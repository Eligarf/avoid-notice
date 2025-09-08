import { MODULE_ID } from "./const.js";
import { log } from "./main.js";

let socket = null;

Hooks.once("socketlib.ready", () => {
  if (typeof socketlib === "undefined") {
    showNotification(`{MODULE_ID}.notifications.noSocketLib`, "warn");
    return;
  }
  socket = socketlib.registerModule(MODULE_ID);
  socket.register("ZoomToCombat", onZoomToCombat);
});

async function onZoomToCombat(targetList) {
  const tokens = targetList.map((id) => canvas.tokens.get(id));
  await zoomToTokens(tokens);
}

export function zoomToCombat(encounter, observations) {
  if (!socket) return;

  let avoiders = Object.keys(observations);
  const nonAvoiders = encounter.combatants.contents
    .filter((c) => !(c.token?.id in observations))
    .map((c) => c.token.id);

  // Build a list of targets and who can observe them
  let targets = {};
  for (const avoiderId in observations) {
    const avoider = observations[avoiderId];
    let observers = [avoiderId];
    for (const observerId in avoider.observers) {
      const observation = avoider.observers[observerId].observation;
      if (
        observation.state !== "unnoticed" &&
        observation.state !== "undetected"
      ) {
        observers.push(observerId);
      }
    }
    targets[avoiderId] = observers;
  }
  avoiders = avoiders.concat(nonAvoiders);
  for (const id of nonAvoiders) {
    targets[id] = avoiders;
  }

  // Now invert it to get who is looking at whom
  let lookers = {};
  for (const [target, observers] of Object.entries(targets)) {
    for (const observer of observers) {
      if (!lookers[observer]) lookers[observer] = [];
      lookers[observer].push(target);
    }
  }

  // Get a list of which users control which lookers
  let users = {};
  for (const lookerId in lookers) {
    const token = canvas.tokens.get(lookerId);
    if (!token) continue;
    // Get all users who control this token and are not GMs
    const controllingUsers = game.users.contents.filter(
      (u) => u.active && !u.isGM && token.actor?.testUserPermission(u, "OWNER"),
    );
    if (!controllingUsers.length) continue;
    const lookees = lookers[lookerId];
    for (const user of controllingUsers) {
      if (!users[user.id]) users[user.id] = [];
      let seenTokens = users[user.id];
      for (const lookeeId of lookees) {
        if (!seenTokens.includes(lookeeId)) seenTokens.push(lookeeId);
      }
    }
  }

  // Send the combatants they can see to each user so they can zoom to them
  for (const userId in users) {
    const targetList = users[userId];
    socket.executeForUsers("ZoomToCombat", [userId], targetList);
  }
}

/**
 * Zooms and pans the canvas to include all given tokens.
 * If all tokens are already visible, does nothing.
 * @param {Array<Token>} tokens - Array of Token objects to include in view.
 */
async function zoomToTokens(tokens) {
  if (!tokens?.length) return;

  const canvas = window.canvas;
  if (!canvas || !canvas.ready) return;

  // Get token bounds
  const positions = tokens.map((t) => ({
    x: t.x,
    y: t.y,
    w: t.w,
    h: t.h,
  }));

  let minX = Math.min(...positions.map((p) => p.x));
  let minY = Math.min(...positions.map((p) => p.y));
  let maxX = Math.max(...positions.map((p) => p.x + p.w));
  let maxY = Math.max(...positions.map((p) => p.y + p.h));

  // Current viewport in scene coordinates
  const viewRect = canvas.app.renderer.screen;
  const scale = canvas.stage.scale.x;
  const viewW = viewRect.width / scale;
  const viewH = viewRect.height / scale;
  const viewX = canvas.stage.transform.pivot.x - viewW / 2;
  const viewY = canvas.stage.transform.pivot.y - viewH / 2;

  // Check if all tokens are already visible
  const allVisible =
    minX >= viewX &&
    minY >= viewY &&
    maxX <= viewX + viewW &&
    maxY <= viewY + viewH;

  if (allVisible) return;

  // make sure to never shrink the view
  minX = Math.min(minX, viewX);
  maxX = Math.max(maxX, viewX + viewW);
  minY = Math.min(minY, viewY);
  maxY = Math.max(maxY, viewY + viewH);

  // Calculate center and required scale
  const padding = 100; // pixels
  const areaW = maxX - minX + padding * 2;
  const areaH = maxY - minY + padding * 2;
  const scaleX = viewRect.width / areaW;
  const scaleY = viewRect.height / areaH;
  const targetScale = Math.min(scaleX, scaleY);

  // Center position
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  // Animate pan and zoom
  await canvas.animatePan({ x: centerX, y: centerY, scale: targetScale });
}
