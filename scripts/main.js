Hooks.once('init', () => {
  Hooks.on('combatStart', async (encounter, ...args) => {
    const sneakers = encounter.combatants.contents.filter((c) => c.flags.pf2e.initiativeStatistic === 'stealth');
    for (const combatant of sneakers) {
      // console.log('pf2e-avoid-notice | combatant', combatant);
      const disposition = combatant.token.disposition;
      const others = encounter.combatants.contents.filter((c) => c.token.disposition != disposition);
      let undetected = '';
      for (const other of others) {
        const dc = other.actor.system.perception.dc;
        if (combatant.initiative >= dc) {
          undetected += `<br>${game.i18n.localize("pf2e-avoid-notice.undetected-by")} ${other.token.name} (DC ${dc})`;
        }
        else if (combatant.initiative >= dc - 4) {
          undetected += `<br>${game.i18n.localize("pf2e-avoid-notice.maybe-undetected-by")} ${other.token.name} (DC ${dc})`;
        }
      }
      if (undetected.length > 0) {
        // console.log('pf2e-avoid-notice | game.messages', game.messages);
        const messages = game.messages.contents.filter((m) =>
          m.data.speaker.token === combatant.tokenId && m.data.flags?.core?.initiativeRoll
        );
        // console.log('pf2e-avoid-notice | messages', messages);
        if (!messages.length) return;
        const lastMessage = messages.pop();
        let chatMessage = await game.messages.get(lastMessage._id);
        console.log('pf2e-avoid-notice | chatMessage', await duplicate(chatMessage));
        let content = await duplicate(chatMessage.data.content);
        content += undetected; 
        await chatMessage.update({ content });
      }
    }
  });
});
