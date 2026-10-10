import { debuglog, localizeString, getToken, breakdownRoll } from "./utils.js";
import {
  MODULE_ID,
  STEALTH_LABELS,
  LOCALIZATION_KEYS,
  UNDETECTED,
  HIDDEN,
} from "./const.js";
import { findCompanionsOnCanvas } from "./combat.js";
import { cachedSettings } from "./settings.js";
import {
  getStealthEffect,
  getStealthBaseline,
  setStealthinessTo,
} from "./effects.js";

export async function preparePointOutData(message, userId, actingToken) {
  debuglog("point out action", {
    message,
    userId,
    actingToken,
  });
  // Warn if != 1 targets
  const targets = Array.from(game.user.targets);
  if (targets.length !== 1) {
    return ui.notifications.warn(
      game.i18n.localize(`${MODULE_ID}.notifications.target1`),
    );
  }

  // Put targeted token in card data
  const subject = canvas.tokens.get(targets[0].id);
  const pointOut = {
    subjectId: subject.tokenDoc?.id || subject.id,
    subjectName: subject.name,
  };
  const update = {
    flags: {
      [MODULE_ID]: {
        card: "pointOut",
        origin: actingToken.id,
        pointOut,
      },
    },
  };

  // only do more if in combat
  const combat = game.combats.active;
  const turns = combat?.turns ?? [];
  if (!turns) return message.update(update);

  // ... and if they are stealthy
  const stealthEffect = getStealthEffect(subject);
  const stealthBaseline = getStealthBaseline(stealthEffect);
  if (stealthBaseline !== UNDETECTED) return message.update(message);

  // ... and if we are a detector
  const flags = stealthEffect?.flags?.[MODULE_ID];
  const detectors = flags?.undetected || {};
  if (!detectors?.except?.includes(actingToken.id))
    return message.update(message);

  // ... and if we have allies to point them out to
  const { minionTokens, eidolonTokens } = findCompanionsOnCanvas();
  const alliance = actingToken.actor?.system?.details?.alliance;
  const newDetectors = combat.combatants.contents
    .map((c) => c.token)
    .concat(minionTokens)
    .concat(eidolonTokens)
    .filter(
      (t) =>
        t.id !== actingToken.id &&
        t.actor?.system?.details?.alliance === alliance &&
        !detectors?.except?.includes(t.id),
    );
  if (!newDetectors.length) return message.update(message);

  pointOut.newDetectors = newDetectors.map((t) => ({
    tokenId: t.id,
    name: t.name,
    stealth: HIDDEN,
    stealthLabel: STEALTH_LABELS[HIDDEN],
  }));
  pointOut.showApplyButton = cachedSettings.useEffects;
  return message.update(update);
}

async function applyPointOutEffects(message, _event, flags) {
  if (!game.user.isGM) return;
  const pointOut = flags.pointOut;
  const subject = getToken(pointOut.subjectId);
  if (!subject) return;
  const targetList = pointOut.newDetectors;
  targetList.forEach(async (t) => {
    const token = getToken(t.tokenId);
    if (!token) return;
    await setStealthinessTo(subject, token, t.stealth);
  });
  pointOut.showApplyButton = false;
  return message.update({ flags: { [MODULE_ID]: flags } });
}

const stealthToggle = HIDDEN + UNDETECTED;
async function onPointOutStatusClick(message, _event, flags, targetId) {
  debuglog("statusClick", { message, _event, flags, targetId });
  const targetList = flags.pointOut?.newDetectors;
  if (!targetList) return;
  const target = targetList.find((t) => t.tokenId === targetId);
  if (!target) return;
  target.stealth = stealthToggle - target.stealth;
  target.stealthLabel = STEALTH_LABELS[target.stealth];
  const update = {
    flags: {
      [MODULE_ID]: flags,
    },
  };
  return message.update(update);
}

function renderNewDetectors(targetList, context) {
  debuglog("renderNewDetectors", { targetList, context });
  const count = targetList.reduce(
    (acc, t) => (t.stealth === HIDDEN ? acc + 1 : acc),
    0,
  );
  let content = `
    <details ${context.collapsed ? "" : "open"} data-visibility="gm" class="${MODULE_ID}-detectors">
      <summary>${localizeString(`${MODULE_ID}.pointOut.hiddens`, { count })}</summary>`;

  const interactive = context.interactive ?? false;
  for (const target of targetList) {
    const hoverId = foundry.utils.randomID();
    context.hoverIds[hoverId] = target.tokenId;
    const vs = localizeString(`${MODULE_ID}.pointOut.to`, {
      name: target.name,
    });
    let resultTag;
    if (interactive) {
      let clickId = foundry.utils.randomID();
      (context["clickIds"] ??= {})[clickId] = async (message, event, flags) => {
        return context.onStatusClick(message, event, flags, target.tokenId);
      };
      resultTag = `
      <div class="${MODULE_ID}-result" data-click-id="${clickId}" data-interactive="true" data-hover-id="${hoverId}">`;
    } else {
      resultTag = `
      <div class="${MODULE_ID}-result" data-interactive="false" data-hover-id="${hoverId}">`;
    }
    content += `
      <div class="${MODULE_ID}-target" data-hover-id="${hoverId}">
        ${resultTag}
          <span>
            ${game.i18n.localize(LOCALIZATION_KEYS[target.stealthLabel])}
          </span>
        </div>
        <div class="${MODULE_ID}-name">${vs}</div>
      </div>`;
  }
  content += `
    </details>`;
  return content;
}

export function renderPointOutCard(message, html, data, flags) {
  debuglog("renderPointOutCard", { message, html, data, flags });
  const pointOut = flags.pointOut;
  if (!pointOut) return;
  const hoverId = foundry.utils.randomID();
  const context = {
    interactive: pointOut.showApplyButton,
    collapsed: false,
    onStatusClick: onPointOutStatusClick,
    hoverIds: { [hoverId]: pointOut.subjectId },
  };

  const subject = localizeString(`${MODULE_ID}.pointOut.subject`, {
    name: pointOut.subjectName,
  });
  let content = `
    <div class="${MODULE_ID}-point-out">
      <div class="${MODULE_ID}-subject" data-hover-id="${hoverId}">
        <div class="${MODULE_ID}-name">${subject}</div>
      </div>
    </div>`;
  const targetList = pointOut.newDetectors;
  if (targetList?.length) {
    context.change = targetList.some((t) => t.stealth !== UNDETECTED);
    content += renderNewDetectors(targetList, context);
    if (context.interactive) {
      const clickId = foundry.utils.randomID();
      (context["clickIds"] ??= {})[clickId] = applyPointOutEffects;
      content += `
        <div class="${MODULE_ID}-point-out">
          <button class="${MODULE_ID}-button" data-click-id="${clickId}" data-visibility="gm" ${context.change ? "" : "disabled"}>
            ${localizeString(`${MODULE_ID}.effects.${context.change ? "apply" : "noChange"}`)}
          </button>
        </div>`;
    }
  }
  html.insertAdjacentHTML("beforeend", content);
  return context;
}
