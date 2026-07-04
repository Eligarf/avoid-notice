import { AvoidNoticePopupMenu } from "./menu.js";
import { debuglog } from "./main.js";
import { clearPartyStealth } from "./stealth.js";
import { MODULE_ID } from "./const.js";

export async function invokeNoTokensMenu({ combatState }) {
  debuglog("invokeNoTokensMenu", combatState);

  let choices = [
    {
      key: "remove-party-stealth",
      label: game.i18n.localize(`${MODULE_ID}.menu.clearPartyStealth.label`),
      hint: `${MODULE_ID}.menu.clearPartyStealth.hint`,
    },
  ];

  choices.sort((a, b) => a.label.localeCompare(b.label));
  const choice = await AvoidNoticePopupMenu.show(choices);

  switch (choice) {
    case "remove-party-stealth":
      clearPartyStealth({});
      break;
  }
}
