# Changelog

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
