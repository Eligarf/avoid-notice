import { AvoidNoticePopupMenu } from "./menu.js";
import {
  debuglog,
  getVisibilityHandler,
  iterateActorsForTokensAndParties,
} from "./main.js";
import { MODULE_ID, SLUGS } from "./const.js";
import { clearActorStealth } from "./stealth.js";
import { revealAvoidersTo, undoRevealsOf } from "./effects.js";
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

    if (hiddenControlledObserved && undetectedControlledObserved) {
      choices.push({
        key: "undo-controlled-hidden-reveals",
        label: game.i18n.localize(
          `${MODULE_ID}.menu.undoControlledHiddenRevealsToTargeted.label`,
        ),
        hint: `${MODULE_ID}.menu.undoControlledHiddenRevealsToTargeted.hint`,
      });
      choices.push({
        key: "undo-controlled-undetected-reveals",
        label: game.i18n.localize(
          `${MODULE_ID}.menu.undoControlledUndetectedRevealsToTargeted.label`,
        ),
        hint: `${MODULE_ID}.menu.undoControlledUndetectedRevealsToTargeted.hint`,
      });
    } else if (hiddenControlledObserved || undetectedControlledObserved) {
      choices.push({
        key: "undo-controlled-reveals",
        label: game.i18n.localize(
          `${MODULE_ID}.menu.undoControlledRevealsToTargeted.label`,
        ),
        hint: `${MODULE_ID}.menu.undoControlledRevealsToTargeted.hint`,
      });
    }

    choices.push(
      {
        key: "reveal-controlled",
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

    if (hiddenTargetedObserved && undetectedTargetedObserved) {
      choices.push({
        key: "undo-targeted-hidden-reveals",
        label: game.i18n.localize(
          `${MODULE_ID}.menu.undoTargetedHiddenRevealsToControlled.label`,
        ),
        hint: `${MODULE_ID}.menu.undoTargetedHiddenRevealsToControlled.hint`,
      });
      choices.push({
        key: "undo-targeted-undetected-reveals",
        label: game.i18n.localize(
          `${MODULE_ID}.menu.undoTargetedUndetectedRevealsToControlled.label`,
        ),
        hint: `${MODULE_ID}.menu.undoTargetedUndetectedRevealsToControlled.hint`,
      });
    } else if (hiddenTargetedObserved || undetectedTargetedObserved) {
      choices.push({
        key: "undo-targeted-reveals",
        label: game.i18n.localize(
          `${MODULE_ID}.menu.undoTargetedRevealsToControlled.label`,
        ),
        hint: `${MODULE_ID}.menu.undoTargetedRevealsToControlled.hint`,
      });
    }

    choices.push(
      {
        key: "reveal-targeted",
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
    case "reveal-controlled":
      await revealAvoidersTo({
        avoiders: controlledAvoiders,
        observers: targetedActors,
      });
      break;
    case "reveal-targeted":
      await revealAvoidersTo({
        avoiders: targetedAvoiders,
        observers: controlledActors,
      });
      break;
    case "undo-controlled-hidden-reveals":
      debuglog("undo-controlled-hidden-reveals");
      break;
    case "undo-controlled-undetected-reveals":
      debuglog("undo-controlled-undetected-reveals");
      break;
    case "undo-controlled-reveals":
      debuglog("undo-controlled-reveals");
      break;
    case "undo-targeted-hidden-reveals":
      debuglog("undo-targeted-hidden-reveals");
      break;
    case "undo-targeted-undetected-reveals":
      debuglog("undo-targeted-undetected-reveals");
      break;
    case "undo-controlled-reveals":
      debuglog("undo-targeted-reveals");
      break;
  }
}
