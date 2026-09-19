import { AvoidNoticePopupMenu } from "./menu.js";
import { debuglog, iterateTokensAndParties } from "./main.js";
import { MODULE_ID, SLUGS } from "./const.js";
import { clearActorStealth } from "./stealth.js";
import { revealAvoidersTo, undoRevealsOf } from "./effects.js";
import { refreshEverybody } from "./socket.js";

export async function invokeConnectedTokensMenu({ controlled, targeted }) {
  debuglog("invokeConnectedTokensMenu", { selected: controlled, targeted });

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
  let controlledObservingTokens = [];

  let choices = [
    {
      key: "refresh",
      label: game.i18n.localize(`${MODULE_ID}.menu.refresh.label`),
      hint: `${MODULE_ID}.menu.refresh.hint`,
      section: 0,
    },
  ];

  if (controlledAvoidingTokens.length > 0) {
    choices.push({
      key: "divider",
      label: "------------------------",
      section: 1,
      disabled: true,
    });
    controlledObservingTokens = controlledAvoidingTokens.filter((c) => {
      const avoider = c?.actor;
      const stealth = avoider?.items?.find(
        (i) => i.slug === SLUGS.stealthEffect,
      );
      const flags = stealth?.flags?.[MODULE_ID];
      const exceptions = (flags?.hidden?.except || []).concat(
        flags?.undetected?.except || [],
      );
      return targeted.tokens.some((t) => exceptions.includes(t.id));
    });
    if (controlledObservingTokens.length) {
      choices.push({
        key: "undo-controlled-reveals",
        label: game.i18n.localize(
          `${MODULE_ID}.menu.undoControlledRevealsToTargeted.label`,
        ),
        hint: `${MODULE_ID}.menu.undoControlledRevealsToTargeted.hint`,
        section: 2,
      });
    }

    choices.push(
      {
        key: "reveal-controlled",
        label: game.i18n.localize(
          `${MODULE_ID}.menu.revealControlledToTargeted.label`,
        ),
        hint: `${MODULE_ID}.menu.revealControlledToTargeted.hint`,
        section: 2,
      },
      {
        key: "remove-controlled-stealth",
        label: game.i18n.localize(
          `${MODULE_ID}.menu.removeControlledStealth.label`,
        ),
        hint: `${MODULE_ID}.menu.removeControlledStealth.hint`,
        section: 2,
      },
    );
  }

  if (targetedAvoidingTokens.length > 0) {
    choices.push(
      {
        key: "divider",
        label: "------------------------",
        section: 3,
        disabled: true,
      },
      {
        key: "reveal-targeted",
        label: game.i18n.localize(
          `${MODULE_ID}.menu.revealTargetedToControlled.label`,
        ),
        hint: `${MODULE_ID}.menu.revealTargetedToControlled.hint`,
        section: 4,
      },
      {
        key: "remove-targeted-stealth",
        label: game.i18n.localize(
          `${MODULE_ID}.menu.removeTargetedStealth.label`,
        ),
        hint: `${MODULE_ID}.menu.removeTargetedStealth.hint`,
        section: 4,
      },
    );
  }

  choices.sort((a, b) =>
    a.section === b.section
      ? a.label.localeCompare(b.label)
      : a.section - b.section,
  );
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
    case "undo-controlled-reveals":
      debuglog("undo-controlled-reveals");
      undoRevealsOf({
        avoiders: controlledAvoidingTokens,
        observers: targeted.tokens,
      });
      break;
    case "undo-targeted-reveals":
      debuglog("undo-targeted-reveals");
      undoRevealsOf({
        avoiders: targetedAvoidingTokens,
        observers: controlled.tokens,
      });
      break;
    default:
      return;
  }
  refreshEverybody();
}
