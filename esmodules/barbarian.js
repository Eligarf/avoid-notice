import { log } from "./main.js";

export async function enrageBarbarians(pcs) {
  const quickTempered = pcs.filter((c) =>
    c.actor.items.some((i) => i?.system?.slug === "quick-tempered"),
  );
  for (const barbarian of quickTempered) {
    const rage = barbarian.actor.items.find(
      (i) => i?.system?.slug === "rage" && i?.system?.selfEffect,
    );
    if (!rage) continue;
    const object = barbarian.token?._object;
    if (!object?.control) continue;
    object.control();
    log(`enraging ${barbarian.actor.name}`);
    await game.pf2e.rollItemMacro(rage.id);
  }
}
