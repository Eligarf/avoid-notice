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
  if (!skill) return null;
  const roll = skill.roll({
    rollMode: "selfroll",
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
  return observations.sort((a, b) => a.delta - b.delta);
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
      hovers[hoverId] = { actor: spotter.observer.id };
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
  let actions = {
    friendlies: {},
    enemies: {},
    createEncounter: foundry.utils.randomID(),
  };
  let hovers = {};
  let enemyStealth = {};
  if (enemyAvoiders.length > 0) {
    content += `<div class="${MODULE_ID}-enemies" data-visibility="gm">`;
    for (const avoider of enemyAvoiders) {
      const roll = await rollStealth(avoider);
      const observations = testAvoiderAgainstObservers(
        avoider,
        roll,
        friendlyActors,
      );
      enemyStealth[avoider.id] = { total: roll.total };
      const hoverId = foundry.utils.randomID();
      hovers[hoverId] = { actor: avoider.id };
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
    for (const avoider of friendlyAvoiders) {
      const roll = await rollStealth(avoider);
      const observations = testAvoiderAgainstObservers(
        avoider,
        roll,
        enemyActors,
      );
      friendlyStealth[avoider.id] = { total: roll.total };
      const hoverId = foundry.utils.randomID();
      const actionId = foundry.utils.randomID();
      actions.friendlies[actionId] = { id: avoider.id };
      hovers[hoverId] = { actor: avoider.id };
      content += `
      <hr>
      <div class="${MODULE_ID}-friendly" data-actor-id="${avoider.id}">
        <span class="${MODULE_ID}-name" data-hover-id="${hoverId}">${avoider.name}</span>
        <i class="fa-solid fa-dice-d20"></i>
        <span class="${MODULE_ID}-roll" data-visibility="gm" data-action-id="${actionId}">${roll.total}</span>
        <ul class="${MODULE_ID}-observations" data-visibility="gm">`;
      content += analyzeObservations(observations, hovers);
      content += `</ul></div>`;
    }
    content += `</div>`;
  }

  content += `
    <div class="${MODULE_ID}-encounter" data-visibility="gm">`;
  const missing = friendlyActors.filter(
    (actor) =>
      !canvas.tokens.placeables.find((token) => token.actor?.id === actor.id),
  );
  if (friendlyActors.length > 0 && missing.length > 0) {
    content += `<div class="${MODULE_ID}-missing">${localizeString(
      `${MODULE_ID}.avoidanceCheck.missingActors`,
      {
        clownCar: localizeString("PF2E.Actor.Party.ClownCar.Deposit"),
        createEncounter: localizeString(
          `${MODULE_ID}.avoidanceCheck.createEncounter`,
        ),
      },
    )}</div>`;
  }
  content += `
    <button class="${MODULE_ID}-create">
        ${localizeString(`${MODULE_ID}.avoidanceCheck.createEncounter`)}
      </button>`;
  content += `</div>`;
  content += `</div>`;

  const gmIds = game.users.filter((u) => u.isGM).map((u) => u.id);
  await ChatMessage.create({
    content,
    rollmode: "gmroll",
    ...(!friendlyAvoiders.length ? { whisper: gmIds } : {}),
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

Hooks.on("renderChatMessageHTML", (message, html, data) => {
  const checkAvoidance = message.flags[MODULE_ID]?.checkAvoidance;
  if (!checkAvoidance) return;
  // debuglog("renderChatMessageHTML", { message, html, data, checkAvoidance });

  const selected = html.querySelectorAll(
    `.${MODULE_ID}-avoidance-check [data-hover-id]`,
  );
  if (selected.length === 0) return;

  for (const el of selected) {
    const hoverId = el.dataset.hoverId;
    const hover = checkAvoidance.hovers[hoverId];
    if (!hover) continue;
    const actorId = hover.actor;

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
});
