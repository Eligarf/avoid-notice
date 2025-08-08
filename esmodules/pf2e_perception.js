import { MODULE_ID } from "./const.js";
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
  for (let id in perceptionData) {
    tokenUpdate[`flags.${PF2E_PERCEPTION_ID}.data.-=${id}`] = beforeV13
      ? true
      : null;
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
  perceptionData,
  results,
  perceptionUpdate,
}) {
  if ("observed" in results) {
    for (const result of results.observed) {
      if (perceptionData && result.id in perceptionData)
        perceptionUpdate[`flags.${PF2E_PERCEPTION_ID}.data.-=${result.id}`] =
          true;
    }
  }
  for (const visibility of ["hidden", "undetected", "unnoticed"]) {
    if (visibility in results) {
      for (const result of results[visibility]) {
        if (perceptionData?.[result.id]?.visibility !== visibility)
          perceptionUpdate[
            `flags.${PF2E_PERCEPTION_ID}.data.${result.id}.visibility`
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
