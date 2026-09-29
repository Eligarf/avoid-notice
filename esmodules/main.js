import { MODULE_ID } from "./const.js";
import {
  SETTINGS,
  setupSettings,
  setupKeybindings,
  groupSettings,
} from "./settings.js";
import { cachedSettings } from "./settings.js";
import { log } from "./utils.js";

globalThis.Hooks.once("init", () => {
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

globalThis.Hooks.once("ready", () => {
  // Handle perceptive or perception module getting yoinked
  if (
    cachedSettings.panZoomToCombat &&
    typeof window?.socketlib === "undefined"
  ) {
    ui.notifications.warn(
      game.i18n.localize(`${MODULE_ID}.notifications.noSocketLib`),
    );
  }
});

globalThis.Hooks.once("setup", () => {
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
    globalThis.Hooks.once("ready", () => {
      game.settings.set(
        MODULE_ID,
        SETTINGS.schema,
        migrate(moduleVersion, schemaVersion),
      );
    });
  }

  log(`Setup ${moduleVersion}`);
});

globalThis.Hooks.on("renderSettingsConfig", (_app, _html, _data) => {
  groupSettings();
});
