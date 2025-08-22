# v13.7.0

- Add a keybind to toggle visibility for selected NPC token(s) off and set their initiative skill to stealth. Super handy for prepping group of NPCs waiting in ambush if you have 'Toggle on GM-Hidden combatants at Combat Start' enabled.
- Update Polish Translation (thanks Lioheart)

# v13.6.3

- Remove warning notification on player clients when clearing stealth for party at combat end.

# v13.6.2

- Use the bulk API switch to also control routing the clear stealth functions for visioner into its specific API call if enabled. Don't enable it unless you are testing functionality as these Visioner APIs are still baking.
- Add an exclamation point to delta values on initiative cards when a token is observed due to strict mode.
- if enabled, reveal GM-hidden encounter tokens last to ensure visibility handlers have had a chance to set the visibility modes.
- Update Polish Translation (thanks Lioheart)

# v13.6.1

- Fix off-by-one error

# v13.6.0

- If compute cover at combat start is enabled and using _PF2e Visioner_ as visibility handler, call visioner's getAutoCoverState to get the updated cover status when testing observers vs avoiders.
- Add an opt-in strict mode game setting.
  - I do not recommend enabling this because I'm not going to chase the numerous visibility edge cases and feats that might affect this.
  - I likely won't respond to any bug reports related to something showing up that shouldn't have when strict mode is enabled.
  - Requires avoiders to have explicit cover or concealment conditions from observing tokens in order to become hidden or undetected from them.
  - If there is interest I might create a Hook allowing others to filter the results prior to application to initiative cards or visibility managers.

# v13.5.2

- Fix error detecting natural 1s and 20s on initiative rolls

# v13.5.1

- Fix error when hazards are included in initiative list

# v13.5.0

- BREAKING CHANGE: Disable use of _Perceptive_ as a visibility handler until such time as I can make it work
- Restructure internal loops to improve batch processing of visibility changes
- Added opt-in game setting to allow stealth initiative rolls to apply against allies.
- Added opt-in game setting to disable writing stealth summaries to initiative cards.
- Added opt-in advanced game setting to use Visioner bulk API
- Update Polish Translation (thanks Lioheart)

# v13.4.1

- Restrict clear party stealth keybinding to GM only

# v13.4.0

- Use the cover API of _PF2e Visioner_ if it is active
- Removed 'Make selected tokens observerable' keybind, Added 'Clear Stealth from selected tokens' (with no default key) in its place
- Added a keybinding to clear stealth from all on-canvas members of the party (no default key)
- Add a game setting to auto-clear stealth from the party at end of combat

# v13.3.0

- Broke up the files for easier maintenance
- Added a new default autopick setting for the visibility handler, where _PF2e Avoid Notice_ will adapt to the vision modules you have installed (_PF2e Visioner_ > _PF2e Perception_). You can still opt-out of using any condition handler, or opt-in to using a specific one if the default priority doesn't suit you. _Perceptive_ is still opt-in, but it won't be selected automatically.
- Changed the game setting of 'Condition Handler' to 'Visibility Handler'. I purposely didn't carry over any settings from 'Condition Handler' because the new auto setting should do what is wanted 95% of the time and let folks see the new visibility features without having to go set stuff in the game settings. Intentional opt-out is still supported.

# v13.2.2

- Don't use _Unnoticed_ if using _PF2e Visioner_ as the condition handler

# v13.2.1

- Fix _PF2e Visioner_ ephemeral effects issue by adding separate updateEphemeralEffects call

# v13.2.0

