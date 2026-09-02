"""Proxya Anty — Python client.

    from proxya_anty import ProxyaAnty

    anty = ProxyaAnty()
    profile = anty.create_profile(platform="windows", proxy="socks5://u:p@host:1080")
    started = anty.start(profile["id"], headless=True)
    # hand started["cdp"]["web_socket_debugger_url"] to playwright or a raw WS
    anty.stop(profile["id"])

It talks to a running launcher rather than embedding one, so profiles, proxies
and the engine are shared with the desktop window: anything a script creates is
visible there, and anything created there is usable here.

Copy the API token from the launcher's Settings page into
``PROXYA_ANTY_API_TOKEN``, or pass ``port=`` and ``token=`` explicitly. The SDK
never reads the launcher's encrypted settings file.

Standard library only — no dependencies to install into a scraper's environment.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import platform as _platform
import time
import urllib.error
import urllib.request
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator


def _config_dir() -> Path:
    system = _platform.system()
    if system == "Windows":
        return Path(os.environ.get("APPDATA", "")) / "proxya-anty"
    if system == "Darwin":
        return Path.home() / "Library" / "Application Support" / "proxya-anty"
    base = os.environ.get("XDG_CONFIG_HOME") or (Path.home() / ".config")
    return Path(base) / "proxya-anty"


class ProxyaAntyError(RuntimeError):
    """Anything the launcher refused, carrying its own wording."""


class ProxyaAnty:
    def __init__(
        self,
        port: int | None = None,
        secret: str | None = None,
        token: str | None = None,
        base_url: str | None = None,
    ) -> None:
        self.port = port or int(os.environ.get("PROXYA_ANTY_API_PORT", "40427"))
        self.token = token or os.environ.get("PROXYA_ANTY_API_TOKEN", "")
        self.secret = secret or ""
        if not self.token and not self.secret:
            raise ProxyaAntyError(
                "No API token. Copy it from Proxya Anty Settings, then set "
                "PROXYA_ANTY_API_TOKEN or pass token=."
            )
        self.base_url = base_url or f"http://127.0.0.1:{self.port}"

    # ---------------------------------------------------------------- plumbing

    def _token(self) -> str:
        """A short-lived bearer, minted per call rather than held."""

        if self.token:
            return self.token

        def b64(raw: bytes) -> str:
            return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()

        now = int(time.time())
        head = b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
        body = b64(
            json.dumps(
                {"sub": "proxya-anty", "iat": now, "exp": now + 300},
                separators=(",", ":"),
            ).encode()
        )
        signing = f"{head}.{body}".encode()
        sig = b64(hmac.new(self.secret.encode(), signing, hashlib.sha256).digest())
        return f"{head}.{body}.{sig}"

    def _call(self, route: str, method: str = "GET", body: Any = None) -> Any:
        data = json.dumps(body).encode() if body is not None else None
        request = urllib.request.Request(
            self.base_url + route,
            data=data,
            method=method,
            headers={
                "Authorization": f"Bearer {self._token()}",
                "Content-Type": "application/json",
            },
        )
        try:
            # No proxy handler: a proxy configured in the environment must not
            # swallow a request to our own loopback.
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
            with opener.open(request, timeout=120) as response:
                text = response.read().decode()
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode()
            try:
                raise ProxyaAntyError(json.loads(detail).get("error", detail)) from None
            except json.JSONDecodeError:
                raise ProxyaAntyError(detail or str(exc)) from None
        except urllib.error.URLError as exc:
            raise ProxyaAntyError(
                f"Proxya Anty is not answering on {self.base_url}. "
                f"Is the launcher running with its API enabled? ({exc.reason})"
            ) from None
        return json.loads(text) if text else None

    # ------------------------------------------------------------------ status

    def health(self) -> dict:
        return self._call("/health")

    def engine(self) -> dict:
        return self._call("/engine")

    # ---------------------------------------------------------------- profiles

    def profiles(self) -> list[dict]:
        return self._call("/profiles")

    def profile(self, profile_id: str) -> dict:
        return self._call(f"/profiles/{profile_id}")

    def create_profile(self, **spec: Any) -> dict:
        """Create a profile. ``platform``, ``fingerprint_id``, ``proxy``,
        ``proxy_id``, ``name`` and ``folder`` are all optional; the device is
        drawn from the library so every signal agrees."""
        return self._call("/profiles", "POST", spec)

    def edit_profile(self, profile_id: str, **changes: Any) -> dict:
        return self._call(f"/profiles/{profile_id}", "PATCH", changes)

    def delete_profile(self, profile_id: str) -> dict:
        return self._call(f"/profiles/{profile_id}", "DELETE")

    def start(self, profile_id: str, headless: bool = False) -> dict:
        """Launch, returning ``{"pid": ..., "cdp": {...}}``."""
        flag = "true" if headless else "false"
        return self._call(f"/profiles/{profile_id}/start?headless={flag}&cdp=true", "POST")

    def stop(self, profile_id: str) -> dict:
        return self._call(f"/profiles/{profile_id}/stop", "POST")

    def running(self) -> list[dict]:
        return self._call("/running")

    # ---------------------------------------------------- persistent job queue

    def queue_status(self) -> dict:
        return self._call("/jobs/status")

    def jobs(self, status: str | None = None, limit: int = 200) -> list[dict]:
        query = f"?limit={max(1, min(2000, limit))}"
        if status:
            from urllib.parse import quote

            query += f"&status={quote(status)}"
        return self._call(f"/jobs{query}")

    def enqueue_job(self, **spec: Any) -> dict:
        """Persist a scheduled launch/warm-up. Thousands of these are rows in
        the local queue; only the configured number of browsers run at once."""
        return self._call("/jobs", "POST", spec)

    def job(self, job_id: str) -> dict:
        return self._call(f"/jobs/{job_id}")

    def cancel_job(self, job_id: str) -> dict:
        return self._call(f"/jobs/{job_id}/cancel", "POST")

    def delete_job(self, job_id: str) -> dict:
        return self._call(f"/jobs/{job_id}", "DELETE")

    def wait_job(
        self,
        job_id: str,
        poll_seconds: float = 0.5,
        timeout_seconds: float | None = None,
    ) -> dict:
        started = time.monotonic()
        while True:
            job = self.job(job_id)
            if job["status"] in {"completed", "failed", "cancelled"}:
                return job
            if timeout_seconds is not None and time.monotonic() - started >= timeout_seconds:
                raise ProxyaAntyError(f"Timed out waiting for job {job_id}")
            time.sleep(max(0.05, poll_seconds))

    def temporary(self, **spec: Any) -> dict:
        """A profile that deletes itself when its browser closes."""
        spec.setdefault("headless", True)
        return self._call("/profiles/temporary", "POST", spec)

    @contextmanager
    def temporary_session(self, **spec: Any) -> Iterator[dict]:
        """Run a block against a throwaway profile and clean up afterwards,
        whether or not the block raised — the half people forget.

            with anty.temporary_session(platform="macos") as session:
                drive(session["cdp"]["web_socket_debugger_url"])
        """
        started = self.temporary(**spec)
        try:
            yield started
        finally:
            try:
                self.stop(started["profile_id"])
            except ProxyaAntyError:
                pass

    # ----------------------------------------------------------------- proxies

    def proxies(self) -> list[dict]:
        return self._call("/proxies")

    def add_proxy(self, **spec: Any) -> dict:
        return self._call("/proxies", "POST", spec)

    def test_proxy(self, proxy_id: str) -> dict:
        """Measure it: handshake, UDP relay, exit country."""
        return self._call(f"/proxies/{proxy_id}/test", "POST")

    def delete_proxy(self, proxy_id: str) -> dict:
        return self._call(f"/proxies/{proxy_id}", "DELETE")

    # ----------------------------------------------------------------- library

    def fingerprints(self) -> list[dict]:
        return self._call("/fingerprints")

    # ----------------------------------------------------------------- cookies

    def export_cookies(self, profile_id: str) -> dict:
        return self._call(f"/profiles/{profile_id}/cookies")

    def import_cookies(self, profile_id: str, cookies: list[dict]) -> dict:
        return self._call(f"/profiles/{profile_id}/cookies", "POST", {"cookies": cookies})
