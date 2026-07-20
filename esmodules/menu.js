const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
import { MODULE_ID, SLUGS } from "./const.js";
import { invokeNoTokensMenu } from "./no-tokens-menu.js";
import { invokeTokensMenu } from "./tokens-menu.js";
import { invokeConnectedTokensMenu } from "./connected-tokens-menu.js";

export class AvoidNoticePopupMenu extends HandlebarsApplicationMixin(
  ApplicationV2,
) {
  constructor(options = {}) {
    super(options);
    this.options.window.title = options.title;
    this._resolve = null;
    this._onPointerDown = this._onPointerDown.bind(this);
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
    return context;
  }

  _onClose() {
    document.removeEventListener("pointerdown", this._onPointerDown, {
      capture: true,
    });
    if (this._resolve) {
      this._resolve(null);
      this._resolve = null;
    }
  }

  _onRender(context, options) {
    super._onRender(context, options);
    document.addEventListener("pointerdown", this._onPointerDown, {
      capture: true,
    });
  }

  _onPointerDown(event) {
    const path = event.composedPath?.() || event.path || [];
    if (!path.includes(this.element)) {
      this.close();
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

export function invokeMenu() {
  if (!canvas?.ready) return;

  const controlledTokens = canvas.tokens.controlled;
  let controlled = null;
  if (controlledTokens.length !== 0) {
    controlled = {
      type: "controlled",
      tokens: controlledTokens,
      dispositions: summarizeDispositions(controlledTokens),
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
    };
  }

  // Three basic scenarios to pick between here. If no tokens are selected, then we
  // are doing some full-scene operation.
  if (!controlled && !targeted) {
    invokeNoTokensMenu();
    return;
  }

  // If we have both types, then we will be doing connected operations
  if (controlled && targeted) {
    invokeConnectedTokensMenu({
      controlled,
      targeted,
    });
    return;
  }

  // Otherwise, no need to distiguish between selected and targeted, we can just use whichever one is present.
  const selection = controlled || targeted;
  invokeTokensMenu({ selection });
}
