import { isAvoider } from "./menu.js";
import { MODULE_ID } from "./const.js";
import {
  localizeString,
  debuglog,
  iterateActorsForTokensAndParties,
} from "./main.js";
import { findBaseCoverBonus } from "./cover.js";

async function rollStealth(actor, options = { skipDialog: true }) {
  const skill = actor?.skills?.stealth;
  const roll = skill.roll({
    rollMode: "selfroll",
    skipDialog: options.skipDialog,
    createMessage: false,
    traits: ["secret", "exploration"],
  });
  debuglog("rollStealth", { actor, skill, roll });
  return roll;
}

function testAvoidance({ stealth, dc, observer, dosDelta, cover }) {
  const delta = stealth + cover - dc;
  const dos = dosDelta + (delta < -9 ? 0 : delta < 0 ? 1 : delta > 9 ? 3 : 2);
  let observation = {
    dc,
    observer,
    delta,
    dos: dos < 0 ? 0 : dos > 3 ? 3 : dos,
    cover,
  };
  return observation;
}

function testAvoiderAgainstObservers(avoider, roll, observers) {
  const stealth = roll.total;
  const rawRoll = roll.dice[0].total;
  const dosDelta = rawRoll === 1 ? -1 : rawRoll === 20 ? 1 : 0;
  const cover = findBaseCoverBonus(avoider);
  const observations = observers
    .filter((observer) => observer?.system?.perception?.dc)
    .map((observer) => {
      return testAvoidance({
        stealth,
        dc: observer.system.perception.dc,
        observer,
        dosDelta,
        cover,
      });
    });
  return observations;
}

export async function checkAvoidance(tokens) {
  // Get our list of friendly and enemy tokens, walking through the party token if necessary
  const friendlyTokens = tokens.filter(
    (token) => token.document.disposition === 1,
  );
  const enemyTokens = tokens.filter(
    (token) => token.document.disposition !== 1,
  );

  // Grab the actors these represent, walking through the party token if necessary
  let friendlyActors = [];
  await iterateActorsForTokensAndParties(friendlyTokens, async (actor) => {
    if (!friendlyActors.includes(actor)) friendlyActors.push(actor);
  });
  const enemyActors = enemyTokens.map((token) => token?.actor);

  // Find the friendly avoiders and enemies
  const friendlyAvoiders = friendlyActors.filter((actor) => isAvoider(actor));
  const enemyAvoiders = enemyActors.filter((actor) => isAvoider(actor));

  // Find the enemy avoiders and friendly observers
  let content = `<div class="${MODULE_ID}-avoidance-check"><h3>${localizeString(`${MODULE_ID}.avoidanceCheck.title`)}</h3>`;
  content += `<div class="enemies" data-visibility="gm">`;
  let actions = {
    friendlies: {},
    enemies: {},
    createEncounter: foundry.utils.randomID(),
  };
  let hovers = {};
  let enemyStealth = {};
  for (const avoider of enemyAvoiders) {
    const roll = await rollStealth(avoider);
    const observations = testAvoiderAgainstObservers(
      avoider,
      roll,
      enemyActors,
    );
    enemyStealth[avoider.id] = { total: roll.total };
    debuglog("observations", observations);
    const hoverId = foundry.utils.randomID();
    hovers[hoverId] = { id: avoider.id };
    content += `
      <div class="enemy" data-actor-id="${avoider.id}">
        <span class="name" data-hover-id="${hoverId}">${avoider.name}</span>
        <span class="roll">${roll.total}</span>
      </div>`;
  }
  content += `</div>`;
  // content += `
  //   <div class="${MODULE_ID}-npc-roll">
  //     <button class="avoid-notice-npcs" data-action-id="${actions.createEncounter}" data-module="${MODULE_ID}">
  //       ${localizeString(`${MODULE_ID}.er.npcs`)}
  //     </button>
  //   </div>`;

  // Build interaction buttons for friendly avoiders
  content += `<div class="friendlies">`;
  let friendlyStealth = {};
  for (const avoider of friendlyAvoiders) {
    const roll = await rollStealth(avoider);
    const observations = testAvoiderAgainstObservers(
      avoider,
      roll,
      enemyActors,
    );
    friendlyStealth[avoider.id] = { total: roll.total };
    debuglog("observations", observations);
    const hoverId = foundry.utils.randomID();
    const actionId = foundry.utils.randomID();
    actions.friendlies[actionId] = { id: avoider.id };
    hovers[hoverId] = { id: avoider.id };
    content += `
      <div class="friendly" data-actor-id="${avoider.id}">
        <span class="name" data-hover-id="${hoverId}">${avoider.name}</span>
        <span class="roll" data-action-id="${actionId}">${roll.total}</span>
      </div>`;
    // <div class=${MODULE_ID}-pc>
    //   <span class="name">${token.name}</span>
    //   <button class="${MODULE_ID}-button" data-action-id="${actionId}" data-module="${MODULE_ID}">${token.name}</button>
  }
  content += `</div></div>`;

  await ChatMessage.create({
    content,
    rollmode: "gmroll",
    flags: {
      [MODULE_ID]: {
        checkAvoidance: {
          actions,
          enemyIds: enemyActors.map((actor) => actor.id),
          partyIds: friendlyActors.map((actor) => actor.id),
          enemyStealth,
          friendlyStealth,
          hovers,
        },
      },
    },
  });
}

Hooks.on("renderChatMessageHTML", (message, html, data) => {
  const checkAvoidance = message.flags[MODULE_ID]?.checkAvoidance;
  if (!checkAvoidance) return;
  debuglog("renderChatMessageHTML", { message, html, data, checkAvoidance });
  // const selected = html.querySelectorAll(
  //   `.${MODULE_ID}-button, .avoid-notice-npcs`,
  // );
});
