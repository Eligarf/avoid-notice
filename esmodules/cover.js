export function findBaseCoverBonus({ actor }) {
  const coverEffect = actor.items.find((i) => i.system.slug === "effect-cover");
  const systemFlags =
    coverEffect?.flags?.system || coverEffect?.flags?.pf2e || {};
  const bonusElement = systemFlags?.rulesSelections?.cover?.bonus;
  let baseCoverBonus = 0;
  switch (bonusElement) {
    case 2:
    case 4:
      baseCoverBonus = bonusElement;
      break;
  }
  return baseCoverBonus;
}
