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
import { isPerceptiveActive } from "./perceptive.js";
import {
  isPerceptionActive,
  clearPf2ePerceptionFlags,
} from "./pf2e_perception.js";
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

export function getVisibilityHandler() {
  let visibilityHandler = game.settings.get(
    MODULE_ID,
    SETTINGS.visibilityHandler,
  );
  if (visibilityHandler === "auto") {
    if (isVisionerActive()) visibilityHandler = "visioner";
    else if (isPerceptionActive()) visibilityHandler = "perception";
    // else if (isPerceptiveActive()) visibilityHandler = "perceptive";
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
    const pf2eFlags = message?.flags?.pf2e;

    // Accept only spell casting of non-attack damaging spells
    if (!pf2eFlags?.casting) return;
    const originUuid = pf2eFlags?.origin?.uuid;
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
    (visibilityHandler === "perception" && !isPerceptionActive()) ||
    (visibilityHandler === "perceptive" && !isPerceptiveActive()) ||
    (visibilityHandler === "visioner" && !isVisionerActive())
  ) {
    game.settings.set(MODULE_ID, SETTINGS.visibilityHandler, "auto");
  }

  if (isPerceptionActive()) {
    Hooks.on("deleteItem", async (item, options, userId) => {
      await clearPf2ePerceptionFlags(item, options, userId);
    });

    Hooks.on("createItem", async (item, options, userId) => {
      await clearPf2ePerceptionFlags(item, options, userId);
    });
  }

  const beforeV13 = Number(game.version.split()[0]) < 13;
  if (!beforeV13) {
    registerHooksForClearMovementHistory();
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
