import { adaptStealthEffectToObservers } from "./effects.js";
import { UNDETECTED, OBSERVED } from "./const.js";
import { debuglog, interpolateString, getToken } from "./utils.js";

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
  return lastMessage.update({ content });
}

export async function applyInitiativeConditions(observations, tokenUpdates) {
  debuglog("applyInitiativeConditions", { observations, tokenUpdates });
  const baselineStealth = UNDETECTED;
  for (const avoiderId in observations) {
    const { avoider, observers, allies } = observations[avoiderId];
    debuglog("applyInitiativeConditions", { avoider, observers, allies });
    const detectors = Object.fromEntries(
      Object.entries(observers)
        .filter(([_, o]) => o.check.stealth < baselineStealth)
        .map(([id, o]) => {
          return [
            id,
            {
              stealth: o.check.stealth,
              signature: o.check.tokenDoc.actor?.signature,
            },
          ];
        })
        .concat(
          allies.map((allyId) => [
            allyId,
            {
              stealth: OBSERVED,
              signature: getToken(allyId)?.actor?.signature,
            },
          ]),
        ),
    );
    await adaptStealthEffectToObservers({
      actor: avoider.tokenDoc.actor,
      baselineStealth,
      detectors,
    });
  }
}
