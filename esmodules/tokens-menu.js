import { AvoidNoticePopupMenu, isAvoider } from "./menu.js";
import { hideTokens, clearTokenStealth } from "./stealth.js";
import { MODULE_ID } from "./const.js";
import { localizeString, debuglog } from "./main.js";

export async function invokeTokensMenu({ selection, combatState }) {
  debuglog("invokeTokensMenu", { selection, combatState });
  const title = localizeString(`${MODULE_ID}.menu.tokensSelected`, {
    type: selection.type,
  });

  let choices = [
    {
      key: "remove-stealth",
      label: game.i18n.localize(`${MODULE_ID}.menu.removeStealth.label`),
      hint: localizeString(`${MODULE_ID}.menu.removeStealth.hint`, {
        type: selection.type,
      }),
    },
  ];

  // If there aren't any PCs, then we can do the ambush thing.
  if (combatState === "inactive" && !selection.dispositions.has(1)) {
    choices.push({
      key: "prepare-ambush",
      label: game.i18n.localize(`${MODULE_ID}.menu.prepareAmbush.label`),
      hint: localizeString(`${MODULE_ID}.menu.prepareAmbush.hint`, {
        type: selection.type,
      }),
    });
  }

  // If we have a mixed bag, look to see if we could do an encounter test
  let friendlyAvoiders = [];
  let unfriendlyAvoiders = [];

  if (
    combatState === "inactive" &&
    selection.dispositions.has(1) &&
    selection.dispositions.has(-1)
  ) {
    const avoiders = selection.tokens.filter((token) => isAvoider(token));
    if (avoiders.length > 0) {
      friendlyAvoiders = avoiders.filter(
        (token) => token.document.disposition === 1,
      );
      unfriendlyAvoiders = avoiders.filter(
        (token) => token.document.disposition === -1,
      );
      if (friendlyAvoiders.length > 0 && unfriendlyAvoiders.length > 0) {
        choices.push({
          key: "encounter-test",
          label: game.i18n.localize(`${MODULE_ID}.menu.encounterTest.label`),
          hint: localizeString(`${MODULE_ID}.menu.encounterTest.hint`, {
            type: selection.type,
          }),
        });
      }
    }
  }

  choices.sort((a, b) => a.label.localeCompare(b.label));
  const choice = await AvoidNoticePopupMenu.show(title, choices);

  switch (choice) {
    case "prepare-ambush":
      debuglog("prepare-ambush", selection.tokens);
      await hideTokens(selection.tokens);
      break;
    case "remove-stealth":
      debuglog("remove-stealth", selection.tokens);
      for (const token of selection.tokens) {
        await clearTokenStealth({ token });
      }
      break;
    case "encounter-test":
      debuglog("encounter-test", {
        tokens: selection.tokens,
        friendlyAvoiders,
        unfriendlyAvoiders,
      });
      break;
  }
}
