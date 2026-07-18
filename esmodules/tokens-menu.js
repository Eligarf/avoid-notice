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

export async function invokeTokensMenu({ selection }) {
  debuglog("invokeTokensMenu", { selection });
  const title = localizeString(`${MODULE_ID}.menu.tokensSelected`, {
    type: selection.type,
  });

  let choices = [];
  const visibilityHandler = getVisibilityHandler();
  if (visibilityHandler !== "visioner")
    choices.push({
      key: "remove-stealth",
      label:
        selection.type === "controlled"
          ? game.i18n.localize(
              `${MODULE_ID}.menu.removeControlledStealth.label`,
            )
          : game.i18n.localize(`${MODULE_ID}.menu.removeTargetedStealth.label`),
    });

  const combat = game?.combat;
  if (!combat && !selection.dispositions.has(1)) {
    choices.push({
      key: "prepare-ambush",
      label: game.i18n.localize(`${MODULE_ID}.menu.prepareAmbush.label`),
      hint: localizeString(`${MODULE_ID}.menu.prepareAmbush.hint`, {
        type: game.i18n.localize(`${MODULE_ID}.menu.type.${selection.type}`),
      }),
    });
  }

  if (!combat) {
    choices.push({
      key: "test-avoidance",
      label: game.i18n.localize(`${MODULE_ID}.menu.testAvoidance.label`),
      hint: localizeString(`${MODULE_ID}.menu.testAvoidance.hint`, {
        type: game.i18n.localize(`${MODULE_ID}.menu.type.${selection.type}`),
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
