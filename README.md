[![License](https://img.shields.io/github/license/eligarf/avoid-notice?label=License)](LICENSE)
[![Latest Version](https://img.shields.io/github/v/release/eligarf/avoid-notice?display_name=tag&sort=semver&label=Latest%20Version)](https://github.com/eligarf/avoid-notice/releases/latest)
![Foundry Version](https://img.shields.io/endpoint?url=https://foundryshields.com/version?url=https%3A%2F%2Fraw.github.com%2Feligarf%2Favoid-notice%2Frelease%2Fmodule.json)

![Latest Downloads](https://img.shields.io/github/downloads/eligarf/avoid-notice/latest/total?color=blue&label=latest%20downloads)
![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Fpf2e-avoid-notice&colorB=4aa94a)
# PF2e Avoid Notice

A module for [FoundryVTT](https://foundryvtt.com) that shows results of initiative stealth check vs combatant perception DCs on the initiative messages when *Begin Encounter* is clicked.

## Initiative messages
When *Begin Encounter* is clicked on the combat tracker, this module appends GM-visible results of checking the initiative stealth value against the non-allied combatants to the initiative roll message, grouped by detection status: `Unnoticed`, `Undetected`, `Hidden`, and `Observed`. The numbers by each listed token in the groups shows the difference between the stealth initiative roll and the perception DC of that token.

![image](https://github.com/Eligarf/avoid-notice/assets/16523503/9d45f113-5078-4972-9110-3c924b0e3c4d)

In the above, *Amiri's* stealth roll of 13 was successful against *monster* and *creature*, who had perception DC's of 10 and 13 and so *Amiri* is `Undetected` by them. The roll was not successful against *beast* or *grumpkin*, who in turn had perception DC's of 17 and 20, so *Amiri* is only `Hidden` against them. *PF2e Avoid Notice* will apply this bonus automatically if the token rolling stealth has an `Effect: Cover (Standard)` or `Effect: Cover (Greater)` effect on it unless *PF2e Perception* is active. 

An *Unnoticed* setting controls whether or not to use `Unnoticed` rather than `Undetected` for stealth checks that beat both the target's perception DC and initiative. `Undetected` is always used if the stealth initiative roll beats the target's perception DC but doesn't beat the target's initiative roll.

*PF2e Avoid Notice* also can remove the GM hidden states of combatants if enabled in the game settings, since forgetting to toggle combatant visibility happens to me too often.

## PF2e Perception
The 'Pathfinder on Foundry VTT Community and Volunteer Development Server' discord server leads to the excellent unlisted module [PF2e Perception](https://github.com/reonZ/pf2e-perception). It isn't required for the overall operation of this module, but additional capabilities become available:

* *PF2e Avoid Notice* will set the appropriate visibility flags on the combatant tokens to reflect the detection status determined by stealth initiative checks.
* An *Override* setting allows *PF2e Avoid Notice* to override existing *PF2e Perception* visibility flags on tokens. Disabling this is useful if one wishes to setup any complicated situation beforehand and not get it stomped by the initiative rolls.
* If *PF2e Perception* cover flags are found on a token using stealth for initiative, standard or greater cover bonuses will apply as appropriate against perception DCs.
* If *Compute Cover at Combat Start* is selected, *`*PF2e Avoid Notice* will ignore existing cover flags and use *PF2e Perception* to calculate new ones for tokens using stealth as initiative for each token they are testing against