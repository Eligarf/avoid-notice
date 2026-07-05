import { isAvoider } from "./menu.js";
import { MODULE_ID } from "./const.js";
import { localizeString, debuglog, iterateTokensAndParties } from "./main.js";

export async function encounterTest(tokens) {
  const avoiders = [];
  await iterateTokensAndParties(tokens, async (token) => {
    if (isAvoider(token)) {
      avoiders.push(token);
    }
  });

  const friendlyAvoiders = avoiders.filter(
    (token) => token.document.disposition === 1,
  );
  const enemies = tokens.filter((token) => token.document.disposition === -1);
  debuglog("friendly avoiders vs enemies", { friendlyAvoiders, enemies });

  for (const token of friendlyAvoiders) {
    debuglog(`encounterTest: friendly avoider ${token.name} (${token.id})`);
  }

  const enemyAvoiders = avoiders.filter(
    (token) => token.document.disposition === -1,
  );
  let friendlies = [];
  await iterateTokensAndParties(tokens, async (token) => {
    if (token.document.disposition === 1) {
      friendlies.push(token);
    }
  });
  debuglog("enemy avoiders vs friendlies", { enemyAvoiders, friendlies });

  for (const token of enemyAvoiders) {
    debuglog(`encounterTest: enemy avoider ${token.name} (${token.id})`);
  }
}
