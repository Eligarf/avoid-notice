import { debuglog, breakdownRoll } from "./utils.js";
import { prepareSeekData } from "./seek.js";
import { prepareHideData } from "./hide.js";
import { prepareSneakData } from "./sneak.js";
import { prepareCreateADiversionData } from "./create-a-diversion.js";
import { preparePointOutData } from "./point-out.js";
import { findCompanionsOnCanvas, findPossibleObservers } from "./combat.js";
import {
  testAvoiderStealthAgainstObservers,
  prepareObservations,
} from "./observation-logic.js";
import { findBaseCoverBonus } from "./cover.js";

const pointOutLabel = "PF2E.Actions.PointOut.Title";

export function prepareObservedActionData({ message, actingToken, analyze }) {
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
    baseCoverBonus: findBaseCoverBonus({
      actor: actingToken?.actor ?? actingToken,
    }),
  };
  const observations = testAvoiderStealthAgainstObservers({
    avoider,
    observers,
    analyze,
  });
  return prepareObservations(observations);
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

  if (
    message.flavor?.includes(
      `<strong>${game.i18n.localize(pointOutLabel)}</strong>`,
    )
  ) {
    return preparePointOutData(message, userId, actingToken);
  }
});
