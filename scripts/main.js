const CONSOLE_COLORS = ['background: #222; color: #80ffff', 'color: #fff'];
const HIDDEN = ['action:hide', 'action:create-a-diversion', 'action:sneak'];
const MODULE_ID = 'pf2e-avoid-notice';
const PERCEPTION_ID = 'pf2e-perception';

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

function renderInitiativeDice(roll) {
  let content = `
    <div class="dice-roll initiative" data-tooltip-class="pf2e">
      <div class="dice-result">
        <div class="dice-formula">${roll.formula}</div>
        <div class="dice-tooltip">
          <section class="tooltip-part">`;
  for (const die of roll.dice) {
    content += `
            <div class="dice">
              <header class="part-header flexrow">
                <span class="part-formula">${die.formula}</span>
                <span class="part-total">${die.total}</span>
              </header>
              <ol class="dice-rolls">`;
    for (const r of die.results) {
      content += `
                <li class="roll die d${die.faces}">${r.result}</li>`;
    }
    content += `
              </ol>
            </div>`;
  }

  content += `
          </section>
        </div>
        <h4 class="dice-total">${roll.total}</h4>
      </div>
    </div><br>`;
  return content;
}

Hooks.once('init', () => {
  // Hooks.on('createChatMessage', async (message, options, id) => {
  //   log('createChatMessage', message);
  //   const pf2eContext = message.flags.pf2e.context;
  //   switch (pf2eContext?.type) {
  //     case 'perception-check':
  //       if (pf2eContext?.options.includes('action:seek')) {
  //         log('perception-check', message);
  //       }
  //       break;
  //     case 'skill-check':
  //       const tags = pf2eContext?.options.filter((t) => HIDDEN.includes(t));
  //       if (tags.length > 0) {
  //         log('skill-check', tags);
  //       }
  //       break;
  //   }
  // });

  Hooks.on('combatStart', async (encounter, ...args) => {
    const perceptionApi = game.modules.get(PERCEPTION_ID)?.api;
    const useUnnoticed = game.settings.get(MODULE_ID, 'useUnnoticed');
    const overridePerception = game.settings.get(MODULE_ID, 'override');
    const computeCover = game.settings.get(MODULE_ID, 'computeCover');

    const stealthers = encounter.combatants.contents.filter((c) => c.flags.pf2e.initiativeStatistic === 'stealth');
    let perceptionChanges = {};
    for (const stealther of stealthers) {
      // log('stealther', stealther);

      // Only check against non-allies
      const disposition = stealther.token.disposition;
      const nonAllies = encounter.combatants.contents.filter((c) => c.token.disposition != disposition);
      if (!nonAllies.length) continue;

      // Now extract some details about the stealther
      const stealtherTokenDoc = stealther.token instanceof Token ? stealther.token.document : stealther.token;
      const coverEffect = stealtherTokenDoc.actor.items.find((i) => i.system.slug === 'effect-cover');
      const bonusElement = coverEffect?.flags.pf2e.rulesSelections.cover.bonus;
      let baseCoverBonus = 0;
      switch (bonusElement) {
        case 2:
        case 4:
          baseCoverBonus = bonusElement;
          break;
      }

      perceptionChanges[stealtherTokenDoc.id] = {};
      let otherUpdate = perceptionChanges[stealtherTokenDoc.id];
      let messageData = {};
      for (const other of nonAllies) {
        const otherTokenDoc = other.token instanceof Token ? other.token.document : other.token;

        let target = {
          dc: other.actor.system.perception.dc,
          name: otherTokenDoc.name,
          id: other.token.id,
        };

        // We give priority to the per-token states in PF2e Perception
        const perceptionData = perceptionApi ? stealtherTokenDoc?.flags?.[PERCEPTION_ID]?.data : undefined;
        let coverBonus = baseCoverBonus;
        if (perceptionApi) {
          const cover = (computeCover)
            ? perceptionApi.token.getCover(stealther.token._object, other.token._object)
            : perceptionData?.[other.token.id]?.cover;
          
          switch (cover) {
            case 'standard':
              coverBonus = 2;
              break;
            case 'greater':
              coverBonus = 4;
              break;
            default:
              coverBonus = 0;
              break;
          }
        }

        // Handle failing to win at stealth
        const delta = stealther.initiative + coverBonus - target.dc;
        if (delta < 0) {
          target.result = 'observed';
          target.delta = `${delta}`;

          // Remove any existing perception flag as we are observed
          if (overridePerception && perceptionData && other.token.id in perceptionData)
            otherUpdate[`flags.${PERCEPTION_ID}.data.-=${other.token.id}`] = true;
        }

        // stealther beat the other token at the stealth battle
        else {
          let visibility = 'undetected';
          target.delta = `+${delta}`;
          if (useUnnoticed && stealther.initiative > other.initiative) {
            visibility = 'unnoticed';
          }
          target.result = visibility;

          // Update the perception flags if there is a difference
          if (perceptionData?.[other.token.id]?.visibility !== visibility &&
            (overridePerception || (perceptionData && !(other.token.id in perceptionData)))
          )
            otherUpdate[`flags.${PERCEPTION_ID}.data.${other.token.id}.visibility`] = visibility;
        }

        // Add a new category if necessary, and put this other token's result in the message data
        if (!(target.result in messageData)) {
          messageData[target.result] = {
            title: game.i18n.localize(`${MODULE_ID}.detectionTitle.${target.result}`),
            resultClass: (delta >= 0) ? 'success' : 'failure',
            targets: [target]
          };
        }
        else {
          messageData[target.result].targets.push(target);
        }
      }

      // Find the last initiative chat for the stealther
      const messages = game.messages.contents.filter((m) =>
        m.speaker.token === stealther.tokenId && m.flags?.core?.initiativeRoll
      );
      if (!messages.length) {
        log(`Couldn't find initiative card for ${stealther.token.name}`);
        continue;
      }

      // Push the new detection statuses into that message
      const lastMessage = await game.messages.get(messages.pop()._id);
      log(`messageData updates for ${stealtherTokenDoc.name}`, messageData);
      let content = renderInitiativeDice(lastMessage.rolls[0]);

      for (const t of ['unnoticed', 'undetected', 'observed']) {
        const status = messageData[t];
        if (status) {
          content += await renderTemplate(`modules/${MODULE_ID}/templates/combat-start.hbs`, status);
        }
      }

      await lastMessage.update({ content });
    }

    // If PF2e-perception is around, move any non-empty changes into an update array
    if (perceptionApi) {
      let updates = [];
      for (const id in perceptionChanges) {
        const update = perceptionChanges[id];
        if (Object.keys(update).length)
          updates.push({ _id: id, ...update });
      }

      // Update all the tokens at once, skipping an empty update
      log('token updates', updates);
      if (updates.length > 0) {
        canvas.scene.updateEmbeddedDocuments("Token", updates);
      }
    }
  });
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

  const perception = game.modules.get(PERCEPTION_ID)?.active;

  game.settings.register(MODULE_ID, 'override', {
    name: game.i18n.localize(`${MODULE_ID}.override.name`),
    hint: game.i18n.localize(`${MODULE_ID}.override.hint`),
    scope: 'world',
    config: perception,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, 'computeCover', {
    name: game.i18n.localize(`${MODULE_ID}.computeCover.name`),
    hint: game.i18n.localize(`${MODULE_ID}.computeCover.hint`),
    scope: 'world',
    config: perception,
    type: Boolean,
    default: false,
  });

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

  // if (!perception) {
  //   Hooks.once('ready', () => {
  //     game.settings.set(MODULE_ID, 'override', false);
  //     game.settings.set(MODULE_ID, 'computeCover', false);
  //   });
  // }

  log(`Setup ${moduleVersion}`);
});