import { MODULE_ID } from "./const.js";
import { log } from "./main.js";
import { invokeMenu } from "./menu.js";

export const SETTINGS = {
  // General settings
  useEffects: "useEffects",
  clearPartyStealthAfterCombat: "clearPartyStealthAfterCombat",
  computeCover: "computeCover",
  hideFromAllies: "hideFromAllies",
  noSummary: "noSummary",
  removeGmHidden: "removeGmHidden",
  requireActivity: "requireActivity",
  useUnnoticed: "useUnnoticed",
  panZoomToCombat: "panZoomToCombat",

  // Advanced settings
  logLevel: "logLevel",
  schema: "schema",

  // keybindings
  menu: "menu",
};

export function setupSettings() {
  game.settings.register(MODULE_ID, SETTINGS.panZoomToCombat, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.panZoomToCombat}.name`),
    hint: game.i18n.localize(`${MODULE_ID}.${SETTINGS.panZoomToCombat}.hint`),
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, SETTINGS.useEffects, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.useEffects}.name`),
    hint: game.i18n.localize(`${MODULE_ID}.${SETTINGS.useEffects}.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, SETTINGS.computeCover, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.computeCover}.name`),
    hint: game.i18n.localize(`${MODULE_ID}.${SETTINGS.computeCover}.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, SETTINGS.requireActivity, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.requireActivity}.name`),
    hint: game.i18n.localize(`${MODULE_ID}.${SETTINGS.requireActivity}.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, SETTINGS.hideFromAllies, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.hideFromAllies}.name`),
    hint: game.i18n.localize(`${MODULE_ID}.${SETTINGS.hideFromAllies}.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, SETTINGS.removeGmHidden, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.removeGmHidden}.name`),
    hint: game.i18n.localize(`${MODULE_ID}.${SETTINGS.removeGmHidden}.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, SETTINGS.clearPartyStealthAfterCombat, {
    name: game.i18n.localize(
      `${MODULE_ID}.${SETTINGS.clearPartyStealthAfterCombat}.name`,
    ),
    hint: game.i18n.localize(
      `${MODULE_ID}.${SETTINGS.clearPartyStealthAfterCombat}.hint`,
    ),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, SETTINGS.useUnnoticed, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.useUnnoticed}.name`),
    hint: game.i18n.localize(`${MODULE_ID}.${SETTINGS.useUnnoticed}.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, SETTINGS.noSummary, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.noSummary}.name`),
    hint: game.i18n.localize(`${MODULE_ID}.${SETTINGS.noSummary}.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, SETTINGS.logLevel, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.logLevel}.name`),
    scope: "client",
    config: true,
    type: String,
    choices: {
      none: game.i18n.localize(`${MODULE_ID}.${SETTINGS.logLevel}.none`),
      debug: game.i18n.localize(`${MODULE_ID}.${SETTINGS.logLevel}.debug`),
      log: game.i18n.localize(`${MODULE_ID}.${SETTINGS.logLevel}.log`),
    },
    default: "none",
  });
}

export function setupKeybindings() {
  game.keybindings.register(MODULE_ID, SETTINGS.menu, {
    name: `${MODULE_ID}.${SETTINGS.menu}.name`,
    hint: `${MODULE_ID}.${SETTINGS.menu}.hint`,
    editable: [],
    onDown: async () => {
      if (!game.user.isGM) return;
      invokeMenu();
    },
  });
}

const SETTING_GROUPS = [
  { label: "general", before: SETTINGS.panZoomToCombat },
  { label: "debug", before: SETTINGS.logLevel },
];

export function groupSettings() {
  for (const section of SETTING_GROUPS) {
    $("<div>")
      .addClass("form-group group-header")
      .html(game.i18n.localize(`${MODULE_ID}.config.${section.label}`))
      .insertBefore(
        $(`[name="${MODULE_ID}.${section.before}"]`).parents(
          "div.form-group:first",
        ),
      );
  }
}
