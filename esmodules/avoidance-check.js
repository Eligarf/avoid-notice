import { isAvoider } from "./menu.js";
import { MODULE_ID } from "./const.js";
import {
  localizeString,
  debuglog,
  iterateActorsForTokensAndParties,
} from "./main.js";
import { findBaseCoverBonus } from "./cover.js";
import { sendStealthRollToGM } from "./socket.js";

async function rollStealth(actor, options = { skipDialog: true }) {
  const skill = actor?.skills?.stealth;
  if (!skill) return null;
  const roll = skill.roll({
    rollMode: "gmroll",
    skipDialog: options.skipDialog,
    createMessage: false,
    traits: ["secret", "exploration"],
  });
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

function testAvoiderStealthAgainstObservers({
  avoider,
  stealth,
  dosDelta,
  observers,
}) {
  const cover = findBaseCoverBonus({ actor: avoider });
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
  return observations.sort((a, b) => a.delta - b.delta);
}

function testAvoiderAgainstObservers(avoider, roll, observers) {
  const stealth = roll.total;
  const rawRoll = roll.dice[0].total;
  const dosDelta = rawRoll === 1 ? -1 : rawRoll === 20 ? 1 : 0;
  return testAvoiderStealthAgainstObservers({
    avoider,
    stealth,
    dosDelta,
    observers,
  });
}

function analyzeObservations(observations, hovers) {
  const summary = observations.reduce((acc, obs) => {
    const dos = obs.dos > 2 ? 2 : obs.dos;
    acc[dos] = (acc[dos] || 0) + 1;
    return acc;
  }, {});

  let content = `<li class="${MODULE_ID}-summary">`;
  if (summary[0]) {
    const observation = localizeString(`${MODULE_ID}.avoidanceCheck.observed`, {
      observed: summary[0],
    });
    content += `<span class="${MODULE_ID}-observed">${observation}</span>`;
  }
  if (summary[1]) {
    const observation = localizeString(`${MODULE_ID}.avoidanceCheck.hidden`, {
      hidden: summary[1],
    });
    content += `<span class="${MODULE_ID}-hidden">${observation}</span>`;
  }
  if (summary[2]) {
    const observation = localizeString(
      `${MODULE_ID}.avoidanceCheck.unnoticed`,
      {
        unnoticed: summary[2],
      },
    );
    content += `<span class="${MODULE_ID}-unnoticed">${observation}</span>`;
  }
  content += `</li>`;
  const spotters = observations.reduce((acc, obs) => {
    if (obs.dos > 1) return acc;
    if (acc.length > 1) return acc;
    acc.push(obs);
    return acc;
  }, []);
  if (spotters.length > 0) {
    content += `<li class="${MODULE_ID}-spotters">
      <ul>`;
    for (const spotter of spotters) {
      const hoverId = foundry.utils.randomID();
      hovers[hoverId] = { actorId: spotter.observer.id };
      content += `
        <li>
          <span class="${MODULE_ID}-spotter-delta">${spotter.delta}</span>
          <span class="${MODULE_ID}-spotter" data-hover-id="${hoverId}">${spotter.observer.name}</span>
        </li>`;
    }
    content += `
      </ul>
    </li>`;
  }
  return content;
}

function makeMissingActorsString() {
  const clownCar = localizeString("PF2E.Actor.Party.ClownCar.Deposit");
  const createEncounter = localizeString(
    `${MODULE_ID}.avoidanceCheck.createEncounter`,
  );
  return localizeString(`${MODULE_ID}.avoidanceCheck.missingActors`, {
    clownCar,
    createEncounter,
  });
}

function buildEncounterSection({ friendlyActors, actions }) {
  let content = `
    <div class="${MODULE_ID}-encounter" data-visibility="gm">`;
  const missing = friendlyActors.filter(
    (actor) =>
      !canvas.tokens.placeables.find((token) => token.actor?.id === actor.id),
  );
  if (friendlyActors.length > 0 && missing.length > 0) {
    content += `<div class="${MODULE_ID}-missing">${makeMissingActorsString()}</div>`;
  }
  content += `
      <button class="${MODULE_ID}-create" data-action-id="${actions.createEncounter}" data-visibility="gm">
        ${localizeString(`${MODULE_ID}.avoidanceCheck.createEncounter`)}
      </button>
    </div>`;
  return content;
}

export async function checkAvoidance(tokens, secret = false) {
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
  let actions = {
    friendlies: {},
    enemies: {},
    createEncounter: foundry.utils.randomID(),
  };
  let hovers = {};
  let enemyStealth = {};
  if (enemyAvoiders.length > 0) {
    content += `<div class="${MODULE_ID}-enemies" data-visibility="gm">`;
    const header = localizeString(
      `${MODULE_ID}.avoidanceCheck.observedEnemies`,
    );
    content += `<div class="${MODULE_ID}-observed-enemies">${header}<ul>`;
    for (const actor of enemyActors) {
      if (!enemyAvoiders.includes(actor)) content += `<li>${actor.name}</li>`;
    }
    content += `</ul></div>`;
    for (const avoider of enemyAvoiders) {
      const roll = await rollStealth(avoider);
      const observations = testAvoiderAgainstObservers(
        avoider,
        roll,
        friendlyActors,
      );
      enemyStealth[avoider.id] = {
        total: roll.total,
        dosDelta:
          roll.dice[0].total === 1 ? -1 : roll.dice[0].total === 20 ? 1 : 0,
      };
      const hoverId = foundry.utils.randomID();
      hovers[hoverId] = { actorId: avoider.id };
      content += `
      <hr>
      <div class="${MODULE_ID}-enemy" data-actor-id="${avoider.id}">
        <span class="${MODULE_ID}-name" data-hover-id="${hoverId}">${avoider.name}</span>
        <span class="${MODULE_ID}-roll">${roll.total}</span>
        <ul class="${MODULE_ID}-observations">`;
      content += analyzeObservations(observations, hovers);
      content += `</ul></div>`;
    }
    content += `</div>`;
  }

  // Build interaction buttons for friendly avoiders
  let friendlyStealth = {};
  if (friendlyAvoiders.length > 0) {
    content += `<div class="${MODULE_ID}-friendlies">`;
    const friendlyHeader = localizeString(
      `${MODULE_ID}.avoidanceCheck.observedFriendlies`,
    );
    content += `<div class="${MODULE_ID}-observed-friendlies">${friendlyHeader}<ul>`;
    for (const actor of friendlyActors) {
      if (!friendlyAvoiders.includes(actor))
        content += `<li>${actor.name}</li>`;
    }
    content += `</ul></div>`;
    for (const avoider of friendlyAvoiders) {
      friendlyStealth[avoider.id] = { total: null, dosDelta: null };
      const hoverId = foundry.utils.randomID();
      const actionId = foundry.utils.randomID();
      actions.friendlies[actionId] = { actorId: avoider.id };
      hovers[hoverId] = { actor: avoider.id };
      content += `
      <hr>
      <div class="${MODULE_ID}-friendly" data-actor-id="${avoider.id}">
        <span class="${MODULE_ID}-name" data-hover-id="${hoverId}">${avoider.name}</span>
        <i class="fa-solid fa-dice-d20" data-action-id="${actionId}"></i>
        <span class="${MODULE_ID}-roll" data-visibility="gm"></span>
        <ul class="${MODULE_ID}-observations" data-visibility="gm"></ul>
      </div>`;
    }
    content += `</div>`;
  } else {
    content += buildEncounterSection({ friendlyActors, actions });
  }

  const gmIds = game.users.filter((u) => u.isGM).map((u) => u.id);
  await ChatMessage.create({
    content,
    rollmode: "gmroll",
    ...(secret || !friendlyAvoiders.length ? { whisper: gmIds } : {}),
    flags: {
      [MODULE_ID]: {
        checkAvoidance: {
          actions,
          enemyIds: enemyActors.map((actor) => actor.id),
          enemyStealth: enemyStealth ?? {},
          friendlyIds: friendlyActors.map((actor) => actor.id),
          friendlyStealth: friendlyStealth ?? {},
          hovers,
        },
      },
    },
  });
}

async function createEncounter(checkAvoidance) {
  debuglog("createEncounter", { checkAvoidance });
  const combat = !game.combat
    ? await Combat.create({ scene: canvas.scene.id, active: true })
    : game.combat;
  if (
    checkAvoidance.friendlyIds.some(
      (id) => !canvas.tokens.placeables.find((t) => t?.actor?.id === id),
    )
  ) {
    ui.notifications.warn(makeMissingActorsString());
  }
  const combatants = checkAvoidance.enemyIds
    .map((id) => {
      const token = canvas.tokens.placeables.find((t) => t?.actor?.id === id);
      let entry = {
        actorId: id,
        tokenId: token?.id,
        hidden: token?.hidden,
      };
      if (checkAvoidance.enemyStealth[id]?.total !== null) {
        entry.initiative = checkAvoidance.enemyStealth[id]?.total;
        entry.flags = { [game.system.id]: { initiativeStatistic: "stealth" } };
      }
      return entry;
    })
    .concat(
      checkAvoidance.friendlyIds.map((id) => {
        const token = canvas.tokens.placeables.find((t) => t?.actor?.id === id);
        let entry = {
          actorId: id,
          tokenId: token?.id,
          hidden: token?.hidden,
        };
        if (checkAvoidance.friendlyStealth[id]?.total !== null) {
          entry.initiative = checkAvoidance.enemyStealth[id]?.total;
          entry.flags = {
            [game.system.id]: { initiativeStatistic: "stealth" },
          };
        }
        return entry;
      }),
    )
    .filter(
      (c) =>
        !combat.combatants.find((existing) => existing.actorId === c.actorId),
    )
    .filter((c) => c.tokenId && c.actorId);
  await combat.createEmbeddedDocuments("Combatant", combatants);
  await ui.combat.render(true);
}

async function rollClick({ message, event, checkAvoidance, actionId }) {
  const actorId = checkAvoidance.actions.friendlies[actionId]?.actorId;
  if (checkAvoidance.friendlyStealth[actorId]?.total !== null) return;
  const actor = game.actors.get(actorId);
  if (!actor) return;
  if (!game.user.isGM && !actor.isOwner) return;
  const skipDialog = event.shiftKey === game.user.settings.showCheckDialogs;
  const roll = await rollStealth(actor, { skipDialog });
  sendStealthRollToGM({
    messageId: message.id,
    actionId,
    stealth: roll.total,
    dosDelta: roll.dice[0].total === 1 ? -1 : roll.dice[0].total === 20 ? 1 : 0,
  });
}

export async function onStealthReply({
  messageId,
  actionId,
  stealth,
  dosDelta,
}) {
  // debuglog("onStealthReply", { messageId, actionId, stealth, dosDelta });
  const message = game.messages.get(messageId);
  if (!message) return;
  const checkAvoidance = message.flags[MODULE_ID]?.checkAvoidance;
  if (!checkAvoidance) return;
  // debuglog("message,checkAvoidance", { message, checkAvoidance });
  const friendly = checkAvoidance.actions.friendlies[actionId];
  if (!friendly) return;
  const avoiderId = friendly.actorId;
  const avoider = game.actors.get(avoiderId);
  if (!avoider) return;
  const enemyActors = checkAvoidance.enemyIds.map((id) => game.actors.get(id));
  const observations = testAvoiderStealthAgainstObservers({
    avoider,
    stealth,
    dosDelta,
    observers: enemyActors,
  });
  checkAvoidance.friendlyStealth[friendly.actorId] = {
    total: stealth,
    dosDelta,
  };
  const analysis = analyzeObservations(observations, checkAvoidance.hovers);
  const parser = new DOMParser();
  const html = parser.parseFromString(message.content, "text/html");
  const friendlyEl = html.querySelector(
    `.${MODULE_ID}-friendly[data-actor-id="${avoiderId}"]`,
  );
  if (!friendlyEl) return;
  const ul = friendlyEl.querySelector("ul");
  if (ul) ul.insertAdjacentHTML("beforeend", analysis);
  const rollSpan = friendlyEl.querySelector(`.${MODULE_ID}-roll`);
  if (rollSpan) rollSpan.textContent = stealth;
  const icon = friendlyEl.querySelector(`i[data-action-id="${actionId}"]`);
  if (icon) icon.remove();

  // If this is the last player, then we need to add the encounter section
  // Check if all friendly avoiders have rolled
  const allRolled = Object.values(checkAvoidance.friendlyStealth).every(
    (s) => s.total !== null,
  );
  if (allRolled) {
    const encounterSection = buildEncounterSection({
      friendlyActors: checkAvoidance.friendlyIds.map((id) =>
        game.actors.get(id),
      ),
      actions: checkAvoidance.actions,
    });
    html.body.insertAdjacentHTML("beforeend", encounterSection);
  }
  const content = html.body.innerHTML;
  await message.update({
    content: content,
    flags: {
      [MODULE_ID]: { checkAvoidance },
    },
  });
}

async function clickHandler(message, event, checkAvoidance) {
  // debuglog("clickHandler", { message, event, checkAvoidance });
  const button = event.target.closest(`button[data-action-id]`);
  if (button) {
    event.preventDefault();
    const actionId = button.dataset.actionId;
    if (actionId === checkAvoidance.actions.createEncounter) {
      if (game.user.isGM) await createEncounter(checkAvoidance);
    }
    return;
  }
  const icon = event.target.closest(`i[data-action-id]`);
  if (icon) {
    event.preventDefault();
    const actionId = icon.dataset.actionId;
    await rollClick({ message, event, checkAvoidance, actionId });
    return;
  }
}

function attachHover(html, el, checkAvoidance) {
  const hoverId = el.dataset.hoverId;
  const hover = checkAvoidance.hovers[hoverId];
  if (!hover) return;
  const actorId = hover.actorId;

  let pendingEnter = false;
  let canvasReadyCb = null;

  const doHoverIn = () => {
    const token = canvas.tokens.placeables.find(
      (t) => t?.actor?.id === actorId,
    );
    if (token && typeof token._onHoverIn === "function") {
      token._onHoverIn(new MouseEvent("mouseenter"));
    }
  };

  const onEnter = () => {
    if (canvas?.ready) {
      doHoverIn();
      return;
    }
    pendingEnter = true;
    canvasReadyCb = () => {
      if (pendingEnter) doHoverIn();
      pendingEnter = false;
      canvasReadyCb = null;
    };
    Hooks.once("canvasReady", canvasReadyCb);
  };

  const onLeave = () => {
    pendingEnter = false;
    if (canvasReadyCb) {
      Hooks.off("canvasReady", canvasReadyCb);
      canvasReadyCb = null;
    }
    if (canvas?.ready) {
      const token = canvas.tokens.placeables.find(
        (t) => t?.actor?.id === actorId,
      );
      if (token && typeof token._onHoverOut === "function")
        token._onHoverOut(new MouseEvent("mouseleave"));
    }
  };

  el.addEventListener("mouseenter", onEnter);
  el.addEventListener("mouseleave", onLeave);

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const removed of m.removedNodes) {
        if (removed === el) {
          el.removeEventListener("mouseenter", onEnter);
          el.removeEventListener("mouseleave", onLeave);
          if (canvasReadyCb) {
            Hooks.off("canvasReady", canvasReadyCb);
            canvasReadyCb = null;
          }
          observer.disconnect();
          return;
        }
      }
    }
  });
  observer.observe(html, { childList: true, subtree: true });
}

Hooks.on("renderChatMessageHTML", (message, html, data) => {
  const checkAvoidance = message.flags[MODULE_ID]?.checkAvoidance;
  if (!checkAvoidance) return;
  debuglog("renderChatMessageHTML", { message, html, data, checkAvoidance });

  html.addEventListener(
    "click",
    async (event) => await clickHandler(message, event, checkAvoidance),
  );

  // Deal with the hover elements
  const selected = html.querySelectorAll(
    `.${MODULE_ID}-avoidance-check [data-hover-id]`,
  );
  for (const el of selected) {
    attachHover(html, el, checkAvoidance);
  }
});
