import { log } from "./main.js";

export const PERCEPTIVE_ID = "perceptive";

export function isPerceptiveActive() {
  return game.modules.get(PERCEPTIVE_ID)?.active;
}

export function getPerceptiveApi() {
  return game.modules.get(PERCEPTIVE_ID)?.api;
}

export async function setPerceptiveCondition({
  perceptiveApi,
  token,
  type,
  dc,
  formula,
  results,
}) {
  // log('tellPerceptive', { token, type, dc, formula, results });
  await perceptiveApi.EffectManager.applyStealthEffects(token, {
    Type: type,
    EffectInfos: { RollFormula: formula },
  });
  if ("prepareSpottableToken" in perceptiveApi.PerceptiveFlags) {
    await perceptiveApi.PerceptiveFlags.prepareSpottableToken(
      token,
      { PPDC: -1, APDC: dc, PPDice: dc },
      "observed" in results ? results.observed.map((o) => o.tokenDoc) : [],
    );
  } else {
    if ("observed" in results) {
      for (const o of results.observed) {
        await perceptiveApi.PerceptiveFlags.addSpottedby(token, o.tokenDoc);
      }
    }
    await perceptiveApi.PerceptiveFlags.setSpottingDCs(token, {
      PPDC: -1,
      APDC: dc,
      PPDice: dc,
    });
  }
}

export async function updatePerceptive({
  avoiderApi,
  initiativeMessage,
  results,
}) {
  const perceptiveApi = avoiderApi.perceptiveApi;
  const avoider = avoiderApi.avoider;
  const avoiderTokenDoc = avoiderApi.avoiderTokenDoc;

  await perceptiveApi.PerceptiveFlags.clearSpottedby(avoiderTokenDoc);
  const dc =
    avoider.actor.type === "hazard"
      ? avoider.actor.system.initiative.dc
      : avoider.actor.system.skills.stealth.dc;

  if ("hidden" in results) {
    await setPerceptiveCondition({
      perceptiveApi,
      token: avoiderTokenDoc,
      type: "hide",
      dc,
      formula: initiativeMessage.rolls[0].formula,
      results,
    });
  } else if ("unnoticed" in results) {
    await setPerceptiveCondition({
      perceptiveApi,
      token: avoiderTokenDoc,
      type: "sneak",
      dc,
      formula: initiativeMessage.rolls[0].formula,
      results,
    });
  } else if ("undetected" in results) {
    await setPerceptiveCondition({
      perceptiveApi,
      token: avoiderTokenDoc,
      type: "sneak",
      dc,
      formula: initiativeMessage.rolls[0].formula,
      results,
    });
  } else {
    await perceptiveApi.EffectManager.removeStealthEffects(avoiderTokenDoc);
  }
}
