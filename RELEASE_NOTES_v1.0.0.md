# Proxya Anty 1.0.0

First release of the Proxya Anty desktop antidetect browser, automation SDKs,
MCP server and Docker runtime.

## Install

### Windows x64

- `Proxya-Anty-1.0.0-Windows-x64-Setup.exe` — standard installer.
- `Proxya-Anty-1.0.0-Windows-x64.msi` — MSI package.
- `Proxya-Anty-1.0.0-Windows-x64-Portable.zip` — local data beside the app.

Windows builds are not yet Authenticode-signed. SmartScreen can show “Unknown
publisher”; verify the SHA-256 before choosing **Run anyway**.

### macOS Apple Silicon

- `Proxya-Anty-1.0.0-macOS-arm64.dmg` — drag into Applications.
- `Proxya-Anty-1.0.0-macOS-arm64-Portable.zip` — portable app and data folder.

The build is ad-hoc signed and not notarized. See
[Install on macOS](docs/mac-installation.md) for the one-time Gatekeeper step.
Intel Macs are not supported in 1.0.0.

### SDKs and Docker

```bash
npm install proxya-anty
npx -y proxya-anty-mcp
pip install proxya-anty
docker pull proxya/anty:1.0.0
```

## SHA-256

```text
b54ac5a9100fcc14ba46980cfea502d41ba84ecf2db6b7c28ea134a75701e53f  Proxya-Anty-1.0.0-Windows-x64-Setup.exe
3a0ca1cecf208020129f9604e70e4a038d8d02923895f8aec4bcff12bed3a678  Proxya-Anty-1.0.0-Windows-x64.msi
4d8f526bf1b76c96728bfb3f7a1d651190a5aa06ef2f7c3b5ef1861be14bd4f8  Proxya-Anty-1.0.0-Windows-x64-Portable.zip
cb15cb3fea532688129c1260638efce80f00bcac3d3c4fe22892b8c1f31decbc  Proxya-Anty-1.0.0-macOS-arm64.dmg
72d01ce79345f8731ed4faf7d684fc9c65f2360f76827206d120aed020d94234  Proxya-Anty-1.0.0-macOS-arm64-Portable.zip
```

## Verification summary

- native acceptance: 29/29;
- leak suite: 11/11;
- local API: 42/42;
- MCP: 11/11;
- Node.js SDK: 19/19;
- Python SDK: 20/20;
- Rust launcher: 123/123;
- Docker self-test: 13/13.

Engine downloads are signed separately and verified by the launcher before
installation. Report regressions with the site, platform and profile OS, but
never attach cookies, proxy credentials or API tokens.
