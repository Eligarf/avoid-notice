import { MODULE_ID, CONSOLE_COLORS } from "./const.js";
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
import { clearPartyStealth, clearTokenStealth } from "./clear-stealth.js";

function colorizeOutput(format, ...args) {
  return [`%c${MODULE_ID} %c|`, ...CONSOLE_COLORS, format, ...args];
}

export function log(format, ...args) {
  const level = game.settings.get(MODULE_ID, "logLevel");
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
  let visibilityHandler = game.settings.get(MODULE_ID, "visibilityHandler");
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
    if (!game.settings.get(MODULE_ID, "autorollSpellDamage")) return;
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

  game.keybindings.register(MODULE_ID, "clearStealth", {
    name: `${MODULE_ID}.clearStealth.name`,
    hint: `${MODULE_ID}.clearStealth.hint`,
    editable: [],
    onDown: async () => {
      const selectedTokens = canvas.tokens.controlled;
      for (const token of selectedTokens) {
        await clearTokenStealth({ token, showBanner: true });
      }
    },
  });

  game.keybindings.register(MODULE_ID, "clearPartyStealth", {
    name: `${MODULE_ID}.clearPartyStealth.name`,
    hint: `${MODULE_ID}.clearPartyStealth.hint`,
    editable: [],
    restricted: true,
    onDown: async () => {
      await clearPartyStealth({ showBanner: true });
    },
  });
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
  const visibilityHandler = game.settings.get(MODULE_ID, "visibilityHandler");
  if (
    (visibilityHandler === "perception" && !isPerceptionActive()) ||
    (visibilityHandler === "perceptive" && !isPerceptiveActive()) ||
    (visibilityHandler === "visioner" && !isVisionerActive())
  ) {
    game.settings.set(MODULE_ID, "visibilityHandler", "auto");
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

  game.settings.register(MODULE_ID, "useUnnoticed", {
    name: game.i18n.localize(`${MODULE_ID}.useUnnoticed.name`),
    hint: game.i18n.localize(`${MODULE_ID}.useUnnoticed.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, "removeGmHidden", {
    name: game.i18n.localize(`${MODULE_ID}.removeGmHidden.name`),
    hint: game.i18n.localize(`${MODULE_ID}.removeGmHidden.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, "hideFromAllies", {
    name: game.i18n.localize(`${MODULE_ID}.hideFromAllies.name`),
    hint: game.i18n.localize(`${MODULE_ID}.hideFromAllies.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, "noSummary", {
    name: game.i18n.localize(`${MODULE_ID}.noSummary.name`),
    hint: game.i18n.localize(`${MODULE_ID}.noSummary.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, "requireActivity", {
    name: game.i18n.localize(`${MODULE_ID}.requireActivity.name`),
    hint: game.i18n.localize(`${MODULE_ID}.requireActivity.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  const perception = isPerceptionActive();
  const perceptive = isPerceptiveActive();
  const visioner = isVisionerActive();

  let choices = {
    auto: `${MODULE_ID}.visibilityHandler.auto`,
    disabled: `${MODULE_ID}.visibilityHandler.disabled`,
    best: `${MODULE_ID}.visibilityHandler.best`,
    worst: `${MODULE_ID}.visibilityHandler.worst`,
  };
  if (visioner) choices.visioner = `${MODULE_ID}.visibilityHandler.visioner`;
  if (perception)
    choices.perception = `${MODULE_ID}.visibilityHandler.perception`;
  if (perceptive)
    choices.perceptive = `${MODULE_ID}.visibilityHandler.perceptive`;

  game.settings.register(MODULE_ID, "visibilityHandler", {
    name: game.i18n.localize(`${MODULE_ID}.visibilityHandler.name`),
    scope: "world",
    config: true,
    type: String,
    choices,
    default: "auto",
  });

  game.settings.register(MODULE_ID, "computeCover", {
    name: game.i18n.localize(`${MODULE_ID}.computeCover.name`),
    hint: game.i18n.localize(`${MODULE_ID}.computeCover.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, "clearPartyStealthAfterCombat", {
    name: game.i18n.localize(`${MODULE_ID}.clearPartyStealthAfterCombat.name`),
    hint: game.i18n.localize(`${MODULE_ID}.clearPartyStealthAfterCombat.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, "raiseShields", {
    name: game.i18n.localize(`${MODULE_ID}.raiseShields.name`),
    hint: game.i18n.localize(`${MODULE_ID}.raiseShields.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, "autorollSpellDamage", {
    name: game.i18n.localize(`${MODULE_ID}.autorollSpellDamage.name`),
    hint: game.i18n.localize(`${MODULE_ID}.autorollSpellDamage.hint`),
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, "rage", {
    name: game.i18n.localize(`${MODULE_ID}.rage.name`),
    hint: game.i18n.localize(`${MODULE_ID}.rage.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  const beforeV13 = Number(game.version.split()[0]) < 13;
  if (!beforeV13) {
    game.settings.register(MODULE_ID, "clearMovement", {
      name: game.i18n.localize(`${MODULE_ID}.clearMovement.name`),
      hint: game.i18n.localize(`${MODULE_ID}.clearMovement.hint`),
      scope: "world",
      config: true,
      type: Boolean,
      default: false,
    });
  }

  game.settings.register(MODULE_ID, "logLevel", {
    name: game.i18n.localize(`${MODULE_ID}.logLevel.name`),
    scope: "client",
    config: true,
    type: String,
    choices: {
      none: game.i18n.localize(`${MODULE_ID}.logLevel.none`),
      debug: game.i18n.localize(`${MODULE_ID}.logLevel.debug`),
      log: game.i18n.localize(`${MODULE_ID}.logLevel.log`),
    },
    default: "none",
  });

  game.settings.register(MODULE_ID, "useBulkApi", {
    name: game.i18n.localize(`${MODULE_ID}.useBulkApi.name`),
    hint: game.i18n.localize(`${MODULE_ID}.useBulkApi.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, "schema", {
    name: game.i18n.localize(`${MODULE_ID}.schema.name`),
    hint: game.i18n.localize(`${MODULE_ID}.schema.hint`),
    scope: "world",
    config: true,
    type: String,
    default: `${moduleVersion}`,
    onChange: (value) => {
      const newValue = migrate(moduleVersion, value);
      if (value != newValue) {
        game.settings.set(MODULE_ID, "schema", newValue);
      }
    },
  });
  const schemaVersion = game.settings.get(MODULE_ID, "schema");
  if (schemaVersion !== moduleVersion) {
    Hooks.once("ready", () => {
      game.settings.set(
        MODULE_ID,
        "schema",
        migrate(moduleVersion, schemaVersion),
      );
    });
  }

  log(`Setup ${moduleVersion}`);
});

Hooks.on("renderSettingsConfig", (app, html, data) => {
  const sections = [
    { label: "general", before: "useUnnoticed" },
    { label: "misfits", before: "raiseShields" },
    { label: "debug", before: "logLevel" },
  ];
  for (const section of sections) {
    $("<div>")
      .addClass("form-group group-header")
      .html(game.i18n.localize(`${MODULE_ID}.config.${section.label}`))
      .insertBefore(
        $(`[name="${MODULE_ID}.${section.before}"]`).parents(
          "div.form-group:first",
        ),
      );
  }
});
