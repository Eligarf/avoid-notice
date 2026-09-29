import {
  CONDITION_IDS,
  CONDITION_PACK,
  HIDDEN,
  MODULE_ID,
  OBSERVED,
  SLUGS,
  UNDETECTED,
  VISIBILITY_LABELS,
} from "./const.js";
import { debuglog } from "./utils.js";
import { cachedSettings } from "./settings.js";

export function isAvoider(tokenOrActor) {
  const actor = tokenOrActor?.actor ?? tokenOrActor;
  // If you have a stealth effect you are an avoider
  if (actor?.items?.some((item) => item.system.slug === SLUGS.stealthEffect))
    return true;

  // once combat starts, a combantant has to have the stealth effect
  const combat = game?.combat;
  const combatant = combat?.combatants?.contents?.some(
    (c) => c.token?.id === tokenOrActor.id || c.actor?.id === tokenOrActor.id,
  );
  if (combat?.round > 0 && !!combatant && combatant?.initiative !== null)
    return false;

  // If activities aren't required, you are an avoider if your initiative is stealth.
  const requireActivity = cachedSettings.requireActivity;
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

export async function undoRevealsOf({ avoiders, observers = [] }) {
  debuglog("undoRevealsOf", { avoiders, observers });
  for (const avoider of avoiders) {
    const actor = avoider?.actor;
    const stealthEffect = actor?.items?.find(
      (item) => item.system.slug === SLUGS.stealthEffect,
    );
    const flags = stealthEffect?.flags?.[MODULE_ID] || {};
    if (!flags) continue;
    const undoSet = new Set(flags.hidden?.except || []);
    (flags.undetected?.except || []).forEach((id) => undoSet.add(id));
    let undos = [...undoSet];
    if (observers.length > 0) {
      undos = undos.filter((id) => observers.some((o) => o.id === id));
    }

    const reveals = foundry.utils.duplicate(flags.observers);
    const baseline = flags.baseline;
    const scrubbed = Object.fromEntries(
      Object.entries(reveals).filter(([id, _]) => !undos.includes(id)),
    );
    await adaptStealthEffectToObservers({
      actor,
      baseline,
      observers: scrubbed,
    });
  }
}

const REVEALED_AS = {
  observed: OBSERVED,
  hidden: HIDDEN,
  undetected: UNDETECTED,
};

export async function revealAvoidersTo({
  avoiders,
  observers,
  revealedAs = "observed",
}) {
  const visibility = REVEALED_AS[revealedAs];
  debuglog("revealAvoidersTo", { avoiders, observers, revealedAs, visibility });
  for (const avoider of avoiders) {
    const actor = avoider?.actor;
    const stealthEffect = actor?.items?.find(
      (item) => item.system.slug === SLUGS.stealthEffect,
    );
    if (!stealthEffect) continue;
    const flags = stealthEffect?.flags?.[MODULE_ID] || {};
    if (!flags) continue;
    const reveals = foundry.utils.duplicate(flags.observers);
    const baseline = flags.baseline;
    for (const observer of observers) {
      const id = observer.id;
      if (id in reveals) {
        reveals[id].visibility = Math.min(reveals[id].visibility, visibility);
      } else {
        reveals[id] = { visibility, signature: observer.actor.signature };
      }
    }
    await adaptStealthEffectToObservers({
      actor,
      baseline,
      observers: reveals,
    });
  }
}

async function createStealthEffect(actor, rules, flags) {
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

export function buildVisibilitySets(observers, baseline = undefined) {
  const observations = Object.entries(observers);
  const list = observations.map(([_, o]) => o.visibility);
  const resultGroups = new Set(list);
  if (baseline !== undefined) resultGroups.add(baseline);
  const visibilities = resultGroups.reduce((acc, visibility) => {
    if (visibility >= baseline) return acc;
    const matches = observations.filter(
      ([_, o]) => o.visibility === visibility,
    );
    acc.push([VISIBILITY_LABELS[visibility], Object.fromEntries(matches)]);
    return acc;
  }, []);
  return Object.fromEntries(visibilities);
}

function buildFlagAndRulesForExcept(state, exceptions) {
  const rules = [
    {
      key: "GrantItem",
      uuid: `Compendium.${CONDITION_PACK}.Item.${CONDITION_IDS[state]}`,
    },
  ];

  const flags = {};
  if (exceptions.length) {
    flags.except = exceptions.map(([id, _]) => id);
    rules.push({
      key: "RollOption",
      domain: "all",
      option: `self:condition:${state}`,
      value: false,
      predicate: [
        exceptions.length > 1
          ? {
              or: exceptions.map(([_, e]) => `target:signature:${e.signature}`),
            }
          : `target:signature:${exceptions[0][1].signature}`,
      ],
    });
  }

  return [flags, rules];
}

function buildFlagsAndRules(visibilities, baseline) {
  const flags = {};
  const rules = [];

  const observed = Object.entries(visibilities.observed || {});
  if (baseline >= HIDDEN) {
    const [hFlags, hRules] = buildFlagAndRulesForExcept("hidden", observed);
    if (hFlags) flags.hidden = hFlags;
    rules.push(...hRules);
  }

  if (baseline >= UNDETECTED) {
    const [uFlags, uRules] = buildFlagAndRulesForExcept(
      "undetected",
      observed.concat(Object.entries(visibilities.hidden || {})),
    );
    if (uFlags) flags.undetected = uFlags;
    rules.push(...uRules);
  }

  return { flags, rules };
}

export async function adaptStealthEffectToObservers({
  actor,
  baseline,
  observers,
}) {
  debuglog("adaptStealthEffectToObservers", { actor, baseline, observers });
  const visibilities = buildVisibilitySets(observers, baseline);
  const { flags, rules } = buildFlagsAndRules(visibilities, baseline);
  flags.observers = observers;
  flags.baseline = baseline;
  const effect = actor?.items?.find(
    (item) => item.system.slug === SLUGS.stealthEffect,
  );
  if (effect) {
    await effect.update({
      flags: {
        [MODULE_ID]: flags,
      },
      system: {
        rules: rules,
      },
    });
  } else {
    await createStealthEffect(actor, rules, flags);
  }
}
