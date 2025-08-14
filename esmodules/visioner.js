import { log } from "./main.js";
import { MODULE_ID } from "./const.js";

export const VISIONER_ID = "pf2e-visioner";

export function isVisionerActive() {
  return game.modules.get(VISIONER_ID)?.active;
}

export function getVisionerApi() {
  return game.modules.get(VISIONER_ID)?.api;
}

async function updateBatch({
  visionerApi,
  avoiderId,
  observers,
  batch = null,
}) {
  // If doing batch mode, add new member and return
  if (batch) {
    batch[avoiderId] = observers;
    return;
  }

  // Otherwise, iterate and set observers individually
  for (const id of Object.keys(observers)) {
    const condition = observers[id];
    await visionerApi.setVisibility(
      id,
      avoiderId,
      condition !== "unnoticed" ? condition : "undetected",
    );
  }
}

export function refreshVisionerPerception(visionerApi) {
  if ("refreshEveryonesPerception" in visionerApi)
    visionerApi.refreshEveryonesPerception();
}

export async function clearVisionerData({
  token,
  visionerApi,
  refresh = false,
  batch = null,
}) {
  const tokens = canvas.scene.tokens.filter((t) => {
    const visibility = t.flags?.[VISIONER_ID]?.visibility;
    if (!visibility) return false;
    if (!(token.id in visibility)) return false;
    return visibility[token.id] !== "observed";
  });
  if (!tokens.length) return;
  let observers = {};
  for (const observer of tokens) {
    observers[observer.id] = "observed";
  }

  await updateBatch({ visionerApi, avoiderId: token.id, observers, batch });

  if (refresh) refreshVisionerPerception(visionerApi);
}

async function processBulkObservationsForVisioner(visionerApi, observations) {
  let updates = [];
  for (const avoiderId in observations) {
    const { observers } = observations[avoiderId];
    for (const observerId in observers) {
      updates.push({
        observerId,
        targetId: avoiderId,
        state: observers[observerId].visibility.result,
      });
    }
  }
  log("updates", updates);
  if (updates.length > 0) await visionerApi.bulkSetVisibility(updates);
}

export async function processObservationsForVisioner(observations) {
  const visionerApi = getVisionerApi();

  // If we are in bulk mode, use that instead
  const useBulkApi = game.settings.get(MODULE_ID, "useBulkApi");
  if (useBulkApi && "bulkSetVisibility" in visionerApi) {
    return await processBulkObservationsForVisioner(visionerApi, observations);
  }

  for (const avoiderId in observations) {
    const { observers } = observations[avoiderId];

    for (const observerId in observers) {
      const condition = observers[observerId].visibility.result;
      await visionerApi.setVisibility(
        observerId,
        avoiderId,
        condition !== "unnoticed" ? condition : "undetected",
      );
    }
  }
}
