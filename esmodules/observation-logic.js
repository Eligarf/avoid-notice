import { clampDos, debuglog } from "./utils.js";
import { prepareTargetList } from "./render-status.js";
import { MODULE_ID } from "./const.js";

export function resolveStealthCheck({ origin, target, resolver }) {
  let check = {
    dc: target.actor.system.perception.dc,
    name: target.name,
    targetId: target.id,
    tokenDoc: target,
  };

  let coverBonus = origin.baseCoverBonus || 0;
  if (coverBonus > 0) {
    check.coverBonus = coverBonus;
    switch (coverBonus) {
      case 2:
        check.tooltip = game.i18n.localize(`${MODULE_ID}.standardCover`);
        break;
      case 4:
        check.tooltip = game.i18n.localize(`${MODULE_ID}.greaterCover`);
        break;
    }
  }

  const delta = origin.skillResult + coverBonus - check.dc;
  check.delta = delta;
  check.deltaStr = delta < 0 ? `${delta}` : `+${delta}`;
  check.degreeOfSuccess = clampDos(delta, origin.rawRollDosDelta);
  resolver(origin, check);

  return check;
}

export function resolveStealthChecks({ origin, targets, resolver }) {
  const checks = targets
    .filter((target) => target.actor?.system?.perception?.dc)
    .map((target) =>
      resolveStealthCheck({
        origin,
        target,
        resolver,
      }),
    );
  return checks.sort((a, b) => a.delta - b.delta);
}

export function resolveSeekCheck({ origin, target, resolver }) {
  let check = {
    dc: target.actor.system.skills.stealth.dc,
    name: target.name,
    observerId: target.id,
    tokenDoc: target,
  };

  const delta = origin.skillResult - check.dc;
  check.delta = delta;
  check.deltaStr = delta < 0 ? `${delta}` : `+${delta}`;
  check.degreeOfSuccess = clampDos(delta, origin.rawRollDosDelta);
  resolver(origin, check);
  return check;
}

export function prepareSummaryAndTargetList(checks) {
  const summary = checks.reduce((acc, obs) => {
    const stealth = obs.stealth;
    acc[stealth] = (acc[stealth] || 0) + 1;
    return acc;
  }, {});

  const targetList = prepareTargetList(checks);
  return { summary, targetList };
}
