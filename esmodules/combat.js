import {
  MODULE_ID,
  PF2E_PERCEPTION_ID,
  PERCEPTIVE_ID,
  log,
  getPerceptionApi,
  getPerceptiveApi,
} from "./main.js";

function renderInitiativeDice(roll) {
  let content = `
    <div class="dice-roll initiative" data-tooltip-class="pf2e">
      <div class="dice-result">
        <div class="dice-formula">${roll.formula}</div>
        <div class="dice-tooltip">
          <section class="tooltip-part">`;
  for (const die of roll.dice) {
    content += `
            <div class="dice">
              <header class="part-header flexrow">
                <span class="part-formula">${die.formula}</span>
                <span class="part-total">${die.total}</span>
              </header>
              <ol class="dice-rolls">`;
    for (const r of die.results) {
      content += `
                <li class="roll die d${die.faces}">${r.result}</li>`;
    }
    content += `
              </ol>
            </div>`;
  }

  content += `
          </section>
        </div>
        <h4 class="dice-total">${roll.total}</h4>
      </div>
    </div><br>`;
  return content;
}

async function updateConditionStatus({ actor, remove = [], add = "" }) {
  // log('tweakStatus', { actor, remove, add });
  const removals = actor.items
    .filter((i) => i.type === "condition" && remove.includes(i.system.slug))
    .map((i) => i.system.slug);
  for (const c of removals) {
    await actor.toggleCondition(c, { active: false });
  }
  if (!add) return;
  await actor.toggleCondition(add, { active: true });
}

async function updateConditionVsBestDc(avoider, results) {
  if ("observed" in results) {
    await updateConditionStatus({
      actor: avoider.actor,
      remove: ["hidden", "undetected", "unnoticed"],
    });
  } else if ("hidden" in results) {
    await updateConditionStatus({
      actor: avoider.actor,
      remove: ["undetected", "unnoticed"],
      add: "hidden",
    });
  } else if ("undetected" in results) {
    await updateConditionStatus({
      actor: avoider.actor,
      remove: ["hidden", "unnoticed"],
      add: "undetected",
    });
  } else if ("unnoticed" in results) {
    await updateConditionStatus({
      actor: avoider.actor,
      remove: ["hidden", "undetected"],
      add: "unnoticed",
    });
  }
}

async function updateConditionVsWorstDc(avoider, results) {
  if ("unnoticed" in results) {
    await updateConditionStatus({
      actor: avoider.actor,
      remove: ["hidden", "undetected"],
      add: "unnoticed",
    });
  } else if ("undetected" in results) {
    await updateConditionStatus({
      actor: avoider.actor,
      remove: ["hidden", "unnoticed"],
      add: "undetected",
    });
  } else if ("hidden" in results) {
    await updateConditionStatus({
      actor: avoider.actor,
      remove: ["undetected", "unnoticed"],
      add: "hidden",
    });
  } else {
    await updateConditionStatus({
      actor: avoider.actor,
      remove: ["hidden", "undetected", "unnoticed"],
    });
  }
}

async function setPerceptiveCondition(
  perceptiveApi,
  token,
  type,
  dc,
  formula,
  results,
) {
  // log('tellPerceptive', { token, type, dc, formula, results });
  await perceptiveApi.EffectManager.applyStealthEffects(token, {
    Type: type,
    EffectInfos: { RollFormula: formula },
  });
  if ("prepareSpottableToken" in perceptiveApi.PerceptiveFlags) {
    await perceptiveApi.PerceptiveFlags.prepareSpottableToken(
      token,
      { PPDC: -1, APDC: dc, PPDice: dc },
      "observed" in results ? results.observed.map((t) => t.doc) : [],
    );
  } else {
    if ("observed" in results) {
      for (const t of results.observed) {
        await perceptiveApi.PerceptiveFlags.addSpottedby(token, t.doc);
      }
    }
    await perceptiveApi.PerceptiveFlags.setSpottingDCs(token, {
      PPDC: -1,
      APDC: dc,
      PPDice: dc,
    });
  }
}

async function updatePerceptive({
  perceptiveApi,
  avoider,
  avoiderTokenDoc,
  initiativeMessage,
  results,
}) {
  let slug;
  await perceptiveApi.PerceptiveFlags.clearSpottedby(avoiderTokenDoc);
  const dc =
    avoider.actor.type === "hazard"
      ? avoider.actor.system.initiative.dc
      : avoider.actor.system.skills.stealth.dc;

  if ("hidden" in results) {
    await setPerceptiveCondition(
      perceptiveApi,
      avoiderTokenDoc,
      "hide",
      dc,
      initiativeMessage.rolls[0].formula,
      results,
    );
  } else if ("unnoticed" in results) {
    await setPerceptiveCondition(
      perceptiveApi,
      avoiderTokenDoc,
      "sneak",
      dc,
      initiativeMessage.rolls[0].formula,
      results,
    );
  } else if ("undetected" in results) {
    await setPerceptiveCondition(
      perceptiveApi,
      avoiderTokenDoc,
      "sneak",
      dc,
      initiativeMessage.rolls[0].formula,
      results,
    );
  } else {
    await perceptiveApi.EffectManager.removeStealthEffects(avoiderTokenDoc);
  }
}

