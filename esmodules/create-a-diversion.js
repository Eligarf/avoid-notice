import { debuglog, breakdownRoll } from "./utils.js";
import {
  MODULE_ID,
  STEALTH_LABELS,
  HIDDEN,
  OBSERVED,
  SUCCESS,
} from "./const.js";
import { findCompanionsOnCanvas, findPossibleTargets } from "./combat.js";
import {
  resolveStealthChecks,
  prepareSummaryAndTargetList,
} from "./observation-logic.js";
import { renderTargetList } from "./render-status.js";

export function resolveDiversion(_origin, check) {
  check.stealth = check.degreeOfSuccess >= SUCCESS ? HIDDEN : OBSERVED;
  check.stealthLabel = STEALTH_LABELS[check.stealth];
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
  const { them: targets, us } = findPossibleTargets({
    encounter: combat,
    origin: actingToken,
    minionTokens,
    eidolonTokens,
  });
  const roll = message.rolls?.[0];
  const { rawRollDosDelta } = breakdownRoll(roll);

  const origin = {
    tokenDoc: actingToken?.document ?? actingToken,
    roll,
    skillResult: roll.total,
    rawRollDosDelta,
    baseCoverBonus: 0,
  };
  const checks = resolveStealthChecks({
    origin,
    targets,
    resolver: resolveDiversion,
  }).sort((a, b) => b.dc - a.dc || a.name.localeCompare(b.name));
  const { summary, targetList } = prepareSummaryAndTargetList(checks);

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
