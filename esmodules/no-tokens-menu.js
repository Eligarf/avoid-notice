import { AvoidNoticePopupMenu } from "./menu.js";
import { log } from "./main.js";
import { clearPartyStealth } from "./stealth.js";
import { MODULE_ID } from "./const.js";

export async function invokeNoTokensMenu({ combatState }) {
  const choice = await AvoidNoticePopupMenu.show(
    `${MODULE_ID}.menu.noTokensSelected`,
    [
      {
        key: "clear-party-stealth",
        label: `${MODULE_ID}.menu.clearPartyStealth.label`,
        hint: `${MODULE_ID}.menu.clearPartyStealth.hint`,
      },
    ],
  );

  switch (choice) {
    case "clear-party-stealth":
      clearPartyStealth({});
      break;
  }
}
