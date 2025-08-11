import { log } from "./main.js";
import { modifyInitiativeCard } from "./initiative.js";

export async function raiseDefendingShields(pcs) {
  const defenders = pcs.filter((c) =>
    c.actor.system.exploration.some(
      (a) => c.actor.items.get(a)?.system?.slug === "defend",
    ),
  );
  for (const defender of defenders) {
    const heldShield = defender.actor?.heldShield;
    if (!heldShield) {
      await modifyInitiativeCard({
        combatant: defender,
        message: game.i18n.localize(
          "pf2e-avoid-notice.raiseShields.needsHeldShield",
        ),
        interpolations: {
          activity: game.i18n.localize(
            "PF2E.TravelSpeed.ExplorationActivities.Defend",
          ),
          actor: defender.actor.name,
        },
      });
      continue;
    }
    const object = defender?.token?._object;
    if (!object?.control) continue;
    object.control();
    await game.pf2e.actions.raiseAShield({ actors: [defender.actor] });
    await modifyInitiativeCard({
      combatant: defender,
      message: game.i18n.localize("pf2e-avoid-notice.activity"),
      interpolations: {
        activity: game.i18n.localize(
          "PF2E.TravelSpeed.ExplorationActivities.Defend",
        ),
        actor: defender.actor.name,
      },
    });
    const fx = defender.actor.itemTypes.effect.find(
      (item) => item.system.slug === "effect-raise-a-shield",
    );
    if (fx) await fx.update({ "system.duration.value": 0 });
  }
}
