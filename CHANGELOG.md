# Changelog

## 0.6.1 — 2026-08-17

- Replace the sidebar filter bar and modal editors with a compact white editor inside each existing three-dot menu.
- Select colors directly and manage labels without leaving the menu.
- Place label badges between the row title and time/actions.
- Persist metadata to `~/.dsh/settings.yaml` and migrate browser-local metadata only after Host acknowledgement.

## 0.6.0 — 2026-08-17

- Add session colors and text labels to the existing session menu.
- Render workspace and session labels inline in the sidebar.
- Add text / `#label` filtering and saved views.
- Persist metadata through the DSH settings namespace with browser fallback.

## 0.4.0 — 2026-08-17

- Add reusable text labels for workspaces.
- Add inline label badges.

## 0.3.0 — 2026-08-17

- Add an eight-color workspace palette and sidebar row accents.

## 0.2.0 — 2026-08-17

- Add **Copy workspace path**.

## 0.1.1 — 2026-08-17

- Add Host `canOpenPath` capability detection.
- Add live Chinese/English locale switching.
- Scope menu styling to the active menu.
- Add clean-checkout `prepack` verification.
- Revalidate cached row identity and redact absolute paths from errors.

## 0.1.0 — 2026-08-17

- Add **打开工作区 / Open workspace** to the existing workspace-row three-dot menu.
- Open the canonical workspace directory through DSH's public `workspaces.openPath()` capability.
