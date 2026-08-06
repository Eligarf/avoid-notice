import { AvoidNoticePopupMenu } from "./menu.js";
import { setAsAmbushers, clearActorStealth } from "./stealth.js";
import { MODULE_ID, SLUGS } from "./const.js";
import { getVisibilityHandler } from "./main.js";
import { undoRevealsOf } from "./effects.js";
import {
  localizeString,
  debuglog,
  iterateActorsForTokensAndParties,
} from "./main.js";
import { testAvoidance } from "./avoidance-test.js";
import { refreshEverybody } from "./socket.js";

export async function invokeTokensMenu({ selection }) {
  debuglog("invokeTokensMenu", { selection });
  const title = localizeString(`${MODULE_ID}.menu.tokensSelected`, {
    type: selection.type,
  });

  let choices = [
    {
      key: "refresh",
      label: game.i18n.localize(`${MODULE_ID}.menu.refresh.label`),
      hint: `${MODULE_ID}.menu.refresh.hint`,
    },
  ];
  const visibilityHandler = getVisibilityHandler();
  if (visibilityHandler !== "visioner") {
    const avoiders = selection.tokens.filter((token) =>
      token.actor?.items?.some((i) => i.slug === SLUGS.stealthEffect),
    );

    if (avoiders.length > 0) {
      choices.push({
        key: "remove-stealth",
        label:
          selection.type === "controlled"
            ? game.i18n.localize(
                `${MODULE_ID}.menu.removeControlledStealth.label`,
              )
            : game.i18n.localize(
                `${MODULE_ID}.menu.removeTargetedStealth.label`,
              ),
        hint:
          selection.type === "controlled"
            ? game.i18n.localize(
                `${MODULE_ID}.menu.removeControlledStealth.hint`,
              )
            : game.i18n.localize(
                `${MODULE_ID}.menu.removeTargetedStealth.hint`,
              ),
      });

      const hiddenObserved = avoiders.some((token) => {
        const stealth = token.actor?.items?.find(
          (i) => i.slug === SLUGS.stealthEffect,
        );
        const exceptions = stealth?.flags?.[MODULE_ID]?.hidden;
        return exceptions?.exceptFor?.length > 0;
      });
      const undetectedObserved = avoiders.some((token) => {
        const stealth = token.actor?.items?.find(
          (i) => i.slug === SLUGS.stealthEffect,
        );
        const exceptions = stealth?.flags?.[MODULE_ID]?.undetected;
        return exceptions?.exceptFor?.length > 0;
      });

      if (hiddenObserved && undetectedObserved) {
        choices.push({
          key: "undo-hidden",
          label: game.i18n.localize(
            `${MODULE_ID}.menu.undoHiddenReveals.label`,
          ),
          hint: localizeString(`${MODULE_ID}.menu.undoHiddenReveals.hint`, {
            type: game.i18n.localize(
              `${MODULE_ID}.menu.type.${selection.type}`,
            ),
          }),
        });
        choices.push({
          key: "undo-undetected",
          label: game.i18n.localize(
            `${MODULE_ID}.menu.undoUndetectedReveals.label`,
          ),
          hint: localizeString(`${MODULE_ID}.menu.undoUndetectedReveals.hint`, {
            type: game.i18n.localize(
              `${MODULE_ID}.menu.type.${selection.type}`,
            ),
          }),
        });
      } else if (hiddenObserved || undetectedObserved) {
        choices.push({
          key: "undo-reveals",
          label: game.i18n.localize(`${MODULE_ID}.menu.undoReveals.label`),
          hint: localizeString(`${MODULE_ID}.menu.undoReveals.hint`, {
            type: game.i18n.localize(
              `${MODULE_ID}.menu.type.${selection.type}`,
            ),
          }),
        });
      }
    }
  }

  const combat = game?.combat;
  if (!combat && !selection.dispositions.has(1)) {
    choices.push({
      key: "prepare-ambush",
      label: game.i18n.localize(`${MODULE_ID}.menu.prepareAmbush.label`),
      hint: localizeString(`${MODULE_ID}.menu.prepareAmbush.hint`, {
        type: game.i18n.localize(`${MODULE_ID}.menu.type.${selection.type}`),
      }),
    });
  }

  if (!combat) {
    choices.push({
      key: "test-avoidance",
      label: game.i18n.localize(`${MODULE_ID}.menu.testAvoidance.label`),
      hint: localizeString(`${MODULE_ID}.menu.testAvoidance.hint`, {
        type: game.i18n.localize(`${MODULE_ID}.menu.type.${selection.type}`),
      }),
    });
  }

  choices.sort((a, b) => a.label.localeCompare(b.label));
  const choice = await AvoidNoticePopupMenu.show(title, choices);

  switch (choice?.key) {
    case "refresh":
      refreshEverybody();
      break;
    case "prepare-ambush":
      debuglog("prepare-ambush", selection.tokens);
      await setAsAmbushers(selection.tokens);
      break;
    case "remove-stealth":
      debuglog("remove-stealth", selection.tokens);
      await iterateActorsForTokensAndParties(
        selection.tokens,
        async (actor) => {
          await clearActorStealth({ actor });
        },
      );
      break;
    case "test-avoidance":
      debuglog("test-avoidance", selection.tokens);
      await testAvoidance(selection.tokens, choice.secret);
      break;
    case "undo-hidden":
      debuglog("undo-hidden", selection.tokens);
      undoRevealsOf({ avoiders: selection.tokens, type: "hidden" });
      refreshEverybody();
      break;
    case "undo-undetected":
      debuglog("undo-undetected", selection.tokens);
      undoRevealsOf({ avoiders: selection.tokens, type: "undetected" });
      refreshEverybody();
      break;
    case "undo-reveals":
      debuglog("undo-reveals", selection.tokens);
      undoRevealsOf({ avoiders: selection.tokens, type: "hidden" });
      undoRevealsOf({ avoiders: selection.tokens, type: "undetected" });
      refreshEverybody();
      break;
  }
}
