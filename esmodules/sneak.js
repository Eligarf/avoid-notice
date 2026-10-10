import { debuglog, localizeString, getToken } from "./utils.js";
import {
  MODULE_ID,
  STEALTH_LABELS,
  UNDETECTED,
  OBSERVED,
  HIDDEN,
  SUCCESS,
  FAILURE,
  CRITICAL_FAILURE,
} from "./const.js";
import { renderTargetList, renderSummary } from "./render-status.js";
import { cachedSettings } from "./settings.js";
import { prepareStealthChecks } from "./action.js";
import { adaptStealthEffectToObservers, getStealthinessTo } from "./effects.js";

export function resolveAvoidNotice(_origin, check) {
  check.stealth =
    check.degreeOfSuccess >= SUCCESS
      ? UNDETECTED
      : check.degreeOfSuccess > CRITICAL_FAILURE
        ? HIDDEN
        : OBSERVED;
  check.stealthLabel = STEALTH_LABELS[check.stealth];
}

function resolveSneak(origin, check) {
  const stealth = getStealthinessTo(origin, check.tokenDoc.id);
  check.was = stealth;
  if (stealth > OBSERVED) {
    check.stealth =
      check.degreeOfSuccess >= SUCCESS
        ? UNDETECTED
        : check.degreeOfSuccess > CRITICAL_FAILURE
          ? HIDDEN
          : OBSERVED;
  } else {
    check.stealth = OBSERVED;
    const tooltip = game.i18n.localize(`${MODULE_ID}.sneak.observed`);
    check.tooltip = check.tooltip ? `${check.tooltip}<br>${tooltip}` : tooltip;
  }
  check.stealthLabel = STEALTH_LABELS[check.stealth];
}

export async function prepareSneakData(message, userId, actingToken) {
  const { allies, summary, targetList } = prepareStealthChecks({
    message,
    userId,
    actingToken,
    resolver: resolveSneak,
  });
  const update = {
    flags: {
      [MODULE_ID]: {
        card: "sneak",
        origin: actingToken.id,
        sneak: {
          summary,
          targetList,
          allies,
          showApplyButton: cachedSettings.useEffects,
        },
      },
    },
  };
  return message.update(update);
}

async function applySneakEffects(message, _event, flags) {
  if (!game.user.isGM) return;
  const sneak = flags.sneak;
  const detectors = Object.fromEntries(
    sneak.targetList
      .map((t) => [
        t.tokenId,
        {
          stealth: t.stealth,
          signature: getToken(t.tokenId)?.actor?.signature,
        },
      ])
      .concat(
        sneak.allies.map((id) => [
          id,
          { stealth: OBSERVED, signature: getToken(id)?.actor?.signature },
        ]),
      ),
  );
  await adaptStealthEffectToObservers({
    actor: message.token.actor,
    baselineStealth: UNDETECTED,
    detectors,
  });

  sneak.showApplyButton = false;
  return message.update({ flags: { [MODULE_ID]: flags } });
}

const sneakDosStates = [CRITICAL_FAILURE, FAILURE, SUCCESS];

async function onSneakStatusClick(message, _event, flags, targetId) {
  const targetList = flags[flags.card]?.targetList;
  if (!targetList) return;
  const target = targetList.find((t) => t.tokenId === targetId);
  if (!target) return;
  target.stealth = (target.stealth + 1) % 3;
  target.stealthLabel = STEALTH_LABELS[target.stealth];
  const update = {
    flags: {
      [MODULE_ID]: flags,
    },
  };
  target.degreeOfSuccess = sneakDosStates[target.stealth];
  return message.update(update);
}

export function renderSneakCard(_message, html, _data, flags) {
  const sneak = flags.sneak;
  const targetList = sneak.targetList;
  if (!targetList?.length) return {};
  const context = {
    interactive: sneak.showApplyButton,
    collapsed: false,
    onStatusClick: onSneakStatusClick,
    change: targetList.some((t) => t.stealth !== t.was),
  };
  const summary = renderSummary(sneak.summary, context);
  let content = renderTargetList(targetList, summary, context);
  if (context.interactive) {
    const clickId = foundry.utils.randomID();
    (context["clickIds"] ??= {})[clickId] = applySneakEffects;
    content += `
      <div class="${MODULE_ID}-sneak">
        <button class="${MODULE_ID}-button" data-click-id="${clickId}" data-visibility="gm" ${context.change ? "" : "disabled"}>
          ${localizeString(`${MODULE_ID}.effects.${context.change ? "apply" : "noChange"}`)}
        </button>
      </div>`;
  }
  html.insertAdjacentHTML("beforeend", content);
  return context;
}
