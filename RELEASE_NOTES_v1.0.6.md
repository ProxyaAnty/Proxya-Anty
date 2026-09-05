# Proxya Anty 1.0.6

This release adds extensions, and everything 1.0.5 added.

## Highlights

- **Extensions.** Add one from a Chrome Web Store link, a `.crx`, a `.zip` or
  a folder you unpacked yourself, then tick it in the profiles that should
  load it. Name, version, description and icon come from the extension's own
  manifest — including localised ones — so what the list shows is what the
  browser loads.
- **A profile's extensions are its own.** Each profile loads its own copy, so
  the same extension carries a different identity in every profile. Websites
  can see that an extension is present; they cannot use it to tell that two
  profiles are the same machine.
- An extension the browser would refuse is refused here instead, with the
  reason. Chromium drops a manifest it dislikes in silence, which leaves
  someone staring at an extension that simply never loads.

Everything from 1.0.5 is included: the identity readout in the profile editor,
the two ways of drawing a device, measured proxy exits, the launch page that
reports where a profile comes out, and location resolved through Proxya's own
service.

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
- Rust launcher: 154/154;
- Chromium switch audit against the shipped engine: passed;
- WebRTC: no address outside the proxy;
- QUIC over SOCKS5: carried.
