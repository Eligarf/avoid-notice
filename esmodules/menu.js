const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
import { MODULE_ID, COMBAT_STATES, SLUGS } from "./const.js";
import { debuglog, isVisionerActive } from "./main.js";
import { invokeNoTokensMenu } from "./no-tokens-menu.js";
import { invokeTokensMenu } from "./tokens-menu.js";
import { SETTINGS } from "./settings.js";

export class AvoidNoticePopupMenu extends HandlebarsApplicationMixin(
  ApplicationV2,
) {
  constructor(options = {}) {
    super(options);
    this.options.window.title = options.title;
    this._resolve = null;
  }

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-popup-menu`,
    tag: "form",
    actions: {
      popupClick: AvoidNoticePopupMenu.popupClick,
    },
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/popup-menu.hbs`,
    },
  };

  async _prepareContext() {
    const context = await super._prepareContext();
    context.options = this.options;
    debuglog("popup menu context", context);
    return context;
  }

  _onClose() {
    if (this._resolve) {
      this._resolve(null);
      this._resolve = null;
    }
  }

  static popupClick(event, target) {
    const key = target.getAttribute("data-key");
    if (this._resolve) {
      this._resolve({ key, secret: event.ctrlKey });
      this._resolve = null;
    }
    this.close();
  }

  static async show(title = "Choose an option", choices = null) {
    return new Promise((resolve) => {
      if (!choices) choices = [];
      choices.push({
        key: "cancel",
        label: game.i18n.localize(`${MODULE_ID}.menu.cancel`),
      });
      const app = new AvoidNoticePopupMenu({ title, choices });
      app._resolve = resolve;
      app.render(true);
    });
  }
}

function summarizeDispositions(tokens) {
  const dispositions = tokens.map((t) => t.document.disposition);
  const uniqueDispositions = new Set(dispositions);
  return uniqueDispositions;
}

export function isAvoider(actor, combatState) {
  // If you have a stealth effect you are an avoider
  if (actor?.items?.some((item) => item.system.slug === SLUGS.stealthEffect))
    return true;

  // once combat starts, a combantant has to have the stealth effect
  const combatant = game.combats?.active?.combatants?.contents?.some(
    (c) => c.token?.actor?.id === actor.id,
  );
  if (
    combatState === COMBAT_STATES.started &&
    !!combatant &&
    combatant?.initiative !== null
  )
    return false;

  // If activities aren't required, you are an avoider if your initiative is stealth.
  const requireActivity = game.settings.get(
    MODULE_ID,
    SETTINGS.requireActivity,
  );
  if (!requireActivity)
    return actor?.system?.initiative?.statistic === SLUGS.stealth;

  // If you don't have an exploration activity, you are an avoider if your initiative is stealth.
  if (!(actor?.parties?.size > 0 && actor?.system?.exploration))
    return actor?.system?.initiative?.statistic === SLUGS.stealth;

  // You are an avoider if you have an exploration activity with the "avoid-notice" slug.
  return actor.system.exploration.some(
    (a) => actor.items.get(a)?.system?.slug === SLUGS.avoidNotice,
  );
}

function invokePairedTokensMenu({ selected, targeted, combatState }) {
  debuglog("invoked the paired tokens menu", {
    selected,
    targeted,
    combatState,
  });
}

export function invokeMenu() {
  if (!canvas?.ready) return;
  if (isVisionerActive()) return;

  const combatState = !game.combats?.active
    ? COMBAT_STATES.inactive
    : game.combats.active.round === 0
      ? COMBAT_STATES.active
      : COMBAT_STATES.started;

  const controlledTokens = canvas.tokens.controlled;
  let selected = null;
  if (controlledTokens.length !== 0) {
    selected = {
      type: "controlled",
      tokens: controlledTokens,
      dispositions: summarizeDispositions(controlledTokens),
      hasAvoider: controlledTokens.some(isAvoider, combatState),
    };
  }

  const targetedTokens = Array.from(game.user.targets).map(
    (t) => canvas.tokens.get(t.id) || t,
  );
  let targeted = null;
  if (targetedTokens.length !== 0) {
    targeted = {
      type: "targeted",
      tokens: targetedTokens,
      dispositions: summarizeDispositions(targetedTokens),
      hasAvoider: targetedTokens.some(isAvoider, combatState),
    };
  }

  // Three basic scenarios to pick between here. If no tokens are selected, then we
  // are doing some full-scene operation.
  if (!selected && !targeted) {
    invokeNoTokensMenu({ combatState });
    return;
  }

  // If we have both types, then we will be doing pairwise operations
  if (selected && targeted) {
    invokePairedTokensMenu({
      selected,
      targeted,
      combatState,
    });
    return;
  }

  // Otherwise, no need to distiguish between selected and targeted, we can just use whichever one is present.
  const selection = selected || targeted;
  invokeTokensMenu({ selection, combatState });
}
