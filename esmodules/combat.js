import { MODULE_ID, COMPENDIUM_IDS } from "./const.js";
import { log, interpolateString, getVisibilityHandler } from "./main.js";
import { getVisionerApi, updateVisioner } from "./visioner.js";
import {
  PF2E_PERCEPTION_ID,
  getPerceptionApi,
  updatePerception,
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

Hooks.once("init", () => {
  Hooks.on("combatStart", async (encounter, ...args) => {
    const visibilityHandler = getVisibilityHandler();
    const perceptionApi =
      visibilityHandler === "perception" ? getPerceptionApi() : null;
    const perceptiveApi =
      visibilityHandler === "perceptive" ? getPerceptiveApi() : null;
    const visionerApi =
      visibilityHandler === "visioner" ? getVisionerApi() : null;
    const useUnnoticed =
      !visionerApi && game.settings.get(MODULE_ID, "useUnnoticed");
    const revealTokens = game.settings.get(MODULE_ID, "removeGmHidden");
    const raiseShields = game.settings.get(MODULE_ID, "raiseShields");
    const rage = game.settings.get(MODULE_ID, "rage");
    const computeCover =
      perceptionApi && game.settings.get(MODULE_ID, "computeCover");
    const requireActivity = game.settings.get(MODULE_ID, "requireActivity");
    let nonAvoidingPcs = [];

    const beforeV13 = Number(game.version.split()[0]) < 13;

    let avoiders = encounter.combatants.contents.filter(
      (c) =>
        !(c.actor?.parties?.size > 0 && c.actor.system?.exploration) &&
        c.flags.pf2e.initiativeStatistic === "stealth",
    );
    const pcs = encounter.combatants.contents.filter(
      (c) => c.actor?.parties?.size > 0 && c.actor.system?.exploration,
    );
    if (!requireActivity) {
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

    if (raiseShields) {
      await raiseDefendingShields(pcs);
    }

    if (rage) {
      await enrageBarbarians(pcs);
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

    let perceptionChanges = {};
    for (const avoider of avoiders) {
      // log("avoider", avoider);

      const initiativeRoll = avoider.initiative;
      const dosDelta = initiativeRoll == 1 ? -1 : initiativeRoll == 20 ? 1 : 0;

      // Only check against non-allies
      const disposition = avoider.token.disposition;
      const nonAllies = encounter.combatants.contents
        .filter((c) => c.token.disposition != disposition)
        .concat(familiars.filter((t) => t.disposition != disposition))
        .concat(eidolons.filter((t) => t.disposition != disposition));
      if (!nonAllies.length) continue;

      // Now extract some details about the avoider
      const isAvoiderToken = beforeV13
        ? avoider.token instanceof Token
        : avoider.token instanceof foundry.canvas.placeables.Token;
      const avoiderTokenDoc = isAvoiderToken
        ? avoider.token.document
        : avoider.token;
      const coverEffect = avoiderTokenDoc.actor.items.find(
        (i) => i.system.slug === "effect-cover",
      );
      const bonusElement = coverEffect?.flags.pf2e.rulesSelections.cover.bonus;
      let baseCoverBonus = 0;
      switch (bonusElement) {
        case 2:
        case 4:
          baseCoverBonus = bonusElement;
          break;
      }

      perceptionChanges[avoiderTokenDoc.id] = {};
      let perceptionUpdate = perceptionChanges[avoiderTokenDoc.id];
      let messageData = {};
      let results = {};
      const perceptionData = perceptionApi
        ? avoiderTokenDoc?.flags?.[PF2E_PERCEPTION_ID]?.data
        : undefined;
      for (const other of nonAllies) {
        const isOtherToken = beforeV13
          ? other?.token instanceof Token
          : other?.token instanceof foundry.canvas.placeables.Token;
        const otherTokenDoc = isOtherToken
          ? other.token.document
          : (other?.token ?? other);
        const otherToken = other?.token ?? other;
        const otherActor = otherToken.actor;
        if (otherActor.type === "hazard") continue;

        let target = {
          dc: otherActor.system.perception.dc,
          name: otherTokenDoc.name,
          id: otherToken.id,
          doc: otherTokenDoc,
        };

        // We give priority to Perception's view of cover over the base cover effect
        let coverBonus = baseCoverBonus;
        if (perceptionApi) {
          const cover = computeCover
            ? perceptionApi.token.getCover(
                avoider.token._object,
                otherToken._object,
              )
            : perceptionData?.[otherToken.id]?.cover;

          switch (cover) {
            case "standard":
              coverBonus = 2;
              break;
            case "greater":
              coverBonus = 4;
              break;
            default:
              coverBonus = 0;
              break;
          }
        }

        if (coverBonus) {
          const oldDelta = avoider.initiative - target.dc;
          target.oldDelta = oldDelta < 0 ? `${oldDelta}` : `+${oldDelta}`;
          switch (coverBonus) {
            case 2:
              target.tooltip = `${game.i18n.localize(`${MODULE_ID}.standardCover`)}: +2`;
              break;
            case 4:
              target.tooltip = `${game.i18n.localize(`${MODULE_ID}.greaterCover`)}: +4`;
              break;
          }
        }

        // Handle critical failing to win at stealth
        const delta = avoider.initiative + coverBonus - target.dc;
        const dos =
          dosDelta + (delta < -9 ? 0 : delta < 0 ? 1 : delta < 9 ? 2 : 3);
        if (dos < 1) {
          target.result = "observed";
          target.delta = `${delta}`;
        }

        // Normal fail is hidden
        else if (dos < 2) {
          const visibility = "hidden";
          target.result = visibility;
          target.delta = `${delta}`;
        }

        // avoider beat the other token at the stealth battle
        else {
          let visibility = "undetected";
          target.delta = `+${delta}`;
          if (useUnnoticed && avoider.initiative > other?.initiative) {
            visibility = "unnoticed";
          }
          target.result = visibility;
        }

        if (!(target.result in results)) {
          results[target.result] = [target];
        } else {
          results[target.result].push(target);
        }

        // Add a new category if necessary, and put this other token's result in the message data
        if (!(target.result in messageData)) {
          const id = COMPENDIUM_IDS[target.result];
          const pack = "pf2e.conditionitems";
          const text = game.i18n.localize(
            `PF2E.condition.${target.result}.name`,
          );
          const title = `
          <a class="content-link" draggable="true" data-link data-uuid="Compendium.${pack}.Item.${id}" data-id="${id}" data-type="Item" data-pack="${pack}">
            <i class="fa-solid fa-face-zany"></i>
            ${text}
          </a>`;
          messageData[target.result] = {
            title,
            resultClass: delta >= 0 ? "success" : "failure",
            targets: [target],
          };
        } else {
          messageData[target.result].targets.push(target);
        }
      }

      // Find the last card with a check roll matching initiative for the avoider
      // continue;
      let initiativeMessage = await findInitiativeCard(avoider);
      let content = interpolateString(
        game.i18n.localize("pf2e-avoid-notice.activity"),
        {
          activity: game.i18n.localize(
            "PF2E.TravelSpeed.ExplorationActivities.AvoidNotice",
          ),
          actor: avoider.actor.name,
        },
      );
      if (initiativeMessage) {
        content = renderInitiativeDice(initiativeMessage.rolls[0]) + content;
      } else {
        log("card for", avoider);
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
          updateConditionVsBestDc(avoider, results);
          break;
        case "worst":
          updateConditionVsWorstDc(avoider, results);
          break;
        case "perceptive":
          await updatePerceptive({
            perceptiveApi,
            avoider,
            avoiderTokenDoc,
            initiativeMessage,
            results,
          });
          break;
        case "perception":
          await updatePerception({ perceptionData, results, perceptionUpdate });
          break;
        case "visioner":
          await updateVisioner({ visionerApi, avoider, results });
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
          for (const target of status.targets) {
            content += `
                  <tr>
                    <td id="${MODULE_ID}-name">${target.name}</td>`;
            if (target.oldDelta) {
              content += `
                    <td id="${MODULE_ID}-delta">
                      <span><s>${target.oldDelta}</s></span>
                      <span data-tooltip="<div>${target.tooltip}</div>"> <b>${target.delta}</b></span>
                    </td>`;
            } else {
              content += `
                    <td id="${MODULE_ID}-delta">${target.delta}</td>`;
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
      for (const id in perceptionChanges) {
        const update = perceptionChanges[id];
        if (Object.keys(update).length)
          tokenUpdates.push({ _id: id, ...update });
      }
    }

    // Reveal GM-hidden combatants so that their sneak results can control visibility
    if (revealTokens) {
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

    if (visionerApi && "refreshEveryonesPerception" in visionerApi)
      visionerApi.refreshEveryonesPerception();
  });
});
