import { AvoidNoticePopupMenu } from "./menu.js";
import { hideTokens, clearTokenStealth } from "./stealth.js";
import { MODULE_ID } from "./const.js";
import { localizeString, debuglog, iterateTokensAndParties } from "./main.js";
import { checkAvoidance } from "./avoidance-check.js";

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

  if (
    combatState === "inactive" &&
    selection.dispositions.has(1) &&
    selection.dispositions.size > 1
  ) {
    choices.push({
      key: "check-avoidance",
      label: game.i18n.localize(`${MODULE_ID}.menu.checkAvoidance.label`),
      hint: localizeString(`${MODULE_ID}.menu.checkAvoidance.hint`, {
        type: selection.type,
      }),
    });
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
      await iterateTokensAndParties(selection.tokens, async (token) => {
        await clearTokenStealth({ token });
      });
      break;
    case "check-avoidance":
      debuglog("check-avoidance", selection.tokens);
      await checkAvoidance(selection.tokens);
      break;
  }
}
