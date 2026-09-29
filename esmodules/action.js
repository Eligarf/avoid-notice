import { debuglog } from "./utils.js";
import { prepareSeekData } from "./seek.js";
import { prepareHideData } from "./hide.js";
import { prepareSneakData } from "./sneak.js";
import { prepareCreateADiversionData } from "./create-a-diversion.js";
import { preparePointOutData } from "./point-out.js";

const pointOutLabel = "PF2E.Actions.PointOut.Title";

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
