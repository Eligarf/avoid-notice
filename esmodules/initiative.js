import { debuglog, interpolateString } from "./main.js";
import { adaptStealthEffectToObservers } from "./effects.js";

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

export async function applyInitiativeConditions(observations, tokenUpdates) {
  debuglog("applyInitiativeConditions", { observations, tokenUpdates });
  for (const avoiderId in observations) {
    const { avoiderApi, observers } = observations[avoiderId];
    const avoider = avoiderApi.avoider;
    const gazers = Object.fromEntries(
      Object.entries(observers)
        .filter(([_, o]) => o.observation.degreeOfSuccess < 2)
        .map(([id, o]) => [
          id,
          {
            dos: o.observation.degreeOfSuccess,
            signature: o.observation.observer.actor?.signature,
          },
        ]),
    );
    await adaptStealthEffectToObservers({
      actor: avoider.actor,
      baseline: 2,
      observers: gazers,
    });
  }
}
