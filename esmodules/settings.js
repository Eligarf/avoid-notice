import { MODULE_ID } from "./const.js";
import { isVisionerActive } from "./visioner.js";
import { isPerceptiveActive } from "./perceptive.js";
import { isPerceptionActive } from "./pf2e_perception.js";
import { clearPartyStealth, clearTokenStealth } from "./stealth.js";
import { hideTokens } from "./stealth.js";

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

  // Misfit settings
  autorollSpellDamage: "autorollSpellDamage",
  clearMovement: "clearMovement",
  rage: "rage",
  raiseShields: "raiseShields",

  // Advanced settings
  logLevel: "logLevel",
  schema: "schema",
  useBulkApi: "useBulkApi",

  // keybindings
  clearPartyStealth: "clearPartyStealth",
  clearStealth: "clearStealth",
  hideTokens: "hideTokens",
};

export function setupSettings() {
  const perception = isPerceptionActive();
  const perceptive = isPerceptiveActive();
  const visioner = isVisionerActive();

  let choices = {
    auto: `${MODULE_ID}.${SETTINGS.visibilityHandler}.auto`,
    disabled: `${MODULE_ID}.${SETTINGS.visibilityHandler}.disabled`,
    best: `${MODULE_ID}.${SETTINGS.visibilityHandler}.best`,
    worst: `${MODULE_ID}.${SETTINGS.visibilityHandler}.worst`,
  };
  if (visioner)
    choices.visioner = `${MODULE_ID}.${SETTINGS.visibilityHandler}.visioner`;
  if (perception)
    choices.perception = `${MODULE_ID}.${SETTINGS.visibilityHandler}.perception`;
  if (perceptive)
    choices.perceptive = `${MODULE_ID}.${SETTINGS.visibilityHandler}.perceptive`;

  game.settings.register(MODULE_ID, SETTINGS.visibilityHandler, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.visibilityHandler}.name`),
    scope: "world",
    config: true,
    type: String,
    choices,
    default: "auto",
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

  game.settings.register(MODULE_ID, SETTINGS.raiseShields, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.raiseShields}.name`),
    hint: game.i18n.localize(`${MODULE_ID}.${SETTINGS.raiseShields}.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
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

  const beforeV13 = Number(game.version.split()[0]) < 13;
  if (!beforeV13) {
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

  game.settings.register(MODULE_ID, SETTINGS.useBulkApi, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.useBulkApi}.name`),
    hint: game.i18n.localize(`${MODULE_ID}.${SETTINGS.useBulkApi}.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });
}

const SETTING_GROUPS = [
  { label: "general", before: SETTINGS.visibilityHandler },
  { label: "misfits", before: SETTINGS.raiseShields },
  { label: "debug", before: SETTINGS.logLevel },
];

export function setupKeybindings() {
  game.keybindings.register(MODULE_ID, SETTINGS.clearStealth, {
    name: `${MODULE_ID}.${SETTINGS.clearStealth}.name`,
    hint: `${MODULE_ID}.${SETTINGS.clearStealth}.hint`,
    editable: [],
    onDown: async () => {
      const selectedTokens = canvas.tokens.controlled;
      for (const token of selectedTokens) {
        await clearTokenStealth({ token, showBanner: true });
      }
    },
  });

  game.keybindings.register(MODULE_ID, SETTINGS.clearPartyStealth, {
    name: `${MODULE_ID}.${SETTINGS.clearPartyStealth}.name`,
    hint: `${MODULE_ID}.${SETTINGS.clearPartyStealth}.hint`,
    editable: [],
    restricted: true,
    onDown: async () => {
      await clearPartyStealth({ showBanner: true });
    },
  });

  game.keybindings.register(MODULE_ID, SETTINGS.hideTokens, {
    name: `${MODULE_ID}.${SETTINGS.hideTokens}.name`,
    hint: `${MODULE_ID}.${SETTINGS.hideTokens}.hint`,
    editable: [],
    restricted: true,
    onDown: async () => {
      const selectedTokens = canvas.tokens.controlled;
      await hideTokens(selectedTokens);
    },
  });
}

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
