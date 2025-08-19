import { log, interpolateString } from "./main.js";

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
        m.flags?.pf2e?.modifierName ===
          combatant.flags?.pf2e?.initiativeStatistic &&
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
