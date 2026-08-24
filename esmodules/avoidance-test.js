import { isAvoider } from "./effects.js";
import { MODULE_ID, SLUGS } from "./const.js";
import { localizeString, debuglog, iterateTokensAndParties } from "./main.js";
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
  const cover = findBaseCoverBonus({ actor: avoider?.actor ?? avoider });
  const observations = observers
    .filter((observer) => {
      const actor = observer?.actor ?? observer;
      return actor?.system?.perception?.dc;
    })
    .map((observer) => {
      const actor = observer?.actor ?? observer;
      return testObserver({
        stealth,
        dc: actor.system.perception.dc,
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
  const rawRoll =
    roll.dice.length > 0 ? roll.dice[0].total : Number(roll.options.dice);
  return testAvoiderStealthAgainstObservers({
    avoider: avoider?.actor ?? avoider,
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
      hovers[hoverId] = { combatantId: spotter.observer.id };
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

function getToken(id) {
  let token = canvas.tokens.get(id);
  if (!token) {
    token = canvas.tokens.placeables.find((t) => t?.actor?.id === id);
  }
  return token;
}

function buildEncounterSection({ friendlies, actions }) {
  let content = `
    <div class="${MODULE_ID}-encounter" data-visibility="gm">`;
  const missing = friendlies.filter((f) => !getToken(f.id));
  if (friendlies.length > 0 && missing.length > 0) {
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
  const friendlyTokens = tokens.filter((t) => t.document.disposition === 1);
  const enemyTokens = tokens.filter((t) => t.document.disposition !== 1);

  // Grab the actors these represent, walking through the party token if necessary
  let friendlies = [];
  await iterateTokensAndParties(friendlyTokens, async (combatant) => {
    if (!friendlies.includes(combatant)) friendlies.push(combatant);
  });

  // Find the friendly avoiders and enemies
  const friendlyAvoiders = friendlies.filter((f) => isAvoider(f));
  const enemyAvoiders = enemyTokens.filter((t) => isAvoider(t));
  const observedEnemies = enemyTokens.filter((t) => !enemyAvoiders.includes(t));
  const observedFriendlies = friendlies.filter(
    (f) => !friendlyAvoiders.includes(f),
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
      for (const token of observedEnemies) {
        content += `<li>${token.name}</li>`;
      }
      content += `</ul></div>`;
    }
    for (const avoider of enemyAvoiders) {
      const roll = await rollStealth(avoider.actor);
      const observations = testAvoiderAgainstObservers(
        avoider,
        roll,
        friendlies,
      );
      const rawRoll =
        roll.dice.length > 0 ? roll.dice[0].total : Number(roll.options.dice);
      enemyStealth[avoider.id] = {
        total: roll.total,
        dosAdjust: rawRoll === 1 ? -1 : rawRoll === 20 ? 1 : 0,
      };
      const hoverId = foundry.utils.randomID();
      hovers[hoverId] = { combatantId: avoider.id };
      content += `
      <hr>
      <div class="${MODULE_ID}-enemy" data-combatant-id="${avoider.id}">
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
      for (const combatant of observedFriendlies) {
        content += `<li>${combatant.name}</li>`;
      }
      content += `</ul></div>`;
    }
    for (const avoider of friendlyAvoiders) {
      friendlyStealth[avoider.id] = { total: null, dosAdjust: null };
      const hoverId = foundry.utils.randomID();
      const actionId = foundry.utils.randomID();
      actions.friendlies[actionId] = { combatantId: avoider.id };
      hovers[hoverId] = { combatant: avoider.id };
      content += `
      <hr>
      <div class="${MODULE_ID}-friendly" data-combatant-id="${avoider.id}">
        <span class="${MODULE_ID}-name" data-hover-id="${hoverId}">${avoider.name}</span>
        <i class="fa-solid fa-dice-d20" data-action-id="${actionId}"></i>
        <span class="${MODULE_ID}-roll" data-visibility="gm"></span>
        <ul class="${MODULE_ID}-observations" data-visibility="gm"></ul>
      </div>`;
    }
    content += `</div>`;
  } else {
    content += buildEncounterSection({
      friendlies: friendlies.map((f) => f?.actor ?? f),
      actions,
    });
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
          enemyIds: enemyTokens.map((t) => t.id),
          enemyStealth: enemyStealth ?? {},
          friendlyIds: friendlies.map((c) => c.id),
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
  if (avoidanceTest.friendlyIds.some((id) => !getToken(id))) {
    ui.notifications.warn(makeMissingActorsString());
  }
  const scoutBonus = getScoutBonus();
  const combatants = avoidanceTest.enemyIds
    .map((id) => {
      const token = canvas.tokens.get(id);
      let entry = {
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
        const token = getToken(id);
        let entry = {
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
        !combat.combatants.find((existing) => existing.tokenId === c.tokenId),
    );
  debuglog("combatants", { combatants });
  await combat.createEmbeddedDocuments("Combatant", combatants);
  await ui.combat.render(true);
}

async function rollClick({ message, event, avoidanceTest, actionId }) {
  debuglog("rollClick", { message, event, avoidanceTest, actionId });
  const combatantId = avoidanceTest.actions.friendlies[actionId]?.combatantId;
  if (avoidanceTest.friendlyStealth[combatantId]?.total !== null) return;
  const actor =
    canvas.tokens.get(combatantId)?.actor ?? game.actors.get(combatantId);
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
    globalThis.Hooks.once("createChatMessage", (msg) => {
      if (msg.rolls?.length && msg.speakerActor?.id === actor.id)
        rollMessageId = msg.id;
    });
    roll = await rollStealth(actor, {
      skipDialog,
      secret: false,
    });
  }
  const rawRoll =
    roll.dice.length > 0 ? roll.dice[0].total : Number(roll.options.dice);
  sendStealthRollToGM({
    messageId: message.id,
    actionId,
    stealth: roll.total,
    dosAdjust: findDosAdjust(rawRoll),
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
  debuglog("message,avoidanceTest", { message, avoidanceTest });
  const friendly = avoidanceTest.actions.friendlies[actionId];
  if (!friendly) return;
  const avoiderId = friendly.combatantId;
  let avoider =
    canvas.tokens.get(avoiderId)?.actor ?? game.actors.get(avoiderId);
  if (!avoider) return;
  const enemyTokens = avoidanceTest.enemyIds.map((id) => canvas.tokens.get(id));
  const observations = testAvoiderStealthAgainstObservers({
    avoider,
    stealth,
    dosAdjust,
    observers: enemyTokens,
  });
  avoidanceTest.friendlyStealth[avoiderId] = {
    total: stealth,
    dosAdjust,
    rollMessageId,
  };
  const analysis = analyzeObservations(observations, avoidanceTest.hovers);
  const parser = new DOMParser();
  const html = parser.parseFromString(message.content, "text/html");
  const friendlyEl = html.querySelector(
    `.${MODULE_ID}-friendly[data-combatant-id="${avoiderId}"]`,
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
      friendlies: avoidanceTest.friendlyIds.map(
        (id) => canvas.tokens.get(id) ?? game.actors.get(id),
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
  const combatantId = hover.combatantId;

  let pendingEnter = false;
  let canvasReadyCb = null;

  const doHoverIn = () => {
    const token = getToken(combatantId);
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
    globalThis.Hooks.once("canvasReady", canvasReadyCb);
  };

  const onLeave = () => {
    pendingEnter = false;
    if (canvasReadyCb) {
      globalThis.Hooks.off("canvasReady", canvasReadyCb);
      canvasReadyCb = null;
    }
    if (canvas?.ready) {
      const token = getToken(combatantId);
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
            globalThis.Hooks.off("canvasReady", canvasReadyCb);
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

globalThis.Hooks.on("renderChatMessageHTML", (message, html, data) => {
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
