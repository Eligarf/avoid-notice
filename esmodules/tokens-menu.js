import { AvoidNoticePopupMenu } from "./menu.js";
import { setAsAmbushers, clearActorStealth } from "./stealth.js";
import { MODULE_ID } from "./const.js";
import { getVisibilityHandler } from "./main.js";
import {
  localizeString,
  debuglog,
  iterateActorsForTokensAndParties,
} from "./main.js";
import { testAvoidance } from "./avoidance-test.js";

export async function invokeTokensMenu({ selection, combatState }) {
  debuglog("invokeTokensMenu", { selection, combatState });
  const title = localizeString(`${MODULE_ID}.menu.tokensSelected`, {
    type: selection.type,
  });

  let choices = [];
  const visibilityHandler = getVisibilityHandler();
  if (visibilityHandler !== "visioner")
    choices.push({
      key: "remove-stealth",
      label: game.i18n.localize(`${MODULE_ID}.menu.removeStealth.label`),
      hint: localizeString(`${MODULE_ID}.menu.removeStealth.hint`, {
        type: selection.type,
      }),
    });

  if (combatState === "inactive" && !selection.dispositions.has(1)) {
    choices.push({
      key: "prepare-ambush",
      label: game.i18n.localize(`${MODULE_ID}.menu.prepareAmbush.label`),
      hint: localizeString(`${MODULE_ID}.menu.prepareAmbush.hint`, {
        type: selection.type,
      }),
    });
  }

  if (combatState === "inactive") {
    choices.push({
      key: "test-avoidance",
      label: game.i18n.localize(`${MODULE_ID}.menu.testAvoidance.label`),
      hint: localizeString(`${MODULE_ID}.menu.testAvoidance.hint`, {
        type: selection.type,
      }),
    });
  }

  choices.sort((a, b) => a.label.localeCompare(b.label));
  const choice = await AvoidNoticePopupMenu.show(title, choices);

  switch (choice?.key) {
    case "prepare-ambush":
      debuglog("prepare-ambush", selection.tokens);
      await setAsAmbushers(selection.tokens);
      break;
    case "remove-stealth":
      debuglog("remove-stealth", selection.tokens);
      await iterateActorsForTokensAndParties(
        selection.tokens,
        async (actor) => {
          await clearActorStealth({ actor });
        },
      );
      break;
    case "test-avoidance":
      debuglog("test-avoidance", selection.tokens);
      await testAvoidance(selection.tokens, choice.secret);
      break;
  }
}
