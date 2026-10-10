import { debuglog, localizeString, getToken } from "./utils.js";
import {
  MODULE_ID,
  STEALTH_LABELS,
  HIDDEN,
  OBSERVED,
  UNDETECTED,
  SUCCESS,
  FAILURE,
} from "./const.js";
import { renderTargetList, renderSummary } from "./render-status.js";
import { cachedSettings } from "./settings.js";
import { prepareStealthChecks } from "./action.js";
import {
  adaptStealthEffectToObservers,
  getStealthEffect,
  getStealthBaseline,
  getStealthinessTo,
} from "./effects.js";

function resolveHide(origin, check) {
  const stealth = getStealthinessTo(origin, check.tokenDoc.id);
  check.was = stealth;
  if (check.degreeOfSuccess >= SUCCESS) {
    if (stealth === UNDETECTED) {
      const tooltip = game.i18n.localize(`${MODULE_ID}.hide.retain`);
      check.tooltip = check.tooltip
        ? `${check.tooltip}<br>${tooltip}`
        : tooltip;
      check.stealth = UNDETECTED;
    } else check.stealth = HIDDEN;
  } else check.stealth = OBSERVED;
  check.stealthLabel = STEALTH_LABELS[check.stealth];
}

export async function prepareHideData(message, userId, actingToken) {
  // debuglog("hide action", {
  //   message,
  //   userId,
  //   actingToken,
  // });
  const { allies, summary, targetList } = prepareStealthChecks({
    message,
    userId,
    actingToken,
    resolver: resolveHide,
  });
  const update = {
    flags: {
      [MODULE_ID]: {
        card: "hide",
        origin: actingToken.id,
        hide: {
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

async function applyHideEffects(message, _event, flags) {
  if (!game.user.isGM) return;
  const stealthEffect = getStealthEffect(message.token);
  const baselineStealth = stealthEffect
    ? Math.max(getStealthBaseline(stealthEffect), HIDDEN)
    : HIDDEN;
  const hide = flags.hide;
  const detectors = Object.fromEntries(
    hide.targetList
      .map((t) => [
        t.tokenId,
        {
          stealth: t.stealth,
          signature: getToken(t.tokenId)?.actor?.signature,
        },
      ])
      .concat(
        hide.allies.map((id) => [
          id,
          { stealth: OBSERVED, signature: getToken(id)?.actor?.signature },
        ]),
      ),
  );
  await adaptStealthEffectToObservers({
    actor: message.token.actor,
    baselineStealth,
    detectors,
  });

  hide.showApplyButton = false;
  return message.update({ flags: { [MODULE_ID]: flags } });
}

const hideDosStates = [FAILURE, SUCCESS, SUCCESS];

async function onHideStatusClick(message, _event, flags, targetId) {
  const targetList = flags[flags.card]?.targetList;
  if (!targetList) return;
  const target = targetList.find((t) => t.tokenId === targetId);
  if (!target) return;
  target.stealth =
    target.stealth === OBSERVED ? Math.max(HIDDEN, target.was) : OBSERVED;
  target.stealthLabel = STEALTH_LABELS[target.stealth];
  const update = {
    flags: {
      [MODULE_ID]: flags,
    },
  };
  target.degreeOfSuccess = hideDosStates[target.stealth];
  return message.update(update);
}

export function renderHideCard(_message, html, _data, flags) {
  const hide = flags.hide;
  const targetList = hide.targetList;
  if (!targetList?.length) return {};
  const context = {
    interactive: hide.showApplyButton,
    collapsed: false,
    onStatusClick: onHideStatusClick,
    change: targetList.some((t) => t.stealth !== t.was),
  };
  const summary = renderSummary(hide.summary, context);
  let content = renderTargetList(targetList, summary, context);
  if (context.interactive) {
    const clickId = foundry.utils.randomID();
    (context["clickIds"] ??= {})[clickId] = applyHideEffects;
    content += `
      <div class="${MODULE_ID}-hide">
        <button class="${MODULE_ID}-button" data-click-id="${clickId}" data-visibility="gm" ${context.change ? "" : "disabled"}>
          ${localizeString(`${MODULE_ID}.effects.${context.change ? "apply" : "noChange"}`)}
        </button>
      </div>`;
  }
  html.insertAdjacentHTML("beforeend", content);
  return context;
}
