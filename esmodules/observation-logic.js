import { clampDos, debuglog } from "./utils.js";
import { prepareTargetList } from "./render-status.js";
import { MODULE_ID } from "./const.js";

export function makeObservation({ avoider, observer, analyze }) {
  let observation = {
    dc: observer.actor.system.perception.dc,
    name: observer.name,
    observerId: observer.id,
    tokenDoc: observer,
  };

  let coverBonus = avoider.baseCoverBonus;
  if (coverBonus > 0) {
    observation.coverBonus = coverBonus;
    switch (coverBonus) {
      case 2:
        observation.tooltip = game.i18n.localize(`${MODULE_ID}.standardCover`);
        break;
      case 4:
        observation.tooltip = game.i18n.localize(`${MODULE_ID}.greaterCover`);
        break;
    }
  }

  const delta = avoider.skillResult + coverBonus - observation.dc;
  observation.delta = delta;
  observation.deltaStr = delta < 0 ? `${delta}` : `+${delta}`;
  observation.degreeOfSuccess = clampDos(delta, avoider.rawRollDosDelta);
  analyze(avoider, observation);
  // debuglog("makeObservation", { avoider, observer, observation });

  return observation;
}

export function testAvoiderStealthAgainstObservers({
  avoider,
  observers,
  analyze,
}) {
  const observations = observers
    .filter((observer) => {
      return observer.actor?.system?.perception?.dc;
    })
    .map((observer) => {
      const observation = makeObservation({
        avoider,
        observer,
        analyze,
      });
      return observation;
    });
  return observations.sort((a, b) => a.delta - b.delta);
}

export function prepareObservations(observations) {
  const summary = observations.reduce((acc, obs) => {
    const visibility = obs.visibility;
    acc[visibility] = (acc[visibility] || 0) + 1;
    return acc;
  }, {});

  const sortedObservers = observations.sort((a, b) => {
    const diff = b.dc - a.dc;
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
  });
  const targetList = prepareTargetList(sortedObservers);
  return { summary, targetList };
}
