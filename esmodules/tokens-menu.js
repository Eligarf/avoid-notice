import { AvoidNoticePopupMenu } from "./menu.js";
import { hideTokens, clearTokenStealth } from "./stealth.js";
import { MODULE_ID } from "./const.js";
import { localizeString, debuglog } from "./main.js";

export async function invokeTokensMenu({ selection, combatState }) {
  const title = localizeString(`${MODULE_ID}.menu.tokensSelected`, {
    type: selection.type,
  });
  const choice = await AvoidNoticePopupMenu.show(title, [
    {
      key: "prepare-ambush",
      label: `${MODULE_ID}.menu.prepareAmbush.label`,
      hint: localizeString(`${MODULE_ID}.menu.prepareAmbush.hint`, {
        type: selection.type,
      }),
    },
    {
      key: "remove-stealth",
      label: `${MODULE_ID}.menu.removeStealth.label`,
      hint: localizeString(`${MODULE_ID}.menu.removeStealth.hint`, {
        type: selection.type,
      }),
    },
  ]);

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
