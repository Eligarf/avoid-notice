import { AvoidNoticePopupMenu } from "./menu.js";
import { debuglog, getVisibilityHandler, refreshPerception } from "./main.js";
import { clearPartyStealth } from "./stealth.js";
import { MODULE_ID } from "./const.js";

export async function invokeNoTokensMenu() {
  debuglog("invokeNoTokensMenu");
  if (getVisibilityHandler() === "visioner") return;

  let choices = [
    {
      key: "remove-party-stealth",
      label: game.i18n.localize(`${MODULE_ID}.menu.clearPartyStealth.label`),
      hint: `${MODULE_ID}.menu.clearPartyStealth.hint`,
    },
    {
      key: "refresh",
      label: "refresh",
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
      refreshPerception();
      break;
  }
}
