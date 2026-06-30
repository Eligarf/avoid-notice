import { AvoidNoticePopupMenu } from "./menu.js";
import { log } from "./main.js";
import { clearPartyStealth } from "./stealth.js";

export async function invokeNoTokensMenu({ combatState }) {
  const choice = await AvoidNoticePopupMenu.show("No tokens selected", [
    { key: "clear-party-stealth", label: "Clear Party Stealth" },
  ]);

  switch (choice) {
    case "clear-party-stealth":
      clearPartyStealth({});
      break;
  }
}
