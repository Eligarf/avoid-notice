import { log } from "./main.js";
import { MODULE_ID } from "./const.js";

console.log("avoid test.js loaded");

/*
Plan: evaluate suppression on selection-change and when the underlying condition item changes, and update only the tokens whose visual state must change. Keep the change client-side (do not mutate game data) and debounce/redraw minimally.

High-level approach
- Centralize the rendering decision into one function (e.g. shouldUseSpecialRendering(token, selectedIds)). That function:
  - Checks whether the token/actor currently has the undetected/hidden condition item.
  - Reads that condition item’s flags.ignoredBy (list of token IDs).
  - Returns false (i.e. suppress special rendering) if any controlled/selected token ID is present in flags.ignoredBy; true otherwise.
  - For multi-selection: treat suppression as true if ANY selected token is in ignoredBy (or pick the logic you want).
- Whenever the set of selected/controlled tokens changes, recompute shouldUseSpecialRendering for tokens that might have the condition and apply or remove your special rendering accordingly.
- Also recompute when the condition item’s flags.ignoredBy changes, when tokens are created/destroyed, or when the scene changes.

Events/hooks to use
- Selection changes: Hooks.on("controlToken", (token, controlled) => { ... }) or check canvas.tokens.controlled. This fires when the user selects/deselects tokens.
- Optionally also consider Hooks.on("targetToken") or track game.user.targets if you want targeting behavior instead of control.
- Condition/flag changes: Hooks.on("updateItem", (item, diff, options, userId) => { ... }) or Hooks.on("updateActor") / updateEmbeddedDocuments depending on where the condition lives.
- Scene/canvas changes: Hooks.on("canvasReady", ...) and Hooks.on("createToken"/"deleteToken"/"updateToken", ...) as needed.

How to update visuals (low-level)
- Do not change the data model; keep the suppression client-side. Store a boolean on the Token instance (e.g. token._myModuleSuppressSpecialRendering) so you can detect changes.
- When the decision flips for a token, reapply your special rendering path. How exactly to re-render depends on how your module draws the special visuals:
  - If you attach PIXI filters/effects to token.sprite or token.container, add/remove those filters and call token.refresh() or token.draw() to force redraw.
  - If you toggle alpha/tint/overlays, update those properties and call token.refresh() or token.draw() as needed.
- Use token.refresh() (or token.draw() depending on your code path) rather than recreating the token to minimize overhead.

Performance and correctness considerations
- Only iterate over tokens that can have the condition (cache tokens whose actor has the condition) rather than all tokens every selection change.
- Debounce/raf the selection-change handler to avoid re-render thrashing on rapid multi-selects: e.g. schedule a single update via requestAnimationFrame or setTimeout(…,0).
- Compare token ID types carefully (strings vs numbers).
- Support multiple clients: this is a client-side visual change; do not write to flags on the server. Different users can see different visuals based on their selection.
- Consider scene/scene-token mismatches: ensure the selected token IDs you test are for the current scene.
- Edge cases: when a token in flags.ignoredBy is deleted or its id changes (rare), ensure you respond to token create/delete events and recompute.
- Testing: verify single-select, multi-select, switching scenes, and updating the condition item flags.

Summary of minimal steps to implement
1. Implement shouldUseSpecialRendering(token, selectedIds).
2. Implement updateAffectedTokens(selectedIds) that finds tokens with the condition, compares previous suppression state, and toggles rendering + token.refresh() for changed tokens.
3. Hook updateAffectedTokens to controlToken, item updates (updateItem/updateActor), canvasReady, and token create/delete/update events.
4. Optimize with caching and debouncing.

This keeps the logic centralized, avoids server-side mutations, and updates only the tokens that actually need their visuals changed.

Short answer: in PF2e the stealth visuals are implemented as additional display children (sprites/containers) attached to the Token, not as a global PIXI.Filter applied to the token image. That makes them easiest to suppress by toggling visibility of the child sprite rather than trying to remove/replace a filter.

How to verify at runtime
- Open Foundry's dev console (Ctrl+Shift+I in the client).
- Inspect a token that shows the undetected/hidden rendering. Run something like:

const tok = canvas.tokens.placeables.find(t => t.id === "<tokenId>");
tok.children.map(c => ({type: c.constructor.name, name: c.name, texture: c.texture?.baseTexture?.imageUrl, visible: c.visible, filters: (c.filters||[]).length}));

- Look for a child whose texture or name references "undetected", "hidden", or the pf2e icons path. That child is the special rendering overlay.

Why this matters for your feature
- Because it's a child sprite you can suppress client-side by setting child.visible = false (or removing the child) and then calling token.refresh()/token.draw() as needed.
- This is cheap and local to a client; you don't need to change item flags or actor data.
- If you instead tried to detect/modify a filter you’d need to handle filter arrays and shader state; filters are less likely used for PF2e stealth and are heavier to toggle.

Practical low-level tips
- Identify the overlay child by inspecting its texture.baseTexture.imageUrl or its constructor/name.
- Toggle visibility rather than removing the sprite to make toggling cheap and reversible.
- Keep the change client-only (don’t write to game data). Store suppression state on the Token instance (e.g. token._pf2eAvoidNoticeHiddenSuppressed) so you can detect changes and restore the overlay later.
- After toggling, call token.refresh() or token.draw() to update visuals.

// Inspect children and try to auto-detect the PF2e stealth overlay
const tok = canvas.tokens.placeables.find(t => t.id === "GHtvSmGsPAsIE6QL");
if (!tok) return console.warn("token not found");
console.log("token container children:", tok.children.map(c => ({
  constructor: c.constructor.name,
  name: c.name,
  visible: c.visible,
  texture: c.texture?.baseTexture?.imageUrl
})));

// Heuristic: find a child by name or texture url containing keywords
const kw = ["undetected","hidden","stealth"];
const overlay = tok.children.find(c => {
  const name = (c.name || "").toLowerCase();
  const url = (c.texture?.baseTexture?.imageUrl || "").toLowerCase();
  return kw.some(k => name.includes(k) || url.includes(k));
});

if (overlay) {
  // hide/show and force a redraw
  overlay.visible = false;         // or true to restore
  // token.refresh() will redraw; depending on PF2e internals you may need draw()
  tok.refresh();
  console.log("toggled overlay:", overlay);
} else {
  console.log("no stealth overlay child detected with keywords; inspect children above");

Does pf2e system handle undetected condition the same way, or does it do something different because in the case of undetected the token is not visible at all on the canvas?

# Copilot (b89c4395-b692-4582-a0f8-7d4b262bb24c) ───

Short answer
- PF2e implements the visible "hidden" styling as an overlay child sprite attached to the Token container.
- For the undetected state the system typically makes the token’s main sprite non‑visible (so the token is effectively not drawn) — i.e. it hides the token’s primary texture/sprite rather than only adding an overlay. In practice you must handle both: the overlay child and the main sprite.

What this means for your feature
- To suppress special rendering for a given viewer you may need to toggle two different things depending on the state:
  - The stealth overlay child (visible = false/true) for the "hidden but shown" case.
  - The token’s main sprite visibility/alpha for the "undetected" case (set visible = true/false or alpha = 0/1).
- Don’t mutate game data. Apply these changes client-side to the PIXI children and reapply after any token redraws.

How to detect and toggle reliably
- Inspect tok.children to find:
  - The main sprite (usually the first/primary child with a texture pointing at the actor image).
  - Any overlay child whose texture URL or name contains keywords like "hidden", "undetected", "stealth".
- If the overlay exists, toggle overlay.visible.
- If the main sprite is hidden/alpha==0, toggle that main sprite’s visible/alpha to show/hide the token for the local client.
- After changing children, call token.refresh() or token.draw() as appropriate.

Practical considerations / edge cases
- PF2e may recreate or reattach these children on refresh. Reapply your toggles after renderToken/token refresh hooks (e.g. Hooks.on("renderToken", …) or following token.draw calls).
- Cache which tokens actually have the condition and only update those.
- Debounce selection-change handlers to avoid many redraws.
- Be defensive about child detection — fall back to logging children if your heuristics fail across versions.
- This is client-only: different users can see different results. Don’t write token or actor documents to force visibility.
- Fog of war, lighting, and permission differences can also affect whether showing a token is meaningful; test those interactions.

If you want, I can give a short console snippet that inspects both the main sprite and overlay and toggles them safely for Foundry v14 + PF2e 8.x.

# User (d02917c8-f5ac-4b86-bde9-3fd1c2a27cbb) ───

yes, please provide the snippet.

# Copilot (e302e22a-2786-41cf-8a8a-61ac3dcd12c2) ───

Paste this into the Foundry client console (Foundry v14 + PF2e 8.x). Replace TOKEN_ID with the token id string. It inspects the token container, heuristically finds the main sprite and any stealth overlay(s), and exposes functions to toggle suppression and to auto-reapply suppression after token redraws.

```js
(() => {
  const TOKEN_ID = "3VdRkVXjzg6TVRuk"; // replace
  const tok = canvas.tokens.placeables.find(t => t.id === TOKEN_ID);
  if (!tok) return console.warn("Token not found on this scene:", TOKEN_ID);
  console.log("is sprite?", tok);

  // Inspect children for debugging
  console.log("children:", tok.children.filter(c => c?.texture).map(c => ({
    ctor: c.constructor.name,
    visible: c.visible,
    alpha: c.alpha,
    src: c?.texture?.baseTexture?.res?.src,
  })));

  // Heuristics to find main sprite and stealth overlay children
  const isOverlayCandidate = c => {
    const txt = (c.texture?.baseTexture?.imageUrl || "").toLowerCase();
    const name = (c.name || "").toLowerCase();
    return /undetected|hidden|stealth|ghost|visibility|mask|overlay/.test(txt) ||
           /undetected|hidden|stealth|ghost|visibility|mask|overlay/.test(name);
  };
  const mainSprite = tok.children.find(c =>
    c.texture && !isOverlayCandidate(c)
  );
  const overlays = tok.children.filter(isOverlayCandidate);

  console.log("mainSprite:", mainSprite, "overlays:", overlays);

  // Toggle suppression locally on the token instance
  function setSuppressed(suppressed) {
    // Track state on the Token instance so we can reapply after redraw
    tok._pf2eAvoidNoticeSuppressed = !!suppressed;

    // Main sprite: PF2e may hide it entirely for 'undetected' => restore by toggling visible/alpha
    if (mainSprite) {
      // prefer visible toggle; also ensure alpha is readable
      try { mainSprite.visible = !suppressed; } catch(e) {}
      try { if (suppressed) mainSprite.alpha = 0; else mainSprite.alpha = 1; } catch(e) {}
    }

    // Overlay children: toggle their visibility
    overlays.forEach(c => {
      try { c.visible = !suppressed; } catch(e) {}
    });

    // Minimal redraw
    try { tok.refresh(); } catch(e) { tok.draw(); }
    console.log(`Set suppressed=${suppressed} for token ${TOKEN_ID}`);
  }

  // Reapply suppression after token redraws (PF2e may recreate overlay children)
  const hookId = Hooks.on("renderToken", (renderedToken, html, data) => {
    if (renderedToken === tok && tok._pf2eAvoidNoticeSuppressed) {
      // re-run the same detection on the new container children
      const newMain = tok.children.find(c => c.texture && !isOverlayCandidate(c));
      const newOverlays = tok.children.filter(isOverlayCandidate);
      if (newMain) { try { newMain.visible = false; newMain.alpha = 0; } catch(e) {} }
      newOverlays.forEach(c => { try { c.visible = false; } catch(e) {} });
      // small refresh
      try { tok.refresh(); } catch(e) { tok.draw(); }
    }
  });

  // Expose control in console
  window.__pf2eUndetectedHelpers = {
    token: tok,
    setSuppressed,
    release: () => Hooks.off("renderToken", hookId)
  };

  console.log("Helpers installed. Use __pf2eUndetectedHelpers.setSuppressed(true) to hide, setSuppressed(false) to restore. Call __pf2eUndetectedHelpers.release() to remove auto-reapply hook.");
})();
```

Notes
- This is entirely client-side and does not change any Actor/Token documents.
- The detection is heuristic to support PF2e variations; if you see the wrong child logged, inspect the children list printed above and tweak the regex in isOverlayCandidate.
 to be able to suppress this detectionFilter on a particular client if a specific token is doing the observing. Any suggestions? Obviously I don't want to affect the true state of the token for others.

# Copilot (25b7c646-daf8-464f-9668-9a81ebdb8df2) ───

so now I'd like to be able to suppress this detectionFilter on a particular client if a specific token is doing the observing. Any suggestions? Obviously I don't want to affect the true state of the token for others.

Copilot

Do it client-side only by toggling the in-memory Token display/filter when the local user is the particular observer. Do not call Token.update or set a flag on the TokenDocument. Hook token rendering and token-control changes so you always remove/disable the filter when needed and restore it when no longer needed.

Example (drop into your module client-side init/ready code):

```js
// Replace with the token id that should disable detection visuals for this client.
// Could be a constant, a flag you store locally, or computed from game.user.character/token.
const OBSERVER_TOKEN_ID = "REPLACE_WITH_TOKEN_ID";

function isLocalObserverActive() {
  // change logic to match how you identify "the observer token" for this user
  return canvas?.tokens?.controlled?.some(t => t.id === OBSERVER_TOKEN_ID);
}

function saveAndRemoveDetectionFilter(token) {
  if (!token?.detectionFilter) return;
  // save the original so we can restore later
  if (!token._pf2e_savedDetectionFilter) token._pf2e_savedDetectionFilter = token.detectionFilter;
  // Prefer to simply disable if the filter exposes .enabled
  if (typeof token.detectionFilter.enabled !== "undefined") {
    token.detectionFilter.enabled = false;
  } else {
    // otherwise remove it from the token display (client-only)
    token.detectionFilter = null;
    if (Array.isArray(token.filters)) {
      token.filters = token.filters.filter(f => f !== token._pf2e_savedDetectionFilter);
    }
  }
}

function restoreDetectionFilter(token) {
  const saved = token._pf2e_savedDetectionFilter;
  if (!saved) return;
  // restore enabled flag if present
  if (typeof saved.enabled !== "undefined") {
    saved.enabled = true;
    token.detectionFilter = saved;
  } else {
    token.detectionFilter = saved;
    token.filters = token.filters || [];
    if (!token.filters.includes(saved)) token.filters.push(saved);
  }
  token._pf2e_savedDetectionFilter = null;
}

Hooks.once("ready", () => {
  // When any token is (re)rendered, enforce suppression if the local observer is active.
  Hooks.on("renderToken", (token) => {
    if (isLocalObserverActive()) {
      saveAndRemoveDetectionFilter(token);
    } else {
      // if observer not active make sure we restore any locally saved filter
      restoreDetectionFilter(token);
    }
  });

  // When control of tokens changes, re-evaluate (user changed their observer token).
  Hooks.on("controlToken", (_token, controlled) => {
    // controlToken fires per-token; just re-run over all visible tokens
    for (const t of canvas.tokens.placeables) {
      if (isLocalObserverActive()) saveAndRemoveDetectionFilter(t);
      else restoreDetectionFilter(t);
    }
  });

  // Also handle scene switches/re-renders
  Hooks.on("canvasReady", () => {
    for (const t of canvas.tokens.placeables) {
      if (isLocalObserverActive()) saveAndRemoveDetectionFilter(t);
      else restoreDetectionFilter(t);
    }
  });
});
```

Notes and caveats
- This never modifies the TokenDocument or calls Token.update, so it won't sync to other clients or persist.
- Foundry/PIXI may recreate token display objects when the token re-renders; hence the renderToken/canvasReady hooks are used to re-apply suppression.
- If a filter exposes .enabled, toggling that is the least invasive. Removing the filter entirely is a fallback.
- Adjust isLoca    */
