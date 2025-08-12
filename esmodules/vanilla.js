export async function updateConditionStatus({ actor, remove = [], add = "" }) {
  // log('tweakStatus', { actor, remove, add });
  const removals = actor.items
    .filter((i) => i.type === "condition" && remove.includes(i.system.slug))
    .map((i) => i.system.slug);
  for (const c of removals) {
    await actor.toggleCondition(c, { active: false });
  }
  if (!add) return;
  await actor.toggleCondition(add, { active: true });
}

export async function updateConditionVsBestDc(avoider, results) {
  if ("observed" in results) {
    await updateConditionStatus({
      actor: avoider.actor,
      remove: ["hidden", "undetected", "unnoticed"],
    });
  } else if ("hidden" in results) {
    await updateConditionStatus({
      actor: avoider.actor,
      remove: ["undetected", "unnoticed"],
      add: "hidden",
    });
  } else if ("undetected" in results) {
    await updateConditionStatus({
      actor: avoider.actor,
      remove: ["hidden", "unnoticed"],
      add: "undetected",
    });
  } else if ("unnoticed" in results) {
    await updateConditionStatus({
      actor: avoider.actor,
      remove: ["hidden", "undetected"],
      add: "unnoticed",
    });
  }
}

export async function updateConditionVsWorstDc(avoider, results) {
  if ("unnoticed" in results) {
    await updateConditionStatus({
      actor: avoider.actor,
      remove: ["hidden", "undetected"],
      add: "unnoticed",
    });
  } else if ("undetected" in results) {
    await updateConditionStatus({
      actor: avoider.actor,
      remove: ["hidden", "unnoticed"],
      add: "undetected",
    });
  } else if ("hidden" in results) {
    await updateConditionStatus({
      actor: avoider.actor,
      remove: ["undetected", "unnoticed"],
      add: "hidden",
    });
  } else {
    await updateConditionStatus({
      actor: avoider.actor,
      remove: ["hidden", "undetected", "unnoticed"],
    });
  }
}

export async function processObservationsForBestDc(observations) {
  for (const avoiderId in observations) {
    const { avoiderApi, observers } = observations[avoiderId];
    const avoider = avoiderApi.avoider;

    // walk through all the observers and group their observations by result
    for (const observerId in observers) {
      const observation = observers[observerId].visibility;
    }
  }
}

export async function processObservationsForWorstDc(observations) {
  for (const avoiderId in observations) {
    const { avoiderApi, observers } = observations[avoiderId];
    const avoider = avoiderApi.avoider;

    // walk through all the observers and group their observations by result
    for (const observerId in observers) {
      const observation = observers[observerId].visibility;
    }
  }
}
