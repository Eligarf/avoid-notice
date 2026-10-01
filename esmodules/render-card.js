import { MODULE_ID } from "./const.js";
import { debuglog, getToken } from "./utils.js";
import { renderAvoidanceCheckCard } from "./avoidance-check.js";
import { renderInitiativeCard } from "./render-status.js";
import { renderSneakCard } from "./sneak.js";
import { renderHideCard } from "./hide.js";
import { renderCreateADiversionCard } from "./create-a-diversion.js";

function attachHoverId(html, el, hoverIds) {
  const hoverId = el.dataset.hoverId;
  const tokenId = hoverIds[hoverId];
  if (!tokenId) return;

  let pendingEnter = false;
  let onCanvasReady = null;

  const onHoverIn = () => {
    const token = getToken(tokenId);
    if (token && typeof token._onHoverIn === "function") {
      token._onHoverIn(new MouseEvent("mouseenter"));
    }
  };

  const onEnter = () => {
    if (canvas?.ready) {
      onHoverIn();
      return;
    }
    pendingEnter = true;
    onCanvasReady = () => {
      if (pendingEnter) onHoverIn();
      pendingEnter = false;
      onCanvasReady = null;
    };
    globalThis.Hooks.once("canvasReady", onCanvasReady);
  };

  const onLeave = () => {
    pendingEnter = false;
    if (onCanvasReady) {
      globalThis.Hooks.off("canvasReady", onCanvasReady);
      onCanvasReady = null;
    }
    if (canvas?.ready) {
      const token = getToken(tokenId);
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
          if (onCanvasReady) {
            globalThis.Hooks.off("canvasReady", onCanvasReady);
            onCanvasReady = null;
          }
          observer.disconnect();
          return;
        }
      }
    }
  });
  observer.observe(html, { childList: true, subtree: true });
}

export function attachHoverIds(html, hoverIds) {
  const selected = html.querySelectorAll(`[data-hover-id]`);
  if (hoverIds) {
    for (const el of selected) {
      attachHoverId(html, el, hoverIds);
    }
  }
}

async function clickHandler(message, event, flags, clickIds) {
  debuglog("clickHandler", { message, event, flags, clickIds });
  const element = event.target.closest(`[data-click-id]`);
  if (element) {
    event.preventDefault();
    const clickId = element.dataset.clickId;
    if (clickId in clickIds) {
      await clickIds[clickId](message, event, flags);
    }
    return;
  }
}

globalThis.Hooks.on("renderChatMessageHTML", (message, html, data) => {
  const flags = message.flags[MODULE_ID];
  if (!flags) return;
  debuglog("renderChatMessageHTML (render-card)", {
    message,
    html,
    data,
    flags,
  });

  let interactionContext = null;
  function guts() {
    switch (flags.card) {
      case "initiative":
        interactionContext = renderInitiativeCard(message, html, data, flags);
        break;
      case "avoidance-check":
        interactionContext = renderAvoidanceCheckCard(
          message,
          html,
          data,
          flags,
        );
        break;
      case "hide":
        interactionContext = renderHideCard(message, html, data, flags);
        break;
      case "sneak":
        interactionContext = renderSneakCard(message, html, data, flags);
        break;
      case "create-a-diversion":
        interactionContext = renderCreateADiversionCard(
          message,
          html,
          data,
          flags,
        );
        break;
      default:
        debuglog(`Unknown card type '${flags.card}'`, {
          message,
          html,
          data,
          flags,
        });
    }
    if (!interactionContext) return;
    debuglog("interactionContext", { interactionContext });

    if (interactionContext.clickIds) {
      html.addEventListener(
        "click",
        async (event) =>
          await clickHandler(
            message,
            event,
            flags,
            interactionContext.clickIds,
          ),
      );
    }
    if (interactionContext.hoverIds) {
      attachHoverIds(html, interactionContext.hoverIds);
    }
  }

  if (canvas.ready) {
    guts();
  } else {
    Hooks.once("canvasReady", () => {
      guts();
    });
  }
});
