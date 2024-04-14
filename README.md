[![License](https://img.shields.io/github/license/eligarf/avoid-notice?label=License)](LICENSE)
[![Latest Version](https://img.shields.io/github/v/release/eligarf/avoid-notice?display_name=tag&sort=semver&label=Latest%20Version)](https://github.com/eligarf/avoid-notice/releases/latest)
![Foundry Version](https://img.shields.io/endpoint?url=https://foundryshields.com/version?url=https%3A%2F%2Fraw.githubusercontent.com%2Feligarf%2Favoid%2Dnotice%2Fdev%2Fmodule.json)

![Latest Downloads](https://img.shields.io/github/downloads/eligarf/avoid-notice/latest/total?color=blue&label=latest%20downloads)
![Total Downloads](https://img.shields.io/github/downloads/eligarf/avoid-notice/total?color=blue&label=total%20downloads)
# PF2e Avoid Notice

A module for [FoundryVTT](https://foundryvtt.com) that shows results of initiative stealth check vs combatant perception DCs on the initiative messages.

* Appends results of checking the initiative stealth value against the non-allied combatants to the initiative roll message, grouped by detection status: `Unnoticed`, `Undetected`, and `Observed`
* `Unnoticed` setting controls whether or not to use `Unnoticed` for stealth checks that beat both the target's perception DC and initiative in place of the standard `Undetected`
* If *PF2e Perception* is active, *PF2e Avoid Notice* will set the appropriate visibility flags on the combatant tokens to reflect the detection status determined by stealth initiative checks.
* `Override` setting allows *PF2e Avoid Notice* to override existing *PF2e Perception* visibility flags on tokens. Disabling this is useful if one wishes to setup any complicated situation beforehand and not get it stomped by the initiative rolls. Even if `Override` is disabled, *Pf2e Avoid Notice* can still change an `Observed` status to something else
* If *PF2e Perception* cover flags are found on a token, standard or greater cover bonuses will apply to the perception DC of that target.

# PF2e Perception
The 'Pathfinder on Foundry VTT Community and Volunteer Development Server' discord server leads to the excellent unlisted module [PF2e Perception](https://github.com/reonZ/pf2e-perception). It isn't required for the overall operation of this module.