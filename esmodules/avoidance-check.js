import { isAvoider } from "./effects.js";
import { MODULE_ID, SLUGS, OBSERVED, HIDDEN, UNDETECTED } from "./const.js";
import { findBaseCoverBonus } from "./cover.js";
import { sendStealthRollToGM } from "./socket.js";
import {
  testAvoiderStealthAgainstObservers,
  prepareObservations,
} from "./observation-logic.js";
import { avoidNoticeCheck } from "./sneak.js";
import { prepareTargetList, renderTargetList } from "./render-status.js";
import {
  getToken,
  breakdownRoll,
  debuglog,
  iterateTokensAndParties,
  localizeString,
} from "./utils.js";

async function rollStealth(actor, { skipDialog = true, player = false } = {}) {
  const options = { skipDialog, player };
  const skill = actor?.skills?.stealth;
  if (!skill) return null;
  const roll = await skill.roll({
    rollMode: "gmroll",
    skipDialog: options.skipDialog,
    createMessage: options.player,
    traits: ["secret", "exploration"],
  });
  return roll;
}

function testAvoiderAgainstObservers(avoiderToken, roll, observers) {
  const { rawRollDosDelta } = breakdownRoll(roll);
  const avoider = {
    tokenDoc: avoiderToken?.document ?? avoiderToken,
    roll,
    stealthResult: roll.total,
    rawRollDosDelta,
    baseCoverBonus: findBaseCoverBonus({
      actor: avoiderToken?.actor ?? avoiderToken,
    }),
  };
  return testAvoiderStealthAgainstObservers({
    avoider,
    observers,
    analyze: avoidNoticeCheck,
  });
}

