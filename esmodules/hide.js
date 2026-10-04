import { debuglog, localizeString, getToken } from "./utils.js";
import {
  MODULE_ID,
  VISIBILITY_LABELS,
  HIDDEN,
  OBSERVED,
  UNDETECTED,
} from "./const.js";
import { renderTargetList } from "./render-status.js";
import { cachedSettings } from "./settings.js";
import { prepareObservedActionData } from "./action.js";
import { adaptStealthEffectToObservers, getVisibilityOf } from "./effects.js";

function hideCheck(avoider, observation) {
  const visibility = getVisibilityOf(avoider, observation.tokenDoc.id);
  const baselineVisibility = visibility >= HIDDEN ? visibility : HIDDEN;
  if (visibility === UNDETECTED && observation.degreeOfSuccess >= 2) {
    const tooltip = game.i18n.localize(`${MODULE_ID}.hide.retain`);
    observation.tooltip = observation.tooltip
      ? `${observation.tooltip}<br>${tooltip}`
      : tooltip;
  }
  observation.visibility =
    observation.degreeOfSuccess >= 2 ? baselineVisibility : OBSERVED;
  observation.visibilityLabel = VISIBILITY_LABELS[observation.visibility];
}

export async function prepareHideData(message, userId, actingToken) {
  // debuglog("hide action", {
  //   message,
  //   userId,
  //   actingToken,
  // });
  const { summary, targetList } = prepareObservedActionData({
    message,
    userId,
    actingToken,
    analyze: hideCheck,
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
  const hide = flags.hide;
  await adaptStealthEffectToObservers({
    actor: message.token.actor,
    baselineVisibility: HIDDEN,
    observers: Object.fromEntries(
      hide.targetList.map((t) => [
        t.tokenId,
        {
          visibility: t.visibility,
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
  const context = { interactive: hide.showApplyButton, loopAt: 2 };
  let content = renderTargetList(targetList, context);
  if (context.interactive) {
    const clickId = foundry.utils.randomID();
    (context["clickIds"] ??= {})[clickId] = applyHideEffects;
    content += `
      <div class="${MODULE_ID}-hide">
        <button class="${MODULE_ID}-button" data-click-id="${clickId}" data-visibility="gm">
          ${localizeString(`${MODULE_ID}.effects.apply`)}
        </button>
      </div>`;
  }
  html.insertAdjacentHTML("beforeend", content);
  return context;
}
