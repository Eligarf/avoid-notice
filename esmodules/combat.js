import { cachedSettings } from "./settings.js";
import {
  findInitiativeCard,
  modifyInitiativeCard,
  applyInitiativeConditions,
} from "./initiative.js";
import { findBaseCoverBonus } from "./cover.js";
import { clearPartyStealth } from "./stealth.js";
import { makeObservation } from "./observation-logic.js";
import { updateInitiativeCards } from "./render-status.js";
import { zoomToCombat } from "./socket.js";
import { avoidNoticeCheck } from "./sneak.js";
import { breakdownRoll, debuglog, refreshPerception } from "./utils.js";
import { MODULE_ID } from "./const.js";

export function findCompanionsOnCanvas() {
  const minionTokens = canvas.scene.tokens.filter(
    (t) =>
      t?.actor?.system?.traits?.value?.includes("minion") &&
      t?.actor?.system?.details?.alliance === "party",
  );
  const eidolonTokens = canvas.scene.tokens.filter(
    (t) => t?.actor?.system?.details?.class?.trait === "eidolon",
  );
  return { minionTokens, eidolonTokens };
}

export function findPossibleObservers({
  encounter,
  avoider,
  minionTokens,
  eidolonTokens,
}) {
  const alliance = avoider.actor?.system?.details?.alliance;
  const tokens = encounter.combatants.contents.map((c) => c.token);
  const them = tokens
    .concat(
      alliance !== "party" || cachedSettings.hideFromAllies ? minionTokens : [],
    )
    .concat(eidolonTokens)
    .filter((t) =>
      cachedSettings.hideFromAllies
        ? t.id !== avoider.id
        : t.actor?.system?.details?.alliance !== alliance,
    )
    .map((t) =>
      t instanceof foundry.canvas.placeables.Token ? t.document : t,
    );

  const us = tokens
    .concat(
      alliance === "party" && !cachedSettings.hideFromAllies
        ? minionTokens
        : [],
    )
    .concat(eidolonTokens)
    .filter(
      (t) =>
        !cachedSettings.hideFromAllies &&
        t.id !== avoider.id &&
        t.actor?.system?.details?.alliance === alliance,
    )
    .map((t) => t.id);
  return { us, them };
}

globalThis.Hooks.once("init", () => {
  globalThis.Hooks.on("combatStart", async (encounter) => {
    debuglog("combatStart", { encounter });
    const avoidanceCheckMessageId =
      encounter.flags[MODULE_ID]?.avoidanceCheckMessageId;
    const avoidanceCheckMessage = avoidanceCheckMessageId
      ? game.messages.get(avoidanceCheckMessageId)
      : null;
    const options = {
      requireActivity: cachedSettings.requireActivity,
      hideFromAllies: cachedSettings.hideFromAllies,
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

    const { minionTokens, eidolonTokens } = findCompanionsOnCanvas();

    // initialize the aggregators
    let observations = {};

    //
    // Walk through all the avoiders and test them against the appropriate observers,
    // recording the results for later batch processing
    //
    for (const avoidingCombatant of avoiders) {
      // log("avoider", avoider);

      const initiativeCard = await findInitiativeCard(avoidingCombatant);
      let rawRollDosDelta = 0;
      if (initiativeCard) {
        ({ rawRollDosDelta } = breakdownRoll(initiativeCard?.rolls?.[0]));
      } else {
        const avoidanceCheck =
          avoidanceCheckMessage?.flags?.[MODULE_ID]?.avoidanceCheck;
        if (avoidanceCheck) {
          const tokenId = avoidingCombatant.token.id;
          if (tokenId in avoidanceCheck.enemyStealth) {
            rawRollDosDelta =
              avoidanceCheck.enemyStealth[tokenId].rawRollDosDelta;
          } else if (tokenId in avoidanceCheck.friendlyStealth) {
            rawRollDosDelta =
              avoidanceCheck.friendlyStealth[tokenId].rawRollDosDelta;
          }
        }
      }

      const { them: observers, us } = findPossibleObservers({
        encounter,
        avoider: avoidingCombatant.token,
        minionTokens,
        eidolonTokens,
      });
      if (!observers.length) continue;

      const isAvoiderToken =
        avoidingCombatant.token instanceof foundry.canvas.placeables.Token;
      const avoiderTokenDoc = isAvoiderToken
        ? avoidingCombatant.token.document
        : avoidingCombatant.token;

      const avoider = {
        tokenDoc: avoiderTokenDoc,
        skillResult: avoidingCombatant.initiative,
        rawRollDosDelta,
        baseCoverBonus: findBaseCoverBonus({ actor: avoidingCombatant.actor }),
        combatant: avoidingCombatant,
      };

      const alliance = avoiderTokenDoc.actor?.system?.details?.alliance;
      const avoiderSeenBy = {
        avoider,
        observers: {},
        allies: alliance === "party" ? us : [],
      };
      observations[avoidingCombatant.token.id] = avoiderSeenBy;

      for (const observerTokenDoc of observers) {
        const observerActor = observerTokenDoc.actor;
        if (observerActor.type === "hazard") continue;
        let observation = makeObservation({
          avoider,
          observer: observerTokenDoc,
          analyze: avoidNoticeCheck,
        });

        avoiderSeenBy.observers[observation.observerId] = { observation };
      }
    }

    //
    // All observation calculations have been done at this point. Now we walk through
    // the result structure and build the messages for each affected chat card, as well
    // as the calls we need to do for the visibility manager
    //
    await updateInitiativeCards(observations);

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
    if (cachedSettings.useEffects) {
      await applyInitiativeConditions(observations, tokenUpdates);
    }

    // Reveal GM-hidden combatants so that their sneak results can control visibility
    // Do this last to avoid any flashes of observability
    const ghostedIds = encounter.combatants.contents
      .map((c) =>
        c.token instanceof foundry.canvas.placeables.Token
          ? c.token.document
          : c.token,
      )
      .filter((t) => t.hidden && t.actor.type !== "hazard")
      .map((t) => t.id);
    for (const t of ghostedIds) {
      let update = tokenUpdates.find((u) => u._id === t);
      if (update) {
        update.hidden = false;
      } else {
        tokenUpdates.push({ _id: t, hidden: false });
      }
    }

    // Update all the tokens at once, skipping an empty update
    if (tokenUpdates.length > 0) {
      canvas.scene.updateEmbeddedDocuments("Token", tokenUpdates);
    }

    zoomToCombat(encounter, observations);
    refreshPerception();
  });

  globalThis.Hooks.on("deleteCombat", async () => {
    if (!game.user?.isActiveGM) return;
    const cleanUp = cachedSettings.clearPartyStealthAfterCombat;
    if (cleanUp) return clearPartyStealth({ showBanner: false });
  });
});
