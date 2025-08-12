import { MODULE_ID } from "./const.js";
import { log, getVisibilityHandler, refreshPerception } from "./main.js";
import { getVisionerApi, processObservationsForVisioner } from "./visioner.js";
import {
  getPerceptionApi,
  processObservationsForPerception,
} from "./pf2e_perception.js";
import {
  getPerceptiveApi,
  processObservationsForPerceptive,
} from "./perceptive.js";
import {
  processObservationsForBestDc,
  processObservationsForWorstDc,
} from "./vanilla.js";
import { enrageBarbarians } from "./barbarian.js";
import { raiseDefendingShields } from "./defender.js";
import { modifyInitiativeCard } from "./initiative.js";
import { findBaseCoverBonus } from "./cover.js";
import { clearPartyStealth } from "./clear-stealth.js";
import { makeObservation } from "./observation-logic.js";
import { renderStatus } from "./render-status.js";

Hooks.once("init", () => {
  Hooks.on("combatStart", async (encounter) => {
    const visibilityHandler = getVisibilityHandler();
    const perceptionApi =
      visibilityHandler === "perception" ? getPerceptionApi() : null;
    const perceptiveApi =
      visibilityHandler === "perceptive" ? getPerceptiveApi() : null;
    const visionerApi =
      visibilityHandler === "visioner" ? getVisionerApi() : null;

    const opts = {
      useUnnoticed:
        !visionerApi && game.settings.get(MODULE_ID, "useUnnoticed"),
      computeCover: game.settings.get(MODULE_ID, "computeCover"),
      revealTokens: game.settings.get(MODULE_ID, "removeGmHidden"),
      raiseShields: game.settings.get(MODULE_ID, "raiseShields"),
      requireActivity: game.settings.get(MODULE_ID, "requireActivity"),
      rage: game.settings.get(MODULE_ID, "rage"),
    };

    const beforeV13 = Number(game.version.split()[0]) < 13;

    // Build out the various lists of combatant types
    let nonAvoidingPcs = [];
    let avoiders = encounter.combatants.contents.filter(
      (c) =>
        !(c.actor?.parties?.size > 0 && c.actor.system?.exploration) &&
        c.flags.pf2e.initiativeStatistic === "stealth",
    );
    const pcs = encounter.combatants.contents.filter(
      (c) => c.actor?.parties?.size > 0 && c.actor.system?.exploration,
    );
    if (!opts.requireActivity) {
      avoiders = avoiders.concat(
        pcs.filter((c) => c.flags.pf2e.initiativeStatistic === "stealth"),
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
          c.flags.pf2e.initiativeStatistic === "stealth" &&
          !c.actor.system.exploration.some(
            (a) => c.actor.items.get(a)?.system?.slug === "avoid-notice",
          ),
      );
    }

    const familiars = canvas.scene.tokens
      .filter((t) => t?.actor?.system?.master)
      .filter((t) =>
        encounter.combatants.contents.some(
          (c) => c.actor._id == t.actor.system.master.id,
        ),
      );
    const eidolons = canvas.scene.tokens.filter(
      (t) => t?.actor?.system?.details?.class?.trait === "eidolon",
    );
    const unrevealedIds = encounter.combatants.contents
      .map((c) =>
        (!beforeV13 && c.token instanceof foundry.canvas.placeables.Token) ||
        (beforeV13 && c.token instanceof Token)
          ? c.token.document
          : c.token,
      )
      .filter((t) => t.hidden && t.actor.type !== "hazard")
      .map((t) => t.id);

    // initialize the aggregators
    let observations = {};

    //
    // Walk through all the avoiders and test them against the appropriate observers,
    // recording the results for later batch processing
    //
    for (const avoider of avoiders) {
      // log("avoider", avoider);

      const initiativeRoll = avoider.initiative;
      const initiativeDosDelta =
        initiativeRoll == 1 ? -1 : initiativeRoll == 20 ? 1 : 0;

      // TODO: add a game setting to control checking vs non-allies or all
      const disposition = avoider.token.disposition;
      const others = encounter.combatants.contents
        .filter((c) => c.token.disposition != disposition)
        .concat(familiars.filter((t) => t.disposition != disposition))
        .concat(eidolons.filter((t) => t.disposition != disposition));
      if (!others.length) continue;

      const isAvoiderToken = beforeV13
        ? avoider.token instanceof Token
        : avoider.token instanceof foundry.canvas.placeables.Token;
      const avoiderTokenDoc = isAvoiderToken
        ? avoider.token.document
        : avoider.token;

      const avoiderApi = {
        visionerApi,
        perceptionApi,
        perceptiveApi,
        avoider,
        avoiderTokenDoc,
        baseCoverBonus: findBaseCoverBonus(avoiderTokenDoc),
        initiativeDosDelta,
      };

      observations[avoider.token.id] = { avoiderApi, observers: {} };
      let avoiderSeenBy = observations[avoider.token.id];

      for (const other of others) {
        const isOtherToken = beforeV13
          ? other?.token instanceof Token
          : other?.token instanceof foundry.canvas.placeables.Token;
        const otherToken = other?.token ?? other;
        const otherActor = otherToken.actor;

        // Bail out if we are dealing with a hazard, otherwise make the observation
        if (otherActor.type === "hazard") continue;

        const otherTokenDoc = isOtherToken
          ? other.token.document
          : (other?.token ?? other);
        let observation = makeObservation({
          avoiderApi,
          opts,
          otherToken,
          otherTokenDoc,
          otherActor,
        });

        avoiderSeenBy.observers[observation.observerId] = {
          visibility: observation,
        };
      }
    }

    //
    // All observation calculations have been done at this point. Now we walk through
    // the result structure and build the messages for each affected chat card, as well
    // as the calls we need to do for the visibility manager
    //
    await renderStatus(observations);

    // Raise the shields
    if (opts.raiseShields) {
      await raiseDefendingShields(pcs);
    }

    // Enrage the barbarians
    if (opts.rage) {
      await enrageBarbarians(pcs);
    }

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

    // Reveal GM-hidden combatants so that their sneak results can control visibility
    if (opts.revealTokens) {
      for (const t of unrevealedIds) {
        let update = tokenUpdates.find((u) => u._id === t);
        if (update) {
          update.hidden = false;
        } else {
          tokenUpdates.push({ _id: t, hidden: false });
        }
      }
    }

    // Adjust the avoider's condition
    switch (visibilityHandler) {
      case "best":
        await processObservationsForBestDc(observations);
        break;
      case "worst":
        await processObservationsForWorstDc(observations);
        break;
      case "perceptive":
        await processObservationsForPerceptive(observations);
        break;
      case "perception":
        await processObservationsForPerception(observations);
        break;
      case "visioner":
        await processObservationsForVisioner(observations);
        break;
    }

    // Update all the tokens at once, skipping an empty update
    if (tokenUpdates.length > 0) {
      canvas.scene.updateEmbeddedDocuments("Token", tokenUpdates);
    }

    refreshPerception();

    //   perceptionChanges = {}
    //   perceptionChanges[avoiderTokenDoc.id] = {};
    //   let perceptionUpdate = perceptionChanges[avoiderTokenDoc.id];
    //   let statusResults = {};
    //
    // if (!(observation.result in statusResults)) {
    //   statusResults[observation.result] = [observation];
    // } else {
    //   statusResults[observation.result].push(observation);
    // }
    //
    //
    // }

    // If PF2e-perception is around, move any non-empty changes into an update array
    // if (perceptionApi) {
    //   updatePerceptionChanges(tokenUpdates, perceptionChanges);
    // }
  });

  Hooks.on("deleteCombat", async () => {
    const cleanUp = game.settings.get(
      MODULE_ID,
      "clearPartyStealthAfterCombat",
    );
    if (cleanUp) clearPartyStealth({ showBanner: false });
  });
});
