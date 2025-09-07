import { log } from "./main.js";
import { MODULE_ID } from "./const.js";
import { SETTINGS } from "./settings.js";

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

async function clearVisionerDataHardWay({
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
}

export async function clearVisionerData({
  token,
  visionerApi,
  refresh = false,
  batch = null,
}) {
  const useBulkApi = game.settings.get(MODULE_ID, SETTINGS.useBulkApi);
  if (!useBulkApi)
    await clearVisionerDataHardWay({ token, visionerApi, refresh, batch });
  else {
    await visionerApi.clearAllDataForSelectedToken(token);
  }

  if (refresh) refreshVisionerPerception(visionerApi);
}

export async function setVisionerData(updates) {
  if (!updates.length) return;
  const visionerApi = getVisionerApi();
  const useBulkApi = game.settings.get(MODULE_ID, SETTINGS.useBulkApi);
  if (useBulkApi && "bulkSetVisibility" in visionerApi) {
    await visionerApi.bulkSetVisibility(updates);
  } else {
    for (const { observerId, targetId, state } of updates) {
      await visionerApi.setVisibility(observerId, targetId, state);
    }
  }
}

export async function processObservationsForVisioner(observations) {
  let updates = [];
  for (const avoiderId in observations) {
    const { observers } = observations[avoiderId];
    for (const observerId in observers) {
      let state = observers[observerId].observation.visibility;
      updates.push({
        observerId,
        targetId: avoiderId,
        state: state !== "unnoticed" ? state : "undetected",
      });
    }
  }
  await setVisionerData(updates);
}

export async function hideLoot() {
  const hiddenLoot = canvas.scene.tokens.filter(
    (t) =>
      t?.hidden &&
      t?.flags?.[VISIONER_ID]?.stealthDC > 0 &&
      t?.actor?.type === "loot",
  );
  const party = canvas.scene.tokens.filter((t) =>
    game.actors.party.members.some((a) => a.id === t?.actor?.id),
  );

  let updates = [];
  for (const pc of party) {
    for (const loot of hiddenLoot) {
      updates.push({ observerId: pc.id, targetId: loot.id, state: "hidden" });
    }
  }

  await setVisionerData(updates);
}
