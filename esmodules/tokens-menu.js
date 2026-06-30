import { AvoidNoticePopupMenu } from "./menu.js";
import { hideTokens } from "./stealth.js";
import { MODULE_ID } from "./const.js";
import { localizeString, log } from "./main.js";

export async function invokeTokensMenu({ selection, combatState }) {
  const title = localizeString(`${MODULE_ID}.menu.tokensSelected`, {
    type: selection.type,
  });
  const choice = await AvoidNoticePopupMenu.show(title, [
    {
      key: "prepare-ambush",
      label: `${MODULE_ID}.menu.prepareAmbush.label`,
      hint: `${MODULE_ID}.menu.prepareAmbush.hint`,
    },
  ]);

  switch (choice) {
    case "prepare-ambush":
      hideTokens(selection.tokens);
      break;
  }
}
