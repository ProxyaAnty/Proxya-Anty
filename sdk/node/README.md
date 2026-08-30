# Proxya Anty SDK

This package controls a running Proxya Anty application through its loopback
API. Copy the API token from the application's Settings page and set:

```bash
export PROXYA_ANTY_API_TOKEN="..."
```

The engine, licence checks and signed fingerprint catalogue remain managed by
the desktop application; this package does not contain or launch them directly.
