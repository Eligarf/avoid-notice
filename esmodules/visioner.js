import { VISIONER_ID } from "./main.js";

export async function clearVisionerData(token, visionerApi) {
  const tokens = canvas.scene.tokens.filter((t) => {
    const visibility = t.flags?.[VISIONER_ID]?.visibility;
    if (!visibility) return false;
    if (!(token.id in visibility)) return false;
    return visibility[token.id] !== "observed";
  });
  if (!tokens.length) return;
  for (const t of tokens) {
    await visionerApi.setVisibility(t.id, token.id, "observed");
  }
  if ("refreshEveryonesPerception" in visionerApi)
    visionerApi.refreshEveryonesPerception();
}

export async function updateVisioner({ visionerApi, avoider, results }) {
  const targetId = avoider.tokenId;
  for (const condition of ["observed", "hidden", "undetected", "unnoticed"]) {
    if (condition in results) {
      for (const result of results[condition]) {
        await visionerApi.setVisibility(result.id, targetId, condition);
      }
    }
  }
}
