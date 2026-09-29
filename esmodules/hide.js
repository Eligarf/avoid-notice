import { debuglog, breakdownRoll } from "./utils.js";
import { MODULE_ID, VISIBILITY_LABELS, HIDDEN, OBSERVED } from "./const.js";
import { findCompanionsOnCanvas, findPossibleObservers } from "./combat.js";
import {
  testAvoiderStealthAgainstObservers,
  prepareObservations,
} from "./observation-logic.js";
import { findBaseCoverBonus } from "./cover.js";
import { renderTargetList } from "./render-status.js";

export function hideCheck(observation) {
  observation.visibility = observation.degreeOfSuccess >= 2 ? HIDDEN : OBSERVED;
  observation.visibilityLabel = VISIBILITY_LABELS[observation.visibility];
}

export async function prepareHideData(message, userId, actingToken) {
  debuglog("hide triggered", { message, userId, actingToken });
  const combat = game?.combat;
  const { minionTokens, eidolonTokens } = findCompanionsOnCanvas();
  const observers = findPossibleObservers({
    encounter: combat,
    avoider: actingToken,
    minionTokens,
    eidolonTokens,
  });
  const roll = message.rolls?.[0];
  const { rawRollDosDelta } = breakdownRoll(roll);
  const avoider = {
    tokenDoc: actingToken?.document ?? actingToken,
    roll,
    stealthResult: roll.total,
    rawRollDosDelta,
    baseCoverBonus: findBaseCoverBonus({
      actor: actingToken?.actor ?? actingToken,
    }),
  };
  const observations = testAvoiderStealthAgainstObservers({
    avoider,
    observers,
    analyze: hideCheck,
  });
  const hoverIds = {};
  const { summary, targetList } = prepareObservations(observations, hoverIds);
  const update = {
    flags: {
      [MODULE_ID]: {
        card: "hide",
        hide: { summary, targetList },
        hoverIds: hoverIds,
      },
    },
  };
  return message.update(update);
}

export function renderHideCard(_message, html, _data, flags) {
  const content = renderTargetList(flags.hide?.targetList);
  html.insertAdjacentHTML("beforeend", content);
}
