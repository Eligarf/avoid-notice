import { MODULE_ID, CONSOLE_COLORS, REFRESH_OPTIONS } from "./const.js";
import { cachedSettings } from "./settings.js";

function colorizeOutput(format, ...args) {
  return [`%c${MODULE_ID} %c|`, ...CONSOLE_COLORS, format, ...args];
}

export function log(format, ...args) {
  const level = cachedSettings.logLevel;
  if (level !== "none") {
    if (level === "debug") console.debug(...colorizeOutput(format, ...args));
    else if (level === "log") console.log(...colorizeOutput(format, ...args));
  }
}

export function debuglog(format, ...args) {
  const level = cachedSettings.logLevel;
  if (level === "debug") console.debug(...colorizeOutput(format, ...args));
}

export function breakdownRoll(roll) {
  const dice = roll?.dice;
  const rawRoll = dice.length > 0 ? dice[0].total : Number(roll?.options?.dice);
  const rawRollDosDelta = rawRoll === 1 ? -1 : rawRoll === 20 ? 1 : 0;
  return { rawRoll, rawRollDosDelta };
}

export function clampDos(delta, rawRollDosDelta) {
  return Math.min(
    Math.max(
      rawRollDosDelta + (delta < -9 ? 0 : delta < 0 ? 1 : delta > 9 ? 3 : 2),
      0,
    ),
    3,
  );
}

export function getToken(id) {
  let token = canvas.tokens.get(id);
  if (!token) {
    token = canvas.tokens.placeables.find((t) => t?.actor?.id === id);
  }
  return token;
}

export function interpolateString(str, interpolations) {
  return str.replace(/\{([A-Za-z0-9_]+)\}/g, (match, key) =>
    interpolations.hasOwnProperty(key) ? interpolations[key] : match,
  );
}

export async function iterateTokensAndParties(tokens, callback) {
  let parties = [];
  for (const token of tokens) {
    const actor = token.actor;
    if (!actor) continue;
    if (actor.type === "party") {
      parties.push(actor);
      continue;
    }
    await callback(token);
  }

  for (const party of parties) {
    for (const member of party.members) {
      if (tokens.some((token) => token.actor?.id === member.id)) continue;
      await callback(member.prototypeToken);
    }
  }
}

export function localizeString(str, interpolations) {
  return interpolateString(game.i18n.localize(str), interpolations);
}

export function refreshPerception() {
  debuglog("Refreshing perception for all tokens");
  canvas.perception.update(REFRESH_OPTIONS);
}
