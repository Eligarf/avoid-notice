import { isAvoider } from "./effects.js";
import { MODULE_ID, SLUGS } from "./const.js";
import { findBaseCoverBonus } from "./cover.js";
import { sendStealthRollToGM } from "./socket.js";
import {
  resolveStealthChecks,
  prepareSummaryAndTargetList,
} from "./observation-logic.js";
import { resolveAvoidNotice } from "./sneak.js";
import { renderSummary, renderTargetList } from "./render-status.js";
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

function resolveStealthRoll({
  avoider,
  roll = null,
  targets,
  rawRollDosDelta = 0,
  skillResult = 10,
}) {
  if (roll) {
    ({ rawRollDosDelta } = breakdownRoll(roll));
    skillResult = roll.total;
  }
  const origin = {
    tokenDoc: avoider?.document ?? avoider,
    skillResult,
    rawRollDosDelta,
    baseCoverBonus: findBaseCoverBonus({
      actor: avoider?.actor ?? avoider,
    }),
  };
  return resolveStealthChecks({
    origin,
    targets,
    resolver: resolveAvoidNotice,
  });
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
  const missing = avoidanceCheck.missing;
  if (missing.length > 0) {
    content += `<div class="${MODULE_ID}-alert">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <span class="${MODULE_ID}-missing">${makeMissingActorsString()}</span>
      </div>
    </div>`;
  }
  if (!avoidanceCheck.addedToCombat) {
    const clickId = foundry.utils.randomID();
    (context["clickIds"] ??= {})[clickId] = createEncounter;
    content += `
      <button class="${MODULE_ID}-button" data-click-id="${clickId}"
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
    .map((t) => ({ id: t.id, name: t.name }));
  const noticableFriendlies = friendlies
    .filter((t) => !friendlyAvoiders.includes(t))
    .map((t) => ({ id: t.id, name: t.name }));

  let enemyStealth = {};
  if (enemyAvoiders.length > 0) {
    for (const avoider of enemyAvoiders) {
      const roll = await rollStealth(avoider.actor);
      const { rawRollDosDelta } = breakdownRoll(roll);
      const checks = resolveStealthRoll({
        avoider,
        roll,
        targets: friendlies,
      }).sort((a, b) => b.dc - a.dc || a.name.localeCompare(b.name));
      const { summary, targetList } = prepareSummaryAndTargetList(checks);

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
      friendlyStealth[avoider.id || avoider.actor.id] = {
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
    friendlyIds: friendlies.map((c) => c.id || c.actor.id),
    friendlyStealth: friendlyStealth ?? {},
    missing: friendlies.filter((c) => !getToken(c.id)).map((c) => c.actor.id),
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
          <div class="${MODULE_ID}-noticable-enemies">
            ${localizeString(`${MODULE_ID}.avoidanceCheck.observedEnemies`)}
            <div class="${MODULE_ID}-noticables">`;
      for (const noticable of noticableEnemies) {
        const hoverId = foundry.utils.randomID();
        (context["hoverIds"] ??= {})[hoverId] = noticable.id;
        content += `
              <div class="${MODULE_ID}-noticable">
                <div class="${MODULE_ID}-name" data-hover-id=${hoverId}>${noticable.name}</div>
              </div>`;
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
          <div class="${MODULE_ID}-enemy-avoiders">
            <div class="${MODULE_ID}-avoider" data-combatant-id="${tokenId}" data-hover-id="${hoverId}">
              <div class="${MODULE_ID}-description">
                <div class="${MODULE_ID}-name">${avoider.name}</div>
                <span>${localizeString(`${MODULE_ID}.avoidanceCheck.checkLabel`)}</span>
                <div class="${MODULE_ID}-roll">${avoider.skillResult}</div>
              </div>`;
      const summary = renderSummary(avoider.summary, context);
      content += renderTargetList(avoider.targetList, summary, context);
      content += `
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
            <div class="${MODULE_ID}-noticable-friendlies">
              ${localizeString(`${MODULE_ID}.avoidanceCheck.observedFriendlies`)}
              <div class="${MODULE_ID}-noticables">`;
      for (const noticable of noticableFriendlies) {
        const hoverId = foundry.utils.randomID();
        (context["hoverIds"] ??= {})[hoverId] = noticable.id;
        content += `
              <div class="${MODULE_ID}-noticable">
                <div class="${MODULE_ID}-name" data-hover-id=${hoverId}>${noticable.name}</div>
              </div>`;
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
            <div class="${MODULE_ID}-friendly-avoiders">
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
                <div class="${MODULE_ID}-player-results" data-visibility="gm">`;
      if (avoider.skillResult !== null) {
        const summary = renderSummary(avoider.summary, context);
        content += renderTargetList(avoider.targetList, summary, context);
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
  return ChatMessage.create({
    content: "Hey there",
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
  const avoidanceCheck = flags.avoidanceCheck;
  const combat = !game.combat
    ? await Combat.create({ scene: canvas.scene.id, active: true })
    : game.combat;
  const missing = avoidanceCheck.friendlyIds.filter((id) => !getToken(id));
  avoidanceCheck.missing = missing;
  if (missing.length > 0) {
    ui.notifications.warn(makeMissingActorsString());
    return message.update({ flags: { [MODULE_ID]: flags } });
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
  let avoider =
    canvas.tokens.get(tokenId) || game.actors.get(tokenId)?.prototypeToken;
  if (!avoider) return;

  const targets = avoidanceCheck.enemyIds.map((id) => canvas.tokens.get(id));
  const checks = resolveStealthRoll({
    avoider,
    rawRollDosDelta,
    skillResult,
    targets,
  }).sort((a, b) => b.dc - a.dc || a.name.localeCompare(b.name));
  const { summary, targetList } = prepareSummaryAndTargetList(checks);

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
  const context = { interactive: false, collapsed: true };
  const content = renderAvoidanceCheck(flags.avoidanceCheck, context);
  html.insertAdjacentHTML("beforeend", content);
  return context;
}
