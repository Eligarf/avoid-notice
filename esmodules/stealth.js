import { interpolateString, refreshPerception, log } from "./main.js";
import { SETTINGS } from "./settings.js";
import { MODULE_ID } from "./const.js";

export async function clearTokenStealth({
  token,
  refresh = true,
  showBanner = false,
} = {}) {
  const conditions = token.actor.items
    .filter((i) =>
      ["hidden", "undetected", "unnoticed"].includes(i.system.slug),
    )
    .map((i) => i.id);
  if (conditions.length > 0) {
    await token.actor.deleteEmbeddedDocuments("Item", conditions);
  }

  if (showBanner) {
    ui.notifications.info(
      interpolateString(
        game.i18n.localize("pf2e-avoid-notice.clearStealth.banner"),
        {
          name: token.name,
        },
      ),
    );
  }
}

export async function clearPartyStealth({ showBanner = false }) {
  const party = canvas.scene.tokens.filter((t) =>
    game.actors.party.members.some((a) => a.id === t?.actor?.id),
  );

  for (const token of party) {
    await clearTokenStealth({ token, refresh: false });
  }

  // Refresh everyone and maybe show banner
  refreshPerception();
  if (showBanner) {
    ui.notifications.info(
      game.i18n.localize("pf2e-avoid-notice.clearPartyStealth.banner"),
    );
  }
}

export async function hideTokens(tokens) {
  let tokenUpdates = [];

  for (const token of tokens) {
    tokenUpdates.push({ _id: token.id, hidden: true });
    const actor = token?.actor;
    if (!actor) continue;
    await actor.update({ "system.initiative.statistic": "stealth" });
    if (actor.type === "hazard")
      await actor.toggleCondition("hidden", { active: true });
  }

  if (tokenUpdates.length > 0) {
    canvas.scene.updateEmbeddedDocuments("Token", tokenUpdates);
  }
}
