import { MODULE_ID, CONSOLE_COLORS, REFRESH_OPTIONS } from "./const.js";
import {
  SETTINGS,
  setupSettings,
  setupKeybindings,
  groupSettings,
} from "./settings.js";

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

export function debuglog(format, ...args) {
  const level = game.settings.get(MODULE_ID, SETTINGS.logLevel);
  if (level === "debug") console.debug(...colorizeOutput(format, ...args));
}

export function interpolateString(str, interpolations) {
  return str.replace(/\{([A-Za-z0-9_]+)\}/g, (match, key) =>
    interpolations.hasOwnProperty(key) ? interpolations[key] : match,
  );
}

export function localizeString(str, interpolations) {
  return interpolateString(game.i18n.localize(str), interpolations);
}

export function refreshPerception() {
  canvas.perception.update(REFRESH_OPTIONS);
}

export async function iterateTokensAndParties(tokens, callback) {
  for (const token of tokens) {
    const actor = token.actor;
    if (!actor) continue;
    if (actor?.type !== "party") {
      await callback(token);
      continue;
    }

    for (const member of actor.members) {
      const token = canvas.tokens.placeables.find(
        (t) => t.actor?.id === member.id,
      );
      if (token) await callback(token);
    }
  }
}

function hookMessages(message, options, id) {
  debuglog("createChatMessage", { message, options, id });
  //   if (isVisionerActive()) return;
  //   if (game.userId != id) return;
  //   const systemFlags = message?.flags?.[game.system.id];
  //
  //   // Accept only spell casting of non-attack damaging spells
  //   if (!systemFlags?.casting) return;
  //   const originUuid = systemFlags?.origin?.uuid;
  //   const origin = originUuid ? await fromUuid(originUuid) : null;
  //   if (origin?.traits?.has("attack")) return;
  //   if (
  //     !message.content.includes(
  //       '<button type="button" data-action="spell-damage" data-visibility="owner">',
  //     )
  //   )
  //     return;
  //
  //   // Roll the damage!
  //   origin?.rollDamage({ target: message.token });
}

Hooks.once("init", () => {
  Hooks.on("createChatMessage", async (message, options, id) => {
    hookMessages(message, options, id);
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

export function isVisionerActive() {
  return game.modules.get("pf2e-visioner")?.active;
}

Hooks.once("ready", () => {
  if (
    game.settings.get(MODULE_ID, SETTINGS.panZoomToCombat) &&
    typeof socketlib === "undefined"
  ) {
    ui.notifications.warn(
      game.i18n.localize(`${MODULE_ID}.notifications.noSocketLib`),
    );
  }
  if (isVisionerActive()) {
    ui.notifications.warn(
      game.i18n.localize(`${MODULE_ID}.notifications.visionerActive`),
    );
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
