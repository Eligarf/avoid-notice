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
  const controlledAvoidingTokens = controlled.tokens.filter((t) => {
    const actor = t?.actor;
    return actor?.items?.some(
      (item) => item.system.slug === SLUGS.stealthEffect,
    );
  });
  const targetedAvoidingTokens = targeted.tokens.filter((t) => {
    const actor = t?.actor;
    return actor?.items?.some(
      (item) => item.system.slug === SLUGS.stealthEffect,
    );
  });
  let hiddenControlledObservingActors = [];
  let undetectedControlledObservingActors = [];
  let hiddenTargetedObservingActors = [];
  let undetectedTargetedObservingActors = [];

  let choices = [
    {
      key: "refresh",
      label: game.i18n.localize(`${MODULE_ID}.menu.refresh.label`),
      hint: `${MODULE_ID}.menu.refresh.hint`,
    },
  ];

  const controlledAvoidingActors = controlledActors.filter((actor) =>
    actor?.items?.some((item) => item.system.slug === SLUGS.stealthEffect),
  );
  if (controlledAvoidingActors.length > 0) {
    hiddenControlledObservingActors = controlledAvoidingActors.filter(
      (avoider) => {
        const stealth = avoider?.items?.find(
          (i) => i.slug === SLUGS.stealthEffect,
        );
        const exceptions = stealth?.flags?.[MODULE_ID]?.hidden;
        return targetedActors.some((a) =>
          exceptions?.exceptFor?.includes(a.id),
        );
      },
    );
    if (hiddenControlledObservingActors.length) {
      choices.push({
        key: "undo-controlled-hidden-reveals",
        label: game.i18n.localize(
          `${MODULE_ID}.menu.undoControlledHiddenRevealsToTargeted.label`,
        ),
        hint: `${MODULE_ID}.menu.undoControlledHiddenRevealsToTargeted.hint`,
      });
    }
    undetectedControlledObservingActors = controlledAvoidingActors.filter(
      (avoider) => {
        const stealth = avoider?.items?.find(
          (i) => i.slug === SLUGS.stealthEffect,
        );
        const exceptions = stealth?.flags?.[MODULE_ID]?.undetected;
        return targetedActors.some((a) =>
          exceptions?.exceptFor?.includes(a.id),
        );
      },
    );
    if (undetectedControlledObservingActors.length) {
      choices.push({
        key: "undo-controlled-undetected-reveals",
        label: game.i18n.localize(
          `${MODULE_ID}.menu.undoControlledUndetectedRevealsToTargeted.label`,
        ),
        hint: `${MODULE_ID}.menu.undoControlledUndetectedRevealsToTargeted.hint`,
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

  const targetedAvoidingActors = targetedActors.filter((actor) =>
    actor?.items?.some((item) => item.system.slug === SLUGS.stealthEffect),
  );
  if (targetedAvoidingActors.length > 0) {
    // hiddenTargetedObservingActors = targetedAvoidingActors.filter((avoider) => {
    //   const stealth = avoider?.items?.find(
    //     (i) => i.slug === SLUGS.stealthEffect,
    //   );
    //   const exceptions = stealth?.flags?.[MODULE_ID]?.hidden;
    //   return controlledActors.some((a) =>
    //     exceptions?.exceptFor?.includes(a.id),
    //   );
    // });
    // if (hiddenTargetedObservingActors.length) {
    //   choices.push({
    //     key: "undo-targeted-hidden-reveals",
    //     label: game.i18n.localize(
    //       `${MODULE_ID}.menu.undoTargetedHiddenRevealsToControlled.label`,
    //     ),
    //     hint: `${MODULE_ID}.menu.undoTargetedHiddenRevealsToControlled.hint`,
    //   });
    // }
    //
    // undetectedTargetedObservingActors = targetedAvoidingActors.filter(
    //   (avoider) => {
    //     const stealth = avoider?.items?.find(
    //       (i) => i.slug === SLUGS.stealthEffect,
    //     );
    //     const exceptions = stealth?.flags?.[MODULE_ID]?.undetected;
    //     return controlledActors.some((a) =>
    //       exceptions?.exceptFor?.includes(a.id),
    //     );
    //   },
    // );
    // if (undetectedTargetedObservingActors.length) {
    //   choices.push({
    //     key: "undo-targeted-undetected-reveals",
    //     label: game.i18n.localize(
    //       `${MODULE_ID}.menu.undoTargetedUndetectedRevealsToControlled.label`,
    //     ),
    //     hint: `${MODULE_ID}.menu.undoTargetedUndetectedRevealsToControlled.hint`,
    //   });
    // }

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
      debuglog("reveal-controlled");
      await revealAvoidersTo({
        avoiders: controlledAvoidingTokens,
        observers: targetedActors,
      });
      break;
    case "reveal-targeted":
      debuglog("reveal-targeted");
      await revealAvoidersTo({
        avoiders: targetedAvoidingActors,
        observers: controlledActors,
      });
      break;
    case "undo-controlled-hidden-reveals":
      debuglog("undo-controlled-hidden-reveals");
      undoRevealsOf({
        avoiders: controlledAvoidingTokens,
        type: "hidden",
        observers: targetedActors,
      });
      break;
    case "undo-controlled-undetected-reveals":
      debuglog("undo-controlled-undetected-reveals");
      undoRevealsOf({
        avoiders: controlledAvoidingTokens,
        type: "undetected",
        observers: targetedActors,
      });
      break;
    case "undo-targeted-hidden-reveals":
      debuglog("undo-targeted-hidden-reveals");
      undoRevealsOf({
        avoiders: targetedAvoidingTokens,
        type: "hidden",
        observers: controlledActors,
      });
      break;
    case "undo-targeted-undetected-reveals":
      debuglog("undo-targeted-undetected-reveals");
      undoRevealsOf({
        avoiders: targetedAvoidingTokens,
        type: "undetected",
        observers: controlledActors,
      });
      break;
    default:
      return;
  }
  refreshEverybody();
}
