# PLAN — make the identity settings visible and unambiguous
## Phase 1 Architecture
His report: options hidden in dropdowns; cannot tell what is enabled; wants visible choices and
clear on/off controls.
CHANGED components/admin/settings/IdentitySection.tsx — replace the two <select> menus with
  always-visible choice cards (role=radio, aria-checked), a live state badge next to each heading,
  and an explicit "Not saved yet" marker so pressing a card is never mistaken for saving.
CHANGED app/(admin)/admin/settings/page.tsx — keep a snapshot of the SAVED config and pass it in,
  so unsaved changes can be named rather than guessed at. Update the snapshot after a successful
  save so the marker clears.
No API change, no DB change — same two keys (identity_enabled, identity_mode).
## Phase 2 Tasks
1. Rewrite IdentitySection with visible cards + state + unsaved marker
2. page.tsx: savedCfg snapshot, pass down, refresh on save
3. tsc, tests, build
4. Commit, push, deploy, verify
## Phase 4 Health check: both settings still save and read back; nothing else on the page broke.
