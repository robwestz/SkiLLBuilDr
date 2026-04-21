# Privacy Policy — Skill Browser

**Last updated:** 2026-04-21

Skill Browser is a local, offline tool. By default it collects no data and makes no network requests.

## Analytics (opt-in only)

If you choose to share anonymous usage data, Skill Browser sends events to **PostHog** (EU region, `eu.i.posthog.com`). Analytics are **disabled by default** and only activate after you explicitly opt in via the welcome screen or the ⚙ Settings panel.

### What is collected

| Event | Properties sent |
|---|---|
| `app.opened` | Viewport width/height, theme (dark/light) |
| `tab.switched` | Previous tab name, new tab name |
| `filter.changed` | Filter facet name (e.g. "category"), selected value |
| `basket.action` | Operation (add/remove/clear), basket item count |
| `deeplink.arrived` | Hash key names present in the URL (e.g. ["tab","q"]) |

### What is never collected

- Source names, plugin names, or skill slugs you browse or add to basket
- Search query text
- Clipboard content
- Any personally identifiable information (name, email, IP address is not stored by PostHog in EU memory-only mode)
- File system paths

### Storage

Analytics events are sent in memory (`persistence: "memory"`) — no cookies, no `localStorage` analytics data. Your opt-in preference is stored in your browser's `localStorage` under `skillbrowser.settings.v1.analyticsOptIn`.

## Changing your preference

Open ⚙ **Settings** at any time and toggle "Share anonymous usage data" on or off. Selecting "Clear all stored data" in Settings removes your preference and all other stored state.

## Third-party processor

When opted in, events are processed by [PostHog](https://posthog.com) (EU region). PostHog's privacy policy: <https://posthog.com/privacy>
