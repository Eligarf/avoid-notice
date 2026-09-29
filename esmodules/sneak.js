import { debuglog, breakdownRoll } from "./utils.js";
import { MODULE_ID, VISIBILITY_LABELS, UNDETECTED } from "./const.js";
import { findCompanionsOnCanvas, findPossibleObservers } from "./combat.js";
import {
  testAvoiderStealthAgainstObservers,
  prepareObservations,
} from "./observation-logic.js";
import { findBaseCoverBonus } from "./cover.js";
import { renderTargetList } from "./render-status.js";

export function avoidNoticeCheck(observation) {
  observation.visibility =
    observation.degreeOfSuccess >= 2 ? UNDETECTED : observation.degreeOfSuccess;
  observation.visibilityLabel = VISIBILITY_LABELS[observation.visibility];
}

export function sneakCheck(observation) {
  return avoidNoticeCheck(observation);
}

export async function prepareSneakData(message, userId, actingToken) {
  debuglog("sneak triggered", {
    message,
    userId,
    actingToken,
  });
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
    analyze: sneakCheck,
  });
  const hoverIds = {};
  const { summary, targetList } = prepareObservations(observations, hoverIds);
  const update = {
    flags: {
      [MODULE_ID]: {
        card: "sneak",
        sneak: { summary, targetList },
        hoverIds: hoverIds,
      },
    },
  };
  return message.update(update);
}

export function renderSneakCard(_message, html, _data, flags) {
  const content = renderTargetList(flags.sneak?.targetList);
  html.insertAdjacentHTML("beforeend", content);
}
