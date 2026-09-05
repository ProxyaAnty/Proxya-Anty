# Changelog

## 1.0.5 — 2026-09-05

- The profile editor now shows the identity it is about to create beside the
  form: platform, user agent, proxy, timezone, language, geolocation, hardware
  and every masked surface, updated as the form changes.
- Added two ways to draw a device — one that reaches across the whole library,
  and one that keeps to hardware resembling the machine the profile runs on.
  Neither can produce the graphics card actually installed there.
- The proxy a profile is bound to is now checked while the profile is being
  made, so its exit address, location and whether it carries UDP are known
  before the profile is created rather than after.
- Proxies now report the operating system and network path of their exit, in
  the proxy list and beside every profile bound to one.
- Added an optional page on launch that states where the profile comes out and
  warns when its timezone does not belong to that exit.
- Location and timezone for a proxy exit are now resolved through Proxya's own
  service by default.
- Settings and the profile list were reorganised around what is used most.

## 1.0.4 — 2026-09-04

- Added WebRTC support for profiles bound to a proxy: candidates report the
  proxy's exit address instead of being suppressed entirely.
- Added geolocation that follows the proxy exit once a page has permission,
  and an immediate refusal when it does not.
- Removed Chromium command-line switches and feature names the shipped engine
  does not accept, and added `npm run switches:check` to keep it that way.
- Devices are no longer repeated across profiles created in sequence, and a
  new profile never claims the host machine's graphics card.
- Interrupted engine updates now clean up the trees they leave behind.

## 1.0.3 — 2026-09-03

- Removed Chromium command-line switches that displayed an unsupported-flag
  warning while retaining fail-closed DNS, WebRTC and automation protection.
- New and duplicated profiles now receive independent private Canvas, WebGL,
  Audio and ClientRects identities instead of inheriting a shared real-value
  template.
- Added live cookie export through Chromium, including cookies that cannot be
  decrypted by an external SQLite reader.
- Added real DNS NetLog regression coverage and expanded native acceptance to
  43 checks.
- Updated the React, TypeScript, Tauri and MCP dependency graphs and cleared
  npm security advisories.

## 1.0.1 — 2026-09-02

- Added Windows, macOS Apple Silicon and Linux desktop release packages.
- Added proxy editing, protocol switching, automatic preflight and clearer
  country/protocol presentation throughout profiles and the proxy library.
- Added SOCKS5 UDP relay and QUIC/HTTP3 support with fail-closed fallback for
  proxies that cannot carry UDP.
- Added human-like context-menu text insertion and smoother profile reordering.
- Added resource-aware browser limits, queue backpressure and a 2,000-job
  concurrency gate for SDK, MCP, npm and Docker workloads.
- Hardened encrypted local storage, release integrity checks, update links and
  cross-platform packaging tests.

## 1.0.0 — 2026-08-30

- First public SDK/MCP release.
- Desktop profile manager for Windows x64 and macOS Apple Silicon.
- Signed Chromium 152.0.7977.54 engines for Windows, macOS and Linux.
- Curated library of 168 coherent device fingerprints.
- Authenticated local API, Node.js SDK, Python SDK and 39-tool MCP server.
- Docker self-test and public detection regression coverage.
