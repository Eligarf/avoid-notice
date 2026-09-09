import { CONDITION_IDS, CONDITION_PACK } from "./const.js";
import { debuglog, interpolateString } from "./main.js";
import { createStealthEffect } from "./effects.js";

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
  let content = "";
  for (const roll in lastMessage.rolls) {
    content += await roll.render();
  }
  content += interpolateString(message, interpolations);
  await lastMessage.update({ content });
}

const EXCEPTIONS = {
  undetected: ["hidden", "observed"],
  hidden: ["observed"],
};

export async function applyInitiativeConditions(observations, tokenUpdates) {
  debuglog("applyInitiativeConditions", { observations, tokenUpdates });
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
    if (rules.length) await createStealthEffect(avoider.actor, rules, flags);
  }
}
