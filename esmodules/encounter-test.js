import { isAvoider } from "./menu.js";
import { MODULE_ID } from "./const.js";
import { localizeString, debuglog, iterateTokensAndParties } from "./main.js";

async function rollStealth(token) {
  const actor = token.actor;
  const skill = actor?.skills?.stealth;
  const roll = skill.roll({
    rollMode: "selfroll",
    skipDialog: true,
    createMessage: false,
    traits: ["secret", "exploration"],
  });
  debuglog("rollStealth", { token, actor, skill, roll });
  return roll;
}

export async function encounterTest(tokens) {
  // Get our list of friendly and enemy tokens
  let friendlies = [];
  await iterateTokensAndParties(tokens, async (token) => {
    if (token.document.disposition === 1) {
      if (!friendlies.includes(token)) friendlies.push(token);
    }
  });
  const enemies = tokens.filter((token) => token.document.disposition === -1);

  // Find the friendly avoiders and enemies
  const friendlyAvoiders = friendlies.filter((token) => isAvoider(token));
  const enemyAvoiders = enemies.filter((token) => isAvoider(token));
  let friendlyStealth = {};
  let enemyStealth = {};

  // Build interaction buttons for friendly avoiders
  let actions = { friendly: {} };
  let content = `<div class="${MODULE_ID}-encounter-test">${localizeString(`${MODULE_ID}.encounter.title`)}</div>`;
  content += `<div class="friendlies">`;
  for (const token of friendlyAvoiders) {
    const actionId = foundry.utils.randomID();
    actions.friendly[actionId] = { tokenId: token.id };
    const roll = await rollStealth(token);
    friendlyStealth[token.id] = roll;
    content += `
      <div class="friendly">
        <span class="name">${token.name}</span>
        <span class="roll">${roll.total}</span>
      </div>`;
    // <div class=${MODULE_ID}-pc>
    //   <span class="name">${token.name}</span>
    //   <button class="${MODULE_ID}-button" data-action-id="${actionId}" data-module="${MODULE_ID}">${token.name}</button>
  }
  content += `</div>`;

  // Find the enemy avoiders and friendly observers

  content += `<div class="enemies" data-visibility="gm">`;
  const actionId = foundry.utils.randomID();
  actions[actionId] = [];
  for (const token of enemyAvoiders) {
    const roll = await rollStealth(token);
    enemyStealth[token.id] = roll.total;
    content += `
      <div class="enemy">
        <span class="name">${token.name}</span>
        <span class="roll">${roll.total}</span>
      </div>`;
  }
  // content += `
  //   <div class="${MODULE_ID}-npc-roll">
  //     <button class="avoid-notice-npcs" data-action-id="${actionId}" data-module="${MODULE_ID}">
  //       ${localizeString(`${MODULE_ID}.encounter.npcs`)}
  //     </button>
  //   </div>`;

  await ChatMessage.create({
    content,
    rollmode: "gmroll",
    flags: {
      [MODULE_ID]: {
        encounterTest: {
          actions,
          enemyIds: enemies.map((token) => token.id),
          partyIds: friendlies.map((token) => token.id),
        },
      },
    },
  });
}

Hooks.on("renderChatMessageHTML", (message, html, data) => {
  const encounterTest = message.flags[MODULE_ID]?.encounterTest;
  if (!encounterTest) return;
  debuglog("renderChatMessageHTML", { message, html, data, encounterTest });
  // const selected = html.querySelectorAll(
  //   `.${MODULE_ID}-button, .avoid-notice-npcs`,
  // );
});
