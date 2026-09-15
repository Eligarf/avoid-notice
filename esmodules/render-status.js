import { interpolateString, debuglog, localizeString } from "./main.js";
import { MODULE_ID, CONDITION_IDS, CONDITION_PACK } from "./const.js";
import { findInitiativeCard } from "./initiative.js";

const dosTable = ["critical-failure", "failure", "success", "critical-success"];

export async function renderStatus(observations) {
  for (const avoiderId in observations) {
    const { avoiderApi, observers } = observations[avoiderId];
    const avoider = avoiderApi.avoider;

    const sortedObservers = Object.entries(observers).sort((a, b) => {
      const diff = b[1].observation.dc - a[1].observation.dc;
      return diff !== 0
        ? diff
        : a[1].observation.name.localeCompare(b[1].observation.name);
    });
    // debuglog(
    //   `Rendering status for ${avoider.token.name} with ${sortedObservers.length} observers`,
    //   { sortedObservers },
    // );

    let activity = interpolateString(
      game.i18n.localize("pf2e-avoid-notice.activity"),
      {
        activity: game.i18n.localize(
          "PF2E.TravelSpeed.ExplorationActivities.AvoidNotice",
        ),
        actor: avoider.actor.name,
      },
    );

    let content = "";
    let hovers = {};
    let initiativeMessage = await findInitiativeCard(avoider);
    if (initiativeMessage) {
      let rollsContent = "";
      for (const roll of initiativeMessage.rolls) {
        rollsContent += await roll.render();
      }
      content = rollsContent;
    } else {
      initiativeMessage = await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({
          actor: avoider.actor,
          alias: avoider.token.name,
        }),
      });
    }

    content += `
      <div class="${MODULE_ID}-init-activity">${activity}</div>
      <div data-visibility="gm">
        <div class="${MODULE_ID}-init-observations">`;
    for (const [_observerId, { observation }] of sortedObservers) {
      const hoverId = foundry.utils.randomID();
      const tokenId = observation.tokenDoc.id;
      hovers[hoverId] = tokenId;
      const vs = localizeString(`${MODULE_ID}.initiative.vs`, {
        name: observation.name,
      });
      content += `
          <div class="${MODULE_ID}-observer">
            <div class="${MODULE_ID}-name" data-hover-id="${hoverId}">${vs}</div>
            <div class="${MODULE_ID}-result">
              <span class="degree-of-success ${dosTable[observation.degreeOfSuccess]}">
                ${game.i18n.localize(MODULE_ID + "." + observation.visibility)}
              </span>
            </div>`;
      if (observation.oldDelta) {
        content += `
            <div class="${MODULE_ID}-dc">
              <span class="degree-of-success ${dosTable[observation.degreeOfSuccess]}">
                DC ${observation.dc}
              </span>
              <span data-tooltip="<div>${observation.tooltip}</div>">
                <i class="fas fa-info-circle"></i>
              </span>
            </div>`;
      } else {
        content += `
            <div class="${MODULE_ID}-dc">
              <span class="degree-of-success ${dosTable[observation.degreeOfSuccess]}">
                DC ${observation.dc}
              </span>
            </div>`;
      }
      content += `
          </div>`;
    }
    content += `
        </div>
      </div>`;

    const update = {
      content,
      flags: {
        [MODULE_ID]: {
          initiative: hovers,
        },
      },
    };
    await initiativeMessage.update(update);
  }
}

function getToken(id) {
  let token = canvas.tokens.get(id);
  if (!token) {
    token = canvas.tokens.placeables.find((t) => t?.actor?.id === id);
  }
  return token;
}

function attachHover(html, el, initiative) {
  const hoverId = el.dataset.hoverId;
  const hover = initiative[hoverId];
  if (!hover) return;
  const combatantId = hover;

  let pendingEnter = false;
  let canvasReadyCb = null;

  const doHoverIn = () => {
    const token = getToken(combatantId);
    if (token && typeof token._onHoverIn === "function") {
      token._onHoverIn(new MouseEvent("mouseenter"));
    }
  };

  const onEnter = () => {
    if (canvas?.ready) {
      doHoverIn();
      return;
    }
    pendingEnter = true;
    canvasReadyCb = () => {
      if (pendingEnter) doHoverIn();
      pendingEnter = false;
      canvasReadyCb = null;
    };
    globalThis.Hooks.once("canvasReady", canvasReadyCb);
  };

  const onLeave = () => {
    pendingEnter = false;
    if (canvasReadyCb) {
      globalThis.Hooks.off("canvasReady", canvasReadyCb);
      canvasReadyCb = null;
    }
    if (canvas?.ready) {
      const token = getToken(combatantId);
      if (token && typeof token._onHoverOut === "function")
        token._onHoverOut(new MouseEvent("mouseleave"));
    }
  };

  el.addEventListener("mouseenter", onEnter);
  el.addEventListener("mouseleave", onLeave);

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const removed of m.removedNodes) {
        if (removed === el) {
          el.removeEventListener("mouseenter", onEnter);
          el.removeEventListener("mouseleave", onLeave);
          if (canvasReadyCb) {
            globalThis.Hooks.off("canvasReady", canvasReadyCb);
            canvasReadyCb = null;
          }
          observer.disconnect();
          return;
        }
      }
    }
  });
  observer.observe(html, { childList: true, subtree: true });
}

globalThis.Hooks.on("renderChatMessageHTML", (message, html, data) => {
  const initiative = message.flags[MODULE_ID]?.initiative;
  if (!initiative) return;
  debuglog("renderChatMessageHTML (initiative)", {
    message,
    html,
    data,
    initiative,
  });

  // Deal with the hover elements
  const selected = html.querySelectorAll(
    `.${MODULE_ID}-init-observations [data-hover-id]`,
  );
  for (const el of selected) {
    attachHover(html, el, initiative);
  }
});

/*

// Left portion: image and token name alignment
.pf2e-avoid-notice-init-observations .target-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
}

.pf2e-avoid-notice-init-observations .token-avatar {
    width: 24px;
    height: 24px;
    border: 1px solid var(--color-border-dark, #999);
    border-radius: 4px;
    object-fit: cover;
}


// Right portion: DC display and target helper buttons
.pf2e-avoid-notice-init-observations .target-dc-section {
    display: flex;
    align-items: center;
    gap: 8px;
}

.pf2e-avoid-notice-init-observations .dc-label {
    font-weight: bold;
    color: var(--secondary, #444);
    background: rgba(0, 0, 0, 0.05);
    padding: 2px 6px;
    border-radius: 3px;
}

.pf2e-avoid-notice-init-observations .roll-save-btn {
    height: 24px;
    width: 24px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: normal;
    border: 1px solid var(--color-border-light);
    background: var(--color-bg-btn, #eee);
    cursor: pointer;
    border-radius: 3px;
}

.pf2e-avoid-notice-init-observations .roll-save-btn:hover {
    background: var(--color-bg-btn-hover, #ddd);
    box-shadow: 0 0 4px rgba(0, 0, 0, 0.15);
}
  */