- Add _PF2e Visioner_ as a condition handler (refer to https://github.com/roi007leaf/pf2e-visioner)

# v13.1.3

- Update a dormant v13 flag removal path for pf2e-perception

# v13.1.2

- Make sure player movements get cleared

# v13.1.1

- Fix a bad pattern used to detect Foundry's major version number

# v13.1.0

- Add an opt-in setting to clear the movement history of a token when its combat turn ends
- Change the autoroll spell damage game setting to be a client setting rather than a world setting
- Update Polish Translation (thanks Lioheart)

# v13.0.2

- Get rid of the double notify when schema version changes

# v13.0.1

- Update pl.json (thanks Lioheart)

# v13.0.0

- Foundry version 13 compatibility
- Small adjustment to text added to the initiative card

# v1.17.0

- If an initiative card is missing, search for an Avoiding Notice roll card that was the source of the initiative result and put the avoid notice results there.
- Ran code through a prettifier

# v1.16.2

- Fix a bug checking against token IDs.

# v1.16.1

- Update Polish Translation (thanks Lioheart)

# v1.16.0

- Add a keybinding to make selected tokens observerable by removing `hidden`, `undetected`, or `unnoticed` condition items. Will also clear out any `PF2E Perception` flags on those tokens.

# v1.15.1

- Mark module as not yet compatible with v13

# v1.15.0

- Added draggable conditions to initiative cards
- Fix annoying popup about location of module.json changing (after this update that is)

# v1.14.0

- expire the raised-shield effect at the beginning of their first turn. (Thanks Farling)
- 6.6 verified
- Put version-specific url on all relevant fields in module.json

# v1.13.2

- Update rage hint in pl.json (thanks Lioheart)
- Update github scripts to automate releases to foundry

# v1.13.1

- Added a missing await

# v1.13.0

- Added an opt-in setting to enable autorolling of non-attack spell damage before saves are rolled.
- Added an opt-in rage setting to automate barbarians entering rage at combat start
- Verify for 6.5
- Update pl.json (thanks Lioheart)

# v1.12.2

- Update pl.json (thanks Lioheart)

# v1.12.1

- Better error messages, don't require `Raise a Shield` action to be present on the actor sheet.

# v1.12.0

- Add an opt-out setting to use the `raise-a-shield` action at combat start for PCs using the `defend` exploration activity and have a Raise a Shield action listed in their encounter actions. Effects don't automatically expire at the beginning of turn 1, so this has to be manually managed.

# v1.11.1

- Fix error at combat start if an avoiding combatant has sent a non-roll chat card after the initiative roll.

# v1.11.0

- If an avoiding combatant has its initiative set manually by the GM using the 'Set as _Combatant's_ initiative' button on a check result card, update that card with visibility results when combat is started.
- Fix a benign error that happened when setting/clearing hidden/undetected conditions via token HUD on a token that didn't have any pf2e-perception status flags on it.

# v1.10.1

- messed up the release process, bumping version to clear it.

# v1.10.0

- Refactored code for better separation of concerns
- Added Polish translation (thanks Lioheart)

# v1.9.0

- Added support for Perceptive as a condition handler

# v1.8.0

- Critical rolls on initiative affect the degree of success of the sneak evaluation
- Added a condition handler setting, allowing a choice of how to handle setting the `hidden`, `undetected`, and `unnoticed` settings at your table.

# v1.7.0

- Fixed a dumb typo preventing the 1.6 feature from working
- If override is allowed, remove any pf2e-perception flags on a token if actor gets a condition item change to `hidden`, `undetected`, or `unnoticed`. This typically comes from using 'Assign Status Effects' on the token HUD; I use it to quickly clear out pf2e-perception's mix of hidden/undetected states after a token attacks by setting then clearing `hidden` in the token HUD.

# v1.6.0

- Add a setting to disable the requirement that PCs have an active `Avoid Notice` exploration activity to hide at combat start.

# v1.5.0

- Hazards are skipped as targets for avoiding notice and when unhiding combatants. Hazards with `stealth` for initiative still display a list of which combatants they avoid notice from.

# v1.4.1

- Added Eidolons to the pets checked at combat start
- Updated compatibility to 6.2

# v1.4.0

- PCs need to have `Avoid Notice` set as an active exploration activity to hide at combat start. NPCs need to have initiative set to `stealth`.
- Stealth is checked against Pet/Familiars of non-allied combatants

# v1.3.1

- 6.1 compatibility

# v1.3.0

- V12 compatibility
- Add option to remove GM hidden state on noticed combatants at combat start.

# v1.2.3

- Fix failed stealth to follow Sneak rules

# v1.2.2

- Localize the tooltips
- Added a schema setting to help with any future data migrations

# v1.2.1

- Added tooltip for cover adjustments

# v1.2.0

- Look for built-in cover effect if not using PF2e Perception
- If enabled, let PF2e Perception autocalculate cover at combat start
- Show cover adjustments on initiative message

# v1.1.1

- Improvements to README.md and table format

# v1.1.0

- Put detection results in a table for better viewing

# v1.0.1

- Restore the tooltips on adjusted stealth initiative chat messages
- More robust tooltip generation
- Removed some code duplication

# v1.0.0

- Use any PF2e-perception cover bonuses on perception DC

# v0.9.0

- Add setting allowing the module to override existing PF2e-perception visibility flags

# v0.8.0

- Add settings to control logging and use of Unnoticed
- Add english localization file
- Clean up code

# v0.7.0

- Update PF2e-Perspective's flags (if it's active) for those combatants rolling initiative with Stealth

# v0.6.0

- Don't show results on player-rolled initiative cards

# v0.5.0

- Group results by detection type

# v0.4.0

- Use Unnoticed if stealth initiative beats perception initiative

# v0.3.0

- Use templates to format the chat info

# v0.2.0

- Better formatting of detection status

# v0.1.0

- Update initiative cards with detection statuses

# v0.0.0

- Initial implementation
