const CONSOLE_COLORS = ['background: #222; color: #80ffff', 'color: #fff'];
const HIDDEN = ['action:hide', 'action:create-a-diversion', 'action:sneak'];
const MODULE_ID = 'pf2e-avoid-notice';
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
  Hooks.on('createChatMessage', async (message, options, id) => {
    // AvoidNotice.log('createChatMessage', message);
    const pf2eContext = message.flags.pf2e.context;
    switch (pf2eContext?.type) {
      case 'perception-check':
        if (pf2eContext?.options.includes('action:seek')) {
          AvoidNotice.log('perception-check', message);
          // await this.rollPerception(message, options, id);
        }
        break;
      case 'skill-check':
        const tags = pf2eContext?.options.filter((t) => HIDDEN.includes(t));
        if (tags.length > 0) {
          AvoidNotice.log('skill-check', tags);
          // await this.rollStealth(message, options, id);
        }
        break;
    }
  });

  Hooks.on('combatStart', async (encounter, ...args) => {
    const sneakers = encounter.combatants.contents.filter((c) => c.flags.pf2e.initiativeStatistic === 'stealth');
    for (const combatant of sneakers) {
      // AvoidNotice.log('combatant', combatant);

      // Find enemies whose perception we beat if we had greater cover
      const disposition = combatant.token.disposition;
      const optimisticStealth = combatant.initiative + 4;
      const others = encounter.combatants.contents.filter((c) => c.token.disposition != disposition && optimisticStealth >= c.actor.system.perception.dc);
      if (!others.length) continue;

      // Now extract the details for the template
      let data = { stealth: combatant.initiative };
      data.undetected = others.map((other) => {
        let target = {
          dc: other.actor.system.perception.dc,
          name: other.token.name,
        };
        target.delta = combatant.initiative - target.dc;
        target.result = (target.delta >= 0) ? `Undetected by +${target.delta}` : `Observed by ${target.delta}`;
        target.resultClass = (target.delta >= 0) ? 'avoid-notice-success' : 'avoid-notice-failure';
        return target;
      });

      // AvoidNotice.log('game.messages', game.messages);
      const messages = game.messages.contents.filter((m) =>
        m.data.speaker.token === combatant.tokenId && m.data.flags?.core?.initiativeRoll
      );
      // AvoidNotice.log('messages', messages);
      if (!messages.length) continue;
      const lastMessage = messages.pop();
      let chatMessage = await game.messages.get(lastMessage._id);
      const content = await renderTemplate(`modules/${MODULE_ID}/templates/combat-start.hbs`, data);
      await chatMessage.update({ content });
    }
  });
});
