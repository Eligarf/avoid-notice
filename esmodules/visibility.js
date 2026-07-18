import { MODULE_ID, SLUGS, CONDITION_IDS } from "./const.js";
import { debuglog, getVisibilityHandler } from "./main.js";
import { SETTINGS } from "./settings.js";

let hooks = {};
let observingActorIds = new Set();
let observedTokens = {};
let gmVisionCopy = undefined;

hooks.canvasReady = Hooks.on("canvasReady", async () => {
  debuglog(`Canvas is ready`);
});

Hooks.once("ready", () => {
  debuglog(`appstate is ready`);
  if (getVisibilityHandler() === "effects") setupVisibilityHooks();
  gmVisionCopy = game.pf2e.settings.gmVision;
});

function removeOverrides(token) {
  const override = observedTokens[token?.id];
  delete observedTokens[token.id];
  debuglog(`'${token.name}' mutations need to be destroyed`, {
    override,
  });
}

function removeObservationsOf(actor) {
  for (const tokenId in observedTokens) {
    const override = observedTokens[tokenId];
    for (const type in override) {
      const state = override[type];
      if (state.exceptFor.has(actor?.id)) {
        state.exceptFor.delete(actor?.id);
        if (state?.mutation && state.exceptFor.size === 0) {
          debuglog(`'${tokenId}' mutations for '${type}' need to be destroyed`);
          delete state.mutation;
        }
      }
    }
  }
}

function recordObservation(token, key, override) {
  // debuglog(`'${token.name}' isn't '${key}' to observers`, {
  //   token,
  //   override,
  // });
  if (!(token?.id in observedTokens)) {
    observedTokens[token.id] = {};
  }
  const record = observedTokens[token.id];
  if (!(key in record)) {
    record[key] = { exceptFor: new Set() };
  }
  const state = record[key];
  const observers = new Set(override.exceptFor);
  const detectors = observers.intersection(observingActorIds);
  const exceptFor = state.exceptFor.union(detectors);
  if (exceptFor.size === state.exceptFor.size) return;
  debuglog("old, new", { old: duplicate(state.exceptFor), new: exceptFor });
  state.exceptFor = exceptFor;
  if (!state?.mutation && exceptFor.size > 0) {
    debuglog(`'${token.name}' mutations for '${key}' need to be created`);
    state.mutation = "mutation";
  }
}

function controlTokenHook(token, controlled) {
  if (!controlled) {
    const actor = token?.actor;
    removeObservationsOf(actor);
    observingActorIds.delete(actor?.id);
    return;
  }

  if (token?.id in observedTokens) {
    removeOverrides(token);
  }
  observingActorIds.add(token.actor?.id);
}

function refreshTokenHook(token, options) {
  // debuglog(`'${token.name}' refreshed`, { token, options });
  if (game.pf2e.settings.gmVision) {
    if (gmVisionCopy) return;
    gmVisionCopy = true;
    const tokenCount = Object.keys(observedTokens).length;
    if (tokenCount > 0) {
      for (const tokenId in observedTokens) {
        const token = canvas.tokens.get(tokenId);
        if (token) removeOverrides(token);
      }
      observedTokens = {};
    }
    return;
  }
  gmVisionCopy = false;

  const actor = token?.actor;
  if (!actor) return;
  // debuglog(`'${token.name}' refreshed`, { token, observingActorIds });
  if (observingActorIds.has(actor.id)) {
    if (token?.id in observedTokens) {
      removeOverrides(token);
    }
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
  const actor = options.parent;
  debuglog(`'${actor?.name}' stealth effect deleted`, {
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
  if (tokenDoc?.id in observedTokens) {
    delete observedTokens[tokenDoc.id];
  }
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
