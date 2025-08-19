## [PF2e Avoid Notice](<https://github.com/Eligarf/avoid-notice>)

[module](<https://foundryvtt.com/packages/pf2e-avoid-notice>) 13.6.0

- If compute cover at combat start is enabled and using _PF2e Visioner_ as visibility handler, call getAutoCoverState to get the updated cover status when testing observers vs avoiders.
- Add an opt-in strict mode game setting.
  - I do not recommend enabling this because I'm not going to chase the numerous visibility edge cases and feats that might affect this.
  - I likely won't respond to any bug reports related to something showing up that shouldn't have when strict mode is enabled.
  - Requires avoiders to have explicit cover or concealment conditions from observing tokens in order to become hidden or undetected from them.
  - If there is interest I might create a Hook allowing others to filter the results prior to application to initiative cards or visibility managers.
