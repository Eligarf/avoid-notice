const CONSOLE_COLORS = ['background: #222; color: #80ffff', 'color: #fff'];
const HIDDEN = ['action:hide', 'action:create-a-diversion', 'action:sneak'];
const MODULE_ID = 'pf2e-avoid-notice';
const PERCEPTION_ID = 'pf2e-perception'

class AvoidNotice {

  static colorizeOutput(format, ...args) {
    return [
      `%cpf2e-avoid-notice %c|`,
      ...CONSOLE_COLORS,
      format,
      ...args,
    ];
  }

  static log(format, ...args) {
    console.log(...AvoidNotice.colorizeOutput(format, ...args));
    // const level = game.settings.get(Stealthy.MODULE_ID, 'logLevel');
    // if (level !== 'none') {

    //   if (level === 'debug')
    //     console.debug(...Stealthy.colorizeOutput(format, ...args));
    //   else if (level === 'log')
    //     console.log(...Stealthy.colorizeOutput(format, ...args));
    // }
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
  //         // await this.rollPerception(message, options, id);
  //       }
  //       break;
  //     case 'skill-check':
  //       const tags = pf2eContext?.options.filter((t) => HIDDEN.includes(t));
  //       if (tags.length > 0) {
  //         AvoidNotice.log('skill-check', tags);
  //         // await this.rollStealth(message, options, id);
  //       }
  //       break;
  //   }
  // });

  Hooks.on('combatStart', async (encounter, ...args) => {
    const sneakers = encounter.combatants.contents.filter((c) => c.flags.pf2e.initiativeStatistic === 'stealth');

    let changes = {};
    for (const combatant of sneakers) {
      // AvoidNotice.log('combatant', combatant);

      // Find enemies whose perception we beat if we had greater cover
      const disposition = combatant.token.disposition;
      const others = encounter.combatants.contents.filter((c) => c.token.disposition != disposition);
      if (!others.length) continue;

      // Now extract the details for the template
      const combatantDoc = combatant.token instanceof Token ? combatant.token.document : combatant.token;
      // AvoidNotice.log('combatantDoc', combatantDoc);
      let uiData = { stealth: combatant.initiative };
      changes[combatantDoc.id] = {};
      let tokenUpdate = changes[combatantDoc.id];
      for (const other of others) {
        const otherDoc = other.token instanceof Token ? other.token.document : other.token;

        let target = {
          dc: other.actor.system.perception.dc,
          name: otherDoc.name,
          id: otherDoc.id,
        };
        const delta = combatant.initiative - target.dc;
        
        const data = combatantDoc?.flags?.[PERCEPTION_ID]?.data;
        if (delta < 0) {
          target.result = 'Observed';
          target.delta = `by ${delta}`;
          target.perception = 'observed';
          if (data && other.token.id in data)
            tokenUpdate[`flags.${PERCEPTION_ID}.data.-=${other.token.id}`] = true;
        }
        else {
          let visibility;
          target.delta = `by +${delta}`;
          if (combatant.initiative > other.initiative) {
            target.result = "Unnoticed";
            visibility = 'unnoticed';
          } else {
            target.result = "Undetected";
            visibility = 'undetected';
          }
          if (data?.[other.token.id]?.visibility !== visibility)
            tokenUpdate[`flags.${PERCEPTION_ID}.data.${other.token.id}.visibility`] = visibility;
        }

        if (!Object.hasOwn(uiData, target.result)) {
          uiData[target.result] = {
            resultClass: (delta >= 0) ? 'success' : 'failure',
            targets: [target]
          };
        }
        else {
          uiData[target.result].targets.push(target);
        }
      }

      // AvoidNotice.log('game.messages', game.messages);
      const messages = game.messages.contents.filter((m) =>
        m.data.speaker.token === combatant.tokenId && m.data.flags?.core?.initiativeRoll
      );
      // AvoidNotice.log('messages', messages);
      if (!messages.length) {
        AvoidNotice.log(`Couldn't find initiative card for ${combatant.token.name}`);
        continue;
      }
      const lastMessage = messages.pop();
      let chatMessage = await game.messages.get(lastMessage._id);
      const content = await renderTemplate(`modules/${MODULE_ID}/templates/combat-start.hbs`, uiData);
      await chatMessage.update({ content });
    }

    // If PF2e-perception is around, te
    if (game.modules.get(PERCEPTION_ID)?.active) {
      let updates = [];
      for (const id in changes) {
        const update = changes[id];
        if (!Object.keys(update).length) continue;
        updates.push({ _id: id, ...update });
      }
      // AvoidNotice.log('updates', updates);
      canvas.scene.updateEmbeddedDocuments("Token", updates);
    }
  });
});
