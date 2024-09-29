const CONSOLE_COLORS = ['background: #222; color: #80ffff', 'color: #fff'];
const HIDDEN = ['action:hide', 'action:create-a-diversion', 'action:sneak'];
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
    const conditionHandler = game.settings.get(MODULE_ID, 'conditionHandler');
    const pf2ePerceptionApi = game.modules.get(PF2E_PERCEPTION_ID)?.api;
    const useUnnoticed = game.settings.get(MODULE_ID, 'useUnnoticed');
    const revealTokens = game.settings.get(MODULE_ID, 'removeGmHidden');
    const overridePf2ePerception = pf2ePerceptionApi && conditionHandler === 'perception';
    const computeCover = pf2ePerceptionApi && game.settings.get(MODULE_ID, 'computeCover');
    const requireActivity = game.settings.get(MODULE_ID, 'requireActivity');
    const perceptiveApi = game.modules.get(PERCEPTIVE_ID)?.api;
    let nonAvoidingPcs = [];

    let avoiders = encounter.combatants.contents.filter((c) =>
      !(c.actor?.parties?.size > 0 && c.actor.system?.exploration) && c.flags.pf2e.initiativeStatistic === 'stealth');
    const pcs = encounter.combatants.contents.filter((c) => c.actor?.parties?.size > 0 && c.actor.system?.exploration);
    if (!requireActivity) {
      avoiders = avoiders.concat(pcs.filter((c) => c.flags.pf2e.initiativeStatistic === 'stealth'));
    }
    else {
      avoiders = avoiders.concat(pcs.filter((c) => c.actor.system.exploration.some(a => c.actor.items.get(a)?.system?.slug === "avoid-notice")));
      nonAvoidingPcs = pcs.filter((c) => c.flags.pf2e.initiativeStatistic === 'stealth' && !c.actor.system.exploration.some(a => c.actor.items.get(a)?.system?.slug === "avoid-notice"));
    }

    const familiars = canvas.scene.tokens
      .filter((t) => t?.actor?.system?.master)
      .filter((t) => encounter.combatants.contents.some((c) => c.actor._id == t.actor.system.master.id));

    const eidolons = canvas.scene.tokens
      .filter((t) => t?.actor?.system?.details?.class?.trait == 'eidolon');

    const unrevealedIds = encounter.combatants.contents
      .map((c) => c.token instanceof Token ? c.token.document : c.token)
      .filter((t) => t.hidden && !(typeof pf2ePerceptionApi !== 'undefined' && t.actor.type === 'hazard'))
      .map((t) => t.id);

    let pf2ePerceptionChanges = {};
    for (const avoider of avoiders) {
      // log('avoider', avoider);

      // Find the last initiative chat for the avoider
      const messages = game.messages.contents.filter((m) =>
        m.speaker.token === avoider.tokenId && m.flags?.core?.initiativeRoll
      );
      if (!messages.length) {
        log(`Couldn't find initiative card for ${avoider.token.name}`);
        continue;
      }
      const initiativeMessage = await game.messages.get(messages.pop()._id);
      // log('initiativeMessage', initiativeMessage);
      const initRoll = initiativeMessage.rolls[0].dice[0].total;
      const dosDelta = (initRoll == 1) ? -1 : (initRoll == 20) ? 1 : 0;

      // Only check against non-allies
      const disposition = avoider.token.disposition;
      const nonAllies = encounter.combatants.contents
        .filter((c) => c.token.disposition != disposition)
        .concat(familiars.filter((t) => t.disposition != disposition))
        .concat(eidolons.filter((t) => t.disposition != disposition));
      if (!nonAllies.length) continue;

      // Now extract some details about the avoider
      const avoiderTokenDoc = avoider.token instanceof Token ? avoider.token.document : avoider.token;
      const coverEffect = avoiderTokenDoc.actor.items.find((i) => i.system.slug === 'effect-cover');
      const bonusElement = coverEffect?.flags.pf2e.rulesSelections.cover.bonus;
      let baseCoverBonus = 0;
      switch (bonusElement) {
        case 2:
        case 4:
          baseCoverBonus = bonusElement;
          break;
      }

      pf2ePerceptionChanges[avoiderTokenDoc.id] = {};
      let pf2ePerceptionUpdate = pf2ePerceptionChanges[avoiderTokenDoc.id];
      let messageData = {};
      let results = {};
      for (const other of nonAllies) {
        const otherTokenDoc = other?.token instanceof Token ? other.token.document : other?.token ?? other;
        const otherToken = other?.token ?? other;
        const otherActor = otherToken.actor;
        if (otherActor.type === 'hazard') continue;

        let target = {
          dc: otherActor.system.perception.dc,
          name: otherTokenDoc.name,
          id: otherToken.id,
          doc: otherTokenDoc,
        };

        // We give priority to the per-token states in PF2e Perception
        const pf2ePerceptionData = pf2ePerceptionApi ? avoiderTokenDoc?.flags?.[PF2E_PERCEPTION_ID]?.data : undefined;
        let coverBonus = baseCoverBonus;
        if (pf2ePerceptionApi) {
          const cover = (computeCover)
            ? pf2ePerceptionApi.token.getCover(avoider.token._object, otherToken._object)
            : pf2ePerceptionData?.[otherToken.id]?.cover;

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
        if (coverBonus) {
          const oldDelta = avoider.initiative - target.dc;
          target.oldDelta = (oldDelta < 0) ? `${oldDelta}` : `+${oldDelta}`;
          switch (coverBonus) {
            case 2:
              target.tooltip = `${game.i18n.localize(`${MODULE_ID}.standardCover`)}: +2`;
              break;
            case 4:
              target.tooltip = `${game.i18n.localize(`${MODULE_ID}.greaterCover`)}: +4`;
              break;
          }
        }

        // Handle critical failing to win at stealth
        const delta = avoider.initiative + coverBonus - target.dc;
        const dos = dosDelta + ((delta < -9) ? 0 : (delta < 0) ? 1 : (delta < 9) ? 2 : 3);
        if (dos < 1) {
          target.result = 'observed';
          target.delta = `${delta}`;

          // Remove any existing perception flag as we are observed
          if (overridePf2ePerception && pf2ePerceptionData && otherToken.id in pf2ePerceptionData)
            pf2ePerceptionUpdate[`flags.${PF2E_PERCEPTION_ID}.data.-=${otherToken.id}`] = true;
        }

        // Normal fail is hidden
        else if (dos < 2) {
          const visibility = 'hidden';
          target.result = visibility;
          target.delta = `${delta}`;

          // Remove any existing perception flag as we are observed
          if (pf2ePerceptionData?.[otherToken.id]?.visibility !== visibility &&
            (overridePf2ePerception || (pf2ePerceptionData && !(otherToken.id in pf2ePerceptionData)))
          )
            pf2ePerceptionUpdate[`flags.${PF2E_PERCEPTION_ID}.data.${otherToken.id}.visibility`] = visibility;
        }

        // avoider beat the other token at the stealth battle
        else {
          let visibility = 'undetected';
          target.delta = `+${delta}`;
          if (useUnnoticed && avoider.initiative > other?.initiative) {
            visibility = 'unnoticed';
          }
          target.result = visibility;

          // Update the perception flags if there is a difference
          if (pf2ePerceptionData?.[otherToken.id]?.visibility !== visibility &&
            (overridePf2ePerception || (pf2ePerceptionData && !(otherToken.id in pf2ePerceptionData)))
          )
            pf2ePerceptionUpdate[`flags.${PF2E_PERCEPTION_ID}.data.${otherToken.id}.visibility`] = visibility;
        }

        if (!(target.result in results)) {
          results[target.result] = [target];
        } else {
          results[target.result].push(target);
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

      async function tweakStatuses({ actor, remove = [], add = '' }) {
        // log('tweakStatus', { actor, remove, add });
        const removals = actor.items
          .filter((i) => i.type === 'condition' && remove.includes(i.system.slug))
          .map((i) => i.system.slug);
        for (const c of removals) {
          await actor.toggleCondition(c, { active: false });
        }
        if (!add) return;
        await actor.toggleCondition(add, { active: true });
      }

      switch (conditionHandler) {
        case 'best': {
          if ('observed' in results) {
            await tweakStatuses({ actor: avoider.actor, remove: ['hidden', 'undetected', 'unnoticed'] });
          }
          else if ('hidden' in results) {
            await tweakStatuses({ actor: avoider.actor, remove: ['undetected', 'unnoticed'], add: 'hidden' });
          }
          else if ('undetected' in results) {
            await tweakStatuses({ actor: avoider.actor, remove: ['hidden', 'unnoticed'], add: 'undetected' });
          }
          else if ('unnoticed' in results) {
            await tweakStatuses({ actor: avoider.actor, remove: ['hidden', 'undetected'], add: 'unnoticed' });
          }
          break;
        }
        case 'worst': {
          if ('unnoticed' in results) {
            await tweakStatuses({ actor: avoider.actor, remove: ['hidden', 'undetected'], add: 'unnoticed' });
          }
          else if ('undetected' in results) {
            await tweakStatuses({ actor: avoider.actor, remove: ['hidden', 'unnoticed'], add: 'undetected' });
          }
          else if ('hidden' in results) {
            await tweakStatuses({ actor: avoider.actor, remove: ['undetected', 'unnoticed'], add: 'hidden' });
          }
          else {
            await tweakStatuses({ actor: avoider.actor, remove: ['hidden', 'undetected', 'unnoticed'] });
          }
          break;
        }
        case 'perceptive': {
          let slug;
          await perceptiveApi.PerceptiveFlags.clearSpottedby(avoiderTokenDoc);
          const dc = (avoider.actor.type === 'hazard') ? avoider.actor.system.initiative.dc : avoider.actor.system.skills.stealth.dc;

          async function tellPerceptive(perceptiveApi, token, type, dc, formula, results) {
            // log('tellPerceptive', { token, type, dc, formula, results });
            await perceptiveApi.EffectManager.applyStealthEffects(token, { Type: type, EffectInfos: { RollFormula: formula } });
            if ('prepareSpottableToken' in perceptiveApi.PerceptiveFlags) {
              await perceptiveApi.PerceptiveFlags.prepareSpottableToken(
                token,
                { PPDC: -1, APDC: dc, PPDice: dc },
                ('observed' in results) ? results.observed.map((t) => t.doc) : []
              );
            }
            else {
              if ('observed' in results) {
                for (const t of results.observed) {
                  await perceptiveApi.PerceptiveFlags.addSpottedby(token, t.doc);
                }
              }
              await perceptiveApi.PerceptiveFlags.setSpottingDCs(token, { PPDC: -1, APDC: dc, PPDice: dc });
            }
          }

          if ('hidden' in results) {
            slug = 'hidden';
            await tellPerceptive(perceptiveApi, avoiderTokenDoc, 'hide', dc, initiativeMessage.rolls[0].formula, results);
          }
          else if ('unnoticed' in results) {
            slug = 'unnoticed';
            await tellPerceptive(perceptiveApi, avoiderTokenDoc, 'sneak', dc, initiativeMessage.rolls[0].formula, results);
          }
          else if ('undetected' in results) {
            slug = 'undetected';
            await tellPerceptive(perceptiveApi, avoiderTokenDoc, 'sneak', dc, initiativeMessage.rolls[0].formula, results);
          }
          else {
            slug = 'observed';
            await perceptiveApi.EffectManager.removeStealthEffects(avoiderTokenDoc);
          }
          break;
        }
      }

      log(`messageData updates for ${avoiderTokenDoc.name}`, messageData);
      let content = renderInitiativeDice(initiativeMessage.rolls[0]);

      for (const t of ['unnoticed', 'undetected', 'hidden', 'observed']) {
        const status = messageData[t];
        if (status) {
          content += `
            <div data-visibility="gm">
              <span><strong>${status.title}</strong></span>
              <table>
                <tbody>`;
          for (const target of status.targets) {
            content += `
                  <tr>
                    <td id="${MODULE_ID}-name">${target.name}</td>`;
            if (target.oldDelta) {
              content += `
                    <td id="${MODULE_ID}-delta">
                      <span><s>${target.oldDelta}</s></span>
                      <span data-tooltip="<div>${target.tooltip}</div>"> <b>${target.delta}</b></span>
                    </td>`;
            }
            else {
              content += `
                    <td id="${MODULE_ID}-delta">${target.delta}</td>`;
            }
            content += `
                  </tr>`;
          }
          content += `
                </tbody>
              </table>
            </div>`;
        }
      }

      await initiativeMessage.update({ content });
    }

    // Print out the warnings for PCs that aren't using Avoid Notice
    for (const nonAvoider of nonAvoidingPcs) {
      const messages = game.messages.contents.filter((m) =>
        m.speaker.token === nonAvoider.tokenId && m.flags?.core?.initiativeRoll
      );
      if (!messages.length) {
        log(`Couldn't find initiative card for ${avoider.token.name}`);
        continue;
      }
      const lastMessage = await game.messages.get(messages.pop()._id);
      let content = renderInitiativeDice(lastMessage.rolls[0]);
      content += `<div><span>${game.i18n.localize("pf2e-avoid-notice.nonHider")}</span></div>`;
      await lastMessage.update({ content });
    }

    // If PF2e-perception is around, move any non-empty changes into an update array
    let tokenUpdates = [];
    if (pf2ePerceptionApi) {
      for (const id in pf2ePerceptionChanges) {
        const update = pf2ePerceptionChanges[id];
        if (Object.keys(update).length)
          tokenUpdates.push({ _id: id, ...update });
      }
    }

    // Reveal combatant tokens
    if (revealTokens) {
      for (const t of unrevealedIds) {
        let update = tokenUpdates.find((u) => u._id === t);
        if (update) {
          update.hidden = false;
        }
        else {
          tokenUpdates.push({ _id: t, hidden: false });
        }
      }
    }

    // Update all the tokens at once, skipping an empty update
    if (tokenUpdates.length > 0) {
      log('token updates', tokenUpdates);
      canvas.scene.updateEmbeddedDocuments("Token", tokenUpdates);
    }
  });
});

