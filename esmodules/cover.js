import { log } from "./main.js";

export function findBaseCoverBonus(avoider) {
  const coverEffect = avoider.actor.items.find(
    (i) => i.system.slug === "effect-cover",
  );
  const bonusElement = coverEffect?.flags?.pf2e?.rulesSelections?.cover?.bonus;
  let baseCoverBonus = 0;
  switch (bonusElement) {
    case 2:
    case 4:
      baseCoverBonus = bonusElement;
      break;
  }
  return baseCoverBonus;
}

export function getRelativeCover({ api, options, observerToken }) {
  let cover = "na";
  if (api.perceptionApi) {
    cover = options.computeCover
      ? api.perceptionApi.token.getCover(
          api.avoider.token._object,
          observerToken._object,
        )
      : api.perceptionData?.[observerToken.id]?.cover;
  } else if (api.visionerApi) {
    cover = options.computeCover
      ? api.visionerApi.getAutoCoverState(
          observerToken.id,
          api.avoider.token.id,
          { forceRecalculate: true },
        )
      : api.visionerApi.getCover(observerToken.id, api.avoider.token.id);
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

export function getRelativeConcealment({ api, options, observerToken }) {
  if (api.visionerApi) {
    const visibility = api.visionerApi.getVisibility(
      observerToken.id,
      api.avoider.token.id,
    );
    return visibility === "concealed";
  }
  return false;
}
