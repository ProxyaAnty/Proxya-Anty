# Proxya Anty MCP server

Control profiles, proxies, cookies and running browser sessions from MCP
clients such as Claude Desktop and Cursor. The server talks only to the
authenticated loopback API exposed by the running Proxya Anty desktop app.

```bash
npx -y proxya-anty-mcp
```

Copy the URL and token from **Settings → Local API**:

```json
{
  "mcpServers": {
    "proxya-anty": {
      "command": "npx",
      "args": ["-y", "proxya-anty-mcp"],
      "env": {
        "PROXYA_ANTY_URL": "http://127.0.0.1:40427",
        "PROXYA_ANTY_TOKEN": "copy from the application"
      }
    }
  }
}
```

The package contains the MCP bridge only. It does not contain the browser
engine, fingerprint catalogue, desktop source or release credentials.
