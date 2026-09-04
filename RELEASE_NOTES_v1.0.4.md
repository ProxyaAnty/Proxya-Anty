# Proxya Anty 1.0.4

This release adds WebRTC support for proxied profiles and geolocation that
follows the proxy exit.

## Highlights

- WebRTC now works on a proxied profile and reports the proxy's exit address.
  Earlier releases could only switch it off, which kept the real address safe
  and left the profile without candidates at all.
- Geolocation follows the proxy exit when a page is allowed to ask for it, and
  is refused immediately when it is not. It no longer leaves the request
  unanswered until the page times out.
- The launcher passes only Chromium switches the shipped engine accepts, and
  `npm run switches:check` verifies that against the engine binary.
- Profiles created in a batch no longer repeat the same device, and never
  claim the graphics card of the machine they run on.
- Interrupted engine updates no longer leave their working copies behind.

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
- Rust launcher: 149/149;
- Chromium switch audit against the shipped engine: passed;
- npm dependency audit: 0 vulnerabilities.
