import { AvoidNoticePopupMenu } from "./menu.js";
import { prepareAmbush, clearAmbush, clearActorStealth } from "./stealth.js";
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

      const observed = avoiders.some((token) => {
        const stealth = token.actor?.items?.find(
          (i) => i.slug === SLUGS.stealthEffect,
        );
        const flags = stealth?.flags?.[MODULE_ID];
        if (!flags) return false;
        return (
          flags.hidden?.except?.length > 0 ||
          flags.undetected?.except?.length > 0
        );
      });

      if (observed) {
        choices.push({
          key: "undo-reveals",
          label: game.i18n.localize(`${MODULE_ID}.menu.undoReveals.label`),
          hint: localizeString(`${MODULE_ID}.menu.undoReveals.hint`, {
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
    if (
      selection.tokens.some((t) => {
        if (!t?.document?.hidden) return true;
        const actor = t?.actor;
        if (!actor) return false;
        const stat = actor?.system?.initiative?.statistic;
        return stat !== "stealth";
      })
    ) {
      choices.push({
        key: "prepare-ambush",
        label: game.i18n.localize(`${MODULE_ID}.menu.prepareAmbush.label`),
        hint: localizeString(`${MODULE_ID}.menu.prepareAmbush.hint`, {
          type: game.i18n.localize(`${MODULE_ID}.menu.type.${selection.type}`),
        }),
        section: 0,
      });
    }
    if (
      selection.tokens.some((t) => {
        if (t?.document?.hidden) return true;
        const actor = t?.actor;
        if (!actor) return false;
        const stat = actor?.system?.initiative?.statistic;
        return stat === "stealth";
      })
    ) {
      choices.push({
        key: "clear-ambush",
        label: game.i18n.localize(`${MODULE_ID}.menu.clearAmbush.label`),
        hint: localizeString(`${MODULE_ID}.menu.clearAmbush.hint`, {
          type: game.i18n.localize(`${MODULE_ID}.menu.type.${selection.type}`),
        }),
        section: 0,
      });
    }
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
      await prepareAmbush(selection.tokens);
      break;
    case "clear-ambush":
      debuglog("clear-ambush", selection.tokens);
      await clearAmbush(selection.tokens);
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
    case "undo-reveals":
      debuglog("undo-reveals", selection.tokens);
      undoRevealsOf({ avoiders: selection.tokens });
      refreshEverybody();
      break;
  }
}
