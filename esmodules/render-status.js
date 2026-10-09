import {
  MODULE_ID,
  LOCALIZATION_KEYS,
  STEALTH_LABELS,
  OBSERVED,
  HIDDEN,
  UNDETECTED,
} from "./const.js";
import { findInitiativeCard } from "./initiative.js";
import { debuglog, interpolateString, localizeString } from "./utils.js";
import { cachedSettings } from "./settings.js";
import { prepareSummaryAndTargetList } from "./observation-logic.js";

const dosTable = ["critical-failure", "failure", "success", "critical-success"];

export function prepareTargetList(sortedChecks) {
  return sortedChecks.map((o) => {
    const check = o.check ?? o;
    const tokenId = check.tokenDoc.id;
    const entry = {
      dc: check.dc,
      degreeOfSuccess: check.degreeOfSuccess,
      delta: check.delta,
      deltaStr: check.deltaStr,
      name: check.name,
      tokenId: tokenId,
      stealth: check.stealth,
      ...(check.was && { was: check.was }),
      stealthLabel: check.stealthLabel,
      ...(check.tooltip && { tooltip: check.tooltip }),
    };
    return entry;
  });
}

async function stealthLabelClick(
  message,
  _event,
  flags,
  targetId,
  stealthDosStates,
) {
  const targetList = flags[flags.card]?.targetList;
  if (!targetList) return;
  const target = targetList.find((t) => t.tokenId === targetId);
  if (!target) return;
  target.stealth = (target.stealth + 1) % stealthDosStates.length;
  target.stealthLabel = STEALTH_LABELS[target.stealth];
  const update = {
    flags: {
      [MODULE_ID]: flags,
    },
  };
  const dos = stealthDosStates[target.stealth];
  if (dos !== -1) target.degreeOfSuccess = stealthDosStates[target.stealth];
  return message.update(update);
}

export function renderSummary(summary, _context) {
  let content = `<div class="${MODULE_ID}-summary">`;
  if (summary[OBSERVED]) {
    const observation = localizeString(`${MODULE_ID}.avoidanceCheck.observed`, {
      observed: summary[OBSERVED],
    });
    content += `<span class="${MODULE_ID}-observed">${observation}</span>`;
  }
  if (summary[HIDDEN]) {
    const observation = localizeString(`${MODULE_ID}.avoidanceCheck.hidden`, {
      hidden: summary[HIDDEN],
    });
    content += `<span class="${MODULE_ID}-hidden">${observation}</span>`;
  }
  if (summary[UNDETECTED]) {
    const observation = localizeString(
      `${MODULE_ID}.avoidanceCheck.undetected`,
      {
        undetected: summary[UNDETECTED],
      },
    );
    content += `<span class="${MODULE_ID}-undetected">${observation}</span>`;
  }
  content += "</div>";
  return content;
}

export function renderTargetList(targetList, summary, context) {
  let content = `
    <div data-visibility="gm">
      <details ${context.collapsed ? "" : "open"} class="${MODULE_ID}-target-list">
        <summary>${summary}</summary>`;

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
        return stealthLabelClick(
          message,
          event,
          flags,
          target.tokenId,
          context.stealthDosStates,
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
              ${game.i18n.localize(LOCALIZATION_KEYS[target.stealthLabel])}
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
      </details>
    </div>`;
  return content;
}

export async function updateInitiativeCards(observations) {
  for (const avoiderId in observations) {
    const { avoider, observers, allies } = observations[avoiderId];

    const sortedChecks = Object.values(observers).sort(
      (a, b) =>
        b.check.dc - a.check.dc || a.check.name.localeCompare(b.check.name),
    );

    const { summary, targetList } = prepareSummaryAndTargetList(sortedChecks);

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
          initiative: { targetList: targetList, summary, allies },
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
  const context = {
    interactive: false,
    collapsed: cachedSettings.collapseTargetList,
  };
  const initiative = flags.initiative;
  const summary = renderSummary(initiative.summary, context);
  content += renderTargetList(initiative.targetList, summary, context);
  html.insertAdjacentHTML("beforeend", content);
  return context;
}
