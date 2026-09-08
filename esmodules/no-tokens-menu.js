import { AvoidNoticePopupMenu } from "./menu.js";
import { debuglog } from "./main.js";
import { clearPartyStealth } from "./stealth.js";
import { MODULE_ID } from "./const.js";
import { refreshEverybody } from "./socket.js";

export async function invokeNoTokensMenu() {
  debuglog("invokeNoTokensMenu");

  let choices = [
    {
      key: "remove-party-stealth",
      label: game.i18n.localize(`${MODULE_ID}.menu.clearPartyStealth.label`),
      hint: `${MODULE_ID}.menu.clearPartyStealth.hint`,
    },
    {
      key: "refresh",
      label: game.i18n.localize(`${MODULE_ID}.menu.refresh.label`),
      hint: `${MODULE_ID}.menu.refresh.hint`,
    },
  ];

  choices.sort((a, b) => a.label.localeCompare(b.label));
  const choice = await AvoidNoticePopupMenu.show(
    `${MODULE_ID}.menu.noTokensSelected`,
    choices,
  );

  switch (choice?.key) {
    case "remove-party-stealth":
      clearPartyStealth({});
      break;
    case "refresh":
      refreshEverybody();
      break;
  }
}
