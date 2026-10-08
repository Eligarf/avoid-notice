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
import { renderTargetList } from "./render-status.js";
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
  const { summary, targetList } = prepareStealthChecks({
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
  await adaptStealthEffectToObservers({
    actor: message.token.actor,
    baselineStealth,
    detectors: Object.fromEntries(
      hide.targetList.map((t) => [
        t.tokenId,
        {
          stealth: t.stealth,
          signature: getToken(t.tokenId)?.actor?.signature,
        },
      ]),
    ),
  });

  hide.showApplyButton = false;
  return message.update({ flags: { [MODULE_ID]: flags } });
}

export function renderHideCard(_message, html, _data, flags) {
  const hide = flags.hide;
  const targetList = hide.targetList;
  if (!targetList?.length) return {};
  const context = {
    interactive: hide.showApplyButton,
    stealthDosStates: [FAILURE, SUCCESS],
  };
  let content = renderTargetList(targetList, context);
  const change = targetList.some((t) => t.stealth !== t.was);
  if (context.interactive) {
    const clickId = foundry.utils.randomID();
    (context["clickIds"] ??= {})[clickId] = applyHideEffects;
    content += `
      <div class="${MODULE_ID}-hide">
        <button class="${MODULE_ID}-button" data-click-id="${clickId}" data-visibility="gm" ${change ? "" : "disabled"}>
          ${localizeString(`${MODULE_ID}.effects.${change ? "apply" : "noChange"}`)}
        </button>
      </div>`;
  }
  html.insertAdjacentHTML("beforeend", content);
  return context;
}
