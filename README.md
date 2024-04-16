[![License](https://img.shields.io/github/license/eligarf/avoid-notice?label=License)](LICENSE)
[![Latest Version](https://img.shields.io/github/v/release/eligarf/avoid-notice?display_name=tag&sort=semver&label=Latest%20Version)](https://github.com/eligarf/avoid-notice/releases/latest)
![Foundry Version](https://img.shields.io/endpoint?url=https://foundryshields.com/version?url=https%3A%2F%2Fraw.github.com%2Feligarf%2Favoid-notice%2Frelease%2Fmodule.json)

![Latest Downloads](https://img.shields.io/github/downloads/eligarf/avoid-notice/latest/total?color=blue&label=latest%20downloads)
![Total Downloads](https://img.shields.io/github/downloads/eligarf/avoid-notice/total?color=blue&label=total%20downloads)
# PF2e Avoid Notice

A module for [FoundryVTT](https://foundryvtt.com) that shows results of initiative stealth check vs combatant perception DCs on the initiative messages when *Begin Encounter* is clicked.

## Initiative messages
When *Begin Encounter* is clicked on the combat tracker, this module appends GM-visible results of checking the initiative stealth value against the non-allied combatants to the initiative roll message, grouped by detection status: `Unnoticed`, `Undetected`, and `Observed`. The numbers by each listed token in the groups shows the difference between the stealth initiative roll and the perception DC of that token. `Unnoticed` and `Undetected` status means that the token rolling initiative was not observed by the listed tokens, so the number listed will be zero or positive. Tokens listed in the `Observed` group are able to observe the stealth-using token.

![image](https://github.com/Eligarf/avoid-notice/assets/16523503/194d98aa-5a60-4564-9971-e368fa5b83f9)

In the above, Amiri's stealth roll of 16 was successful against *monster* and *creature*, who had perception DC's of 10 and 13. It was not successful against *beast* or *grumpkin*, who in turn had perception DC's of 17 and 20. The deltas are there to inform the GMs should they want to take addtional factors such as cover into consideration.

An *Unnoticed* setting controls whether or not to use `Unnoticed` rather than `Undetected` for stealth checks that beat both the target's perception DC and initiative. `Undetected` is always used if the stealth initiative roll beats the target's perception DC but doesn't beat the target's initiative roll.

## PF2e Perception
The 'Pathfinder on Foundry VTT Community and Volunteer Development Server' discord server leads to the excellent unlisted module [PF2e Perception](https://github.com/reonZ/pf2e-perception). It isn't required for the overall operation of this module, but additional capabilities become available:

* *PF2e Avoid Notice* will set the appropriate visibility flags on the combatant tokens to reflect the detection status determined by stealth initiative checks.
* An *Override* setting allows *PF2e Avoid Notice* to override existing *PF2e Perception* visibility flags on tokens. Disabling this is useful if one wishes to setup any complicated situation beforehand and not get it stomped by the initiative rolls.
* If *PF2e Perception* cover flags are found on a token using stealth for initiative, standard or greater cover bonuses will apply as appropriate against perception DCs.
