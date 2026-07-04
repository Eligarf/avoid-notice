import { CONDITION_IDS, CONDITION_PACK, MODULE_ID } from "./const.js";
import { log, interpolateString } from "./main.js";
import { createStealthEffect } from "./effects.js";

export function renderInitiativeDice(roll) {
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

export async function findInitiativeCard(combatant) {
  let messages = game.messages.contents.filter(
    (m) =>
      m.speaker.token === combatant.tokenId && m.flags?.core?.initiativeRoll,
  );
  if (!messages.length) {
    messages = game.messages.contents.filter(
      (m) =>
        m.speaker.token === combatant.tokenId &&
        m.flags?.[game.system.id]?.modifierName ===
          combatant.flags?.[game.system.id]?.initiativeStatistic &&
        m?.rolls?.[0]?.total === combatant.initiative,
    );
  }
  return messages.length ? game.messages.get(messages.pop()._id) : null;
}

export async function modifyInitiativeCard({
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

const EXCEPTIONS = {
  unnoticed: ["hidden", "observed", "undetected"],
  undetected: ["hidden", "observed"],
  hidden: ["observed"],
};

export async function applyInitiativeConditions(observations, tokenUpdates) {
  log("applyInitiativeConditions", { observations, tokenUpdates });
  let results = {};
  for (const avoiderId in observations) {
    const { avoiderApi, observers } = observations[avoiderId];
    const avoider = avoiderApi.avoider;

    // walk through all the observers and group their observations by result
    let result = {};
    for (const observerId in observers) {
      const observation = observers[observerId].observation;

      if (!(observation.visibility in result)) {
        result[observation.visibility] = {
          observers: [observation],
        };
      } else {
        result[observation.visibility].observers.push(observation);
      }
    }

    let flags = {};
    let rules = [];
    flags = {};

    // Each visibility result gets a condition and possibly a list of exceptions for observers that saw a better result
    for (const visibility in result) {
      if (visibility === "observed") continue;

      rules.push({
        key: "GrantItem",
        uuid: `Compendium.${CONDITION_PACK}.Item.${CONDITION_IDS[visibility]}`,
      });

      let flag = [];
      for (const c of EXCEPTIONS[visibility] || []) {
        if (c in result) {
          flag.push(result[c].observers.map((o) => o.observerId));
        }
      }
      if (flag.length) {
        flags[visibility] = { exceptFor: flag.flat() };
      }
    }

    // If no rules to apply, nothing to do for this avoider
    if (!rules.length) continue;

    // Now we need to create an effect and apply the flags and rules to it.
    await createStealthEffect(avoider.actor, rules, flags);
  }
}
