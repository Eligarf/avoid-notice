import { MODULE_ID } from "./const.js";
import { invokeMenu } from "./menu.js";
import { setupVisibilityHooks, releaseVisibilityHooks } from "./visibility.js";

export const SETTINGS = {
  // General settings
  clearPartyStealthAfterCombat: "clearPartyStealthAfterCombat",
  computeCover: "computeCover",
  hideFromAllies: "hideFromAllies",
  noSummary: "noSummary",
  removeGmHidden: "removeGmHidden",
  requireActivity: "requireActivity",
  useUnnoticed: "useUnnoticed",
  useEffects: "useEffects",
  panZoomToCombat: "panZoomToCombat",

  // Advanced settings
  logLevel: "logLevel",
  schema: "schema",
  useNewApis: "useBulkApi",

  // keybindings
  menu: "menu",
};

export let cachedSettings = {
  panZoomToCombat: true,
  useEffects: false,
  computeCover: false,
  requireActivity: true,
  hideFromAllies: false,
  removeGmHidden: false,
  clearPartyStealthAfterCombat: false,
  useUnnoticed: true,
  noSummary: false,
  logLevel: "none",
  useNewApis: false,
};

export function setupSettings() {
  game.settings.register(MODULE_ID, SETTINGS.panZoomToCombat, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.panZoomToCombat}.name`),
    hint: game.i18n.localize(`${MODULE_ID}.${SETTINGS.panZoomToCombat}.hint`),
    scope: "client",
    config: true,
    type: Boolean,
    default: cachedSettings.panZoomToCombat,
    onChange: (newValue) => {
      cachedSettings.panZoomToCombat = newValue;
    },
  });
  cachedSettings.panZoomToCombat = game.settings.get(
    MODULE_ID,
    SETTINGS.panZoomToCombat,
  );

  game.settings.register(MODULE_ID, SETTINGS.useEffects, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.useEffects}.name`),
    hint: game.i18n.localize(`${MODULE_ID}.${SETTINGS.useEffects}.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: cachedSettings.useEffects,
    onChange: (newValue) => {
      cachedSettings.useEffects = newValue;
      if (newValue) {
        setupVisibilityHooks();
      } else {
        releaseVisibilityHooks();
      }
    },
  });
  cachedSettings.useEffects = game.settings.get(MODULE_ID, SETTINGS.useEffects);

  game.settings.register(MODULE_ID, SETTINGS.computeCover, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.computeCover}.name`),
    hint: game.i18n.localize(`${MODULE_ID}.${SETTINGS.computeCover}.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: cachedSettings.computeCover,
    onChange: (newValue) => {
      cachedSettings.computeCover = newValue;
    },
  });
  cachedSettings.computeCover = game.settings.get(
    MODULE_ID,
    SETTINGS.computeCover,
  );

  game.settings.register(MODULE_ID, SETTINGS.requireActivity, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.requireActivity}.name`),
    hint: game.i18n.localize(`${MODULE_ID}.${SETTINGS.requireActivity}.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: cachedSettings.requireActivity,
    onChange: (newValue) => {
      cachedSettings.requireActivity = newValue;
    },
  });
  cachedSettings.requireActivity = game.settings.get(
    MODULE_ID,
    SETTINGS.requireActivity,
  );

  game.settings.register(MODULE_ID, SETTINGS.hideFromAllies, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.hideFromAllies}.name`),
    hint: game.i18n.localize(`${MODULE_ID}.${SETTINGS.hideFromAllies}.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: cachedSettings.hideFromAllies,
    onChange: (newValue) => {
      cachedSettings.hideFromAllies = newValue;
    },
  });
  cachedSettings.hideFromAllies = game.settings.get(
    MODULE_ID,
    SETTINGS.hideFromAllies,
  );

  game.settings.register(MODULE_ID, SETTINGS.removeGmHidden, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.removeGmHidden}.name`),
    hint: game.i18n.localize(`${MODULE_ID}.${SETTINGS.removeGmHidden}.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: cachedSettings.removeGmHidden,
    onChange: (newValue) => {
      cachedSettings.removeGmHidden = newValue;
    },
  });
  cachedSettings.removeGmHidden = game.settings.get(
    MODULE_ID,
    SETTINGS.removeGmHidden,
  );

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
    default: cachedSettings.clearPartyStealthAfterCombat,
    onChange: (newValue) => {
      cachedSettings.clearPartyStealthAfterCombat = newValue;
    },
  });
  cachedSettings.clearPartyStealthAfterCombat = game.settings.get(
    MODULE_ID,
    SETTINGS.clearPartyStealthAfterCombat,
  );

  game.settings.register(MODULE_ID, SETTINGS.useUnnoticed, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.useUnnoticed}.name`),
    hint: game.i18n.localize(`${MODULE_ID}.${SETTINGS.useUnnoticed}.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: cachedSettings.useUnnoticed,
    onChange: (newValue) => {
      cachedSettings.useUnnoticed = newValue;
    },
  });
  cachedSettings.useUnnoticed = game.settings.get(
    MODULE_ID,
    SETTINGS.useUnnoticed,
  );

  game.settings.register(MODULE_ID, SETTINGS.noSummary, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.noSummary}.name`),
    hint: game.i18n.localize(`${MODULE_ID}.${SETTINGS.noSummary}.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: cachedSettings.noSummary,
    onChange: (newValue) => {
      cachedSettings.noSummary = newValue;
    },
  });
  cachedSettings.noSummary = game.settings.get(MODULE_ID, SETTINGS.noSummary);

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
    default: cachedSettings.logLevel,
    onChange: (newValue) => {
      cachedSettings.logLevel = newValue;
    },
  });
  cachedSettings.logLevel = game.settings.get(MODULE_ID, SETTINGS.logLevel);

  game.settings.register(MODULE_ID, SETTINGS.useNewApis, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.useNewApis}.name`),
    hint: game.i18n.localize(`${MODULE_ID}.${SETTINGS.useNewApis}.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: cachedSettings.useNewApis,
    onChange: (newValue) => {
      cachedSettings.useNewApis = newValue;
    },
  });
  cachedSettings.useNewApis = game.settings.get(MODULE_ID, SETTINGS.useNewApis);
}

export function setupKeybindings() {
  game.keybindings.register(MODULE_ID, SETTINGS.menu, {
    name: `${MODULE_ID}.${SETTINGS.menu}.bindings.name`,
    hint: `${MODULE_ID}.${SETTINGS.menu}.bindings.hint`,
    editable: [{ key: "Equal", modifiers: [] }],
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
