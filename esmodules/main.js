const CONSOLE_COLORS = ['background: #222; color: #80ffff', 'color: #fff'];
const SKILL_ACTIONS = ['action:hide', 'action:create-a-diversion', 'action:sneak'];
const MODULE_ID = 'pf2e-avoid-notice';
const PF2E_PERCEPTION_ID = 'pf2e-perception';
const PERCEPTIVE_ID = 'perceptive';

function colorizeOutput(format, ...args) {
  return [
    `%c${MODULE_ID} %c|`,
    ...CONSOLE_COLORS,
    format,
    ...args,
  ];
}

function log(format, ...args) {
  const level = game.settings.get(MODULE_ID, 'logLevel');
  if (level !== 'none') {

    if (level === 'debug')
      console.debug(...colorizeOutput(format, ...args));
    else if (level === 'log')
      console.log(...colorizeOutput(format, ...args));
  }
}

function getPerceptionApi() {
  return game.modules.get(PF2E_PERCEPTION_ID)?.api;
}

function getPerceptiveApi() {
  return game.modules.get(PERCEPTIVE_ID)?.api;
}

export { MODULE_ID, PF2E_PERCEPTION_ID, PERCEPTIVE_ID, log, getPerceptionApi, getPerceptiveApi };

// Hooks.once('init', () => {
//   Hooks.on('createChatMessage', async (message, options, id) => {
//     if (game.userId != id) return;
//     log('createChatMessage', message);
//     const context = message.flags.pf2e.context;
//     const actorId = message?.actor?.id ?? message.speaker?.actor ?? '';
//     switch (context?.type) {
//       case 'perception-check':
//         if (context?.options.includes('action:seek')) {
//           log('perception-check', message);
//         }
//         break;
//       case 'skill-check':
//         const tags = context?.options.filter((t) => SKILL_ACTIONS.includes(t));
//         if (tags.length > 0) {
//           log('skill-check', tags);
//         }
//         break;
//     }
//   });
// });

function migrate(moduleVersion, oldVersion) {

  ui.notifications.warn(`Updated PF2e Avoid Notice data from ${oldVersion} to ${moduleVersion}`);
  return moduleVersion;
}

Hooks.once('ready', () => {

  // Handle perceptive or perception module getting yoinked
  const conditionHandler = game.settings.get(MODULE_ID, 'conditionHandler');
  if (conditionHandler === 'perception' && !getPerceptionApi() || conditionHandler === 'perceptive' && !getPerceptionApi()) {
    game.settings.set(MODULE_ID, 'conditionHandler', 'ignore');
  }

  async function clearPf2ePerceptionFlags(item, options, userId) {
    // Only do stuff if we are changing hidden, undetected, or unnoticed conditions and using pf2e-perception
    const conditionHandler = game.settings.get(MODULE_ID, 'conditionHandler');
    if (conditionHandler !== 'perception') return;
    const perceptionApi = getPerceptionApi();
    if (!perceptionApi) return;
    if (item?.type !== 'condition' || !['hidden', 'undetected', 'unnoticed'].includes(item?.system?.slug)) return;

    // Get the token on the current scene
    const token = options.parent?.parent ?? canvas.scene.tokens.find((t) => t.actorId === options.parent.id);
    if (!token) return;

    // Remove any ids that perception is tracking
    const perceptionData = token.flags?.[PF2E_PERCEPTION_ID]?.data;
    if (!Object.keys(perceptionData).length) return;
    let tokenUpdate = {};
    for (let id in perceptionData) {
      tokenUpdate[`flags.${PF2E_PERCEPTION_ID}.data.-=${id}`] = true;
    }
    const updates = [{ _id: token.id, ...tokenUpdate }];
    await canvas.scene.updateEmbeddedDocuments("Token", updates);
  }

  if (game.modules.get(PF2E_PERCEPTION_ID)?.active) {
    Hooks.on("deleteItem", async (item, options, userId) => {
      await clearPf2ePerceptionFlags(item, options, userId);
    });

    Hooks.on("createItem", async (item, options, userId) => {
      await clearPf2ePerceptionFlags(item, options, userId);
    });
  }

});

Hooks.once('setup', () => {
  const module = game.modules.get(MODULE_ID);
  const moduleVersion = module.version;

  game.settings.register(MODULE_ID, 'useUnnoticed', {
    name: game.i18n.localize(`${MODULE_ID}.useUnnoticed.name`),
    hint: game.i18n.localize(`${MODULE_ID}.useUnnoticed.hint`),
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, 'removeGmHidden', {
    name: game.i18n.localize(`${MODULE_ID}.removeGmHidden.name`),
    hint: game.i18n.localize(`${MODULE_ID}.removeGmHidden.hint`),
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, 'requireActivity', {
    name: game.i18n.localize(`${MODULE_ID}.requireActivity.name`),
    hint: game.i18n.localize(`${MODULE_ID}.requireActivity.hint`),
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  });

  const perception = game.modules.get(PF2E_PERCEPTION_ID)?.active;
  const perceptive = game.modules.get(PERCEPTIVE_ID)?.active;

  let choices = {
    'ignore': `${MODULE_ID}.conditionHandler.ignore`,
    'best': `${MODULE_ID}.conditionHandler.best`,
    'worst': `${MODULE_ID}.conditionHandler.worst`,
  };
  if (perception) choices.perception = `${MODULE_ID}.conditionHandler.perception`;
  if (perceptive) choices.perceptive = `${MODULE_ID}.conditionHandler.perceptive`;

  game.settings.register(MODULE_ID, 'conditionHandler', {
    name: game.i18n.localize(`${MODULE_ID}.conditionHandler.name`),
    hint: game.i18n.localize(`${MODULE_ID}.conditionHandler.hint`),
    scope: 'world',
    config: true,
    type: String,
    choices,
    default: (perception) ? 'perception' : 'ignore'
  });

  if (perception) {
    game.settings.register(MODULE_ID, 'computeCover', {
      name: game.i18n.localize(`${MODULE_ID}.computeCover.name`),
      hint: game.i18n.localize(`${MODULE_ID}.computeCover.hint`),
      scope: 'world',
      config: perception,
      type: Boolean,
      default: false,
    });
  }

  game.settings.register(MODULE_ID, 'schema', {
    name: game.i18n.localize(`${MODULE_ID}.schema.name`),
    hint: game.i18n.localize(`${MODULE_ID}.schema.hint`),
    scope: 'world',
    config: true,
    type: String,
    default: `${moduleVersion}`,
    onChange: value => {
      const newValue = migrate(moduleVersion, value);
      if (value != newValue) {
        game.settings.set(MODULE_ID, 'schema', newValue);
      }
    }
  });
  const schemaVersion = game.settings.get(MODULE_ID, 'schema');
  if (schemaVersion !== moduleVersion) {
    Hooks.once('ready', () => {
      game.settings.set(MODULE_ID, 'schema', migrate(moduleVersion, schemaVersion));
    });
  }


  game.settings.register(MODULE_ID, 'logLevel', {
    name: game.i18n.localize(`${MODULE_ID}.logLevel.name`),
    scope: 'client',
    config: true,
    type: String,
    choices: {
      'none': game.i18n.localize(`${MODULE_ID}.logLevel.none`),
      'debug': game.i18n.localize(`${MODULE_ID}.logLevel.debug`),
      'log': game.i18n.localize(`${MODULE_ID}.logLevel.log`)
    },
    default: 'none'
  });

  log(`Setup ${moduleVersion}`);
});