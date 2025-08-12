import { MODULE_ID, COMPENDIUM_IDS } from "./const.js";
import {
  log,
  interpolateString,
  getVisibilityHandler,
  refreshPerception,
} from "./main.js";
import { getVisionerApi, updateVisioner } from "./visioner.js";
import {
  getPerceptionApi,
  updatePerception,
  updatePerceptionChanges,
} from "./pf2e_perception.js";
import { getPerceptiveApi, updatePerceptive } from "./perceptive.js";
import {
  updateConditionVsBestDc,
  updateConditionVsWorstDc,
} from "./vanilla.js";
import { enrageBarbarians } from "./barbarian.js";
import { raiseDefendingShields } from "./defender.js";
import {
  renderInitiativeDice,
  findInitiativeCard,
  modifyInitiativeCard,
} from "./initiative.js";
import { findBaseCoverBonus } from "./cover.js";
import { clearPartyStealth } from "./clear-stealth.js";
import { makeObservation } from "./observation-logic.js";

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
    let perceptionChanges = {};
    let seenBy = {};

    // Loop over all the avoiders to build up lists of what has to change
    for (const avoider of avoiders) {
      // log("avoider", avoider);

      const initiativeRoll = avoider.initiative;
      const initiativeDosDelta =
        initiativeRoll == 1 ? -1 : initiativeRoll == 20 ? 1 : 0;

      // Only check against non-allies
      // TODO: add a game setting to control this
      const disposition = avoider.token.disposition;
      const others = encounter.combatants.contents
        .filter((c) => c.token.disposition != disposition)
        .concat(familiars.filter((t) => t.disposition != disposition))
        .concat(eidolons.filter((t) => t.disposition != disposition));
      if (!others.length) continue;

      // Now extract some details about the avoider
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

      // make some structures to acrue info into
      let messageData = {};
      let statusResults = {};
      seenBy[avoider.token.id] = { avoider };
      let avoiderSeenBy = seenBy[avoider.token.id];
      perceptionChanges[avoiderTokenDoc.id] = {};
      let perceptionUpdate = perceptionChanges[avoiderTokenDoc.id];

      // Iterate the others and test the observation of each
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

        // put the observation into the accrual containers
        avoiderSeenBy[observation.observerId] = { visibility: observation };
        if (!(observation.result in statusResults)) {
          statusResults[observation.result] = [observation];
        } else {
          statusResults[observation.result].push(observation);
        }

        // Add a new category if necessary, and put this other token's result in the message data
        if (!(observation.result in messageData)) {
          const id = COMPENDIUM_IDS[observation.result];
          const pack = "pf2e.conditionitems";
          const text = game.i18n.localize(
            `PF2E.condition.${observation.result}.name`,
          );
          const title = `
          <a class="content-link" draggable="true" data-link data-uuid="Compendium.${pack}.Item.${id}" data-id="${id}" data-type="Item" data-pack="${pack}">
            <i class="fa-solid fa-face-zany"></i>
            ${text}
          </a>`;
          messageData[observation.result] = {
            title,
            resultClass: observation.success ? "success" : "failure",
            observers: [observation],
          };
        } else {
          messageData[observation.result].observers.push(observation);
        }
      }

      // Find the last card with a check roll matching initiative for the avoider
      // continue;
      let content = interpolateString(
        game.i18n.localize("pf2e-avoid-notice.activity"),
        {
          activity: game.i18n.localize(
            "PF2E.TravelSpeed.ExplorationActivities.AvoidNotice",
          ),
          actor: avoider.actor.name,
        },
      );

      let initiativeMessage = await findInitiativeCard(avoider);
      if (initiativeMessage) {
        content = renderInitiativeDice(initiativeMessage.rolls[0]) + content;
      } else {
        initiativeMessage = await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({
            actor: avoider.actor,
            alias: avoider.token.name,
          }),
        });
      }

      // Adjust the avoider's condition
      switch (visibilityHandler) {
        case "best":
          updateConditionVsBestDc(avoider, statusResults);
          break;
        case "worst":
          updateConditionVsWorstDc(avoider, statusResults);
          break;
        case "perceptive":
          await updatePerceptive({
            avoiderApi,
            initiativeMessage,
            results: statusResults,
          });
          break;
        case "perception":
          await updatePerception({
            avoiderApi,
            results: statusResults,
            perceptionUpdate,
          });
          break;
        case "visioner":
          await updateVisioner({
            avoiderApi,
            results: statusResults,
          });
          break;
      }

      // log(`messageData updates for ${avoiderTokenDoc.name}`, messageData);
      for (const t of ["unnoticed", "undetected", "hidden", "observed"]) {
        const status = messageData[t];
        if (status) {
          content += `
            <div data-visibility="gm">
              ${status.title}
              <table>
                <tbody>`;
          for (const observation of status.observers) {
            content += `
                  <tr>
                    <td id="${MODULE_ID}-name">${observation.name}</td>`;
            if (observation.oldDelta) {
              content += `
                    <td id="${MODULE_ID}-delta">
                      <span><s>${observation.oldDelta}</s></span>
                      <span data-tooltip="<div>${observation.tooltip}</div>"> <b>${observation.delta}</b></span>
                    </td>`;
            } else {
              content += `
                    <td id="${MODULE_ID}-delta">${observation.delta}</td>`;
            }
            content += `
                  </tr>`;
          }
          content += `
                </tbody>
              </table>
            </div>`;
        }
      }

      await initiativeMessage.update({ content });
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

    // If PF2e-perception is around, move any non-empty changes into an update array
    let tokenUpdates = [];
    if (perceptionApi) {
      updatePerceptionChanges(tokenUpdates, perceptionChanges);
    }

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

    // Update all the tokens at once, skipping an empty update
    if (tokenUpdates.length > 0) {
      // log('token updates', tokenUpdates);
      canvas.scene.updateEmbeddedDocuments("Token", tokenUpdates);
    }

    // Raise the shields
    if (opts.raiseShields) {
      await raiseDefendingShields(pcs);
    }

    // Enrage the barbarians
    if (opts.rage) {
      await enrageBarbarians(pcs);
    }

    refreshPerception();
  });

  Hooks.on("deleteCombat", async () => {
    const cleanUp = game.settings.get(
      MODULE_ID,
      "clearPartyStealthAfterCombat",
    );
    if (cleanUp) clearPartyStealth({ showBanner: false });
  });
});
