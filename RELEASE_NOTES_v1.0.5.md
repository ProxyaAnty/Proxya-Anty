# Proxya Anty 1.0.5

This release makes what a profile will look like visible before it is created,
and what a proxy's exit looks like visible before it is used.

## Highlights

- The profile editor shows the resulting identity beside the form — platform,
  user agent, proxy, timezone, language, geolocation, hardware and every masked
  surface — so a profile that contradicts itself can be seen rather than found
  later.
- Two ways to draw a device: across the whole library, or restricted to
  hardware resembling the machine the profile runs on. Neither can produce the
  graphics card actually installed there.
- A bound proxy is checked while the profile is being made. Its exit address,
  location, network operator and whether it carries UDP are known before the
  profile exists.
- Proxies report the operating system and network path of their exit, in the
  proxy list and beside every profile bound to one. A residential address
  behind a tunnel is marked.
- An optional page on launch states where the profile comes out, and warns when
  its timezone does not belong to that exit — the mismatch that costs a score
  on most checkers and is otherwise invisible.
- Location and timezone for a proxy exit are resolved through Proxya's own
  service by default, with the previous providers kept as fallbacks and
  selectable in Settings.

## Downloads

- Windows x64: installer, MSI and portable ZIP.
- macOS Apple Silicon: DMG, app ZIP and portable ZIP.
- Linux x64: AppImage, DEB and RPM.

The Windows packages are not Authenticode-signed and the macOS build is ad-hoc
signed, not notarized. Verify every download against the published
`SHA256SUMS.txt` file.

## Verification summary

- native browser acceptance: 43/43;
- leak suite: 11/11 on Windows, macOS and Linux;
- local API: 42/42;
- Rust launcher: 150/150;
- Chromium switch audit against the shipped engine: passed;
- WebRTC: no address outside the proxy;
- QUIC over SOCKS5: carried.
