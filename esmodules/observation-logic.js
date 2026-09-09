import { MODULE_ID } from "./const.js";
import { getCoverFrom } from "./cover.js";
import { debuglog } from "./main.js";

export function makeObservation({
  avoiderApi,
  options,
  observer,
  observerToken,
  observerTokenDoc,
  observerActor,
}) {
  let observation = {
    dc: observerActor.system.perception.dc,
    name: observerTokenDoc.name,
    observer,
    observerId: observerToken.id,
    tokenDoc: observerTokenDoc,
  };

  let coverBonus = getCoverFrom({
    api: avoiderApi,
    options,
    observerToken,
  });

  if (coverBonus < 0) coverBonus = avoiderApi.baseCoverBonus;
  if (coverBonus > 0) {
    observation.coverBonus = coverBonus;
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
  observation.delta = delta;
  const dos =
    avoiderApi.initiativeDosDelta +
    (delta < -9 ? 0 : delta < 0 ? 1 : delta > 9 ? 3 : 2);
  observation.degreeOfSuccess = dos;

  if (dos < 1) {
    observation.visibility = "observed";
  }

  // Normal fail is hidden
  else if (dos < 2) {
    observation.visibility = "hidden";
  }

  // avoider beat the other token at the stealth battle
  else {
    observation.visibility = "undetected";
  }

  return observation;
}

export function evaluateObservation({
  observation,
  options,
  minionTokens,
  eidolonTokens,
}) {
  const delta = observation.delta;
  observation.deltaStr = delta < 0 ? `${delta}` : `+${delta}`;

  observation.success =
    observation.visibility !== "observed" &&
    observation.visibility !== "hidden";
}
