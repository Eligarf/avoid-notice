async function updateConditionStatus({ actor, remove = [], add = "" }) {
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

async function updateConditionVsBestDc(avoider, visibilities) {
  if ("observed" in visibilities) {
    await updateConditionStatus({
      actor: avoider.actor,
      remove: ["hidden", "undetected", "unnoticed"],
    });
  } else if ("hidden" in visibilities) {
    await updateConditionStatus({
      actor: avoider.actor,
      remove: ["undetected", "unnoticed"],
      add: "hidden",
    });
  } else if ("undetected" in visibilities) {
    await updateConditionStatus({
      actor: avoider.actor,
      remove: ["hidden", "unnoticed"],
      add: "undetected",
    });
  } else if ("unnoticed" in visibilities) {
    await updateConditionStatus({
      actor: avoider.actor,
      remove: ["hidden", "undetected"],
      add: "unnoticed",
    });
  }
}

async function updateConditionVsWorstDc(avoider, visibilities) {
  if ("unnoticed" in visibilities) {
    await updateConditionStatus({
      actor: avoider.actor,
      remove: ["hidden", "undetected"],
      add: "unnoticed",
    });
  } else if ("undetected" in visibilities) {
    await updateConditionStatus({
      actor: avoider.actor,
      remove: ["hidden", "unnoticed"],
      add: "undetected",
    });
  } else if ("hidden" in visibilities) {
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

    let visibilities = {};
    for (const observerId in observers) {
      const observation = observers[observerId].observation;

      if (!(observation.visibility in visibilities)) {
        visibilities[observation.visibility] = true;
      }
    }
    await updateConditionVsBestDc(avoider, visibilities);
  }
}

export async function processObservationsForWorstDc(observations) {
  for (const avoiderId in observations) {
    const { avoiderApi, observers } = observations[avoiderId];
    const avoider = avoiderApi.avoider;

    let visibilities = {};
    for (const observerId in observers) {
      const observation = observers[observerId].observation;

      if (!(observation.visibility in visibilities)) {
        visibilities[observation.visibility] = true;
      }
    }
    await updateConditionVsWorstDc(avoider, visibilities);
  }
}
