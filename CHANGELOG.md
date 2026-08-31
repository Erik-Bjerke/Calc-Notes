# Changelog

Notable changes to Numori Notes. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed

- **Upgraded to Numori UI 0.3.0 and moved shared UI out of the app.** Four local
  components were replaced by the design system's new primitives (behaviour and
  appearance preserved) and deleted:
  - `ToastNotification` → `UiToast`. The `useToast` composable is unchanged; its
    `{ id, message, type, icon }` objects feed straight into the shared component.
  - `OfflineIndicator` → `UiBanner` (warning colour, `mdi:wifi-off`).
  - `EmailVerificationBanner` → `UiBanner` (clickable, `mdi:email-alert-outline`),
    still opening the verification modal on tap.
  - `ThemeSwitcher` → `UiThemeToggle`. The shared toggle is stateless, so the
    shared-note page now owns the `@nuxtjs/color-mode` wiring.
- **`SyncIndicator` now renders `UiSpinner`** instead of a hand-rolled spinning
  icon, keeping the floating puck but sharing the spinner.

### Notes

- `UpdateNotification` stays bespoke: its web/native layouts and update flow are
  application-specific and not a duplicate of any single library primitive.
