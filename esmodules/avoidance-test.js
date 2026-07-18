import { isAvoider } from "./effects.js";
import { MODULE_ID, SLUGS } from "./const.js";
import {
  localizeString,
  debuglog,
  iterateActorsForTokensAndParties,
} from "./main.js";
import { findBaseCoverBonus } from "./cover.js";
import { sendStealthRollToGM } from "./socket.js";

async function rollStealth(
  actor,
  options = { skipDialog: true, secret: true },
) {
  const skill = actor?.skills?.stealth;
  if (!skill) return null;
  const roll = await skill.roll({
    rollMode: "gmroll",
    skipDialog: options.skipDialog,
    createMessage: !options.secret,
    traits: ["secret", "exploration"],
  });
  return roll;
}

function testObserver({ stealth, dc, observer, dosAdjust, cover }) {
  const delta = stealth + cover - dc;
  const baseDos = delta < -9 ? 0 : delta < 0 ? 1 : delta > 9 ? 3 : 2;
  let observation = {
    dc,
    observer,
    delta,
    dos: dosAdjust[baseDos],
    cover,
  };
  return observation;
}

function testAvoiderStealthAgainstObservers({
  avoider,
  stealth,
  dosAdjust,
  observers,
}) {
  const cover = findBaseCoverBonus({ actor: avoider });
  const observations = observers
    .filter((observer) => observer?.system?.perception?.dc)
    .map((observer) => {
      return testObserver({
        stealth,
        dc: observer.system.perception.dc,
        observer,
        dosAdjust,
        cover,
      });
    });
  return observations.sort((a, b) => a.delta - b.delta);
}

const CRIT_FAIL_DOS_ADJUST = [0, 0, 1, 2];
const NO_DOS_ADJUST = [0, 1, 2, 3];
const CRIT_SUCCESS_DOS_ADJUST = [1, 2, 3, 3];

function findDosAdjust(rawRoll) {
  const dosAdjust =
    rawRoll === 1
      ? CRIT_FAIL_DOS_ADJUST
      : rawRoll === 20
        ? CRIT_SUCCESS_DOS_ADJUST
        : NO_DOS_ADJUST;
  return dosAdjust;
}

