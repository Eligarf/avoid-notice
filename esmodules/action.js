import { debuglog, breakdownRoll } from "./utils.js";
import { prepareSeekData } from "./seek.js";
import { prepareHideData } from "./hide.js";
import { prepareSneakData } from "./sneak.js";
import { prepareCreateADiversionData } from "./create-a-diversion.js";
import { preparePointOutData } from "./point-out.js";
import { findCompanionsOnCanvas, findPossibleTargets } from "./combat.js";
import {
  resolveStealthChecks,
  prepareSummaryAndTargetList,
} from "./observation-logic.js";
import { findBaseCoverBonus } from "./cover.js";

let pointOutText = "J0V4p0dn40xIY4rR";
globalThis.Hooks.once("ready", () => {
  pointOutText = `<strong>${game.i18n.localize("PF2E.Actions.PointOut.Title")}</strong>`;
});

export function prepareStealthChecks({ message, actingToken, resolver }) {
  const combat = game?.combat;
  const { minionTokens, eidolonTokens } = findCompanionsOnCanvas();
  const { them } = findPossibleTargets({
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
    baseCoverBonus: findBaseCoverBonus({
      actor: actingToken?.actor ?? actingToken,
    }),
  };
  const checks = resolveStealthChecks({
    origin,
    targets: them,
    resolver,
  }).sort((a, b) => b.dc - a.dc || a.name.localeCompare(b.name));
  return prepareSummaryAndTargetList(checks);
}

Hooks.on("createChatMessage", async (message, options, userId) => {
  const combat = game?.combat;
  if (!combat) return;
  const flags = message.flags[game.system.id];
  if (!flags) return;
  debuglog("createChatMessage (action)", { message, options, userId, flags });

  const actingToken = message.token;
  const context = flags.context;
  if (context) {
    const options = context.options || [];
    if (options.includes("action:seek")) {
      return prepareSeekData(message, userId, actingToken);
    } else if (options.includes("action:hide")) {
      return prepareHideData(message, userId, actingToken);
    } else if (options.includes("action:sneak")) {
      return prepareSneakData(message, userId, actingToken);
    } else if (options.includes("action:create-a-diversion")) {
      return prepareCreateADiversionData(message, userId, actingToken);
    }
    return;
  }

  if (message.flavor?.includes(pointOutText)) {
    return preparePointOutData(message, userId, actingToken);
  }
});
