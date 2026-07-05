import { MODULE_ID, CONDITION_IDS, CONDITION_PACK, SLUGS } from "./const.js";
import { SETTINGS } from "./settings.js";
import { log } from "./main.js";

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

  // log(`Creating stealth effect for actor ${actor.name}`, effectData);
  await actor.createEmbeddedDocuments("Item", [effectData]);
}
