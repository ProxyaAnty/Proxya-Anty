# Security policy

## Supported releases

Security fixes are applied to the current desktop release and the latest major
version of each public SDK package.

## Report a vulnerability privately

Do not open a public issue for vulnerabilities, leaked credentials, licence
bypass, or a finding that includes customer data. Contact Proxya through
[proxya.co/contact](https://proxya.co/contact) and include:

- affected version and platform;
- a minimal reproduction without real account, cookie or proxy credentials;
- expected impact;
- whether the finding has been shared elsewhere.

We will acknowledge a complete report, reproduce it, and coordinate a fix and
disclosure timeline. Please do not access data that is not yours, degrade the
service, or run high-volume tests against production.

## Release integrity

The desktop launcher verifies a detached Ed25519 signature, platform, release
sequence, package SHA-256 and executable-file manifest before accepting an
engine download. Published SHA-256 values detect transfer corruption; the
signature establishes that the manifest came from Proxya.

The private signing key and proprietary browser/launcher source are not part of
this repository. If a release asset does not match its published checksum, do
not run it and report the mismatch privately.
