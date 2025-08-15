import { MODULE_ID } from "./const.js";

async function endOfTurn(encounter, change, action) {
  if (!game.settings.get(MODULE_ID, "clearMovement")) return;
  const tokenDoc = canvas.tokens.get(encounter.current.tokenId)?.document;
  if (!tokenDoc) return;
  const movement = tokenDoc?._movementHistory;
  if (!movement) return;
  const movementLength = movement?.length;
  if (!movementLength) return;
  await tokenDoc.clearMovementHistory();
}

export async function registerHooksForClearMovementHistory() {
  Hooks.on("combatTurn", async (encounter, change, action) => {
    await endOfTurn(encounter, change, action);
  });

  Hooks.on("combatRound", async (encounter, change, action) => {
    await endOfTurn(encounter, change, action);
  });
}
