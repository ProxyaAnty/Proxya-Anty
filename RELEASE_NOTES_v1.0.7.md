# Proxya Anty 1.0.7

This release fixes engine installation on macOS.

## What changed

- **macOS installs its engine again.** On 1.0.6 the first-run download ended
  with "verified archive does not contain the expected browser binary" and no
  profile could start. The download, its checksum and its signature were all
  fine; the launcher was wrong about the archive, not the other way round.
  Windows and Linux were not affected.
- When an engine archive is rejected, the message now says what the archive
  held instead of only what was expected.

Everything else is 1.0.6: extensions, the identity readout in the profile
editor, measured proxy exits and the rest. The engine is unchanged
(Chromium 152.0.7977.54), so nothing is downloaded again on Windows or Linux.

## Downloads

- Windows x64: installer, MSI and portable ZIP.
- macOS Apple Silicon: DMG, app ZIP and portable ZIP.
- Linux x64: AppImage, DEB and RPM.

The Windows packages are not Authenticode-signed and the macOS build is ad-hoc
signed, not notarized. Verify every download against the published
`SHA256SUMS.txt` file.

## Verification summary

- Rust launcher: 155/155;
- macOS engine install from the published archive: passed;
- Chromium switch audit against the shipped engine: passed.
