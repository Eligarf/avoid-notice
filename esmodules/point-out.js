import { debuglog } from "./utils.js";

export async function preparePointOutData(message, userId, actingToken) {
  debuglog("pointOut triggered", {
    message,
    actingToken,
    userId,
  });
}
