# Proxya Anty 1.0.1

This release brings the desktop application and native Chromium engine to
Windows x64, macOS Apple Silicon and Linux x64, and completes the proxy,
transport, automation and release-hardening work for production use.

## Highlights

- Proxy test and edit actions, protocol switching, editor autofill and
  automatic proxy preflight before a profile is saved.
- Consistent glass-style country and operating-system badges, cleaner Proxya
  order rows, working profile search and animated drag reordering.
- Human-like text insertion from the input context menu with realistic timing.
- SOCKS5 UDP relay and native QUIC/HTTP3 transport. Proxies without UDP fail
  closed to TCP instead of leaking direct traffic.
- Resource-aware browser concurrency, atomic profile reservations, queue
  backpressure and idempotent automation jobs for SDK/MCP/npm/Docker clients.
- Encrypted account, settings and proxy storage; signed engine/catalogue
  verification; GitHub Releases update links and stricter artifact checks.
- The unrequested Automation page was removed from the desktop UI. The local
  authenticated API, SDK and MCP automation interfaces remain available.

## Downloads

### Windows x64

- `proxya-anty-1.0.1-windows-x64-setup.exe` — standard NSIS installer.
- `proxya-anty-1.0.1-windows-x64.msi` — MSI package.
- `proxya-anty-1.0.1-windows-portable.zip` — portable application and data.

The Windows packages are not yet Authenticode-signed. SmartScreen can show
“Unknown publisher”; compare the SHA-256 below before choosing **Run anyway**.

### macOS Apple Silicon

- `Proxya-Anty_1.0.1_aarch64.dmg` — drag the app into Applications.
- `Proxya-Anty_1.0.1_aarch64.app.zip` — application bundle ZIP.
- `Proxya-Anty_1.0.1_aarch64_portable.zip` — portable app and data layout.

The macOS build is ad-hoc signed and not notarized. See
[Install on macOS](docs/mac-installation.md) for the one-time Gatekeeper step.
Until a stable Developer ID signature is added, an update can also ask for
permission to reuse the previous build's Keychain item.

### Linux x64

- `proxya-anty-1.0.1-linux-x64.AppImage`
- `proxya-anty-1.0.1-linux-x64.deb`
- `proxya-anty-1.0.1-linux-x64.rpm`

## SHA-256

```text
4a0a40320c3488eb18e6cb369c15ec7bb2150c69f5e4eb37d9441af2f7c4c9ca  proxya-anty-1.0.1-windows-x64-setup.exe
8b3d81700aba0ee32a0cd2c7006014651074c247858d27c1105ca06bc1485b77  proxya-anty-1.0.1-windows-x64.msi
a031a754162edae4dfad5354aff2d32f0e880949ee6e74a34ec4b7bd024ae7e5  proxya-anty-1.0.1-windows-portable.zip
212a2a177ac9dd25eafcc559d2d366d741377a0297da871a13883e552be4f297  Proxya-Anty_1.0.1_aarch64.dmg
1538c84661364314f0d236f0ccec1a4db674b8061abfedcc1eb5b8ed37205e88  Proxya-Anty_1.0.1_aarch64.app.zip
588ed97d77151dc64aac872b5e12e9303eef36f61ebcf6afb407688fb7c118bf  Proxya-Anty_1.0.1_aarch64_portable.zip
533b5662675b974b99a558f29c686a29271dee0deacdd21d94d513a5d9ef5b2c  proxya-anty-1.0.1-linux-x64.AppImage
e79349b0c6e97b7df28c1f3f4623cb98716f4fa9cb1a668a2e6c11642a770ea9  proxya-anty-1.0.1-linux-x64.deb
fc9f3da6c002e3a2291d20dbe2a84732608e720bbdb5b7e43b0d8d16cd6bd3d1  proxya-anty-1.0.1-linux-x64.rpm
```

## Verification summary

- native browser acceptance: 29/29;
- leak suite: 11/11;
- local API: 42/42;
- MCP: 11/11;
- Node.js SDK: 19/19;
- Python SDK: 20/20;
- Rust launcher: 142/142;
- concurrency/backpressure: 17/17 with 2,000 queued jobs;
- npm dependency audit: 0 vulnerabilities.

Engine downloads remain separately signed and are verified before use. Never
attach proxy credentials, cookies, API tokens or account data to bug reports.
