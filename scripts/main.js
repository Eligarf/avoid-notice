const CONSOLE_COLORS = ['background: #222; color: #80ffff', 'color: #fff'];
const HIDDEN = ['action:hide', 'action:create-a-diversion', 'action:sneak'];
const MODULE_ID = 'pf2e-avoid-notice';
const PERCEPTION_ID = 'pf2e-perception';

class AvoidNotice {

  static colorizeOutput(format, ...args) {
    return [
      `%c${MODULE_ID} %c|`,
      ...CONSOLE_COLORS,
      format,
      ...args,
    ];
  }

  static log(format, ...args) {
    const level = game.settings.get(MODULE_ID, 'logLevel');
    if (level !== 'none') {

      if (level === 'debug')
        console.debug(...AvoidNotice.colorizeOutput(format, ...args));
      else if (level === 'log')
        console.log(...AvoidNotice.colorizeOutput(format, ...args));
    }
  }
}

Hooks.once('init', () => {
  // Hooks.on('createChatMessage', async (message, options, id) => {
  //   // AvoidNotice.log('createChatMessage', message);
  //   const pf2eContext = message.flags.pf2e.context;
  //   switch (pf2eContext?.type) {
  //     case 'perception-check':
  //       if (pf2eContext?.options.includes('action:seek')) {
  //         AvoidNotice.log('perception-check', message);
  //       }
  //       break;
  //     case 'skill-check':
  //       const tags = pf2eContext?.options.filter((t) => HIDDEN.includes(t));
  //       if (tags.length > 0) {
  //         AvoidNotice.log('skill-check', tags);
  //       }
  //       break;
  //   }
  // });

  Hooks.on('combatStart', async (encounter, ...args) => {
    const useUnnoticed = game.settings.get(MODULE_ID, 'useUnnoticed');
    const stealthies = encounter.combatants.contents.filter((c) => c.flags.pf2e.initiativeStatistic === 'stealth');
    let perceptionChanges = {};
    for (const combatant of stealthies) {
      // AvoidNotice.log('combatant', combatant);

      // Only check against non-allies
      const disposition = combatant.token.disposition;
      const nonAllies = encounter.combatants.contents.filter((c) => c.token.disposition != disposition);
      if (!nonAllies.length) continue;

      // Now extract the details for the template
      const combatantDoc = combatant.token instanceof Token ? combatant.token.document : combatant.token;
      perceptionChanges[combatantDoc.id] = {};
      let tokenUpdate = perceptionChanges[combatantDoc.id];
      let messageData = { stealth: combatant.initiative };
      for (const other of nonAllies) {
        const otherDoc = other.token instanceof Token ? other.token.document : other.token;

        let target = {
          dc: other.actor.system.perception.dc,
          name: otherDoc.name,
          id: otherDoc.id,
        };
        const perceptionData = combatantDoc?.flags?.[PERCEPTION_ID]?.data;

        // Handle failing to win at stealth
        const delta = combatant.initiative - target.dc;
        if (delta < 0) {
          target.result = 'observed';
          target.delta = `by ${delta}`;

          // Remove any existing perception flag as we are observed
          if (perceptionData && other.token.id in perceptionData)
            tokenUpdate[`flags.${PERCEPTION_ID}.data.-=${other.token.id}`] = true;
        }

        // combatant beat the other token at the stealth battle
        else {
          let visibility = 'undetected';
          target.delta = `by +${delta}`;
          if (useUnnoticed && combatant.initiative > other.initiative) {
            visibility = 'unnoticed';
          }
          target.result = visibility;

          // Update the perception flags if there is a difference
          if (perceptionData?.[other.token.id]?.visibility !== visibility)
            tokenUpdate[`flags.${PERCEPTION_ID}.data.${other.token.id}.visibility`] = visibility;
        }

        // Add a new category if necessary, and put this other token's result in the message data
        if (!(target.result in messageData)) {
          messageData[target.result] = {
            resultClass: (delta >= 0) ? 'success' : 'failure',
            targets: [target]
          };
        }
        else {
          messageData[target.result].targets.push(target);
        }
      }

      // Find the last initiative chat for the combatant
      const messages = game.messages.contents.filter((m) =>
        m.data.speaker.token === combatant.tokenId && m.data.flags?.core?.initiativeRoll
      );
      if (!messages.length) {
        AvoidNotice.log(`Couldn't find initiative card for ${combatant.token.name}`);
        continue;
      }

      // Push the new detection statuses into that message
      const lastMessage = messages.pop();
      let chatMessage = await game.messages.get(lastMessage._id);
      AvoidNotice.log(`messageData updates for ${combatantDoc.name}`, messageData);
      const content = await renderTemplate(`modules/${MODULE_ID}/templates/combat-start.hbs`, messageData);
      await chatMessage.update({ content });
    }

    // If PF2e-perception is around, move its changes into an update array and batch update
    // all the tokens at once
    if (game.modules.get(PERCEPTION_ID)?.active) {
      let updates = [];
      for (const id in perceptionChanges) {
        const update = perceptionChanges[id];
        if (!Object.keys(update).length) continue;
        updates.push({ _id: id, ...update });
      }
      AvoidNotice.log('updates', updates);
      canvas.scene.updateEmbeddedDocuments("Token", updates);
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

  AvoidNotice.log(`Setup ${moduleVersion}`);
});