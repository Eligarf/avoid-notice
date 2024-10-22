# v1.12.0
* Add a defaulted-true game setting to use the `raise-a-shield` action at combat start for combatants using the `defend` exploration activity.

# v1.11.1
* Fix error at combat start if an avoiding combatant has sent a non-roll chat card after the initiative roll.

# v1.11.0
* If an avoiding combatant has its initiative set manually by the GM using the 'Set as *Combatant's* initiative' button on a check result card, update that card with visibility results when combat is started.
* Fix a benign error that happened when setting/clearing hidden/undetected conditions via token HUD on a token that didn't have any pf2e-perception status flags on it.

# v1.10.1
* messed up the release process, bumping version to clear it.

# v1.10.0
* Refactored code for better separation of concerns
* Added Polish translation (thanks Lioheart)

# v1.9.0
* Added support for Perceptive as a condition handler

# v1.8.0
* Critical rolls on initiative affect the degree of success of the sneak evaluation
* Added a condition handler setting, allowing a choice of how to handle setting the `hidden`, `undetected`, and `unnoticed` settings at your table.

# v1.7.0
* Fixed a dumb typo preventing the 1.6 feature from working
* If override is allowed, remove any pf2e-perception flags on a token if actor gets a condition item change to `hidden`, `undetected`, or `unnoticed`. This typically comes from using 'Assign Status Effects' on the token HUD; I use it to quickly clear out pf2e-perception's mix of hidden/undetected states after a token attacks by setting then clearing `hidden` in the token HUD.

# v1.6.0
* Add a setting to disable the requirement that PCs have an active `Avoid Notice` exploration activity to hide at combat start.

# v1.5.0
* Hazards are skipped as targets for avoiding notice and when unhiding combatants. Hazards with `stealth` for initiative still display a list of which combatants they avoid notice from.

# v1.4.1
* Added Eidolons to the pets checked at combat start
* Updated compatibility to 6.2

# v1.4.0
* PCs need to have `Avoid Notice` set as an active exploration activity to hide at combat start. NPCs need to have initiative set to `stealth`.
* Stealth is checked against Pet/Familiars of non-allied combatants 

# v1.3.1
* 6.1 compatibility

# v1.3.0
* V12 compatibility
* Add option to remove GM hidden state on noticed combatants at combat start.

# v1.2.3
* Fix failed stealth to follow Sneak rules

# v1.2.2
* Localize the tooltips
* Added a schema setting to help with any future data migrations

# v1.2.1
* Added tooltip for cover adjustments

# v1.2.0
* Look for built-in cover effect if not using PF2e Perception
* If enabled, let PF2e Perception autocalculate cover at combat start
* Show cover adjustments on initiative message

# v1.1.1
* Improvements to README.md and table format

# v1.1.0
* Put detection results in a table for better viewing

# v1.0.1
* Restore the tooltips on adjusted stealth initiative chat messages
* More robust tooltip generation
* Removed some code duplication

# v1.0.0
* Use any PF2e-perception cover bonuses on perception DC

# v0.9.0
* Add setting allowing the module to override existing PF2e-perception visibility flags

# v0.8.0
* Add settings to control logging and use of Unnoticed
* Add english localization file
* Clean up code

# v0.7.0
* Update PF2e-Perspective's flags (if it's active) for those combatants rolling initiative with Stealth

# v0.6.0
* Don't show results on player-rolled initiative cards

# v0.5.0
* Group results by detection type

# v0.4.0
* Use Unnoticed if stealth initiative beats perception initiative

# v0.3.0
* Use templates to format the chat info

# v0.2.0
* Better formatting of detection status

# v0.1.0
* Update initiative cards with detection statuses

# v0.0.0
* Initial implementation