import { MODULE_ID, LOCALIZATION_KEYS, VISIBILITY_LABELS } from "./const.js";
import { findInitiativeCard } from "./initiative.js";
import { debuglog, interpolateString, localizeString } from "./utils.js";

const dosTable = ["critical-failure", "failure", "success", "critical-success"];

export function prepareTargetList(sortedObservers) {
  return sortedObservers.map((o) => {
    const observation = o.observation ?? o;
    const tokenId = observation.tokenDoc.id;
    const entry = {
      dc: observation.dc,
      degreeOfSuccess: observation.degreeOfSuccess,
      delta: observation.delta,
      deltaStr: observation.deltaStr,
      name: observation.name,
      tokenId: tokenId,
      visibility: observation.visibility,
      visibilityLabel: observation.visibilityLabel,
      ...(observation.tooltip && { tooltip: observation.tooltip }),
    };
    return entry;
  });
}

async function visibilityClick(message, _event, flags, targetId, loopAt) {
  const targetList = flags[flags.card]?.targetList;
  if (!targetList) return;
  const target = targetList.find((t) => t.tokenId === targetId);
  if (!target) return;
  target.visibility = (target.visibility + 1) % loopAt;
  target.visibilityLabel = VISIBILITY_LABELS[target.visibility];
  const update = {
    flags: {
      [MODULE_ID]: flags,
    },
  };
  target.degreeOfSuccess =
    loopAt === 3 ? target.visibility : target.visibility + 1;
  return message.update(update);
}

export function renderTargetList(targetList, context) {
  let content = `
    <div data-visibility="gm">
      <div class="${MODULE_ID}-target-list">`;

  const interactive = context.interactive ?? false;
  for (const target of targetList) {
    const hoverId = foundry.utils.randomID();
    (context["hoverIds"] ??= {})[hoverId] = target.tokenId;
    const vs = localizeString(`${MODULE_ID}.initiative.vs`, {
      name: target.name,
    });
    let resultTag;
    if (interactive) {
      let clickId = foundry.utils.randomID();
      (context["clickIds"] ??= {})[clickId] = async (message, event, flags) => {
        return visibilityClick(
          message,
          event,
          flags,
          target.tokenId,
          context.loopAt ?? 3,
        );
      };
      resultTag = `<div class="${MODULE_ID}-result" data-click-id="${clickId}" data-interactive="true">`;
    } else {
      resultTag = `<div class="${MODULE_ID}-result" data-interactive="false">`;
    }
    content += `
        <div class="${MODULE_ID}-target" data-hover-id="${hoverId}">
          <div class="${MODULE_ID}-name">${vs}</div>
          ${resultTag}
            <span class="degree-of-success ${dosTable[target.degreeOfSuccess]}">
              ${game.i18n.localize(LOCALIZATION_KEYS[target.visibilityLabel])}
            </span>
          </div>`;
    if (target.tooltip) {
      content += `
          <div class="${MODULE_ID}-dc" data-tooltip="<div>${target.tooltip}</div>">
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

    const targetList = prepareTargetList(sortedObservers);

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
        },
      },
    };
    await initiativeMessage.update(update);
  }
}

export function renderInitiativeCard(_message, html, _data, flags) {
  const activity = interpolateString(
    game.i18n.localize("pf2e-avoid-notice.activity"),
    {
      activity: game.i18n.localize(flags.activity),
      actor: flags.name,
    },
  );
  let content = `<div class="${MODULE_ID}-init-activity">${activity}</div>`;
  const context = { interactive: false };
  content += renderTargetList(flags.initiative?.targetList, context);
  html.insertAdjacentHTML("beforeend", content);
  return context;
}
