# Contributing

This repository accepts changes to the public Node.js SDK, Python SDK, MCP
server and their documentation. The desktop launcher, fingerprint catalogue,
Chromium patches and engine are maintained in a separate private tree and are
not part of the contribution surface.

## Before opening a pull request

1. Do not include tokens, cookies, proxy credentials, account data or binary
   engine/application files.
2. Keep the SDK clients dependency-light and compatible with the authenticated
   loopback API.
3. Run the public CI checks locally where possible:

   ```bash
   node --check sdk/node/index.mjs
   python -m py_compile sdk/python/proxya_anty.py
   npm --prefix mcp ci
   npm --prefix mcp audit --omit=dev
   ```

4. Explain the user-visible change and add a regression check when behavior
   changes.

For browser detection regressions, open an issue with the site, platform,
profile OS and proxy type. Do not publish a live user session or credentials.