function testAvoiderAgainstObservers(avoider, roll, observers) {
  const stealth = roll.total;
  const rawRoll = roll.dice[0].total;
  return testAvoiderStealthAgainstObservers({
    avoider,
    stealth,
    dosAdjust: findDosAdjust(rawRoll),
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
    const observation = localizeString(`${MODULE_ID}.avoidanceTest.observed`, {
      observed: summary[0],
    });
    content += `<span class="${MODULE_ID}-observation">${observation}</span>`;
  }
  if (summary[1]) {
    const observation = localizeString(`${MODULE_ID}.avoidanceTest.hidden`, {
      hidden: summary[1],
    });
    content += `<span class="${MODULE_ID}-observation">${observation}</span>`;
  }
  if (summary[2]) {
    const observation = localizeString(`${MODULE_ID}.avoidanceTest.unnoticed`, {
      unnoticed: summary[2],
    });
    content += `<span class="${MODULE_ID}-observation">${observation}</span>`;
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
    `${MODULE_ID}.avoidanceTest.createEncounter`,
  );
  return localizeString(`${MODULE_ID}.avoidanceTest.missingActors`, {
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
        ${localizeString(`${MODULE_ID}.avoidanceTest.createEncounter`)}
      </button>
    </div>`;
  return content;
}

export async function testAvoidance(tokens, secret = false) {
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
  const friendlyAvoiders = friendlyActors.filter((actor) =>
    isAvoider({ actor }),
  );
  const enemyAvoiders = enemyActors.filter((actor) => isAvoider({ actor }));
  const observedEnemies = enemyActors.filter(
    (actor) => !enemyAvoiders.includes(actor),
  );
  const observedFriendlies = friendlyActors.filter(
    (actor) => !friendlyAvoiders.includes(actor),
  );

  // Find the enemy avoiders and friendly observers
  let content = `<div class="${MODULE_ID}-avoidance-test"><h3>${localizeString(`${MODULE_ID}.avoidanceTest.title`)}</h3>`;
  let actions = {
    friendlies: {},
    enemies: {},
    createEncounter: foundry.utils.randomID(),
  };
  let hovers = {};
  let enemyStealth = {};
  if (enemyAvoiders.length > 0) {
    content += `<div class="${MODULE_ID}-enemies" data-visibility="gm">`;
    if (observedEnemies.length > 0) {
      const header = localizeString(
        `${MODULE_ID}.avoidanceTest.observedEnemies`,
      );
      content += `<div class="${MODULE_ID}-observed-enemies">${header}<ul>`;
      for (const actor of observedEnemies) {
        content += `<li>${actor.name}</li>`;
      }
      content += `</ul></div>`;
    }
    for (const avoider of enemyAvoiders) {
      const roll = await rollStealth(avoider);
      const observations = testAvoiderAgainstObservers(
        avoider,
        roll,
        friendlyActors,
      );
      enemyStealth[avoider.id] = {
        total: roll.total,
        dosAdjust:
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
    if (observedFriendlies.length > 0) {
      const friendlyHeader = localizeString(
        `${MODULE_ID}.avoidanceTest.observedFriendlies`,
      );
      content += `<div class="${MODULE_ID}-observed-friendlies">${friendlyHeader}<ul>`;
      for (const actor of observedFriendlies) {
        content += `<li>${actor.name}</li>`;
      }
      content += `</ul></div>`;
    }
    for (const avoider of friendlyAvoiders) {
      friendlyStealth[avoider.id] = { total: null, dosAdjust: null };
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
  const superSecret = secret && !friendlyAvoiders.length;
  await ChatMessage.create({
    content,
    rollmode: "gmroll",
    ...(superSecret ? { whisper: gmIds } : {}),
    flags: {
      [MODULE_ID]: {
        avoidanceTest: {
          secret: superSecret,
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

function getScoutBonus() {
  const bonus = game.actors.party.members.reduce((acc, m) => {
    if (
      !m.system.exploration.some(
        (a) => m.items.get(a)?.system?.slug === SLUGS.scout,
      )
    )
      return acc;
    if (m.items.find((i) => i.system.slug === SLUGS.incredibleScout))
      acc = Math.max(acc, 2);
    if (m.items.find((i) => i.system.slug === SLUGS.scoutDedication))
      acc = Math.max(acc, 2);
    return Math.max(acc, 1);
  }, 0);
  return bonus;
}

async function createEncounter(avoidanceTest) {
  debuglog("createEncounter", { avoidanceTest });
  const combat = !game.combat
    ? await Combat.create({ scene: canvas.scene.id, active: true })
    : game.combat;
  if (
    avoidanceTest.friendlyIds.some(
      (id) => !canvas.tokens.placeables.find((t) => t?.actor?.id === id),
    )
  ) {
    ui.notifications.warn(makeMissingActorsString());
  }
  const scoutBonus = getScoutBonus();
  const combatants = avoidanceTest.enemyIds
    .map((id) => {
      const token = canvas.tokens.placeables.find((t) => t?.actor?.id === id);
      let entry = {
        actorId: id,
        tokenId: token?.id,
        hidden: token?.hidden,
      };
      if (
        id in avoidanceTest.enemyStealth &&
        avoidanceTest.enemyStealth[id]?.total !== null
      ) {
        entry.initiative = avoidanceTest.enemyStealth[id]?.total;
        entry.flags = { [game.system.id]: { initiativeStatistic: "stealth" } };
      }
      return entry;
    })
    .concat(
      avoidanceTest.friendlyIds.map((id) => {
        const token = canvas.tokens.placeables.find((t) => t?.actor?.id === id);
        let entry = {
          actorId: id,
          tokenId: token?.id,
          hidden: token?.hidden,
        };
        if (
          id in avoidanceTest.friendlyStealth &&
          avoidanceTest.friendlyStealth[id]?.total !== null
        ) {
          const stealthEntry = avoidanceTest.friendlyStealth[id];
          entry.initiative = stealthEntry?.total;
          if (scoutBonus) {
            const message = game.messages.get(stealthEntry?.rollMessageId);
            const modifiers = message.flags[game.system.id]?.modifiers;
            const circumstance =
              modifiers?.find((m) => m.slug === SLUGS.circumstanceBonus)
                ?.modifier || 0;
            if (scoutBonus > circumstance)
              entry.initiative += scoutBonus - circumstance;
          }
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

async function rollClick({ message, event, avoidanceTest, actionId }) {
  debuglog("rollClick", { message, event, avoidanceTest, actionId });
  const actorId = avoidanceTest.actions.friendlies[actionId]?.actorId;
  if (avoidanceTest.friendlyStealth[actorId]?.total !== null) return;
  const actor = game.actors.get(actorId);
  if (!actor) return;
  if (!game.user.isGM && !actor.isOwner) return;
  const skipDialog = event.shiftKey === game.user.settings.showCheckDialogs;
  let roll = null;
  let rollMessageId = null;
  if (avoidanceTest.secret) {
    roll = await rollStealth(actor, {
      skipDialog,
      secret: true,
    });
  } else {
    Hooks.once("createChatMessage", (msg) => {
      if (msg.rolls?.length && msg.speakerActor?.id === actor.id)
        rollMessageId = msg.id;
    });
    roll = await rollStealth(actor, {
      skipDialog,
      secret: false,
    });
  }
  sendStealthRollToGM({
    messageId: message.id,
    actionId,
    stealth: roll.total,
    dosAdjust: findDosAdjust(roll.dice[0].total),
    rollMessageId,
  });
}

export async function onStealthReply({
  messageId,
  actionId,
  stealth,
  dosAdjust,
  rollMessageId,
}) {
  debuglog("onStealthReply", {
    messageId,
    actionId,
    stealth,
    dosAdjust,
    rollMessageId,
  });
  const message = game.messages.get(messageId);
  if (!message) return;
  const avoidanceTest = message.flags[MODULE_ID]?.avoidanceTest;
  if (!avoidanceTest) return;
  // debuglog("message,avoidanceTest", { message, avoidanceTest });
  const friendly = avoidanceTest.actions.friendlies[actionId];
  if (!friendly) return;
  const avoiderId = friendly.actorId;
  const avoider = game.actors.get(avoiderId);
  if (!avoider) return;
  const enemyActors = avoidanceTest.enemyIds.map((id) => game.actors.get(id));
  const observations = testAvoiderStealthAgainstObservers({
    avoider,
    stealth,
    dosAdjust,
    observers: enemyActors,
  });
  avoidanceTest.friendlyStealth[friendly.actorId] = {
    total: stealth,
    dosAdjust,
    rollMessageId,
  };
  const analysis = analyzeObservations(observations, avoidanceTest.hovers);
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
  const allRolled = Object.values(avoidanceTest.friendlyStealth).every(
    (s) => s.total !== null,
  );
  if (allRolled) {
    const encounterSection = buildEncounterSection({
      friendlyActors: avoidanceTest.friendlyIds.map((id) =>
        game.actors.get(id),
      ),
      actions: avoidanceTest.actions,
    });
    html.body.insertAdjacentHTML("beforeend", encounterSection);
  }
  const content = html.body.innerHTML;
  await message.update({
    content: content,
    flags: {
      [MODULE_ID]: { avoidanceTest },
    },
  });
}

async function clickHandler(message, event, avoidanceTest) {
  debuglog("clickHandler", { message, event, avoidanceTest });
  const button = event.target.closest(`button[data-action-id]`);
  if (button) {
    event.preventDefault();
    const actionId = button.dataset.actionId;
    if (actionId === avoidanceTest.actions.createEncounter) {
      if (game.user.isGM) await createEncounter(avoidanceTest);
    }
    return;
  }
  const icon = event.target.closest(`i[data-action-id]`);
  if (icon) {
    event.preventDefault();
    const actionId = icon.dataset.actionId;
    await rollClick({ message, event, avoidanceTest, actionId });
    return;
  }
}

function attachHover(html, el, avoidanceTest) {
  const hoverId = el.dataset.hoverId;
  const hover = avoidanceTest.hovers[hoverId];
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
  const avoidanceTest = message.flags[MODULE_ID]?.avoidanceTest;
  if (!avoidanceTest) return;
  debuglog("renderChatMessageHTML", { message, html, data, avoidanceTest });

  html.addEventListener(
    "click",
    async (event) => await clickHandler(message, event, avoidanceTest),
  );

  // Deal with the hover elements
  const selected = html.querySelectorAll(
    `.${MODULE_ID}-avoidance-test [data-hover-id]`,
  );
  for (const el of selected) {
    attachHover(html, el, avoidanceTest);
  }
});
