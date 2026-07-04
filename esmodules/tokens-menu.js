import { AvoidNoticePopupMenu } from "./menu.js";
import { hideTokens, clearTokenStealth } from "./stealth.js";
import { MODULE_ID } from "./const.js";
import { localizeString, debuglog } from "./main.js";

export async function invokeTokensMenu({ selection, combatState }) {
  debuglog("invokeTokensMenu", selection, combatState);
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

  if (
    combatState === "inactive" &&
    selection.dispositions.size == 1 &&
    selection.dispositions.has(-1)
  ) {
    choices.push({
      key: "prepare-ambush",
      label: game.i18n.localize(`${MODULE_ID}.menu.prepareAmbush.label`),
      hint: localizeString(`${MODULE_ID}.menu.prepareAmbush.hint`, {
        type: selection.type,
      }),
    });
  }

  choices.sort((a, b) => a.label.localeCompare(b.label));
  const choice = await AvoidNoticePopupMenu.show(title, choices);

  switch (choice) {
    case "prepare-ambush":
      await hideTokens(selection.tokens);
      break;
    case "remove-stealth":
      debuglog("remove-stealth", selection.tokens);
      for (const token of selection.tokens) {
        await clearTokenStealth({ token });
      }
      break;
  }
}
