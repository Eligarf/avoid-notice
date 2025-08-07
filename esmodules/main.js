import { MODULE_ID, CONSOLE_COLORS } from "./const.js";
import {
  isVisionerActive,
  getVisionerApi,
  clearVisionerData,
} from "./visioner.js";
import { isPerceptiveActive } from "./perceptive.js";
import {
  isPerceptionActive,
  getPerceptionApi,
  clearPerceptionData,
  clearPf2ePerceptionFlags,
} from "./pf2e_perception.js";
import { registerHooksForClearMovementHistory } from "./clearMovement.js";

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

export function getConditiondHandler() {
  let conditionHandler = game.settings.get(MODULE_ID, "conditionHandler");
  if (conditionHandler === "auto") {
    if (isVisionerActive()) conditionHandler = "visioner";
    else if (isPerceptionActive()) conditionHandler = "perception";
    else if (isPerceptiveActive()) conditionHandler = "perceptive";
  }
  return conditionHandler;
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

  game.keybindings.register(MODULE_ID, "observable", {
    name: `${MODULE_ID}.observable.name`,
    hint: `${MODULE_ID}.observable.hint`,
    editable: [{ key: "KeyB" }],
    onDown: async () => {
      const conditionHandler = getConditiondHandler();
      const perceptionApi =
        conditionHandler === "perception" ? getPerceptionApi() : null;
      const visionerApi =
        conditionHandler === "visioner" ? getVisionerApi() : null;
      const selectedTokens = canvas.tokens.controlled;
      for (const token of selectedTokens) {
        ui.notifications.info(
          interpolateString(
            game.i18n.localize("pf2e-avoid-notice.clearVisibility"),
            {
              name: token.name,
            },
          ),
        );
        if (perceptionApi) await clearPerceptionData(token.document);
        if (visionerApi) await clearVisionerData({ token, visionerApi });
        const conditions = token.actor.items
          .filter((i) =>
            ["hidden", "undetected", "unnoticed"].includes(i.system.slug),
          )
          .map((i) => i.id);
        if (conditions.length > 0) {
          await token.actor.deleteEmbeddedDocuments("Item", conditions);
        }
      }
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
  const conditionHandler = game.settings.get(MODULE_ID, "conditionHandler");
  if (
    (conditionHandler === "perception" && !isPerceptionActive()) ||
    (conditionHandler === "perceptive" && !isPerceptiveActive()) ||
    (conditionHandler === "visioner" && !isVisionerActive()) ||
    conditionHandler === "ignore"
  ) {
    game.settings.set(MODULE_ID, "conditionHandler", "auto");
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
    auto: `${MODULE_ID}.conditionHandler.auto`,
    disabled: `${MODULE_ID}.conditionHandler.disabled`,
    best: `${MODULE_ID}.conditionHandler.best`,
    worst: `${MODULE_ID}.conditionHandler.worst`,
  };
  if (visioner) choices.visioner = `${MODULE_ID}.conditionHandler.visioner`;
  if (perception)
    choices.perception = `${MODULE_ID}.conditionHandler.perception`;
  if (perceptive)
    choices.perceptive = `${MODULE_ID}.conditionHandler.perceptive`;

  game.settings.register(MODULE_ID, "conditionHandler", {
    name: game.i18n.localize(`${MODULE_ID}.conditionHandler.name`),
    hint: game.i18n.localize(`${MODULE_ID}.conditionHandler.hint`),
    scope: "world",
    config: true,
    type: String,
    choices,
    default: "auto",
  });

  if (perception) {
    game.settings.register(MODULE_ID, "computeCover", {
      name: game.i18n.localize(`${MODULE_ID}.computeCover.name`),
      hint: game.i18n.localize(`${MODULE_ID}.computeCover.hint`),
      scope: "world",
      config: perception,
      type: Boolean,
      default: false,
    });
  }

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
