import { AvoidNoticePopupMenu } from "./menu.js";
import {
  debuglog,
  getVisibilityHandler,
  iterateTokensAndParties,
} from "./main.js";
import { MODULE_ID, SLUGS } from "./const.js";
import { clearActorStealth } from "./stealth.js";
import { revealAvoidersTo, undoRevealsOf } from "./effects.js";
import { refreshEverybody } from "./socket.js";

export async function invokeConnectedTokensMenu({ controlled, targeted }) {
  debuglog("invokeConnectedTokensMenu", { selected: controlled, targeted });

  if (getVisibilityHandler() === "visioner") return;

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
  let hiddenControlledObservingTokens = [];
  let undetectedControlledObservingTokens = [];

  let choices = [
    {
      key: "refresh",
      label: game.i18n.localize(`${MODULE_ID}.menu.refresh.label`),
      hint: `${MODULE_ID}.menu.refresh.hint`,
    },
  ];

  if (controlledAvoidingTokens.length > 0) {
    hiddenControlledObservingTokens = controlledAvoidingTokens.filter((c) => {
      const avoider = c?.actor;
      const stealth = avoider?.items?.find(
        (i) => i.slug === SLUGS.stealthEffect,
      );
      const exceptions = stealth?.flags?.[MODULE_ID]?.hidden;
      return targeted.tokens.some((t) => exceptions?.exceptFor?.includes(t.id));
    });
    if (hiddenControlledObservingTokens.length) {
      choices.push({
        key: "undo-controlled-hidden-reveals",
        label: game.i18n.localize(
          `${MODULE_ID}.menu.undoControlledHiddenRevealsToTargeted.label`,
        ),
        hint: `${MODULE_ID}.menu.undoControlledHiddenRevealsToTargeted.hint`,
      });
    }
    undetectedControlledObservingTokens = controlledAvoidingTokens.filter(
      (c) => {
        const avoider = c?.actor;
        const stealth = avoider?.items?.find(
          (i) => i.slug === SLUGS.stealthEffect,
        );
        const exceptions = stealth?.flags?.[MODULE_ID]?.undetected;
        return targeted.tokens.some((t) =>
          exceptions?.exceptFor?.includes(t.id),
        );
      },
    );
    if (undetectedControlledObservingTokens.length) {
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

  if (targetedAvoidingTokens.length > 0) {
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
      await iterateTokensAndParties(controlled.tokens, async (combatant) => {
        await clearActorStealth({ actor: combatant?.actor ?? combatant });
      });
      break;
    case "remove-targeted-stealth":
      debuglog("remove-targeted-stealth");
      await iterateTokensAndParties(targeted.tokens, async (combatant) => {
        await clearActorStealth({ actor: combatant?.actor ?? combatant });
      });
      break;
    case "reveal-controlled":
      debuglog("reveal-controlled");
      await revealAvoidersTo({
        avoiders: controlledAvoidingTokens,
        observers: targeted.tokens,
      });
      break;
    case "reveal-targeted":
      debuglog("reveal-targeted");
      await revealAvoidersTo({
        avoiders: targetedAvoidingTokens,
        observers: controlled.tokens,
      });
      break;
    case "undo-controlled-hidden-reveals":
      debuglog("undo-controlled-hidden-reveals");
      undoRevealsOf({
        avoiders: controlledAvoidingTokens,
        type: "hidden",
        observers: targeted.tokens,
      });
      break;
    case "undo-controlled-undetected-reveals":
      debuglog("undo-controlled-undetected-reveals");
      undoRevealsOf({
        avoiders: controlledAvoidingTokens,
        type: "undetected",
        observers: targeted.tokens,
      });
      break;
    case "undo-targeted-hidden-reveals":
      debuglog("undo-targeted-hidden-reveals");
      undoRevealsOf({
        avoiders: targetedAvoidingTokens,
        type: "hidden",
        observers: controlled.tokens,
      });
      break;
    case "undo-targeted-undetected-reveals":
      debuglog("undo-targeted-undetected-reveals");
      undoRevealsOf({
        avoiders: targetedAvoidingTokens,
        type: "undetected",
        observers: controlled.tokens,
      });
      break;
    default:
      return;
  }
  refreshEverybody();
}
