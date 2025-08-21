import { interpolateString } from "./main.js";
import { MODULE_ID, COMPENDIUM_IDS } from "./const.js";
import { findInitiativeCard, renderInitiativeDice } from "./initiative.js";

export async function renderStatus(observations) {
  for (const avoiderId in observations) {
    const { avoiderApi, observers } = observations[avoiderId];
    const avoider = avoiderApi.avoider;

    let messageData = {};

    // walk through all the observers and group their observations by result
    for (const observerId in observers) {
      const observation = observers[observerId].observation;

      if (!(observation.visibility in messageData)) {
        const id = COMPENDIUM_IDS[observation.visibility];
        const pack = "pf2e.conditionitems";
        const text = game.i18n.localize(
          `PF2E.condition.${observation.visibility}.name`,
        );
        const title = `
        <a class="content-link" draggable="true" data-link data-uuid="Compendium.${pack}.Item.${id}" data-id="${id}" data-type="Item" data-pack="${pack}">
          <i class="fa-solid fa-face-zany"></i>
          ${text}
        </a>`;
        messageData[observation.visibility] = {
          title,
          resultClass: observation.success ? "success" : "failure",
          observers: [observation],
        };
      } else {
        messageData[observation.visibility].observers.push(observation);
      }
    }

    let content = interpolateString(
      game.i18n.localize("pf2e-avoid-notice.activity"),
      {
        activity: game.i18n.localize(
          "PF2E.TravelSpeed.ExplorationActivities.AvoidNotice",
        ),
        actor: avoider.actor.name,
      },
    );

    let initiativeMessage = await findInitiativeCard(avoider);
    if (initiativeMessage) {
      content = renderInitiativeDice(initiativeMessage.rolls[0]) + content;
    } else {
      initiativeMessage = await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({
          actor: avoider.actor,
          alias: avoider.token.name,
        }),
      });
    }

    for (const t of ["unnoticed", "undetected", "hidden", "observed"]) {
      const status = messageData[t];
      if (status) {
        content += `
          <div data-visibility="gm">
            ${status.title}
            <table>
              <tbody>`;
        for (const observation of status.observers) {
          content += `
                <tr>
                  <td id="${MODULE_ID}-name">${observation.name}</td>`;
          if (observation.oldDelta) {
            content += `
                  <td id="${MODULE_ID}-deltaStr">
                    <span><s>${observation.oldDelta}</s></span>
                    <span data-tooltip="<div>${observation.tooltip}</div>"> <b>${observation.deltaStr}</b></span>
                  </td>`;
          } else {
            content += `
                  <td id="${MODULE_ID}-deltaStr">${observation.deltaStr}</td>`;
          }
          content += `
                </tr>`;
        }
        content += `
              </tbody>
            </table>
          </div>`;
      }
    }

    await initiativeMessage.update({ content });
  }
}
