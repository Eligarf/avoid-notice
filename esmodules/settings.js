import { MODULE_ID } from "./const.js";
import { log } from "./main.js";
import { isVisionerActive } from "./visioner.js";
import { invokeMenu } from "./menu.js";

export const SETTINGS = {
  // General settings
  clearPartyStealthAfterCombat: "clearPartyStealthAfterCombat",
  computeCover: "computeCover",
  hideFromAllies: "hideFromAllies",
  noSummary: "noSummary",
  removeGmHidden: "removeGmHidden",
  requireActivity: "requireActivity",
  strict: "strict",
  useUnnoticed: "useUnnoticed",
  visibilityHandler: "visibilityHandler",
  panZoomToCombat: "panZoomToCombat",

  // Misfit settings
  autorollSpellDamage: "autorollSpellDamage",
  clearMovement: "clearMovement",
  rage: "rage",

  // Advanced settings
  logLevel: "logLevel",
  schema: "schema",
  useNewApis: "useBulkApi",

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

  const visioner = isVisionerActive();

  let choices = {
    native: `${MODULE_ID}.${SETTINGS.visibilityHandler}.native`,
    disabled: `${MODULE_ID}.${SETTINGS.visibilityHandler}.disabled`,
    best: `${MODULE_ID}.${SETTINGS.visibilityHandler}.best`,
    worst: `${MODULE_ID}.${SETTINGS.visibilityHandler}.worst`,
  };
  if (visioner)
    choices.visioner = `${MODULE_ID}.${SETTINGS.visibilityHandler}.visioner`;

  game.settings.register(MODULE_ID, SETTINGS.visibilityHandler, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.visibilityHandler}.name`),
    scope: "world",
    config: true,
    type: String,
    choices,
    default: "disabled",
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

  game.settings.register(MODULE_ID, SETTINGS.strict, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.strict}.name`),
    hint: game.i18n.localize(`${MODULE_ID}.${SETTINGS.strict}.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, SETTINGS.autorollSpellDamage, {
    name: game.i18n.localize(
      `${MODULE_ID}.${SETTINGS.autorollSpellDamage}.name`,
    ),
    hint: game.i18n.localize(
      `${MODULE_ID}.${SETTINGS.autorollSpellDamage}.hint`,
    ),
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, SETTINGS.rage, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.rage}.name`),
    hint: game.i18n.localize(`${MODULE_ID}.${SETTINGS.rage}.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  const splitVersion = game.version.split();
  const clearMovement =
    Number(splitVersion[0]) === 13 && Number(splitVersion[1]) < 347;
  if (clearMovement) {
    game.settings.register(MODULE_ID, SETTINGS.clearMovement, {
      name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.clearMovement}.name`),
      hint: game.i18n.localize(`${MODULE_ID}.${SETTINGS.clearMovement}.hint`),
      scope: "world",
      config: true,
      type: Boolean,
      default: false,
    });
  }

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

  game.settings.register(MODULE_ID, SETTINGS.useNewApis, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.useNewApis}.name`),
    hint: game.i18n.localize(`${MODULE_ID}.${SETTINGS.useNewApis}.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
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
  { label: "misfits", before: SETTINGS.autorollSpellDamage },
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
