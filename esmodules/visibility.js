import { MODULE_ID, SLUGS } from "./const.js";
import { debuglog, getVisibilityHandler } from "./main.js";
import { createVisibilityCache } from "./cache.js";

let hooks = {};
let observingTokenIds = new Set();
let revealedToTokenIds = new Set();
let gmVisionCopy = undefined;
let tokenIdsWithEyeballs = new Set();
const cache = createVisibilityCache();
let eyeballTexture = null;

hooks.canvasReady = globalThis.Hooks.on("canvasReady", async () => {
  debuglog(`Canvas is ready`);
});

globalThis.Hooks.once("ready", async () => {
  debuglog(`appstate is ready`);
  if (getVisibilityHandler() === "effects") setupVisibilityHooks();
  gmVisionCopy = game.pf2e.settings.gmVision;
  for (const token of canvas.tokens.controlled) {
    controlTokenHook(token, true);
  }
  const iconPath = "icons/magic/perception/eye-tendrils-web-purple.webp";
  eyeballTexture = await loadTexture(iconPath);
});

export function refreshVisibilityCache() {
  debuglog(`refreshVisibilityCache`);
  cache.clear(handleMutations);
  for (const token of canvas.tokens.placeables) {
    if (tokenIdsWithEyeballs.has(token.id)) {
      showEyeball({ token, isVisible: false });
    }
  }
}

function findExceptions(actor) {
  const stealth = actor?.items.find((i) => i.slug === SLUGS.stealthEffect);
  if (!stealth) return null;
  const states = stealth.flags[MODULE_ID];
  if (!states) return null;
  let exceptions = new Set();
  for (const [_key, s] of Object.entries(states)) {
    for (const id of s?.exceptFor) {
      exceptions.add(id);
    }
  }
  return exceptions;
}

function applyMutation(token, mutation) {
  // debuglog(
  //   `token.visible=${token.visible} mesh.visible=${token?.mesh?.visible} detectionFilter=${token.detectionFilter ? "exists" : "null"}`,
  // );
  token.visible = true;
  if (!token.mesh) {
    ui.notifications.warn(
      `Token '${token.name}' has no mesh. This may cause visual issues.`,
    );
  } else {
    token.mesh.visible = true;
  }
  if (!token.detectionFilter) {
    token.detectionFilter = mutation.filter;
  } else if (token.detectionFilter !== mutation.filter) {
    ui.notifications.warn(
      `Token '${token.name}' already has a detection filter. This may cause visual issues.`,
      {
        tokenFilter: token.detectionFilter,
        undetectedFilter: mutation.filter,
      },
    );
  }
}

function handleMutations(token, record, mutations) {
  // debuglog("handleMutations", { token, record, mutations });
  for (let i = 0; i < mutations?.adds?.length; i++) {
    const type = mutations.adds[i];
    if (type === "hidden") {
      record.mutations.hidden = { filter: token.detectionFilter };
      token.detectionFilter = null;
    } else if (type === "undetected") {
      const filter =
        foundry.canvas.rendering.filters.OutlineOverlayFilter.create({
          wave: true,
        });
      filter.thickness = 1;
      record.mutations.undetected = { filter };
      applyMutation(token, record.mutations.undetected);
    }
  }
  for (let i = 0; i < mutations?.removes?.length; i++) {
    const type = mutations.removes[i];
    if (type === "hidden") {
      token.detectionFilter = record.mutations.hidden.filter;
      delete record.mutations.hidden;
    } else if (type === "undetected") {
      token.visible = false;
      if (!token.mesh) {
        ui.notifications.warn(
          `Token '${token.name}' has no mesh. This may cause visual issues.`,
        );
      } else {
        token.mesh.visible = false;
      }
      if (
        token.detectionFilter &&
        token.detectionFilter !== record.mutations.undetected.filter
      ) {
        ui.notifications.warn(
          `Token '${token.name}' has a different detection filter than expected. This may cause visual issues.`,
          {
            tokenFilter: token.detectionFilter,
            undetectedFilter: record.mutations.undetected.filter,
          },
        );
      } else token.detectionFilter = null;
      record.mutations.undetected.filter = null;
      delete record.mutations.undetected;
    }
  }
}

function recordObservation(token, key, override) {
  const record = cache.getOrCreate(token);
  const snapshot = cache.duplicate(record.snapshot);
  if (!(key in snapshot)) snapshot[key] = { exceptFor: new Set() };
  const state = snapshot[key];
  const observers = new Set(override.exceptFor);
  const detectors = observers.intersection(observingTokenIds);
  state.exceptFor = state.exceptFor.union(detectors);
  const mutations = cache.update(record, snapshot);
  if (!mutations) return;
  handleMutations(token, record, mutations);
}

function showEyeball({ token, isVisible }) {
  const spriteName = "observing-eyeball";
  let eyeSprite = token.mesh.children.find((c) => c.name === spriteName);
  if (isVisible) {
    if (eyeSprite) return;
    eyeSprite = new PIXI.Sprite(eyeballTexture);
    eyeSprite.name = spriteName;
    eyeSprite.anchor.set(0.5, 0.5);
    const desired = token.mesh.texture.width * 0.5;
    const scale = desired / eyeballTexture.width;
    eyeSprite.scale.set(scale);
    eyeSprite.x = 0;
    eyeSprite.y = 0;
    token.mesh.addChild(eyeSprite);
    tokenIdsWithEyeballs.add(token.id);
    return;
  }
  if (eyeSprite) {
    tokenIdsWithEyeballs.delete(token.id);
    token.removeChild(eyeSprite);
    eyeSprite.destroy({ children: true, texture: false });
  }
}

