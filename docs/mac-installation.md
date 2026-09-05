# Install Proxya Anty on macOS

The 1.0.5 build supports Apple Silicon (M1 and newer). It is ad-hoc signed but
not notarized with an Apple Developer ID, so Gatekeeper can show “developer
cannot be verified” or “app is damaged” after download.

## DMG installation

1. Open `Proxya-Anty_1.0.5_aarch64.dmg`.
2. Drag **Proxya Anty** into **Applications**.
3. In Terminal run once:

   ```bash
   xattr -dr com.apple.quarantine "/Applications/Proxya Anty.app"
   ```

4. Open Proxya Anty normally.

Alternatively, try to open the app once, then go to **System Settings →
Privacy & Security** and choose **Open Anyway**. On older macOS versions,
Control-click the app, choose **Open**, then confirm.

## Portable ZIP

Extract the archive and keep `Proxya Anty.app` beside its `proxya-data`
folder. Clear quarantine from the extracted folder:

```bash
xattr -dr com.apple.quarantine ~/Downloads/Proxya\ Anty
```

The portable folder contains profiles, cookies and local state. Secret-bearing
files are encrypted with a key held by macOS Keychain, so copying the folder to
another Mac does not transfer account access or proxy passwords. Protect it
like browser data and do not rename or separate `proxya-data` from the app.

Until the app has a stable Apple Developer ID signature, an update may ask once
for permission to reuse the previous build's Keychain item. Allow access so the
new build can read the already encrypted settings.

On first launch the application downloads and verifies the macOS engine. The
download is about 160 MB compressed.
