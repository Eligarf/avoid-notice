import { interpolateString, getVisibilityHandler, log } from "./main.js";
import { getPerceptionApi, clearPerceptionData } from "./pf2e_perception.js";
import { getVisionerApi, clearVisionerData } from "./visioner.js";

export async function clearTokenStealth({ token, showBanner = false } = {}) {
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
  const visibilityHandler = getVisibilityHandler();

  const perceptionApi =
    visibilityHandler === "perception" ? getPerceptionApi() : null;
  if (perceptionApi) await clearPerceptionData(token.document);

  const visionerApi =
    visibilityHandler === "visioner" ? getVisionerApi() : null;
  if (visionerApi) await clearVisionerData({ token, visionerApi });

  const conditions = token.actor.items
    .filter((i) =>
      ["hidden", "undetected", "unnoticed"].includes(i.system.slug),
    )
    .map((i) => i.id);
  if (conditions.length > 0) {
    await token.actor.deleteEmbeddedDocuments("Item", conditions);
  }
}

export async function clearPartyStealth({ showBanner = false }) {
  if (showBanner) {
    ui.notifications.info(
      game.i18n.localize("pf2e-avoid-notice.clearPartyStealth.banner"),
    );
  }
  const party = canvas.scene.tokens.filter((t) =>
    game.actors.party.members.some((a) => a.id === t?.actor?.id),
  );
  for (const token of party) {
    await clearTokenStealth({ token });
  }
}
