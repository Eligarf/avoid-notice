class AvoidNotice {
  static CONSOLE_COLORS = ['background: #222; color: #80ffff', 'color: #fff'];
  static HIDDEN = ['action:hide', 'action:create-a-diversion', 'action:sneak'];

  static colorizeOutput(format, ...args) {
    return [
      `%cpf2e-avoid-notice %c|`,
      ...AvoidNotice.CONSOLE_COLORS,
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
        const hidden = ['action:hide', 'action:create-a-diversion', 'action:sneak'];
        const tags = pf2eContext?.options.filter((t) => AvoidNotice.HIDDEN.includes(t));
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
      const disposition = combatant.token.disposition;
      const others = encounter.combatants.contents.filter((c) => c.token.disposition != disposition);
      let undetected = '';
      for (const other of others) {
        const dc = other.actor.system.perception.dc;
        if (combatant.initiative >= dc) {
          undetected += `${other.token.name}<div class="target - dc - result" data-tooltip-class="pf2e" data-tooltip-direction="UP">\n    <div class="target - dc" data-visibility="gm"><span data-visibility="gm" data-whose="opposer">DC ${dc}</span></div>\n    <div class="result degree - of - success">Result: <span class="success">Success</span> <span data-visibility="gm" data-whose="opposer">by +${combatant.initiative - dc}</span></div>\n</div><hr>`
        }
        else if (combatant.initiative >= dc - 4) {
          undetected += `${other.token.name}<div class="target - dc - result" data-tooltip-class="pf2e" data-tooltip-direction="UP">\n    <div class="target - dc" data-visibility="gm"><span data-visibility="gm" data-whose="opposer">DC ${dc}</span></div>\n    <div class="result degree - of - success">Result: <span class="failure">Failure</span> <span data-visibility="gm" data-whose="opposer">by ${combatant.initiative - dc}</span></div>\n</div><hr>`
        }
      }
      if (undetected.length > 0) {
        // AvoidNotice.log('game.messages', game.messages);
        const messages = game.messages.contents.filter((m) =>
          m.data.speaker.token === combatant.tokenId && m.data.flags?.core?.initiativeRoll
        );
        // AvoidNotice.log('messages', messages);
        if (!messages.length) return;
        const lastMessage = messages.pop();
        let chatMessage = await game.messages.get(lastMessage._id);
        // AvoidNotice.log('chatMessage', await duplicate(chatMessage));
        let content = await duplicate(chatMessage.data.content);
        content = `<h1><strong>${content}</strong></h1>` + undetected;
        await chatMessage.update({ content });
      }
    }
  });
});
