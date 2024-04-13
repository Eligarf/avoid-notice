[![License](https://img.shields.io/github/license/eligarf/stealthy?label=License)](LICENSE)
[![Latest Version](https://img.shields.io/github/v/release/eligarf/stealthy?display_name=tag&sort=semver&label=Latest%20Version)](https://github.com/eligarf/stealthy/releases/latest)
![Foundry Version](https://img.shields.io/endpoint?url=https://foundryshields.com/version?url=https%3A%2F%2Fraw.githubusercontent.com%2Feligarf%2Fstealthy%2Fdev%2Fmodule.json)

![Latest Downloads](https://img.shields.io/github/downloads/eligarf/stealthy/latest/total?color=blue&label=latest%20downloads)
![Total Downloads](https://img.shields.io/github/downloads/eligarf/stealthy/total?color=blue&label=total%20downloads)
# PF2e Avoid Notice

A module for [FoundryVTT](https://foundryvtt.com) that shows results of initiative stealth check vs combatant perception DCs on the initiative messages.

* Appends results of checking the initiative stealth value against the non-allied combatants to the initiative roll message, grouped by detection status: `Unnoticed`, `Undetected`, and `Observed`
* `Unnoticed` setting controls whether or not to use `Unnoticed` for stealth checks that beat both the target's perception DC and initiative in place of the standard `Undetected`
* If `PF2e Perception` is active, `PF2e Avoid Notice` will set the appropriate flags on the combatant tokens to reflect the detection status determined by stealth initiative checks.
* `Override` setting allows `PF2e Avoid Notice` to override existing `PF2e Perception` flags on tokens. Disabling this is useful if one wishes to setup any complicated situation beforehand and not get it stomped by the initiative rolls. Even if `Override` is disabled, `Pf2e Avoid Notice` can still change an `Observed` status to something else
