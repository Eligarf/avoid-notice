import { MODULE_ID } from "./const.js";
import { findInitiativeCard } from "./initiative.js";
import { debuglog, interpolateString, localizeString } from "./utils.js";

const dosTable = ["critical-failure", "failure", "success", "critical-success"];

export function prepareTargetList(sortedObservers, hoverIds) {
  return sortedObservers.map((o) => {
    const observation = o.observation ?? o;
    const tokenId = observation.tokenDoc.id;
    const hoverId = foundry.utils.randomID();
    hoverIds[hoverId] = tokenId;
    const entry = {
      dc: observation.dc,
      degreeOfSuccess: observation.degreeOfSuccess,
      delta: observation.delta,
      deltaStr: observation.deltaStr,
      hoverId: hoverId,
      name: observation.name,
      tokenId: tokenId,
      visibility: observation.visibility,
      visibilityLabel: observation.visibilityLabel,
      ...(observation.tooltip && { tooltip: observation.tooltip }),
    };
    return entry;
  });
}

export function renderTargetList(targetList) {
  let content = `
    <div data-visibility="gm">
      <div class="${MODULE_ID}-target-list">`;

  for (const target of targetList) {
    const hoverId = target.hoverId;
    const vs = localizeString(`${MODULE_ID}.initiative.vs`, {
      name: target.name,
    });
    content += `
        <div class="${MODULE_ID}-target" data-hover-id="${hoverId}">
          <div class="${MODULE_ID}-name">${vs}</div>
          <div class="${MODULE_ID}-result">
            <span class="degree-of-success ${dosTable[target.degreeOfSuccess]}">
              ${game.i18n.localize(`${MODULE_ID}.${target.visibilityLabel}`)}
            </span>
          </div>`;
    if (target.tooltip) {
      content += `
          <div class="${MODULE_ID}-dc" data-tooltip="<div>${game.i18n.localize(`${MODULE_ID}.${target.tooltip}`)}</div>">
            <span class="degree-of-success ${dosTable[target.degreeOfSuccess]}">
              DC ${target.dc}
            </span>
            <i class="fas fa-info-circle"></i>
          </div>`;
    } else {
      content += `
          <div class="${MODULE_ID}-dc">
            <span class="degree-of-success ${dosTable[target.degreeOfSuccess]}">
              DC ${target.dc}
            </span>
          </div>`;
    }
    content += `
        </div>`;
  }
  content += `
      </div>
    </div>`;
  return content;
}

export async function updateInitiativeCards(observations) {
  for (const avoiderId in observations) {
    const { avoider, observers } = observations[avoiderId];

    const sortedObservers = Object.values(observers).sort((a, b) => {
      const diff = b.observation.dc - a.observation.dc;
      return diff !== 0
        ? diff
        : a.observation.name.localeCompare(b.observation.name);
    });

    let hoverIds = {};
    const targetList = prepareTargetList(sortedObservers, hoverIds);

    const initiativeMessage = await findInitiativeCard(avoider.combatant);
    if (!initiativeMessage) {
      debuglog("No initiative message found for", { avoider });
      continue;
    }
    const update = {
      flags: {
        [MODULE_ID]: {
          card: "initiative",
          name: avoider.tokenDoc.name,
          activity: "PF2E.TravelSpeed.ExplorationActivities.AvoidNotice",
          initiative: { targetList: targetList },
          hoverIds: hoverIds,
        },
      },
    };
    await initiativeMessage.update(update);
  }
}

export function renderInitiativeCard(message, html, data, flags) {
  const activity = interpolateString(
    game.i18n.localize("pf2e-avoid-notice.activity"),
    {
      activity: game.i18n.localize(flags.activity),
      actor: flags.name,
    },
  );
  let content = `<div class="${MODULE_ID}-init-activity">${activity}</div>`;
  content += renderTargetList(flags.initiative?.targetList);
  html.insertAdjacentHTML("beforeend", content);
}
