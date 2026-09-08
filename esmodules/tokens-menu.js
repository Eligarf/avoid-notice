import { AvoidNoticePopupMenu } from "./menu.js";
import { setAsAmbushers, clearActorStealth } from "./stealth.js";
import { MODULE_ID, SLUGS } from "./const.js";
import { undoRevealsOf } from "./effects.js";
import { localizeString, debuglog, iterateTokensAndParties } from "./main.js";
import { testAvoidance } from "./avoidance-test.js";
import { refreshEverybody } from "./socket.js";
import { cachedSettings } from "./settings.js";

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
      section: 0,
    },
  ];
  if (cachedSettings.useEffects) {
    const avoiders = selection.tokens.filter((token) =>
      token.actor?.items?.some((i) => i.slug === SLUGS.stealthEffect),
    );

    if (avoiders.length > 0) {
      choices.push({
        key: "divider",
        label: "------------------------",
        section: 1,
        disabled: true,
      });
      choices.push({
        key: "remove-stealth",
        label: game.i18n.localize(`${MODULE_ID}.menu.removeStealth.label`),
        hint:
          selection.type === "controlled"
            ? game.i18n.localize(
                `${MODULE_ID}.menu.removeControlledStealth.hint`,
              )
            : game.i18n.localize(
                `${MODULE_ID}.menu.removeTargetedStealth.hint`,
              ),
        section: 2,
      });

      const hiddenObserved = avoiders.some((token) => {
        const stealth = token.actor?.items?.find(
          (i) => i.slug === SLUGS.stealthEffect,
        );
        const exceptions = stealth?.flags?.[MODULE_ID]?.hidden;
        return exceptions?.exceptFor?.length > 0;
      });
      if (hiddenObserved) {
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
          section: 2,
        });
      }

      const undetectedObserved = avoiders.some((token) => {
        const stealth = token.actor?.items?.find(
          (i) => i.slug === SLUGS.stealthEffect,
        );
        const exceptions = stealth?.flags?.[MODULE_ID]?.undetected;
        return exceptions?.exceptFor?.length > 0;
      });
      if (undetectedObserved) {
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
          section: 2,
        });
      }
    }
  }

  if (!selection.dispositions.has(1)) {
    choices.push({
      key: "prepare-ambush",
      label: game.i18n.localize(`${MODULE_ID}.menu.prepareAmbush.label`),
      hint: localizeString(`${MODULE_ID}.menu.prepareAmbush.hint`, {
        type: game.i18n.localize(`${MODULE_ID}.menu.type.${selection.type}`),
      }),
      section: 0,
    });
  }

  const combat = game?.combat;
  if (!combat) {
    choices.push({
      key: "test-avoidance",
      label: game.i18n.localize(`${MODULE_ID}.menu.testAvoidance.label`),
      hint: localizeString(`${MODULE_ID}.menu.testAvoidance.hint`, {
        type: game.i18n.localize(`${MODULE_ID}.menu.type.${selection.type}`),
      }),
      section: 0,
    });
  }

  choices.sort((a, b) =>
    a.section === b.section
      ? a.label.localeCompare(b.label)
      : a.section - b.section,
  );
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
      await iterateTokensAndParties(selection.tokens, async (combatant) => {
        await clearActorStealth({ actor: combatant?.actor ?? combatant });
      });
      refreshEverybody();
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
  }
}
