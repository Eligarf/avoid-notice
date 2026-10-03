import { isAvoider } from "./effects.js";
import { MODULE_ID, SLUGS, OBSERVED, HIDDEN, UNDETECTED } from "./const.js";
import { findBaseCoverBonus } from "./cover.js";
import { sendStealthRollToGM } from "./socket.js";
import {
  testAvoiderStealthAgainstObservers,
  prepareObservations,
} from "./observation-logic.js";
import { avoidNoticeCheck } from "./sneak.js";
import { renderTargetList } from "./render-status.js";
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
    skillResult: roll.total,
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
    const observation = localizeString(`${MODULE_ID}.avoidanceCheck.observed`, {
      observed: summary[OBSERVED],
    });
    content += `<span class="${MODULE_ID}-observation">${observation}</span>`;
  }
  if (summary[HIDDEN]) {
    const observation = localizeString(`${MODULE_ID}.avoidanceCheck.hidden`, {
      hidden: summary[HIDDEN],
    });
    content += `<span class="${MODULE_ID}-observation">${observation}</span>`;
  }
  if (summary[UNDETECTED]) {
    const observation = localizeString(
      `${MODULE_ID}.avoidanceCheck.undetected`,
      {
        undetected: summary[UNDETECTED],
      },
    );
    content += `<span class="${MODULE_ID}-observation">${observation}</span>`;
  }
  content += renderTargetList(targetList.slice(0, 2), context);
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

function renderEncounterSection(avoidanceCheck, context) {
  let content = `
    <div class="${MODULE_ID}-encounter" data-visibility="gm">`;
  const friendlyIds = avoidanceCheck.friendlyIds ?? [];
  const missing = friendlyIds.filter((id) => !getToken(id));
  if (missing.length > 0) {
    content += `<div class="${MODULE_ID}-missing">${makeMissingActorsString()}</div>`;
  } else if (!avoidanceCheck.addedToCombat) {
    const clickId = foundry.utils.randomID();
    (context["clickIds"] ??= {})[clickId] = createEncounter;
    content += `
      <button class="${MODULE_ID}-create" data-click-id="${clickId}"
          data-visibility="gm" title="${localizeString(`${MODULE_ID}.avoidanceCheck.createEncounterTooltip`)}">
        ${localizeString(`${MODULE_ID}.avoidanceCheck.createEncounter`)}
      </button>`;
  }
  content += "</div>";
  return content;
}

async function prepareAvoidanceCheckData(tokens) {
  const friendlyTokens = tokens.filter((t) => t.document.disposition === 1);
  const enemyTokens = tokens.filter((t) => t.document.disposition !== 1);

  let friendlies = [];
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

      const { summary, targetList } = prepareObservations(observations);
      enemyStealth[avoider.id] = {
        name: avoider.name,
        skillResult: roll.total,
        rawRollDosDelta,
        summary,
        targetList,
      };
    }
  }

  let friendlyStealth = {};
  if (friendlyAvoiders.length > 0) {
    for (const avoider of friendlyAvoiders) {
      friendlyStealth[avoider.id] = {
        name: avoider.name,
        skillResult: null,
        rawRollDosDelta: null,
      };
    }
  }

  const avoidanceCheckData = {
    addedToCombat: false,
    noticableEnemies: noticableEnemies,
    enemyIds: enemyTokens.map((t) => t.id),
    enemyStealth: enemyStealth ?? {},
    noticableFriendlies: noticableFriendlies,
    friendlyIds: friendlies.map((c) => c.id),
    friendlyStealth: friendlyStealth ?? {},
  };
  return avoidanceCheckData;
}

