import { debuglog, localizeString, getToken } from "./utils.js";
import { MODULE_ID, VISIBILITY_LABELS, UNDETECTED, OBSERVED } from "./const.js";
import { renderTargetList } from "./render-status.js";
import { cachedSettings } from "./settings.js";
import { prepareObservedActionData } from "./action.js";
import { adaptStealthEffectToObservers, getVisibilityOf } from "./effects.js";

export function avoidNoticeCheck(_avoider, observation) {
  observation.visibility =
    observation.degreeOfSuccess >= 2 ? UNDETECTED : observation.degreeOfSuccess;
  observation.visibilityLabel = VISIBILITY_LABELS[observation.visibility];
}

function sneakCheck(avoider, observation) {
  const visibility = getVisibilityOf(avoider, observation.tokenDoc.id);
  if (visibility > OBSERVED) {
    observation.visibility =
      observation.degreeOfSuccess >= 2
        ? UNDETECTED
        : observation.degreeOfSuccess;
    observation.visibilityLabel = VISIBILITY_LABELS[observation.visibility];
  } else {
    observation.visibility = OBSERVED;
    const tooltip = game.i18n.localize(`${MODULE_ID}.sneak.observed`);
    observation.tooltip = observation.tooltip
      ? `${observation.tooltip}<br>${tooltip}`
      : tooltip;
  }
  observation.visibilityLabel = VISIBILITY_LABELS[observation.visibility];
}

export async function prepareSneakData(message, userId, actingToken) {
  const { summary, targetList } = prepareObservedActionData({
    message,
    userId,
    actingToken,
    analyze: sneakCheck,
  });
  const update = {
    flags: {
      [MODULE_ID]: {
        card: "sneak",
        origin: actingToken.id,
        sneak: {
          summary,
          targetList,
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
  await adaptStealthEffectToObservers({
    actor: message.token.actor,
    baselineVisibility: UNDETECTED,
    observers: Object.fromEntries(
      sneak.targetList.map((t) => [
        t.tokenId,
        {
          visibility: t.visibility,
          signature: getToken(t.tokenId)?.actor?.signature,
        },
      ]),
    ),
  });

  sneak.showApplyButton = false;
  return message.update({ flags: { [MODULE_ID]: flags } });
}

export function renderSneakCard(_message, html, _data, flags) {
  const sneak = flags.sneak;
  const targetList = sneak.targetList;
  if (!targetList?.length) return {};
  const context = { interactive: sneak.showApplyButton };
  let content = renderTargetList(targetList, context);
  if (context.interactive) {
    const clickId = foundry.utils.randomID();
    (context["clickIds"] ??= {})[clickId] = applySneakEffects;
    content += `
      <div class="${MODULE_ID}-sneak">
        <button class="${MODULE_ID}-apply-effects" data-click-id="${clickId}" data-visibility="gm">
          ${localizeString(`${MODULE_ID}.effects.apply`)}
        </button>
      </div>`;
  }
  html.insertAdjacentHTML("beforeend", content);
  return context;
}
