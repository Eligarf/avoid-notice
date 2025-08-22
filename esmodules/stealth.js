import {
  interpolateString,
  getVisibilityHandler,
  log,
  refreshPerception,
} from "./main.js";
import { getPerceptionApi, clearPerceptionData } from "./pf2e_perception.js";
import { getVisionerApi, clearVisionerData } from "./visioner.js";

export async function clearTokenStealth({
  token,
  refresh = true,
  showBanner = false,
} = {}) {
  const visibilityHandler = getVisibilityHandler();

  const perceptionApi =
    visibilityHandler === "perception" ? getPerceptionApi() : null;
  if (perceptionApi) await clearPerceptionData(token);

  const visionerApi =
    visibilityHandler === "visioner" ? getVisionerApi() : null;
  if (visionerApi) await clearVisionerData({ token, visionerApi, refresh });

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
  }

  if (tokenUpdates.length > 0) {
    canvas.scene.updateEmbeddedDocuments("Token", tokenUpdates);
  }
}
