Hooks.once('init', () => {
  Hooks.on('combatStart', async (encounter, ...args) => {
    const sneakers = encounter.combatants.contents.filter((c) => c.flags.pf2e.initiativeStatistic === 'stealth');
    for (const combatant of sneakers) {
      const disposition = combatant.token.disposition;
      const others = encounter.combatants.contents.filter((c) => c.token.disposition != disposition);
      let undetected = '';
      for (const other of others) {
        const dc = other.actor.system.perception.dc;
        if (combatant.initiative >= dc) {
          if (undetected.length > 0) undetected += '<br>';
          undetected += `undetected by ${other.token.name} (DC ${dc})`;
        }
      }
      if (undetected.length > 0) {
        const data = {
          content: `Avoiding Notice at start of combat: ${combatant.initiative}<br>${undetected}`,
          speaker: ChatMessage.getSpeaker({ token: combatant.token instanceof Token ? combatant.token.document : combatant.token })
        };
        data.type = CONST.CHAT_MESSAGE_TYPES.WHISPER;
        data.whisper = ChatMessage.getWhisperRecipients('gm');
        ChatMessage.create(data);
      }
    }
  });
});
