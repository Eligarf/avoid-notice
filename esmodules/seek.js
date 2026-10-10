import { debuglog, localizeString, getToken, breakdownRoll } from "./utils.js";
import {
  MODULE_ID,
  STEALTH_LABELS,
  OBSERVED,
  LOCALIZATION_KEYS,
  SUCCESS,
  CRITICAL_SUCCESS,
} from "./const.js";
import {
  renderTargetList,
  renderSummary,
  prepareTargetList,
} from "./render-status.js";
import { findCompanionsOnCanvas, findPossibleTargets } from "./combat.js";
import { cachedSettings } from "./settings.js";
import { resolveSeekCheck } from "./observation-logic.js";
import { getStealthinessTo, setStealthinessTo } from "./effects.js";

function resolveSeek(origin, check) {
  const stealth = getStealthinessTo(check.tokenDoc, origin.tokenDoc.id);
  check.was = stealth;
  const tooltip = localizeString(`${MODULE_ID}.seek.was`, {
    stealth: game.i18n.localize(LOCALIZATION_KEYS[STEALTH_LABELS[stealth]]),
  });
  if (check.degreeOfSuccess === CRITICAL_SUCCESS) {
    check.stealth = OBSERVED;
    check.tooltip = tooltip;
  } else if (check.degreeOfSuccess === SUCCESS) {
    check.stealth = Math.max(OBSERVED, stealth - 1);
    check.tooltip = tooltip;
  } else {
    check.stealth = stealth;
  }
  check.stealthLabel = STEALTH_LABELS[check.stealth];
}

export async function prepareSeekData(message, userId, actingToken) {
  debuglog("seek action", {
    message,
    userId,
    actingToken,
  });
  const combat = game?.combat;
  const { minionTokens, eidolonTokens } = findCompanionsOnCanvas();
  const { them } = findPossibleTargets({
    encounter: combat,
    origin: actingToken,
    minionTokens,
    eidolonTokens,
  });
  const avoiders = them.filter(
    (t) => getStealthinessTo(t, actingToken.id) > OBSERVED,
  );
  if (!avoiders.length) return;

  const roll = message.rolls?.[0];
  const { rawRollDosDelta } = breakdownRoll(roll);
  const origin = {
    tokenDoc: actingToken?.document ?? actingToken,
    roll,
    skillResult: roll.total,
    rawRollDosDelta,
  };

  const checks = avoiders.map((target) =>
    resolveSeekCheck({
      origin,
      target,
      resolver: resolveSeek,
    }),
  );
  checks.sort(
    (a, b) =>
      a.stealth - b.stealth ||
      b.delta - a.delta ||
      a.name.localeCompare(b.name),
  );
  const targetList = prepareTargetList(checks);

  const update = {
    flags: {
      [MODULE_ID]: {
        card: "seek",
        origin: actingToken.id,
        seek: {
          targetList,
          showApplyButton: cachedSettings.useEffects,
        },
      },
    },
  };
  return message.update(update);
}

async function applySeekEffects(message, _event, flags) {
  if (!game.user.isGM) return;
  const seek = flags.seek;
  const token = message.token;
  const avoiders = seek.targetList;
  avoiders.forEach(async (t) => {
    const origin = getToken(t.tokenId);
    if (!origin) return;
    await setStealthinessTo(origin, token, t.stealth);
  });
  seek.showApplyButton = false;
  return message.update({ flags: { [MODULE_ID]: flags } });
}

async function onSeekStatusClick(message, _event, flags, targetId) {
  const targetList = flags[flags.card]?.targetList;
  if (!targetList) return;
  const target = targetList.find((t) => t.tokenId === targetId);
  if (!target) return;
  target.stealth = (target.stealth + 2) % 3;
  target.stealthLabel = STEALTH_LABELS[target.stealth];
  const update = {
    flags: {
      [MODULE_ID]: flags,
    },
  };
  return message.update(update);
}

export function renderSeekCard(message, html, data, flags) {
  debuglog("renderSeekCard", { message, html, data, flags });
  const seek = flags.seek;
  const targetList = seek.targetList;
  if (!targetList?.length) return {};
  const context = {
    interactive: seek.showApplyButton,
    collapsed: false,
    onStatusClick: onSeekStatusClick,
    change: targetList.some((t) => t.stealth !== t.was),
  };
  const summary = renderSummary(targetList, context);
  let content = renderTargetList(targetList, summary, context);
  if (context.interactive) {
    const clickId = foundry.utils.randomID();
    (context["clickIds"] ??= {})[clickId] = applySeekEffects;
    content += `
      <div class="${MODULE_ID}-seek">
        <button class="${MODULE_ID}-button" data-click-id="${clickId}" data-visibility="gm" ${context.change ? "" : "disabled"}>
          ${localizeString(`${MODULE_ID}.effects.${context.change ? "apply" : "noChange"}`)}
        </button>
      </div>`;
  }
  html.insertAdjacentHTML("beforeend", content);
  return context;
}