async function updatePerception({ perceptionData, results, perceptionUpdate }) {
  if ("observed" in results) {
    for (const result of results.observed) {
      if (perceptionData && result.id in perceptionData)
        perceptionUpdate[`flags.${PF2E_PERCEPTION_ID}.data.-=${result.id}`] =
          true;
    }
  }
  for (const visibility of ["hidden", "undetected", "unnoticed"]) {
    if (visibility in results) {
      for (const result of results[visibility]) {
        if (perceptionData?.[result.id]?.visibility !== visibility)
          perceptionUpdate[
            `flags.${PF2E_PERCEPTION_ID}.data.${result.id}.visibility`
          ] = visibility;
      }
    }
  }
}

async function findInitiativeCard(combatant) {
  let messages = game.messages.contents.filter(
    (m) =>
      m.speaker.token === combatant.tokenId && m.flags?.core?.initiativeRoll,
  );
  if (!messages.length) {
    messages = game.messages.contents.filter(
      (m) =>
        m.speaker.token === combatant.tokenId &&
        m.flags?.pf2e?.modifierName ===
          combatant.flags?.pf2e?.initiativeStatistic &&
        m?.rolls?.[0]?.total === combatant.initiative,
    );
  }
  return messages.length ? game.messages.get(messages.pop()._id) : null;
}

function interpolateString(str, interpolations) {
  return str.replace(/\{([A-Za-z0-9_]+)\}/g, (match, key) =>
    interpolations.hasOwnProperty(key) ? interpolations[key] : match,
  );
}

async function modifyInitiativeCard({
  combatant,
  message,
  interpolations = {},
}) {
  const lastMessage = await findInitiativeCard(combatant);
  if (!lastMessage) return;
  let content = renderInitiativeDice(lastMessage.rolls[0]);
  content += interpolateString(message, interpolations);
  await lastMessage.update({ content });
}

async function raiseDefendingShields(pcs) {
  const defenders = pcs.filter((c) =>
    c.actor.system.exploration.some(
      (a) => c.actor.items.get(a)?.system?.slug === "defend",
    ),
  );
  for (const defender of defenders) {
    const heldShield = defender.actor?.heldShield;
    if (!heldShield) {
      await modifyInitiativeCard({
        combatant: defender,
        message: game.i18n.localize(
          "pf2e-avoid-notice.raiseShields.needsHeldShield",
        ),
        interpolations: {
          activity: game.i18n.localize(
            "PF2E.TravelSpeed.ExplorationActivities.Defend",
          ),
          actor: defender.actor.name,
        },
      });
      continue;
    }
    const object = defender?.token?._object;
    if (!object?.control) continue;
    object.control();
    log(`raising ${defender.actor.name}'s shield`);
    await game.pf2e.actions.raiseAShield({ actors: [defender.actor] });
    await modifyInitiativeCard({
      combatant: defender,
      message: game.i18n.localize("pf2e-avoid-notice.activity"),
      interpolations: {
        activity: game.i18n.localize(
          "PF2E.TravelSpeed.ExplorationActivities.Defend",
        ),
        actor: defender.actor.name,
      },
    });
    const fx = defender.actor.itemTypes.effect.find(
      (item) => item.system.slug === "effect-raise-a-shield",
    );
    if (fx) await fx.update({ "system.duration.value": 0 });
  }
}

async function enrageBarbarians(pcs) {
  const barbarians = pcs.filter((c) =>
    c.actor.items.some((i) => i?.system?.slug === "quick-tempered"),
  );
  for (const barbarian of barbarians) {
    const rage = barbarian.actor.items.find(
      (i) => i?.system?.slug === "rage" && i?.system?.selfEffect,
    );
    if (!rage) continue;
    const object = barbarian.token?._object;
    if (!object?.control) continue;
    object.control();
    log(`enraging ${barbarian.actor.name}`);
    await game.pf2e.rollItemMacro(rage.id);
  }
}

const COMPENDIUM_IDS = {
  observed: "1wQY3JYyhMYeeV2G",
  hidden: "iU0fEDdBp3rXpTMC",
  undetected: "VRSef5y1LmL2Hkjf",
  unnoticed: "9evPzg9E6muFcoSk",
};

Hooks.once("init", () => {
  Hooks.on("combatStart", async (encounter, ...args) => {
    const conditionHandler = game.settings.get(MODULE_ID, "conditionHandler");
    const perceptionApi =
      conditionHandler === "perception" ? getPerceptionApi() : null;
    const useUnnoticed = game.settings.get(MODULE_ID, "useUnnoticed");
    const revealTokens = game.settings.get(MODULE_ID, "removeGmHidden");
    const raiseShields = game.settings.get(MODULE_ID, "raiseShields");
    const rage = game.settings.get(MODULE_ID, "rage");
    const computeCover =
      perceptionApi && game.settings.get(MODULE_ID, "computeCover");
    const requireActivity = game.settings.get(MODULE_ID, "requireActivity");
    const perceptiveApi =
      conditionHandler === "perceptive" ? getPerceptiveApi() : null;
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
      switch (conditionHandler) {
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
  });
});
