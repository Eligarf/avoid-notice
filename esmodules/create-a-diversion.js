import { debuglog, breakdownRoll } from "./utils.js";
import { MODULE_ID, VISIBILITY_LABELS, HIDDEN, OBSERVED } from "./const.js";
import { findCompanionsOnCanvas, findPossibleObservers } from "./combat.js";
import {
  testAvoiderStealthAgainstObservers,
  prepareObservations,
} from "./observation-logic.js";
import { renderTargetList } from "./render-status.js";

export function createADiversionCheck(_avoider, observation) {
  observation.visibility = observation.degreeOfSuccess >= 2 ? HIDDEN : OBSERVED;
  observation.visibilityLabel = VISIBILITY_LABELS[observation.visibility];
}

export async function prepareCreateADiversionData(
  message,
  userId,
  actingToken,
) {
  debuglog("createADiversion triggered", {
    message,
    actingToken,
    userId,
  });
  const combat = game?.combat;
  const { minionTokens, eidolonTokens } = findCompanionsOnCanvas();
  const { them: observers, us } = findPossibleObservers({
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
    skillResult: roll.total,
    rawRollDosDelta,
    baseCoverBonus: 0,
  };
  const observations = testAvoiderStealthAgainstObservers({
    avoider,
    observers,
    analyze: createADiversionCheck,
  });
  const { summary, targetList } = prepareObservations(observations);
  const update = {
    flags: {
      [MODULE_ID]: {
        card: "create-a-diversion",
        createADiversion: { summary, targetList },
      },
    },
  };
  return message.update(update);
}

export function renderCreateADiversionCard(_message, html, _data, flags) {
  const context = { interactive: flags.showApplyButton };
  const content = renderTargetList(flags.createADiversion?.targetList, context);
  html.insertAdjacentHTML("beforeend", content);
  return context;
}
