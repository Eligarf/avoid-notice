import { log } from "./main.js";

export async function enrageBarbarians(pcs) {
  const beforeV14 = Number(game.version.split()[0]) < 14;
  const quickTempered = pcs.filter((c) =>
    c.actor.items.some((i) => i?.system?.slug === "quick-tempered"),
  );
  for (const barbarian of quickTempered) {
    const rage = barbarian.actor.items.find(
      (i) => i?.system?.slug === "rage" && i?.system?.selfEffect,
    );
    if (!rage) continue;
    if (beforeV14) {
      const object = barbarian.token?._object;
      if (!object?.control) continue;
      object.control();
    } else {
      const token = canvas.tokens.placeables.find(
        (t) => t.id === barbarian.token.id,
      );
      if (!token) continue;
      token.control({ releaseOthers: true });
    }
    await game.pf2e.rollItemMacro(rage.id);
  }
}
