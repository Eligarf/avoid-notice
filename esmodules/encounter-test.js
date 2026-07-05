import { isAvoider } from "./menu.js";
import { MODULE_ID } from "./const.js";
import { localizeString, debuglog, iterateTokensAndParties } from "./main.js";

export async function encounterTest(tokens) {
  const avoiders = [];
  await iterateTokensAndParties(tokens, async (token) => {
    if (isAvoider(token)) {
      if (!avoiders.includes(token)) avoiders.push(token);
    }
  });

  const friendlyAvoiders = avoiders.filter(
    (token) => token.document.disposition === 1,
  );
  const enemies = tokens.filter((token) => token.document.disposition === -1);

  let content = `<div><h3>${localizeString(`${MODULE_ID}.encounter.name`)}</h3></div>`;
  let actions = { party: {} };
  for (const token of friendlyAvoiders) {
    const actionId = foundry.utils.randomID();
    actions.party[actionId] = { tokenId: token.id };
    content += `<button class="avoid-notice-pc" data-action-id="${actionId}" data-module="${MODULE_ID}">${token.name}</button></br>`;
  }

  const enemyAvoiders = avoiders.filter(
    (token) => token.document.disposition === -1,
  );
  let friendlies = [];
  await iterateTokensAndParties(tokens, async (token) => {
    if (token.document.disposition === 1) {
      if (!friendlies.includes(token)) friendlies.push(token);
    }
  });

  content += `<div data-visibility="gm">`;
  const actionId = foundry.utils.randomID();
  actions[actionId] = [];
  for (const token of enemyAvoiders) {
    actions[actionId].push(token.id);
    content += `${token.name}</br>`;
  }
  content += `<button class="avoid-notice-npcs" data-action-id="${actionId}" data-module="${MODULE_ID}">${localizeString(`${MODULE_ID}.encounter.npcs`)}</button>`;

  const gmIds = game.users.filter((u) => u.isGM).map((u) => u.id);
  await ChatMessage.create({
    content,
    whisper: gmIds,
    rollmode: "gmroll",
    flags: {
      [MODULE_ID]: {
        actions,
        enemyIds: enemyAvoiders.map((token) => token.id),
        partyIds: friendlies.map((token) => token.id),
      },
    },
  });
}

Hooks.on("renderChatMessage", (message, html, data) => {});
