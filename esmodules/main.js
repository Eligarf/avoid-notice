import { MODULE_ID, CONSOLE_COLORS } from "./const.js";
import {
  SETTINGS,
  setupSettings,
  setupKeybindings,
  groupSettings,
} from "./settings.js";
import {
  isVisionerActive,
  getVisionerApi,
  refreshVisionerPerception,
} from "./visioner.js";
import { registerHooksForClearMovementHistory } from "./clear-movement.js";

function colorizeOutput(format, ...args) {
  return [`%c${MODULE_ID} %c|`, ...CONSOLE_COLORS, format, ...args];
}

export function log(format, ...args) {
  const level = game.settings.get(MODULE_ID, SETTINGS.logLevel);
  if (level !== "none") {
    if (level === "debug") console.debug(...colorizeOutput(format, ...args));
    else if (level === "log") console.log(...colorizeOutput(format, ...args));
  }
}

export function interpolateString(str, interpolations) {
  return str.replace(/\{([A-Za-z0-9_]+)\}/g, (match, key) =>
    interpolations.hasOwnProperty(key) ? interpolations[key] : match,
  );
}

export function localizeString(str, interpolations) {
  return interpolateString(game.i18n.localize(str), interpolations);
}

export function getVisibilityHandler() {
  let visibilityHandler = game.settings.get(
    MODULE_ID,
    SETTINGS.visibilityHandler,
  );
  if (visibilityHandler === "auto") {
    visibilityHandler = isVisionerActive() ? "visioner" : "disabled";
  }
  return visibilityHandler;
}

export function refreshPerception() {
  const handler = getVisibilityHandler();
  if (handler === "visioner") refreshVisionerPerception(getVisionerApi());
}

Hooks.once("init", () => {
  Hooks.on("createChatMessage", async (message, options, id) => {
    if (game.userId != id) return;
    if (!game.settings.get(MODULE_ID, SETTINGS.autorollSpellDamage)) return;
    const systemFlags = message?.flags?.[game.system.id];

    // Accept only spell casting of non-attack damaging spells
    if (!systemFlags?.casting) return;
    const originUuid = systemFlags?.origin?.uuid;
    const origin = originUuid ? await fromUuid(originUuid) : null;
    if (origin?.traits?.has("attack")) return;
    if (
      !message.content.includes(
        '<button type="button" data-action="spell-damage" data-visibility="owner">',
      )
    )
      return;

    // Roll the damage!
    origin?.rollDamage({ target: message.token });
  });

  setupKeybindings();
});

function migrate(moduleVersion, oldVersion) {
  if (oldVersion !== moduleVersion) {
    // ui.notifications.info(
    //   `Updated PF2e Avoid Notice data from ${oldVersion} to ${moduleVersion}`,
    // );
  }
  return moduleVersion;
}

Hooks.once("ready", () => {
  // Handle perceptive or perception module getting yoinked
  const visibilityHandler = game.settings.get(
    MODULE_ID,
    SETTINGS.visibilityHandler,
  );
  if (
    visibilityHandler === "perception" ||
    visibilityHandler === "perceptive"
  ) {
    game.settings.set(MODULE_ID, SETTINGS.visibilityHandler, "disabled");
  } else if (visibilityHandler === "auto") {
    game.settings.set(
      MODULE_ID,
      SETTINGS.visibilityHandler,
      isVisionerActive() ? "visioner" : "disabled",
    );
  }

  const splitVersion = game.version.split();
  const clearMovement =
    Number(splitVersion[0]) === 13 && Number(splitVersion[1]) < 347;
  if (clearMovement) registerHooksForClearMovementHistory();

  if (
    game.settings.get(MODULE_ID, SETTINGS.panZoomToCombat) &&
    typeof socketlib === "undefined"
  ) {
    showNotification(`{MODULE_ID}.notifications.noSocketLib`, "warn");
  }
});

Hooks.once("setup", () => {
  const module = game.modules.get(MODULE_ID);
  const moduleVersion = module.version;

  setupSettings();

  game.settings.register(MODULE_ID, SETTINGS.schema, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.schema}.name`),
    hint: game.i18n.localize(`${MODULE_ID}.${SETTINGS.schema}.hint`),
    scope: "world",
    config: true,
    type: String,
    default: `${moduleVersion}`,
    onChange: (value) => {
      const newValue = migrate(moduleVersion, value);
      if (value != newValue) {
        game.settings.set(MODULE_ID, SETTINGS.schema, newValue);
      }
    },
  });

  const schemaVersion = game.settings.get(MODULE_ID, SETTINGS.schema);
  if (schemaVersion !== moduleVersion) {
    Hooks.once("ready", () => {
      game.settings.set(
        MODULE_ID,
        SETTINGS.schema,
        migrate(moduleVersion, schemaVersion),
      );
    });
  }

  log(`Setup ${moduleVersion}`);
});

Hooks.on("renderSettingsConfig", (app, html, data) => {
  groupSettings();
});
