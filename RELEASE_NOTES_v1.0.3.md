# Proxya Anty 1.0.3

This security and consistency update removes the visible unsupported-command-
line warning and fixes the shared/real fingerprint defaults in newly created
profiles.

## Highlights

- No unsupported Chromium flag banner; CDP sessions keep
  `navigator.webdriver === false` by using a concrete loopback port.
- New and duplicated profiles get independent, stable private values for
  Canvas, WebGL, Audio and ClientRects.
- Proxied DNS is fail-closed without local port-53 traffic, and WebRTC gathers
  no candidates outside the proxy.
- Live cookie export asks Chromium directly, including app-bound cookies.
- Updated Tauri, React, TypeScript and MCP dependencies with zero npm audit
  vulnerabilities.

## Downloads

- Windows x64: installer, MSI and portable ZIP.
- macOS Apple Silicon: DMG, app ZIP and portable ZIP.
- Linux x64: AppImage, DEB and RPM.

The Windows packages are not Authenticode-signed and the macOS build is ad-hoc
signed, not notarized. Verify every download against the published
`SHA256SUMS.txt` file.

## Verification summary

- native browser acceptance: 43/43;
- leak suite: 11/11;
- local API: 42/42;
- MCP: 11/11;
- Node.js SDK: 19/19;
- Python SDK: 20/20;
- Rust launcher: 142/142;
- concurrency/backpressure: 17/17 with 2,000 queued jobs;
- public GitHub CI reproduction: passed;
- npm dependency audit: 0 vulnerabilities.