function controlTokenHook(token, controlled) {
  debuglog(`'${token.name}' controlled: ${controlled}`, { token, controlled });
  if (!controlled) {
    observingTokenIds.delete(token.id);
    cache.removeObserver(token, handleMutations);
  } else {
    observingTokenIds.add(token.id);
    if (cache.has(token)) {
      cache.removeAvoider(token, handleMutations);
    }
  }
  if (!game.user.isGM) return;

  if (controlled) {
    const actor = token?.actor;
    if (!actor) return;
    const exceptions = findExceptions(actor);
    if (!exceptions) return;
    revealedToTokenIds = revealedToTokenIds.union(exceptions);
  } else {
    revealedToTokenIds.clear();
    for (const id of observingTokenIds) {
      const token = canvas.tokens.get(id);
      const actor = token?.actor;
      if (!actor) continue;
      const exceptions = findExceptions(actor);
      if (!exceptions) continue;
      revealedToTokenIds = revealedToTokenIds.union(exceptions);
    }
  }
}

function refreshTokenHook(token, _options) {
  // debuglog(
  //   `'${token.name}' refreshed (hidden=${token.document.hidden} visible=${token.visible} filter=${token.detectionFilter ? "exists" : "null"})`,
  //   {
  //     token,
  //     observingTokenIds,
  //   },
  // );
  if (game.user.isGM) {
    const isRevealed = revealedToTokenIds.has(token.id);
    showEyeball({ token, isVisible: isRevealed });
  }

  if (game.pf2e.settings.gmVision) {
    if (gmVisionCopy) return;
    gmVisionCopy = true;
    cache.clear(handleMutations);
    return;
  }
  gmVisionCopy = false;

  if (observingTokenIds.has(token.id) || token.document.hidden) {
    if (cache.has(token)) cache.removeAvoider(token, handleMutations);
    return;
  }

  const actor = token?.actor;
  if (!actor) return;
  const stealth = actor?.items.find((i) => i.slug === SLUGS.stealthEffect);
  if (!stealth) return;
  const states = stealth.flags[MODULE_ID];
  if (!states) return false;
  for (const [key, s] of Object.entries(states)) {
    if (s.exceptFor.some((id) => observingTokenIds.has(id))) {
      recordObservation(token, key, s);
    }
  }

  // our mutations get zotted out every time, so we need to restore them here
  const record = cache.get(token);
  if (!record) return;
  const undetected = record?.mutations?.undetected;
  if (undetected) applyMutation(token, undetected);
  const hidden = record?.mutations?.hidden;
  if (hidden) token.detectionFilter = null;
}

function createItemHook(item, options, userId) {
  if (item?.system?.slug !== SLUGS.stealthEffect) return;
  const actor = options.parent;
  debuglog(`'${actor?.name}' stealth effect created`, {
    item,
    options,
    userId,
  });
}

function deleteItemHook(item, options, userId) {
  if (item?.system?.slug !== SLUGS.stealthEffect) return;
  debuglog(`stealth effect deleted`, {
    item,
    options,
    userId,
  });
}

function createTokenHook(tokenDoc, data, options, userId) {
  debuglog(`'${tokenDoc.name}' created`, { tokenDoc, data, options, userId });
}

function updateTokenHook(tokenDoc, data, options, userId) {
  debuglog(`'${tokenDoc.name}' updated`, { tokenDoc, data, options, userId });
}

function deleteTokenHook(tokenDoc, options, userId) {
  debuglog(`'${tokenDoc.name}' deleted`, { tokenDoc, options, userId });
  const stealth = tokenDoc?.actor?.items.find(
    (i) => i.slug === SLUGS.stealthEffect,
  );
  if (!stealth) return;
  cache.removeAvoider(tokenDoc, handleMutations);
}

export function setupVisibilityHooks() {
  if (!hooks?.controlToken)
    hooks.controlToken = globalThis.Hooks.on("controlToken", controlTokenHook);
  if (!hooks?.refreshToken)
    hooks.refreshToken = globalThis.Hooks.on("refreshToken", refreshTokenHook);
  if (!hooks?.createItem)
    hooks.createItem = globalThis.Hooks.on("createItem", createItemHook);
  if (!hooks?.deleteItem)
    hooks.deleteItem = globalThis.Hooks.on("deleteItem", deleteItemHook);
  if (!hooks?.updateToken)
    hooks.updateToken = globalThis.Hooks.on("updateToken", updateTokenHook);
  if (!hooks?.createToken)
    hooks.createToken = globalThis.Hooks.on("createToken", createTokenHook);
  if (!hooks?.deleteToken)
    hooks.deleteToken = globalThis.Hooks.on("deleteToken", deleteTokenHook);
}

export function releaseVisibilityHooks() {
  globalThis.Hooks.off("deleteToken", deleteTokenHook);
  globalThis.Hooks.off("createToken", createTokenHook);
  globalThis.Hooks.off("updateToken", updateTokenHook);
  globalThis.Hooks.off("deleteItem", deleteItemHook);
  globalThis.Hooks.off("createItem", createItemHook);
  globalThis.Hooks.off("refreshToken", refreshTokenHook);
  globalThis.Hooks.off("controlToken", controlTokenHook);
  hooks = {};
}
