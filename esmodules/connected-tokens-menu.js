import { AvoidNoticePopupMenu } from "./menu.js";
import {
  debuglog,
  getVisibilityHandler,
  iterateActorsForTokensAndParties,
} from "./main.js";
import { MODULE_ID, SLUGS } from "./const.js";
import { clearActorStealth } from "./stealth.js";
import { makeAvoidersObservableTo } from "./effects.js";

export async function invokeConnectedTokensMenu({ controlled, targeted }) {
  debuglog("invokeConnectedTokensMenu", { selected: controlled, targeted });

  if (getVisibilityHandler() === "visioner") return;

  const controlledActors = controlled.tokens.map((t) => t?.actor);
  const targetedActors = targeted.tokens.map((t) => t?.actor);
  const controlledAvoiders = controlledActors.filter((actor) =>
    actor?.items?.some((item) => item.system.slug === SLUGS.stealthEffect),
  );
  const targetedAvoiders = targetedActors.filter((actor) =>
    actor?.items?.some((item) => item.system.slug === SLUGS.stealthEffect),
  );
  let choices = [];

  if (controlledAvoiders.length > 0) {
    choices.push(
      {
        key: "make-controlled-observable",
        label: game.i18n.localize(
          `${MODULE_ID}.menu.makeControlledObservableToTargeted.label`,
        ),
      },
      {
        key: "remove-controlled-stealth",
        label: game.i18n.localize(
          `${MODULE_ID}.menu.removeControlledStealth.label`,
        ),
      },
    );
  }

  if (targetedAvoiders.length > 0) {
    choices.push(
      {
        key: "make-targeted-observable",
        label: game.i18n.localize(
          `${MODULE_ID}.menu.makeTargetedObservableToControlled.label`,
        ),
      },
      {
        key: "remove-targeted-stealth",
        label: game.i18n.localize(
          `${MODULE_ID}.menu.removeTargetedStealth.label`,
        ),
      },
    );
  }

  if (choices.length === 0) return;

  choices.sort((a, b) => a.label.localeCompare(b.label));
  const choice = await AvoidNoticePopupMenu.show(
    `${MODULE_ID}.menu.connectedTokens`,
    choices,
  );

  switch (choice?.key) {
    case "make-controlled-observable":
      await makeAvoidersObservableTo({
        avoiders: controlledAvoiders,
        observers: targetedActors,
      });
      break;
    case "make-targeted-observable":
      await makeAvoidersObservableTo({
        avoiders: targetedAvoiders,
        observers: controlledActors,
      });
      break;
    case "remove-controlled-stealth":
      debuglog("remove-controlled-stealth");
      await iterateActorsForTokensAndParties(
        controlled.tokens,
        async (actor) => {
          await clearActorStealth({ actor });
        },
      );
      break;
    case "remove-targeted-stealth":
      debuglog("remove-targeted-stealth");
      await iterateActorsForTokensAndParties(targeted.tokens, async (actor) => {
        await clearActorStealth({ actor });
      });
      break;
  }
}