function renderObservations(summary, targetList) {
  let content = `<li class="${MODULE_ID}-summary">`;
  if (summary[OBSERVED]) {
    const observation = localizeString(`${MODULE_ID}.avoidanceTest.observed`, {
      observed: summary[OBSERVED],
    });
    content += `<span class="${MODULE_ID}-observation">${observation}</span>`;
  }
  if (summary[HIDDEN]) {
    const observation = localizeString(`${MODULE_ID}.avoidanceTest.hidden`, {
      hidden: summary[HIDDEN],
    });
    content += `<span class="${MODULE_ID}-observation">${observation}</span>`;
  }
  if (summary[UNDETECTED]) {
    const observation = localizeString(
      `${MODULE_ID}.avoidanceTest.undetected`,
      {
        undetected: summary[UNDETECTED],
      },
    );
    content += `<span class="${MODULE_ID}-observation">${observation}</span>`;
  }
  content += renderTargetList(targetList.slice(0, 2));
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

function renderEncounterSection(avoidanceCheck) {
  let content = `
    <div class="${MODULE_ID}-encounter" data-visibility="gm">`;
  const friendlyIds = avoidanceCheck.friendlyIds ?? [];
  const missing = friendlyIds.filter((id) => !getToken(id));
  if (missing.length > 0) {
    content += `<div class="${MODULE_ID}-missing">${makeMissingActorsString()}</div>`;
  }
  content += `
      <button class="${MODULE_ID}-create" data-action-id="${avoidanceCheck.actions.createEncounter}"
          data-visibility="gm" title="${localizeString(`${MODULE_ID}.avoidanceTest.createEncounterTooltip`)}">
        ${localizeString(`${MODULE_ID}.avoidanceTest.createEncounter`)}
      </button>
    </div>`;
  return content;
}

async function prepareAvoidanceCheckData(tokens) {
  const friendlyTokens = tokens.filter((t) => t.document.disposition === 1);
  const enemyTokens = tokens.filter((t) => t.document.disposition !== 1);

  let friendlies = [];
  const hoverIds = {};
  await iterateTokensAndParties(friendlyTokens, async (combatant) => {
    if (!friendlies.includes(combatant)) friendlies.push(combatant);
  });

  const friendlyAvoiders = friendlies.filter((f) => isAvoider(f));
  const enemyAvoiders = enemyTokens.filter((t) => isAvoider(t));
  const noticableEnemies = enemyTokens
    .filter((t) => !enemyAvoiders.includes(t))
    .map((t) => t.name);
  const noticableFriendlies = friendlies
    .filter((t) => !friendlyAvoiders.includes(t))
    .map((t) => t.name);

  let actions = {
    friendlies: {},
    enemies: {},
    createEncounter: foundry.utils.randomID(),
  };
  let enemyStealth = {};
  if (enemyAvoiders.length > 0) {
    for (const avoider of enemyAvoiders) {
      const roll = await rollStealth(avoider.actor);
      const { rawRollDosDelta } = breakdownRoll(roll);
      const observations = testAvoiderAgainstObservers(
        avoider,
        roll,
        friendlies,
      );

      const hoverId = foundry.utils.randomID();
      hoverIds[hoverId] = avoider.id;
      const { summary, targetList } = prepareObservations(
        observations,
        hoverIds,
      );
      enemyStealth[avoider.id] = {
        name: avoider.name,
        stealthResult: roll.total,
        rawRollDosDelta,
        hoverId,
        summary,
        targetList,
      };
    }
  }

  let friendlyStealth = {};
  if (friendlyAvoiders.length > 0) {
    for (const avoider of friendlyAvoiders) {
      const hoverId = foundry.utils.randomID();
      const actionId = foundry.utils.randomID();
      actions.friendlies[actionId] = { combatantId: avoider.id };
      hoverIds[hoverId] = avoider.id;
      friendlyStealth[avoider.id] = {
        name: avoider.name,
        stealthResult: null,
        rawRollDosDelta: null,
        hoverId,
        actionId,
      };
    }
  }

  const avoidanceCheckData = {
    actions,
    noticableEnemies: noticableEnemies,
    enemyIds: enemyTokens.map((t) => t.id),
    enemyStealth: enemyStealth ?? {},
    noticableFriendlies: noticableFriendlies,
    friendlyIds: friendlies.map((c) => c.id),
    friendlyStealth: friendlyStealth ?? {},
  };
  return { avoidanceCheckData, hoverIds };
}

function renderAvoidanceCheck(avoidanceCheck) {
  debuglog("renderAvoidanceCheck", { avoidanceCheck });
  let content = `
    <div class="${MODULE_ID}-avoidance-check">
      <h3>${localizeString(`${MODULE_ID}.avoidanceTest.title`)}</h3>`;
  const enemyIds = avoidanceCheck.enemyIds;
  if (enemyIds.length > 0) {
    content += `
      <div class="${MODULE_ID}-enemies" data-visibility="gm">`;
    const noticableEnemies = avoidanceCheck.noticableEnemies;
    if (noticableEnemies?.length > 0) {
      content += `
          <div class="${MODULE_ID}-observed-enemies">
            ${localizeString(`${MODULE_ID}.avoidanceTest.observedEnemies`)}
            <div class="${MODULE_ID}-noticables">`;
      for (const name of noticableEnemies) {
        content += `<span>${name}</span>`;
      }
      content += `
            </div>
          </div>`;
    }

    const enemyAvoiders = avoidanceCheck.enemyStealth;
    for (const [tokenId, avoider] of Object.entries(enemyAvoiders)) {
      content += `
          <hr>
          <div class="${MODULE_ID}-enemies">
            <div class="${MODULE_ID}-avoider" data-combatant-id="${tokenId}" data-hover-id="${avoider.hoverId}">
              <div class="${MODULE_ID}-description">
                <div class="${MODULE_ID}-name">${avoider.name}</div>
                <span>${localizeString(`${MODULE_ID}.avoidanceTest.checkLabel`)}</span>
                <div class="${MODULE_ID}-roll">${avoider.stealthResult}</div>
              </div>
              <div class="${MODULE_ID}-observations">`;
      content += renderObservations(avoider.summary, avoider.targetList);
      content += `
              </div>
            </div>
          </div>`;
    }
    content += `</div>`;
  }

  // Build interaction buttons for friendly avoiders
  const friendlyIds = avoidanceCheck.friendlyIds;
  if (friendlyIds.length > 0) {
    content += `
          <div class="${MODULE_ID}-friendlies">`;
    const noticableFriendlies = avoidanceCheck.noticableFriendlies;
    if (noticableFriendlies.length > 0) {
      content += `
            <div class="${MODULE_ID}-observed-friendlies">
              ${localizeString(`${MODULE_ID}.avoidanceTest.observedFriendlies`)}
              <div class="${MODULE_ID}-noticables">`;
      for (const name of noticableFriendlies) {
        content += `<li>${name}</li>`;
      }
      content += `
              </div>
            </div>`;
    }
    const friendlyAvoiders = avoidanceCheck.friendlyStealth;
    for (const [tokenId, avoider] of Object.entries(friendlyAvoiders)) {
      content += `
            <hr>
            <div class="${MODULE_ID}-friendlies">
              <div class="${MODULE_ID}-avoider" data-combatant-id="${tokenId}" data-hover-id="${avoider.hoverId}">
                <div class="${MODULE_ID}-description">
                  <div class="${MODULE_ID}-name">${avoider.name}</div>
                  <span>${localizeString(`${MODULE_ID}.avoidanceTest.checkLabel`)}</span>`;
      if (avoider.stealthResult === null) {
        content += `
                  <i class="fa-solid fa-dice-d20" data-action-id="${avoider.actionId}"></i>`;
      } else {
        content += `
                  <div class="${MODULE_ID}-roll" data-visibility="gm">${avoider.stealthResult}</div>`;
      }
      content += `
                </div>
                <div class="${MODULE_ID}-observations" data-visibility="gm">`;
      if (avoider.stealthResult !== null) {
        content += renderObservations(avoider.summary, avoider.targetList);
      }
      content += `
                </div>
              </div>
            </div>`;
    }
    content += `</div>`;
  }

  const unrolled = Object.values(avoidanceCheck.friendlyStealth).some(
    (s) => s.stealthResult === null,
  );
  if (!unrolled) {
    content += renderEncounterSection(avoidanceCheck);
  }
  return content;
}

export async function avoidanceCheck(tokens) {
  const gmIds = game.users.filter((u) => u.isGM).map((u) => u.id);
  const { avoidanceCheckData, hoverIds } =
    await prepareAvoidanceCheckData(tokens);
  const secret = !avoidanceCheckData.friendlyIds.length;
  avoidanceCheckData.secret = secret;
  await ChatMessage.create({
    rollmode: "gmroll",
    ...(secret ? { whisper: gmIds } : {}),
    flags: {
      [MODULE_ID]: {
        card: "avoidance-check",
        hoverIds: hoverIds,
        avoidanceTest: avoidanceCheckData,
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

async function createEncounter(avoidanceTest, message) {
  debuglog("createEncounter", { avoidanceTest, message });
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
        avoidanceTest.enemyStealth[id]?.stealthResult !== null
      ) {
        entry.initiative = avoidanceTest.enemyStealth[id]?.stealthResult;
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
          avoidanceTest.friendlyStealth[id]?.stealthResult !== null
        ) {
          const stealthEntry = avoidanceTest.friendlyStealth[id];
          entry.initiative = stealthEntry?.stealthResult;
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
  await combat.update({
    flags: { [MODULE_ID]: { avoidanceCheckMessageId: message.id } },
  });
  await ui.combat.render(true);
}

async function rollClick({ message, event, avoidanceTest, actionId }) {
  debuglog("rollClick", { message, event, avoidanceTest, actionId });
  const combatantId = avoidanceTest.actions.friendlies[actionId]?.combatantId;
  if (avoidanceTest.friendlyStealth[combatantId]?.stealthResult !== null)
    return;
  const actor =
    canvas.tokens.get(combatantId)?.actor ?? game.actors.get(combatantId);
  if (!actor) return;
  if (!game.user.isGM && !actor.isOwner) return;
  let roll = null;
  let rollMessageId = null;
  if (avoidanceTest.secret) {
    roll = await rollStealth(actor, {
      skipDialog: true,
      player: false,
    });
  } else {
    const skipDialog = event.shiftKey === game.user.settings.showCheckDialogs;
    globalThis.Hooks.once("createChatMessage", (msg) => {
      if (msg.rolls?.length && msg.speakerActor?.id === actor.id)
        rollMessageId = msg.id;
    });
    roll = await rollStealth(actor, {
      skipDialog,
      player: true,
    });
  }
  const { rawRollDosDelta } = breakdownRoll(roll);
  sendStealthRollToGM({
    messageId: message.id,
    actionId,
    stealthResult: roll.total,
    rawRollDosDelta,
    rollMessageId,
  });
}

export async function onStealthReply({
  messageId,
  actionId,
  stealthResult,
  rawRollDosDelta,
  rollMessageId,
}) {
  debuglog("onStealthReply", {
    messageId,
    actionId,
    stealthResult,
    rawRollDosDelta,
    rollMessageId,
  });
  const message = game.messages.get(messageId);
  if (!message) return;
  const flags = message.flags[MODULE_ID];
  if (!flags) return;
  const avoidanceTest = flags.avoidanceTest;
  if (!avoidanceTest) return;
  const friendly = avoidanceTest.actions.friendlies[actionId];
  if (!friendly) return;
  const avoiderId = friendly.combatantId;
  let avoiderToken = canvas.tokens.get(avoiderId);
  if (!avoiderToken) return;
  const avoider = {
    tokenDoc: avoiderToken?.document ?? avoiderToken,
    stealthResult,
    rawRollDosDelta,
    baseCoverBonus: findBaseCoverBonus({
      actor: avoiderToken?.actor,
    }),
  };
  const enemyTokens = avoidanceTest.enemyIds.map((id) => canvas.tokens.get(id));
  const observations = testAvoiderStealthAgainstObservers({
    avoider,
    observers: enemyTokens,
    analyze: avoidNoticeCheck,
  });
  const { summary, targetList } = prepareObservations(
    observations,
    flags.hoverIds,
  );
  const avoiderData = avoidanceTest.friendlyStealth[avoiderId];
  avoiderData.stealthResult = stealthResult;
  avoiderData.rawRollDosDelta = rawRollDosDelta;
  avoiderData.summary = summary;
  avoiderData.targetList = targetList;
  avoiderData.rollMessageId = rollMessageId;
  const update = {
    flags: {
      [MODULE_ID]: flags,
    },
  };
  await message.update(update);
}

async function clickHandler(message, event, avoidanceTest) {
  debuglog("clickHandler", { message, event, avoidanceTest });
  const button = event.target.closest(`button[data-action-id]`);
  if (button) {
    event.preventDefault();
    const actionId = button.dataset.actionId;
    if (actionId === avoidanceTest.actions.createEncounter) {
      if (game.user.isGM) await createEncounter(avoidanceTest, message);
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

function renderAvoidanceCheckCardGuts(message, html, _data, flags) {
  const content = renderAvoidanceCheck(flags.avoidanceTest);
  html.insertAdjacentHTML("beforeend", content);
  html.addEventListener(
    "click",
    async (event) => await clickHandler(message, event, flags.avoidanceTest),
  );
}

export function renderAvoidanceCheckCard(message, html, _data, flags) {
  if (canvas.ready) {
    renderAvoidanceCheckCardGuts(message, html, _data, flags);
  } else {
    Hooks.once("canvasReady", () => {
      renderAvoidanceCheckCardGuts(message, html, _data, flags);
    });
  }
}
