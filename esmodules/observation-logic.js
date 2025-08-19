import { MODULE_ID } from "./const.js";
import { log } from "./main.js";
import { getRelativeCover, getRelativeConcealment } from "./cover.js";

export function makeObservation({
  avoiderApi,
  options,
  otherToken: observerToken,
  otherTokenDoc: observerTokenDoc,
  otherActor: observerActor,
}) {
  let observation = {
    dc: observerActor.system.perception.dc,
    name: observerTokenDoc.name,
    observerId: observerToken.id,
    tokenDoc: observerTokenDoc,
    coverOrConcealment: !options.strict,
  };

  let coverBonus = getRelativeCover({
    api: avoiderApi,
    options,
    observerToken,
  });

  if (coverBonus < 0) coverBonus = avoiderApi.baseCoverBonus;
  if (!observation.coverOrConcealment) {
    observation.coverOrConcealment =
      coverBonus > 1
        ? true
        : getRelativeConcealment({
            api: avoiderApi,
            options,
            observerToken,
          });
  }

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

  if (dos < 1 || !observation.coverOrConcealment) {
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
