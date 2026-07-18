import { MODULE_ID, SLUGS, CONDITION_IDS } from "./const.js";
import { debuglog } from "./main.js";
import { SETTINGS } from "./settings.js";

export function isAvoider({ actor }) {
  // If you have a stealth effect you are an avoider
  if (actor?.items?.some((item) => item.system.slug === SLUGS.stealthEffect))
    return true;

  // once combat starts, a combantant has to have the stealth effect
  const combat = game?.combat;
  const combatant = combat?.combatants?.contents?.some(
    (c) => c.token?.actor?.id === actor.id,
  );
  if (combat?.round > 0 && !!combatant && combatant?.initiative !== null)
    return false;

  // If activities aren't required, you are an avoider if your initiative is stealth.
  const requireActivity = game.settings.get(
    MODULE_ID,
    SETTINGS.requireActivity,
  );
  if (!requireActivity)
    return actor?.system?.initiative?.statistic === SLUGS.stealth;

  // If you don't have an exploration activity, you are an avoider if your initiative is stealth.
  if (!(actor?.parties?.size > 0 && actor?.system?.exploration))
    return actor?.system?.initiative?.statistic === SLUGS.stealth;

  // You are an avoider if you have an exploration activity with the "avoid-notice" slug.
  return actor.system.exploration.some(
    (a) => actor.items.get(a)?.system?.slug === SLUGS.avoidNotice,
  );
}

export async function makeAvoidersObservableTo({ avoiders, observers }) {
  debuglog("makeAvoidersObservableTo", { avoiders, observers });
  for (const avoider of avoiders) {
    const stealthEffect = avoider?.items?.find(
      (item) => item.system.slug === SLUGS.stealthEffect,
    );
    let flags = stealthEffect?.flags?.[MODULE_ID] || {};
    const states =
      stealthEffect.system?.rules
        ?.filter(
          (rule) => rule.key === "GrantItem" && rule.flag in CONDITION_IDS,
        )
        .map((rule) => rule.flag) || [];
    for (const state of states) {
      if (state in flags) {
        const exceptFor = new Set(flags[state].exceptFor);
        for (const observer of observers) {
          exceptFor.add(observer.id);
        }
        flags[state].exceptFor = Array.from(exceptFor);
      } else {
        flags[state] = {
          exceptFor: observers.map((observer) => observer.id),
        };
      }
    }
    await stealthEffect.update({
      flags: {
        [MODULE_ID]: flags,
      },
    });
  }
}

export async function createStealthEffect(actor, rules, flags) {
  let effectData = {
    type: "effect",
    name: game.i18n.localize(`${MODULE_ID}.effects.stealth.name`),
    img: "systems/pf2e/icons/conditions/unnoticed.webp",
    flags: {
      [MODULE_ID]: flags,
    },
    system: {
      description: {
        value: game.i18n.localize(`${MODULE_ID}.effects.stealth.description`),
      },
      slug: SLUGS.stealthEffect,
      slug: "pf2e-avoid-notice-stealth",
      duration: {
        value: -1,
        unit: "unlimited",
        sustained: false,
        expiry: null,
      },
      rules: rules,
      tokenIcon: {
        show: true,
      },
      unidentified: false,
      badge: null,
    },
  };

  await actor.createEmbeddedDocuments("Item", [effectData]);
}