function renderAvoidanceCheck(avoidanceCheck, context) {
  let content = `
    <div class="${MODULE_ID}-avoidance-check">
      <h3>${localizeString(`${MODULE_ID}.avoidanceCheck.title`)}</h3>`;
  const enemyIds = avoidanceCheck.enemyIds;
  if (enemyIds.length > 0) {
    content += `
      <div class="${MODULE_ID}-enemies" data-visibility="gm">`;
    const noticableEnemies = avoidanceCheck.noticableEnemies;
    if (noticableEnemies?.length > 0) {
      content += `
          <div class="${MODULE_ID}-observed-enemies">
            ${localizeString(`${MODULE_ID}.avoidanceCheck.observedEnemies`)}
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
      const hoverId = foundry.utils.randomID();
      (context["hoverIds"] ??= {})[hoverId] = tokenId;
      content += `
          <hr>
          <div class="${MODULE_ID}-enemies">
            <div class="${MODULE_ID}-avoider" data-combatant-id="${tokenId}" data-hover-id="${hoverId}">
              <div class="${MODULE_ID}-description">
                <div class="${MODULE_ID}-name">${avoider.name}</div>
                <span>${localizeString(`${MODULE_ID}.avoidanceCheck.checkLabel`)}</span>
                <div class="${MODULE_ID}-roll">${avoider.skillResult}</div>
              </div>
              <div class="${MODULE_ID}-observations">`;
      content += renderObservations(
        avoider.summary,
        avoider.targetList,
        context,
      );
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
              ${localizeString(`${MODULE_ID}.avoidanceCheck.observedFriendlies`)}
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
      const hoverId = foundry.utils.randomID();
      (context["hoverIds"] ??= {})[hoverId] = tokenId;
      content += `
            <hr>
            <div class="${MODULE_ID}-friendlies">
              <div class="${MODULE_ID}-avoider" data-combatant-id="${tokenId}" data-hover-id="${hoverId}">
                <div class="${MODULE_ID}-description">
                  <div class="${MODULE_ID}-name">${avoider.name}</div>
                  <span>${localizeString(`${MODULE_ID}.avoidanceCheck.checkLabel`)}</span>`;
      if (avoider.skillResult === null) {
        const clickId = foundry.utils.randomID();
        (context["clickIds"] ??= {})[clickId] = async (
          message,
          event,
          flags,
        ) => {
          return rollClick(message, event, flags.avoidanceCheck, tokenId);
        };
        content += `
                  <i class="fa-solid fa-dice-d20" data-click-id="${clickId}"></i>`;
      } else {
        content += `
                  <div class="${MODULE_ID}-roll" data-visibility="gm">${avoider.skillResult}</div>`;
      }
      content += `
                </div>
                <div class="${MODULE_ID}-observations" data-visibility="gm">`;
      if (avoider.skillResult !== null) {
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
    (s) => s.skillResult === null,
  );
  if (!unrolled) {
    content += renderEncounterSection(avoidanceCheck, context);
  }
  return content;
}

export async function avoidanceCheck(tokens) {
  const gmIds = game.users.filter((u) => u.isGM).map((u) => u.id);
  const avoidanceCheckData = await prepareAvoidanceCheckData(tokens);
  const secret = !avoidanceCheckData.friendlyIds.length;
  avoidanceCheckData.secret = secret;
  await ChatMessage.create({
    rollmode: "gmroll",
    ...(secret ? { whisper: gmIds } : {}),
    flags: {
      [MODULE_ID]: {
        card: "avoidance-check",
        avoidanceCheck: avoidanceCheckData,
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

async function createEncounter(message, event, flags) {
  debuglog("createEncounter", { message, event, flags });
  const avoidanceCheck = flags.avoidanceCheck;
  const combat = !game.combat
    ? await Combat.create({ scene: canvas.scene.id, active: true })
    : game.combat;
  if (avoidanceCheck.friendlyIds.some((id) => !getToken(id))) {
    ui.notifications.warn(makeMissingActorsString());
  }
  const scoutBonus = getScoutBonus();
  const combatants = avoidanceCheck.enemyIds
    .map((id) => {
      const token = canvas.tokens.get(id);
      let entry = {
        tokenId: token?.id,
        hidden: token?.hidden,
      };
      if (
        id in avoidanceCheck.enemyStealth &&
        avoidanceCheck.enemyStealth[id]?.skillResult !== null
      ) {
        entry.initiative = avoidanceCheck.enemyStealth[id]?.skillResult;
        entry.flags = { [game.system.id]: { initiativeStatistic: "stealth" } };
      }
      return entry;
    })
    .concat(
      avoidanceCheck.friendlyIds.map((id) => {
        const token = getToken(id);
        let entry = {
          tokenId: token?.id,
          hidden: token?.hidden,
        };
        if (
          id in avoidanceCheck.friendlyStealth &&
          avoidanceCheck.friendlyStealth[id]?.skillResult !== null
        ) {
          const stealthEntry = avoidanceCheck.friendlyStealth[id];
          entry.initiative = stealthEntry?.skillResult;
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
  await combat.createEmbeddedDocuments("Combatant", combatants);
  await combat.update({
    flags: { [MODULE_ID]: { avoidanceCheckMessageId: message.id } },
  });
  avoidanceCheck.addedToCombat = true;
  message.update({ flags: { [MODULE_ID]: flags } });
  await ui.combat.render(true);
}

async function rollClick(message, event, avoidanceCheck, tokenId) {
  debuglog("rollClick", { message, event, avoidanceCheck, tokenId });
  if (avoidanceCheck.friendlyStealth[tokenId]?.skillResult !== null) return;
  const actor = canvas.tokens.get(tokenId)?.actor ?? game.actors.get(tokenId);
  if (!actor) return;
  if (!game.user.isGM && !actor.isOwner) return;
  let roll = null;
  let rollMessageId = null;
  if (avoidanceCheck.secret) {
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
  return sendStealthRollToGM({
    messageId: message.id,
    tokenId,
    skillResult: roll.total,
    rawRollDosDelta,
    rollMessageId,
  });
}

export async function onStealthReply({
  messageId,
  tokenId,
  skillResult,
  rawRollDosDelta,
  rollMessageId,
}) {
  debuglog("onStealthReply", {
    messageId,
    tokenId,
    skillResult,
    rawRollDosDelta,
    rollMessageId,
  });
  const message = game.messages.get(messageId);
  if (!message) return;
  const flags = message.flags[MODULE_ID];
  if (!flags) return;
  const avoidanceCheck = flags.avoidanceCheck;
  if (!avoidanceCheck) return;
  let avoiderToken = canvas.tokens.get(tokenId);
  if (!avoiderToken) return;
  const avoider = {
    tokenDoc: avoiderToken?.document ?? avoiderToken,
    skillResult,
    rawRollDosDelta,
    baseCoverBonus: findBaseCoverBonus({
      actor: avoiderToken?.actor,
    }),
  };
  const enemyTokens = avoidanceCheck.enemyIds.map((id) =>
    canvas.tokens.get(id),
  );
  const observations = testAvoiderStealthAgainstObservers({
    avoider,
    observers: enemyTokens,
    analyze: avoidNoticeCheck,
  });
  const { summary, targetList } = prepareObservations(observations);
  const avoiderData = avoidanceCheck.friendlyStealth[tokenId];
  avoiderData.skillResult = skillResult;
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

export function renderAvoidanceCheckCard(_message, html, _data, flags) {
  const context = { interactive: true };
  const content = renderAvoidanceCheck(flags.avoidanceCheck, context);
  html.insertAdjacentHTML("beforeend", content);
  return context;
}
