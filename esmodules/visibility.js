import { MODULE_ID, SLUGS } from "./const.js";
import { debuglog, getVisibilityHandler } from "./main.js";
import { createVisibilityCache } from "./cache.js";

let hooks = {};
let observingActorIds = new Set();
let gmVisionCopy = undefined;
const cache = createVisibilityCache();

hooks.canvasReady = globalThis.Hooks.on("canvasReady", async () => {
  debuglog(`Canvas is ready`);
});

globalThis.Hooks.once("ready", () => {
  debuglog(`appstate is ready`);
  if (getVisibilityHandler() === "effects") setupVisibilityHooks();
  gmVisionCopy = game.pf2e.settings.gmVision;
  for (const token of canvas.tokens.controlled) {
    controlTokenHook(token, true);
  }
});

function setUndetectedMutation(token, undetected) {
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
    token.detectionFilter = undetected.filter;
  } else if (token.detectionFilter !== undetected.filter) {
    ui.notifications.warn(
      `Token '${token.name}' already has a detection filter. This may cause visual issues.`,
    );
  }
}

function handleMutations(token, record, mutations) {
  debuglog("handleMutations", { token, record, mutations });
  switch (mutations?.adds?.length) {
    case 2:
      ui.notifications.warn(`Token '${token.name}' is getting two adds?`);
      break;
    case 1:
      const type = mutations.adds[0];
      if (type === "hidden") {
        record.mutations.hidden = {};
        if (token.detectionFilter) {
          token.detectionFilter.enabled = false;
        } else {
          ui.notifications.warn(
            `Token '${token.name}' is being hidden but has no detection filter. This may cause visual issues.`,
          );
        }
      } else if (type === "undetected") {
        const filter =
          foundry.canvas.rendering.filters.OutlineOverlayFilter.create({
            wave: true,
          });
        filter.thickness = 1;
        record.mutations.undetected = { filter };
        setUndetectedMutation(token, record.mutations.undetected);
      }
      break;
  }
  switch (mutations?.removes?.length) {
    case 2:
      ui.notifications.warn(`Token '${token.name}' is getting two removes?`);
      break;
    case 1:
      const type = mutations.removes[0];
      if (type === "hidden") {
        if (token.detectionFilter) {
          token.detectionFilter.enabled = true;
        } else {
          ui.notifications.warn(
            `Token '${token.name}' is being unhidden but has no detection filter. This may cause visual issues.`,
          );
        }
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
        if (token.detectionFilter !== record.mutations.undetected.filter) {
          ui.notifications.warn(
            `Token '${token.name}' has a different detection filter than expected. This may cause visual issues.`,
          );
        } else token.detectionFilter = null;
        record.mutations.undetected.filter = null;
        delete record.mutations.undetected;
      }
      break;
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
  // debuglog(`'${token.name}' refreshed (visible=${token.visible})`, {
  //   token,
  //   observingActorIds,
  // });
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
  const record = cache.get(token);
  if (!record) return;
  const undetected = record?.mutations?.undetected;
  if (!undetected) return;
  setUndetectedMutation(token, undetected);
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

// token.visible;
// token.detectionFilter;
// static getDetectionFilter() {
// 	const filter = this._detectionFilter ??= foundry.canvas.rendering.filters.OutlineOverlayFilter.create({ wave: !0 });
// 	return filter.thickness = 1, filter;
// }
// token.detectionFilterMesh.visible;
//
