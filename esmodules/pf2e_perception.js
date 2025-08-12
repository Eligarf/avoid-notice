import { getVisibilityHandler, log } from "./main.js";

export const PF2E_PERCEPTION_ID = "pf2e-perception";

export function isPerceptionActive() {
  return game.modules.get(PF2E_PERCEPTION_ID)?.active;
}

export function getPerceptionApi() {
  return game.modules.get(PF2E_PERCEPTION_ID)?.api;
}

export async function clearPerceptionData(token) {
  // Remove any ids that perception is tracking
  const perceptionData = token.flags?.[PF2E_PERCEPTION_ID]?.data;
  if (!perceptionData || !Object.keys(perceptionData).length) return;
  let tokenUpdate = {};
  const beforeV13 = Number(game.version.split()[0]) < 13;
  const remove = beforeV13 ? true : null;
  for (let id in perceptionData) {
    tokenUpdate[`flags.${PF2E_PERCEPTION_ID}.data.-=${id}`] = remove;
  }
  const updates = [{ _id: token.id, ...tokenUpdate }];
  await canvas.scene.updateEmbeddedDocuments("Token", updates);
}

export async function clearPf2ePerceptionFlags(item, options, userId) {
  // Only do stuff if we are changing hidden, undetected, or unnoticed conditions and using pf2e-perception
  const visibilityHandler = getVisibilityHandler();
  if (visibilityHandler !== "perception") return;
  const perceptionApi = getPerceptionApi();
  if (!perceptionApi) return;
  if (
    item?.type !== "condition" ||
    !["hidden", "undetected", "unnoticed"].includes(item?.system?.slug)
  )
    return;

  // Get the token on the current scene
  const token =
    options.parent?.parent ??
    canvas.scene.tokens.find((t) => t.actorId === options.parent.id);
  if (!token) return;
  await clearPerceptionData(token);
}

export async function updatePerception({
  avoiderApi,
  results,
  perceptionUpdate,
}) {
  const avoiderTokenDoc = avoiderApi.avoiderTokenDoc;
  const perceptionData = avoiderTokenDoc?.flags?.[PF2E_PERCEPTION_ID]?.data;
  if ("observed" in results) {
    const beforeV13 = Number(game.version.split()[0]) < 13;
    const remove = beforeV13 ? true : null;
    for (const result of results.observed) {
      if (perceptionData && result.observerId in perceptionData) {
        perceptionUpdate[
          `flags.${PF2E_PERCEPTION_ID}.data.-=${result.observerId}`
        ] = remove;
      }
    }
  }
  for (const visibility of ["hidden", "undetected", "unnoticed"]) {
    if (!(visibility in results)) continue;
    for (const result of results[visibility]) {
      if (perceptionData?.[result.observerId]?.visibility !== visibility) {
        perceptionUpdate[
          `flags.${PF2E_PERCEPTION_ID}.data.${result.observerId}.visibility`
        ] = visibility;
      }
    }
  }
}

export function updatePerceptionChanges(tokenUpdates, perceptionChanges) {
  for (const id in perceptionChanges) {
    const update = perceptionChanges[id];
    if (Object.keys(update).length) tokenUpdates.push({ _id: id, ...update });
  }
}

export async function processObservationsForPerception(
  observations,
  tokenUpdates,
) {
  const beforeV13 = Number(game.version.split()[0]) < 13;
  const remove = beforeV13 ? true : null;

  for (const avoiderId in observations) {
    const { avoiderApi, observers } = observations[avoiderId];
    const avoiderTokenDoc = avoiderApi.avoiderTokenDoc;
    const perceptionData = avoiderTokenDoc?.flags?.[PF2E_PERCEPTION_ID]?.data;
    let perceptionUpdate = { _id: avoiderTokenDoc.id };

    // walk through all the observers and group their observations by result
    for (const observerId in observers) {
      const observation = observers[observerId].visibility;
      const condition = observation.result;
      if (condition === "observed") {
        if (perceptionData && observation.observerId in perceptionData) {
          perceptionUpdate[
            `flags.${PF2E_PERCEPTION_ID}.data.-=${observation.observerId}`
          ] = remove;
        }
      } else if (["hidden", "undetected", "unnoticed"].includes(condition)) {
        if (
          perceptionData?.[observation.observerId]?.visibility !== condition
        ) {
          perceptionUpdate[
            `flags.${PF2E_PERCEPTION_ID}.data.${observation.observerId}.visibility`
          ] = condition;
        }
      }
    }
    tokenUpdates.push(perceptionUpdate);
  }
}
