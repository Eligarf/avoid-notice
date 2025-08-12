import { log } from "./main.js";

export const VISIONER_ID = "pf2e-visioner";

export function isVisionerActive() {
  return game.modules.get(VISIONER_ID)?.active;
}

export function getVisionerApi() {
  return game.modules.get(VISIONER_ID)?.api;
}

async function updateBatch({ batch, visionerApi, targetId, observers }) {
  // If doing batch mode, add new member and return
  if (batch) {
    batch[targetId] = observers;
    return;
  }

  // Otherwise, iterate and set observers individually
  for (const id of Object.keys(observers)) {
    const condition = observers[id];
    await visionerApi.setVisibility(
      id,
      targetId,
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
  for (const t of tokens) {
    observers[t.id] = "observed";
  }

  await updateBatch({ batch, visionerApi, targetId: token.id, observers });

  if (refresh) refreshVisionerPerception(visionerApi);
}

export async function updateVisioner({ avoiderApi, results, batch = null }) {
  const avoider = avoiderApi.avoider;
  const targetId = avoider.tokenId;
  const visionerApi = avoiderApi.visionerApi;

  let observers = {};
  for (const condition of ["observed", "hidden", "undetected", "unnoticed"]) {
    if (condition in results) {
      for (const result of results[condition]) {
        observers[result.observerId] =
          condition !== "unnoticed" ? condition : "undetected";
      }
    }
  }

  await updateBatch({ batch, visionerApi, targetId, observers });
}
