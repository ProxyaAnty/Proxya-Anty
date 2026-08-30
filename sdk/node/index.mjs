/**
 * Proxya Anty — Node client.
 *
 *   import { ProxyaAnty } from "./sdk/node/index.mjs";
 *
 *   const anty = new ProxyaAnty();
 *   const profile = await anty.createProfile({ platform: "windows", proxy: "socks5://u:p@host:1080" });
 *   const { cdp } = await anty.start(profile.id, { headless: true });
 *   // hand cdp.web_socket_debugger_url to puppeteer, playwright, or a raw WS
 *   await anty.stop(profile.id);
 *
 * It talks to a running launcher rather than embedding one: profiles, proxies
 * and the engine are shared with the desktop window, so anything a script
 * creates is visible there and vice versa.
 *
 * Copy the API token from the launcher's Settings page into
 * `PROXYA_ANTY_API_TOKEN`, or pass `{ port, token }` explicitly. The SDK never
 * reads the launcher's encrypted settings file.
 */
import crypto from "node:crypto";

export class ProxyaAnty {
  /**
   * @param {{ port?: number, token?: string, secret?: string, baseUrl?: string }} [options]
   */
  constructor(options = {}) {
    this.port = Number(options.port ?? process.env.PROXYA_ANTY_API_PORT ?? 40427);
    this.token = options.token ?? process.env.PROXYA_ANTY_API_TOKEN ?? "";
    this.secret = options.secret ?? "";
    if (!this.token && !this.secret) {
      throw new Error(
        "No API token. Copy it from Proxya Anty Settings, then set " +
          "PROXYA_ANTY_API_TOKEN or pass { token }.",
      );
    }
    this.baseUrl = options.baseUrl ?? `http://127.0.0.1:${this.port}`;
  }

  /** A short-lived bearer, minted per call rather than held. */
  #token() {
    if (this.token) return this.token;
    const b64 = (b) => Buffer.from(b).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const head = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const body = b64(JSON.stringify({ sub: "proxya-anty", iat: now, exp: now + 300 }));
    const sig = crypto
      .createHmac("sha256", this.secret)
      .update(`${head}.${body}`)
      .digest("base64url");
    return `${head}.${body}.${sig}`;
  }

  async #call(route, init = {}) {
    let res;
    try {
      res = await fetch(this.baseUrl + route, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.#token()}`,
          "Content-Type": "application/json",
          ...(init.headers ?? {}),
        },
      });
    } catch {
      throw new Error(
        `Proxya Anty is not answering on ${this.baseUrl}. Is the launcher running with its API enabled?`,
      );
    }
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(body?.error ?? `${res.status} from ${route}`);
    return body;
  }

  health() {
    return this.#call("/health");
  }
  engine() {
    return this.#call("/engine");
  }

  // ---- profiles ----
  profiles() {
    return this.#call("/profiles");
  }
  profile(id) {
    return this.#call(`/profiles/${id}`);
  }
  createProfile(spec = {}) {
    return this.#call("/profiles", { method: "POST", body: JSON.stringify(spec) });
  }
  editProfile(id, changes) {
    return this.#call(`/profiles/${id}`, { method: "PATCH", body: JSON.stringify(changes) });
  }
  deleteProfile(id) {
    return this.#call(`/profiles/${id}`, { method: "DELETE" });
  }

  /** Launch and return `{ pid, cdp }`. `cdp.web_socket_debugger_url` drives it. */
  start(id, { headless = false } = {}) {
    return this.#call(`/profiles/${id}/start?headless=${!!headless}&cdp=true`, {
      method: "POST",
    });
  }
  stop(id) {
    return this.#call(`/profiles/${id}/stop`, { method: "POST" });
  }
  running() {
    return this.#call("/running");
  }

  /** A profile that deletes itself when its browser closes. */
  temporary(spec = {}) {
    return this.#call("/profiles/temporary", {
      method: "POST",
      body: JSON.stringify({ headless: true, ...spec }),
    });
  }

  // ---- proxies ----
  proxies() {
    return this.#call("/proxies");
  }
  addProxy(spec) {
    return this.#call("/proxies", { method: "POST", body: JSON.stringify(spec) });
  }
  testProxy(id) {
    return this.#call(`/proxies/${id}/test`, { method: "POST" });
  }
  deleteProxy(id) {
    return this.#call(`/proxies/${id}`, { method: "DELETE" });
  }

  // ---- library ----
  fingerprints() {
    return this.#call("/fingerprints");
  }

  // ---- cookies ----
  exportCookies(id) {
    return this.#call(`/profiles/${id}/cookies`);
  }
  importCookies(id, cookies) {
    return this.#call(`/profiles/${id}/cookies`, {
      method: "POST",
      body: JSON.stringify({ cookies }),
    });
  }

  /**
   * Run `fn` against a throwaway profile and clean up afterwards, whether or not
   * it threw. The pattern most scraping wants, and the one people forget the
   * second half of.
   */
  async withTemporary(spec, fn) {
    const started = await this.temporary(spec);
    try {
      return await fn(started);
    } finally {
      await this.stop(started.profile_id).catch(() => {});
    }
  }
}

export default ProxyaAnty;
