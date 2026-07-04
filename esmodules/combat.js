import { MODULE_ID } from "./const.js";
import { SETTINGS } from "./settings.js";
import { log, isVisionerActive, refreshPerception } from "./main.js";
import {
  findInitiativeCard,
  modifyInitiativeCard,
  applyInitiativeConditions,
} from "./initiative.js";
import { findBaseCoverBonus } from "./cover.js";
import { clearPartyStealth } from "./stealth.js";
import { makeObservation, evaluateObservation } from "./observation-logic.js";
import { renderStatus } from "./render-status.js";
import { zoomToCombat } from "./socket.js";

Hooks.once("init", () => {
  Hooks.on("combatStart", async (encounter) => {
    if (isVisionerActive()) return;
    const options = {
      useEffects: game.settings.get(MODULE_ID, SETTINGS.useEffects),
      useUnnoticed: game.settings.get(MODULE_ID, SETTINGS.useUnnoticed),
      computeCover: game.settings.get(MODULE_ID, SETTINGS.computeCover),
      revealTokens: game.settings.get(MODULE_ID, SETTINGS.removeGmHidden),
      requireActivity: game.settings.get(MODULE_ID, SETTINGS.requireActivity),
      hideFromAllies: game.settings.get(MODULE_ID, SETTINGS.hideFromAllies),
    };

    // Build out the various lists of combatant types
    let nonAvoidingPcs = [];
    let avoiders = encounter.combatants.contents.filter(
      (c) =>
        !(c.actor?.parties?.size > 0 && c.actor.system?.exploration) &&
        c.flags[game.system.id]?.initiativeStatistic === "stealth",
    );
    const pcs = encounter.combatants.contents.filter(
      (c) => c.actor?.parties?.size > 0 && c.actor.system?.exploration,
    );
    if (!options.requireActivity) {
      avoiders = avoiders.concat(
        pcs.filter(
          (c) => c.flags[game.system.id]?.initiativeStatistic === "stealth",
        ),
      );
    } else {
      avoiders = avoiders.concat(
        pcs.filter((c) =>
          c.actor.system.exploration.some(
            (a) => c.actor.items.get(a)?.system?.slug === "avoid-notice",
          ),
        ),
      );
      nonAvoidingPcs = pcs.filter(
        (c) =>
          c.flags[game.system.id]?.initiativeStatistic === "stealth" &&
          !c.actor.system.exploration.some(
            (a) => c.actor.items.get(a)?.system?.slug === "avoid-notice",
          ),
      );
    }

    const minionTokens = canvas.scene.tokens.filter(
      (t) =>
        t?.actor?.system?.traits?.value?.includes("minion") &&
        t?.actor?.system?.details?.alliance === "party",
    );
    const eidolonTokens = canvas.scene.tokens.filter(
      (t) => t?.actor?.system?.details?.class?.trait === "eidolon",
    );
    // initialize the aggregators
    let observations = {};

    //
    // Walk through all the avoiders and test them against the appropriate observers,
    // recording the results for later batch processing
    //
    for (const avoider of avoiders) {
      // log("avoider", avoider);

      const initiativeCard = await findInitiativeCard(avoider);
      const rolls = initiativeCard?.rolls;
      const dice = rolls?.[0]?.dice;
      const rawRoll = dice?.[0]?.total;
      const initiativeDosDelta = rawRoll === 1 ? -1 : rawRoll === 20 ? 1 : 0;

      const disposition = avoider.token.disposition;
      const observers = encounter.combatants.contents
        .filter(
          (c) =>
            c.token.disposition !== disposition ||
            (options.hideFromAllies && c.id !== avoider.id),
        )
        .concat(
          minionTokens.filter(
            (t) => options.hideFromAllies || t.disposition != disposition,
          ),
        )
        .concat(
          eidolonTokens.filter(
            (t) => options.hideFromAllies || t.disposition != disposition,
          ),
        );
      if (!observers.length) continue;

      const isAvoiderToken =
        avoider.token instanceof foundry.canvas.placeables.Token;
      const avoiderTokenDoc = isAvoiderToken
        ? avoider.token.document
        : avoider.token;

      const avoiderApi = {
        avoider,
        avoiderTokenDoc,
        baseCoverBonus: findBaseCoverBonus(avoiderTokenDoc),
        initiativeDosDelta,
      };

      observations[avoider.token.id] = { avoiderApi, observers: {} };
      let avoiderSeenBy = observations[avoider.token.id];

      for (const observer of observers) {
        const isObserverToken =
          observer?.token instanceof foundry.canvas.placeables.Token;
        const observerToken = observer?.token ?? observer;
        const observerActor = observerToken.actor;

        // Bail out if we are dealing with a hazard, otherwise make the observation
        if (observerActor.type === "hazard") continue;

        const observerTokenDoc = isObserverToken
          ? observer.token.document
          : (observer?.token ?? observer);
        let observation = makeObservation({
          avoiderApi,
          options,
          observer,
          observerToken,
          observerTokenDoc,
          observerActor,
        });

        avoiderSeenBy.observers[observation.observerId] = { observation };
      }
    }

    // Now evaluate each observation
    for (const avoiderId in observations) {
      const { observers } = observations[avoiderId];
      for (const observerId in observers) {
        const observation = observers[observerId].observation;
        evaluateObservation({
          observation,
          options,
          minionTokens,
          eidolonTokens,
        });
      }
    }

    //
    // All observation calculations have been done at this point. Now we walk through
    // the result structure and build the messages for each affected chat card, as well
    // as the calls we need to do for the visibility manager
    //
    if (!game.settings.get(MODULE_ID, SETTINGS.noSummary))
      await renderStatus(observations);

    // Print out the warnings for PCs that aren't using Avoid Notice
    for (const nonAvoider of nonAvoidingPcs) {
      await modifyInitiativeCard({
        combatant: nonAvoider,
        message: game.i18n.localize("pf2e-avoid-notice.requireActivity.error"),
        interpolations: {
          actor: nonAvoider.actor.name,
          action: game.i18n.localize(
            "PF2E.TravelSpeed.ExplorationActivities.AvoidNotice",
          ),
        },
      });
    }

    let tokenUpdates = [];

    // Adjust the avoider's condition
    if (options.useEffects) {
      await applyInitiativeConditions(observations, tokenUpdates);
    }

    // Reveal GM-hidden combatants so that their sneak results can control visibility
    // Do this last to avoid any flashes of observability
    if (options.revealTokens) {
      const pcTokenIds = pcs.map((c) => c.token.id);

      const unrevealedIds = encounter.combatants.contents
        .map((c) =>
          c.token instanceof foundry.canvas.placeables.Token
            ? c.token.document
            : c.token,
        )
        .filter((t) => t.hidden && t.actor.type !== "hazard")
        .map((t) => t.id)
        .filter((avoiderId) => {
          if (!options.useUnnoticed) return true;
          const observers = observations[avoiderId]?.observers;
          return pcTokenIds.some(
            (id) => observers?.[id]?.observation?.visibility !== "unnoticed",
          );
        });

      for (const t of unrevealedIds) {
        let update = tokenUpdates.find((u) => u._id === t);
        if (update) {
          update.hidden = false;
        } else {
          tokenUpdates.push({ _id: t, hidden: false });
        }
      }
    }

    // Update all the tokens at once, skipping an empty update
    if (tokenUpdates.length > 0) {
      canvas.scene.updateEmbeddedDocuments("Token", tokenUpdates);
    }

    zoomToCombat(encounter, observations);
    refreshPerception();
  });

  Hooks.on("deleteCombat", async () => {
    if (isVisionerActive()) return;
    if (!game.user?.isActiveGM) return;
    const cleanUp = game.settings.get(
      MODULE_ID,
      SETTINGS.clearPartyStealthAfterCombat,
    );
    if (cleanUp) clearPartyStealth({ showBanner: false });
  });
});