function migrate(moduleVersion, oldVersion) {

  ui.notifications.warn(`Updated PF2e Avoid Notice data from ${oldVersion} to ${moduleVersion}`);
  return moduleVersion;
}

Hooks.once('ready', () => {

  async function clearPf2ePerceptionFlags(item, options, userId) {
    // Only do stuff if we are changing hidden, undetected, or unnoticed conditions and using pf2e-perception
    const pf2ePerceptionApi = game.modules.get(PF2E_PERCEPTION_ID)?.api;
    if (!pf2ePerceptionApi) return;
    const conditionHandler = game.settings.get(MODULE_ID, 'conditionHandler');
    const overridePf2ePerception = conditionHandler === 'perception';
    if (!overridePf2ePerception) return;
    if (item?.type !== 'condition' || !['hidden', 'undetected', 'unnoticed'].includes(item?.system?.slug)) return;

    // Get the token on the current scene
    const token = options.parent?.parent ?? canvas.scene.tokens.find((t) => t.actorId === options.parent.id);
    if (!token) return;

    // Remove any ids that perception is tracking if any
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

  // if (!perception) {
  //   Hooks.once('ready', () => {
  //     game.settings.set(MODULE_ID, 'override', false);
  //     game.settings.set(MODULE_ID, 'computeCover', false);
  //   });
  // }

  log(`Setup ${moduleVersion}`);
});