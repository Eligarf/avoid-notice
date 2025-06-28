[![License](https://img.shields.io/github/license/eligarf/avoid-notice?label=License)](LICENSE)
[![Latest Version](https://img.shields.io/github/v/release/eligarf/avoid-notice?display_name=tag&sort=semver&label=Latest%20Version)](https://github.com/eligarf/avoid-notice/releases/latest)
![Foundry Version](https://img.shields.io/endpoint?url=https://foundryshields.com/version?url=https%3A%2F%2Fraw.github.com%2Feligarf%2Favoid-notice%2Frelease%2Fmodule.json)

![Latest Downloads](https://img.shields.io/github/downloads/eligarf/avoid-notice/latest/total?color=blue&label=latest%20downloads)
![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Fpf2e-avoid-notice&colorB=4aa94a)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/rule671908)

# PF2e Avoid Notice

A module for [FoundryVTT](https://foundryvtt.com) that shows results of initiative stealth check vs combatant perception DCs on the initiative messages when _Begin Encounter_ is clicked.

The term _Avoider_ refers to any combatant that should get hide checks at start of combat. These are:

- PC's with `Avoid Notice` as an active exploration activity.
- PC's with stealth selected for initiative if the game settings don't require `Avoid Notice` to be active
- NPCs that are using stealth for initiative

## Initiative messages

When _Begin Encounter_ is clicked on the combat tracker, this module checks the initiative value for the avoider against its non-allied combatants and appends GM-only information to its initiative roll message, grouped by detection status: `Unnoticed`, `Undetected`, `Hidden`, and `Observed`. The numbers by each listed token in the groups shows the difference between the avoider's initiative check and the perception DC of that combatants they are hiding from.

One mechanical note: rules-as-written, the `Avoid Notice` exploration activity must be active for PCs to gain the benefit of using their initiative roll as their sneak check. Usually this is paired with using stealth for initiative, but some advanced character feats might allow other skills to be used for initiative while still hiding. GMs can control whether or not this is a requirement in the game settings.

![image](https://github.com/Eligarf/avoid-notice/assets/16523503/9d45f113-5078-4972-9110-3c924b0e3c4d)

In the above, _Amiri's_ initiative roll of 13 was successful against _monster_ and _creature_, who had perception DC's of 10 and 13 and so _Amiri_ is `Undetected` by them. The roll was not successful against _beast_ or _grumpkin_, who in turn had perception DC's of 17 and 20, so _Amiri_ is only `Hidden` against them. _PF2e Avoid Notice_ will apply this bonus automatically if the avoider has an `Effect: Cover (Standard)` or `Effect: Cover (Greater)` effect on it unless _PF2e Perception_ is active.

An _Unnoticed_ setting controls whether or not to use `Unnoticed` rather than `Undetected` for initiative checks that beat both the target's perception DC and initiative. `Undetected` is always used if the initiative roll beats the target's perception DC but doesn't beat the target's initiative roll.

_PF2e Avoid Notice_ also can remove the GM hidden states of combatants if enabled in the game settings, since forgetting to toggle combatant visibility happens to me far too often.

Initiative sometimes comes from a previous roll like a sneak check or the use of the avoid notice exploration activity in the Basic Action Macros. In these cases, if the GM has chosen to use the "Set as *Combatant's*initiative" button on the skill check card, there won't be an initiative card and the visibility results will be written to the check card instead. It finds it by looking for the latest message from that combatant with a check result that matches the combatant's initiative roll, so it possible that the visibility result could end up on the wrong card if the combatant has rolled some other kind of check that had the same check value after the designated initiative roll but prior to combat being started.

## Condition Handling

This module provides the GM a number of options in the game settings for automating the application of status results at combat start. Note that an avoider might end up with `undetected`, `hidden`, and `observed` on the same roll vs different observers, and target-relative conditions aren't handled by the base system (only _PF2e perception_ can do this)

- It can do nothing and let the GM handle everything.
- It can use the worst degree-of-success to determine which condition to apply to the avoider, or;
- It can use the best degree-of-success.
- The [_Perceptive_](https://foundryvtt.com/packages/perceptive) module can be chosen to handle things. Its only limitation is not being able to manage `undetected` and `hidden` on an avoider at the same time, but it does handle mixing `observed` states with those others.
- The _PF2e Perception_ module can be selected. It handles multiple visibility states for a token.

## PF2e Perception

The 'Pathfinder on Foundry VTT Community and Volunteer Development Server' discord server leads to the excellent unlisted module [PF2e Perception](https://github.com/reonZ/pf2e-perception). It isn't required for the overall operation of this module, but additional capabilities become available:

- _PF2e Avoid Notice_ will set the appropriate visibility flags on the avoiding tokens to reflect the detection status determined by initiative checks.
- If *PF2e Perception* cover flags are found on an avoider token, standard or greater cover bonuses will apply as appropriate against perception DCs. The are given higher priority than the system cover flag if both are on a token.
- If _Compute Cover at Combat Start_ is selected, _PF2e Avoid Notice_ will ignore existing cover flags and use _PF2e Perception_ to calculate new ones for avoider tokens for each token they are testing against
- Manually adding or removing the `hidden`, `undetected`, or `unnoticed` status condition on the token HUD will cause _PF2e Avoid Notice_ to clear out any existing _PF2e Perception_ flags on that token

# Misfit features

These really don't belong here and should be in some other module(s), but they are handy to me so I'm sharing.

## Raise a Shield

This is an opt-out setting to automatically apply `Raise a shield` to PCs using `Defend` at combat start. Full automation requires use of _PF2e Toolbelt_, wherein you must enable the 'Auto Self-Applied' checkbox in the 'Actionable' section of its game settings.

## Autoroll Spell Damage

This is an opt-in setting to enable autorolling damage on non-attack spells, which only rolls the damage if the message card from the spell cast has a button with a `spell-damage` data action when it is created. This works differently from the autoroll feature of _PF2e Workbench_ since it immediately rolls the damage and doesn't wait for a saving throw roll to trigger the automatic damage roll. It is off by default to avoid upsetting GMs who want to hide more rolls, but I heartily recommend it.

## Rage

This is an opt-in setting to automate Barbarians with `Quick-Tempered` so they automatically enter `Rage` at combat start. The `Rage` action will be ignored if it doesn't have a self-applied effect.

## Clear Movement History

Foundry v13 only. This opt-in setting will clear a token's movement history when it ends its turn in combat.
