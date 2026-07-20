import { MODULE_ID, SLUGS } from "./const.js";
import { debuglog, getVisibilityHandler } from "./main.js";
import { createVisibilityCache } from "./cache.js";

let hooks = {};
let observingActorIds = new Set();
let gmVisionCopy = undefined;
const cache = createVisibilityCache();

hooks.canvasReady = Hooks.on("canvasReady", async () => {
  debuglog(`Canvas is ready`);
});

Hooks.once("ready", () => {
  debuglog(`appstate is ready`);
  if (getVisibilityHandler() === "effects") setupVisibilityHooks();
  gmVisionCopy = game.pf2e.settings.gmVision;
});

function handleMutations(token, record, mutations) {
  // debuglog("handleMutations", { token, record, mutations });
  for (const type of mutations?.adds) {
    const mutation = {};
    switch (type) {
      case "hidden":
        if (token.detectionFilter) {
          mutation.visible = token.detectionFilter.enabled;
          token.detectionFilter.enabled = false;
        }
        break;
    }
    record.mutations[type] = mutation;
    debuglog(`'${token.name}' adds '${type}' mutation`, {
      token,
      record,
      mutation,
    });
  }
  for (const type of mutations?.removes) {
    const mutation = record.mutations[type];
    switch (type) {
      case "hidden":
        if (token.detectionFilter) {
          token.detectionFilter.enabled = mutation.visible;
        }
        break;
    }
    delete record.mutations[type];
    debuglog(`'${token.name}' removes '${type}' mutation`, {
      token,
      record,
    });
  }
}

function recordObservation(token, key, override) {
  const record = cache.getOrCreate(token);
  const snapshot = cache.duplicate(record.snapshot);
  if (!(key in snapshot)) snapshot[key] = { exceptFor: new Set() };
  const state = snapshot[key];
  const observers = new Set(override.exceptFor);
  const detectors = observers.intersection(observingActorIds);
  state.exceptFor = state.exceptFor.union(detectors);
  const mutations = cache.update(record, snapshot);
  if (!mutations) return;
  handleMutations(token, record, mutations);
}

function controlTokenHook(token, controlled) {
  debuglog(`'${token.name}' controlled: ${controlled}`, { token, controlled });
  if (!controlled) {
    const actor = token?.actor;
    observingActorIds.delete(actor?.id);
    cache.removeObserver(actor, handleMutations);
    return;
  }

  observingActorIds.add(token.actor?.id);
  if (cache.has(token)) {
    cache.removeAvoider(token, handleMutations);
  }
}

function refreshTokenHook(token, _options) {
  if (game.pf2e.settings.gmVision) {
    if (gmVisionCopy) return;
    gmVisionCopy = true;
    cache.clear(handleMutations);
    return;
  }
  gmVisionCopy = false;

  const actor = token?.actor;
  if (!actor) return;
  // debuglog(`'${token.name}' refreshed`, { token, observingActorIds });
  if (observingActorIds.has(actor.id)) {
    if (cache.has(token)) cache.removeAvoider(token, handleMutations);
    return;
  }

  const stealth = actor?.items.find((i) => i.slug === SLUGS.stealthEffect);
  if (!stealth) return;
  const states = stealth.flags[MODULE_ID];
  if (!states) return false;
  for (const [key, s] of Object.entries(states)) {
    if (s.exceptFor.some((id) => observingActorIds.has(id))) {
      recordObservation(token, key, s);
    }
  }
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
    hooks.controlToken = Hooks.on("controlToken", controlTokenHook);
  if (!hooks?.refreshToken)
    hooks.refreshToken = Hooks.on("refreshToken", refreshTokenHook);
  if (!hooks?.createItem)
    hooks.createItem = Hooks.on("createItem", createItemHook);
  if (!hooks?.deleteItem)
    hooks.deleteItem = Hooks.on("deleteItem", deleteItemHook);
  if (!hooks?.updateToken)
    hooks.updateToken = Hooks.on("updateToken", updateTokenHook);
  if (!hooks?.createToken)
    hooks.createToken = Hooks.on("createToken", createTokenHook);
  if (!hooks?.deleteToken)
    hooks.deleteToken = Hooks.on("deleteToken", deleteTokenHook);
}

export function releaseVisibilityHooks() {
  Hooks.off("deleteToken", deleteTokenHook);
  Hooks.off("createToken", createTokenHook);
  Hooks.off("updateToken", updateTokenHook);
  Hooks.off("deleteItem", deleteItemHook);
  Hooks.off("createItem", createItemHook);
  Hooks.off("refreshToken", refreshTokenHook);
  Hooks.off("controlToken", controlTokenHook);
  hooks = {};
}

// token.visible;
// token.detectionFilter;
// static getDetectionFilter() {
// 	const filter = this._detectionFilter ??= foundry.canvas.rendering.filters.OutlineOverlayFilter.create({ wave: !0 });
// 	return filter.thickness = 1, filter;
// }
// token.detectionFilterMesh.visible;
//
