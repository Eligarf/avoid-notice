import { adaptStealthEffectToObservers } from "./effects.js";
import { UNDETECTED } from "./const.js";
import { debuglog, interpolateString } from "./utils.js";

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
  for (const avoiderId in observations) {
    const { avoider, observers } = observations[avoiderId];
    const gazers = Object.fromEntries(
      Object.entries(observers)
        .filter(([_, o]) => o.observation.degreeOfSuccess < UNDETECTED)
        .map(([id, o]) => {
          return [
            id,
            {
              visibility: o.observation.visibility,
              signature: o.observation.tokenDoc.actor?.signature,
            },
          ];
        }),
    );
    await adaptStealthEffectToObservers({
      actor: avoider.tokenDoc.actor,
      baselineVisibility: UNDETECTED,
      observers: gazers,
    });
  }
}
