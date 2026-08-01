import { AvoidNoticePopupMenu } from "./menu.js";
import {
  debuglog,
  getVisibilityHandler,
  iterateActorsForTokensAndParties,
} from "./main.js";
import { MODULE_ID, SLUGS } from "./const.js";
import { clearActorStealth } from "./stealth.js";
import { revealAvoidersTo } from "./effects.js";
import { refreshEverybody } from "./socket.js";

export async function invokeConnectedTokensMenu({ controlled, targeted }) {
  debuglog("invokeConnectedTokensMenu", { selected: controlled, targeted });

  if (getVisibilityHandler() === "visioner") return;

  const controlledActors = controlled.tokens.map((t) => t?.actor);
  const targetedActors = targeted.tokens.map((t) => t?.actor);

  let choices = [
    {
      key: "refresh",
      label: game.i18n.localize(`${MODULE_ID}.menu.refresh.label`),
      hint: `${MODULE_ID}.menu.refresh.hint`,
    },
  ];

  const controlledAvoiders = controlledActors.filter((actor) =>
    actor?.items?.some((item) => item.system.slug === SLUGS.stealthEffect),
  );
  if (controlledAvoiders.length > 0) {
    const hiddenControlledObserved = controlledAvoiders.some((avoider) => {
      const stealth = avoider?.items?.find(
        (i) => i.slug === SLUGS.stealthEffect,
      );
      const exceptions = stealth?.flags?.[MODULE_ID]?.hidden;
      return exceptions?.exceptFor?.length > 0;
    });
    const undetectedControlledObserved = controlledAvoiders.some((avoider) => {
      const stealth = avoider?.items?.find(
        (i) => i.slug === SLUGS.stealthEffect,
      );
      const exceptions = stealth?.flags?.[MODULE_ID]?.undetected;
      return exceptions?.exceptFor?.length > 0;
    });
    debuglog("control hidden/undetected observed", {
      hiddenControlledObserved,
      undetectedControlledObserved,
    });

    choices.push(
      {
        key: "make-controlled-observable",
        label: game.i18n.localize(
          `${MODULE_ID}.menu.revealControlledToTargeted.label`,
        ),
        hint: `${MODULE_ID}.menu.revealControlledToTargeted.hint`,
      },
      {
        key: "remove-controlled-stealth",
        label: game.i18n.localize(
          `${MODULE_ID}.menu.removeControlledStealth.label`,
        ),
        hint: `${MODULE_ID}.menu.removeControlledStealth.hint`,
      },
    );
  }

  const targetedAvoiders = targetedActors.filter((actor) =>
    actor?.items?.some((item) => item.system.slug === SLUGS.stealthEffect),
  );
  if (targetedAvoiders.length > 0) {
    const hiddenTargetedObserved = targetedAvoiders.some((avoider) => {
      const stealth = avoider?.items?.find(
        (i) => i.slug === SLUGS.stealthEffect,
      );
      const exceptions = stealth?.flags?.[MODULE_ID]?.hidden;
      return exceptions?.exceptFor?.length > 0;
    });
    const undetectedTargetedObserved = targetedAvoiders.some((avoider) => {
      const stealth = avoider?.items?.find(
        (i) => i.slug === SLUGS.stealthEffect,
      );
      const exceptions = stealth?.flags?.[MODULE_ID]?.undetected;
      return exceptions?.exceptFor?.length > 0;
    });
    debuglog("target hidden/undetected observed", {
      hiddenTargetedObserved,
      undetectedTargetedObserved,
    });

    choices.push(
      {
        key: "make-targeted-observable",
        label: game.i18n.localize(
          `${MODULE_ID}.menu.revealTargetedToControlled.label`,
        ),
        hint: `${MODULE_ID}.menu.revealTargetedToControlled.hint`,
      },
      {
        key: "remove-targeted-stealth",
        label: game.i18n.localize(
          `${MODULE_ID}.menu.removeTargetedStealth.label`,
        ),
        hint: `${MODULE_ID}.menu.removeTargetedStealth.hint`,
      },
    );
  }

  choices.sort((a, b) => a.label.localeCompare(b.label));
  const choice = await AvoidNoticePopupMenu.show(
    `${MODULE_ID}.menu.connectedTokens`,
    choices,
  );

  switch (choice?.key) {
    case "refresh":
      refreshEverybody();
      break;
    case "make-controlled-observable":
      await revealAvoidersTo({
        avoiders: controlledAvoiders,
        observers: targetedActors,
      });
      break;
    case "make-targeted-observable":
      await revealAvoidersTo({
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
