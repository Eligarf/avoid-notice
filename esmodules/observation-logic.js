import { MODULE_ID } from "./const.js";
import { getRelativeCover } from "./cover.js";

export function makeObservation({
  avoiderApi,
  options,
  otherToken,
  otherTokenDoc,
  otherActor,
}) {
  let observation = {
    dc: otherActor.system.perception.dc,
    name: otherTokenDoc.name,
    observerId: otherToken.id,
    tokenDoc: otherTokenDoc,
  };

  let coverBonus = getRelativeCover({
    api: avoiderApi,
    options,
    otherToken,
  });
  if (coverBonus < 0) coverBonus = avoiderApi.baseCoverBonus;

  // We give priority to relative cover over the base cover effect

  if (coverBonus > 0) {
    const oldDelta = avoiderApi.avoider.initiative - observation.dc;
    observation.oldDelta = oldDelta < 0 ? `${oldDelta}` : `+${oldDelta}`;
    switch (coverBonus) {
      case 2:
        observation.tooltip = `${game.i18n.localize(`${MODULE_ID}.standardCover`)}: +2`;
        break;
      case 4:
        observation.tooltip = `${game.i18n.localize(`${MODULE_ID}.greaterCover`)}: +4`;
        break;
    }
  }

  // Handle critical failing to win at stealth
  const delta = avoiderApi.avoider.initiative + coverBonus - observation.dc;
  const dos =
    avoiderApi.initiativeDosDelta +
    (delta < -9 ? 0 : delta < 0 ? 1 : delta < 9 ? 2 : 3);
  if (dos < 1) {
    observation.success = false;
    observation.result = "observed";
    observation.delta = `${delta}`;
  }

  // Normal fail is hidden
  else if (dos < 2) {
    observation.success = false;
    const visibility = "hidden";
    observation.result = visibility;
    observation.delta = `${delta}`;
  }

  // avoider beat the other token at the stealth battle
  else {
    observation.success = true;
    let visibility = "undetected";
    observation.delta = `+${delta}`;
    if (
      options.useUnnoticed &&
      avoiderApi.avoider.initiative > other?.initiative
    ) {
      visibility = "unnoticed";
    }
    observation.result = visibility;
  }

  return observation;
}
