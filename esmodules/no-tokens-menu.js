import { AvoidNoticePopupMenu } from "./menu.js";
import { debuglog } from "./utils.js";
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

  const combat = game.combats.active;
  const turns = combat?.turns ?? [];
  if (turns.length > 0) {
    choices.push({
      key: "declump",
      label: game.i18n.localize(`${MODULE_ID}.menu.declump.label`),
      hint: `${MODULE_ID}.menu.declump.hint`,
    });
  }
  choices.sort((a, b) => a.label.localeCompare(b.label));
  const choice = await AvoidNoticePopupMenu.show(
    `${MODULE_ID}.menu.noTokensSelected`,
    choices,
  );

  switch (choice?.key) {
    case "remove-party-stealth":
      return clearPartyStealth({});
    case "refresh":
      return refreshEverybody();
    case "declump":
      const delta = 3;
      const total = turns.length;
      const topInit = turns[0].initiative ?? 20;
      const bottomInit = topInit - delta * (total - 1);

      let init = bottomInit < 1 ? topInit + 1 - bottomInit : topInit;
      for (let i = 0; i < total; ++i) {
        const combatant = turns[i];
        if (init !== combatant.initiative) {
          await combat.setInitiative(combatant.id, init);
        }
        init -= delta;
      }
      return;
  }
}
