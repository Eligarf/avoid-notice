import { log } from "./main.js";
import { getPerceptionApi } from "./pf2e_perception.js";

export function findBaseCoverBonus(avoider) {
  const coverEffect = avoider.actor.items.find(
    (i) => i.system.slug === "effect-cover",
  );
  const bonusElement = coverEffect?.flags.pf2e.rulesSelections.cover.bonus;
  let baseCoverBonus = 0;
  switch (bonusElement) {
    case 2:
    case 4:
      baseCoverBonus = bonusElement;
      break;
  }
  return baseCoverBonus;
}

export function getRelativeCover({ api, options, otherToken }) {
  let cover = "na";
  if (api.perceptionApi) {
    cover = options.computeCover
      ? api.perceptionApi.token.getCover(
          api.avoider.token._object,
          otherToken._object,
        )
      : api.perceptionData?.[otherToken.id]?.cover;
  } else if (api.visionerApi) {
    cover = api.visionerApi.getCover(otherToken.id, api.avoider.token.id);
  }

  let coverBonus = -1;
  switch (cover) {
    case "na":
      break;
    case "standard":
      coverBonus = 2;
      break;
    case "greater":
      coverBonus = 4;
      break;
    default:
      coverBonus = 0;
      break;
  }
  return coverBonus;
}
