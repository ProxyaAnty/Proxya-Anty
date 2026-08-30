/**
 * Keep the DevTools Runtime agent switched off while a page is running.
 *
 * A page cannot see the protocol, but it can see what an enabled Runtime agent
 * costs. Measured on this engine: `console.log` runs about fifteen times slower
 * with the agent on — 0.4 ms per two hundred calls against 5.8 ms — because
 * every argument is serialised and written to the debugging socket. A page can
 * time its own console calls, and a bot-detection page reads exactly that. None
 * of it is about the fingerprint: a stock Chrome driven by plain Puppeteer or
 * Playwright fails the same check for the same reason.
 *
 *     your script  ──ws──>  this proxy  ──ws──>  browser
 *
 * Everything is forwarded untouched but one thing. When the client enables the
 * Runtime agent, the enable goes through, the execution contexts it announces
 * are passed on, and then the agent is switched off again without telling the
 * client. `Runtime.evaluate` works perfectly well against a disabled agent, so
 * the client keeps working; the page sees an ordinary browser.
 *
 * The agent comes back for a few milliseconds after each navigation, to catch
 * the new page's contexts, and goes quiet once they stop arriving.
 *
 * No dependencies. Node's global WebSocket is the client half; the server half
 * is here because Node has no built-in one, and adding `ws` to a stealth SDK to
 * save eighty lines is a poor trade.
 *
 *     import { RuntimeGuard } from "./cdpguard.mjs";
 *     const guard = new RuntimeGuard("http://127.0.0.1:9222");
 *     const endpoint = await guard.start();
 *     const browser = await puppeteer.connect({ browserURL: endpoint });
 *     // ... later
 *     await guard.stop();
 */
import http from "node:http";
import crypto from "node:crypto";

/** Ids for messages the guard sends on its own behalf, far above any client's. */
const OUR_ID_BASE = 2_000_000_000;

/**
 * How long to wait for contexts to stop arriving before switching the agent
 * off. Each announcement pushes this back rather than restarting a fixed
 * window: a client creates its isolated world at an unpredictable moment after
 * a navigation, and a window that closed first left that world unaddressable.
 */
const SETTLE_MS = 150;

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

// ---------------------------------------------------------------- framing

function frame(payload) {
  const data = Buffer.from(payload, "utf8");
  const n = data.length;
  let head;
  if (n < 126) {
    head = Buffer.from([0x81, n]);
  } else if (n < 65536) {
    head = Buffer.alloc(4);
    head[0] = 0x81;
    head[1] = 126;
    head.writeUInt16BE(n, 2);
  } else {
    head = Buffer.alloc(10);
    head[0] = 0x81;
    head[1] = 127;
    head.writeBigUInt64BE(BigInt(n), 2);
  }
  return Buffer.concat([head, data]);
}

/**
 * Pull whole frames out of a growing buffer.
 *
 * Returns what it could parse and what is left over: a socket hands over
 * arbitrary slices, and a message that arrives in three pieces is ordinary
 * rather than exceptional.
 */
function parseFrames(buf) {
  const out = [];
  let off = 0;
  for (;;) {
    if (buf.length - off < 2) break;
    const opcode = buf[off] & 0x0f;
    const masked = (buf[off + 1] & 0x80) !== 0;
    let len = buf[off + 1] & 0x7f;
    let p = off + 2;
    if (len === 126) {
      if (buf.length - p < 2) break;
      len = buf.readUInt16BE(p);
      p += 2;
    } else if (len === 127) {
      if (buf.length - p < 8) break;
      len = Number(buf.readBigUInt64BE(p));
      p += 8;
    }
    let mask = null;
    if (masked) {
      if (buf.length - p < 4) break;
      mask = buf.subarray(p, p + 4);
      p += 4;
    }
    if (buf.length - p < len) break;
    const body = Buffer.from(buf.subarray(p, p + len));
    if (mask) for (let i = 0; i < body.length; i++) body[i] ^= mask[i % 4];
    off = p + len;
    if (opcode === 0x1) out.push(body.toString("utf8"));
    else if (opcode === 0x8) out.push(null); // close
  }
  return { messages: out, rest: buf.subarray(off) };
}

// ------------------------------------------------------------------ state

/** What the guard remembers about one client connection. */
class State {
  constructor(browser) {
    this.browser = browser;
    /** Sessions where the client asked for Runtime and believes it is on. */
    this.wantsRuntime = new Set();
    /** Client message id -> session, for enables waiting to be undone. */
    this.pendingEnable = new Map();
    /** "session\0uniqueId" for every context the client has been told about. */
    this.announced = new Set();
    /** One pending switch-off per session, replaced as contexts arrive. */
    this.quietTimers = new Map();
    this.nextId = OUR_ID_BASE;
  }

  send(method, sessionId) {
    const msg = { id: ++this.nextId, method, params: {} };
    if (sessionId) msg.sessionId = sessionId;
    try {
      this.browser.send(JSON.stringify(msg));
    } catch {
      // The connection is going away; nothing here is worth raising.
    }
  }

  scheduleQuiet(sessionId) {
    const key = sessionId ?? "";
    clearTimeout(this.quietTimers.get(key));
    this.quietTimers.set(
      key,
      setTimeout(() => this.send("Runtime.disable", sessionId), SETTLE_MS),
    );
  }

  clearTimers() {
    for (const t of this.quietTimers.values()) clearTimeout(t);
    this.quietTimers.clear();
  }
}

// ------------------------------------------------------------------ guard

export class RuntimeGuard {
  /** @param {string} upstreamHttp e.g. "http://127.0.0.1:9222" */
  constructor(upstreamHttp) {
    this.upstream = upstreamHttp.replace(/\/+$/, "");
    this.path = "/devtools/browser/" + crypto.randomBytes(16).toString("hex");
    this.server = null;
    this.port = null;
    this.sockets = new Set();
  }

  /** Start listening; resolves to the http endpoint to connect a client to. */
  async start() {
    this.server = http.createServer((req, res) => this.#http(req, res));
    this.server.on("upgrade", (req, socket) => this.#upgrade(req, socket));
    await new Promise((resolve) => this.server.listen(0, "127.0.0.1", resolve));
    this.port = this.server.address().port;
    return `http://127.0.0.1:${this.port}`;
  }

  async stop() {
    for (const s of this.sockets) s.destroy();
    this.sockets.clear();
    if (this.server) await new Promise((r) => this.server.close(r));
    this.server = null;
  }

  async #http(req, res) {
    // Clients ask for "/json/version" with and without a trailing slash.
    const path = (req.url ?? "/").replace(/\/+$/, "") || "/";
    if (!["/json/version", "/json/list", "/json"].includes(path)) {
      res.writeHead(404).end("not found\n");
      return;
    }
    let body;
    try {
      body = await (await fetch(this.upstream + path)).json();
    } catch (err) {
      res.writeHead(502).end(`upstream unreachable: ${err}\n`);
      return;
    }
    // Point the client at us rather than at the browser, whatever shape it is.
    const mine = `ws://127.0.0.1:${this.port}${this.path}`;
    if (Array.isArray(body)) {
      for (const item of body) {
        if (item && item.webSocketDebuggerUrl) item.webSocketDebuggerUrl = mine;
      }
    } else if (body && body.webSocketDebuggerUrl) {
      body.webSocketDebuggerUrl = mine;
    }
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(body));
  }

  async #upgrade(req, socket) {
    const key = req.headers["sec-websocket-key"];
    if (!key) {
      socket.destroy();
      return;
    }
    const accept = crypto.createHash("sha1").update(key + WS_GUID).digest("base64");
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
        "Upgrade: websocket\r\nConnection: Upgrade\r\n" +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
    socket.setNoDelay(true);
    this.sockets.add(socket);

    // Node's own WebSocket, which is the client half of this proxy.
    //
    // It landed as a global in Node 22. On 18 and 20 it is simply not there,
    // and this used to fail the way anything inside a bare `catch` fails: the
    // socket was destroyed and the driver saw a connection close with no
    // reason given. Worse, it only happened once a driver actually connected —
    // `launchEngine` returned an endpoint that looked fine and broke on first
    // use. Our own container shipped Node 18 for a while, so this was reachable
    // out of the box.
    if (typeof WebSocket === "undefined") {
      socket.destroy();
      throw new Error(
        "this Node has no global WebSocket, which the runtime guard needs as " +
          `its client half — it became a global in Node 22 and this is ${process.version}. ` +
          "Upgrade Node, or pass { guardRuntime: false } and connect your driver " +
          "straight to the engine.",
      );
    }

    let browserWs;
    try {
      const info = await (await fetch(this.upstream + "/json/version")).json();
      browserWs = new WebSocket(info.webSocketDebuggerUrl);
    } catch (err) {
      // Still swallowed, but only for what this catch is actually for: the
      // browser going away between the handshake and the upstream connect.
      socket.destroy();
      return;
    }

    const state = new State(browserWs);
    const queued = [];
    let open = false;

    browserWs.addEventListener("open", () => {
      open = true;
      for (const m of queued.splice(0)) browserWs.send(m);
    });
    browserWs.addEventListener("message", (ev) => {
      const raw = typeof ev.data === "string" ? ev.data : String(ev.data);
      this.#fromBrowser(raw, state, socket);
    });
    const shut = () => {
      state.clearTimers();
      socket.destroy();
      this.sockets.delete(socket);
    };
    browserWs.addEventListener("close", shut);
    browserWs.addEventListener("error", shut);

    let buf = Buffer.alloc(0);
    socket.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      const { messages, rest } = parseFrames(buf);
      buf = rest;
      for (const raw of messages) {
        if (raw === null) {
          try {
            browserWs.close();
          } catch {
            /* already closing */
          }
          return;
        }
        const out = this.#fromClient(raw, state);
        if (open) browserWs.send(out);
        else queued.push(out);
      }
    });
    socket.on("close", () => {
      state.clearTimers();
      this.sockets.delete(socket);
      try {
        browserWs.close();
      } catch {
        /* already closing */
      }
    });
    socket.on("error", shut);
  }

  /** Client -> browser. Nothing is rewritten; enables are remembered. */
  #fromClient(raw, state) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return raw;
    }
    if (msg.method === "Runtime.enable") {
      state.wantsRuntime.add(msg.sessionId ?? "");
      state.pendingEnable.set(msg.id, msg.sessionId);
    } else if (msg.method === "Runtime.disable") {
      state.wantsRuntime.delete(msg.sessionId ?? "");
    }
    return raw;
  }

  /** Browser -> client. Our own bookkeeping never reaches the client. */
  #fromBrowser(raw, state, socket) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      socket.write(frame(raw));
      return;
    }

    if (typeof msg.id === "number" && msg.id >= OUR_ID_BASE) return;

    if (msg.id !== undefined && state.pendingEnable.has(msg.id)) {
      const sessionId = state.pendingEnable.get(msg.id);
      state.pendingEnable.delete(msg.id);
      socket.write(frame(raw));
      state.scheduleQuiet(sessionId);
      return;
    }

    const sessionId = msg.sessionId;
    const key = (sessionId ?? "") + "\0";

    if (msg.method === "Runtime.executionContextCreated") {
      // Switching the agent on again re-announces every context that already
      // exists, and a client that hears about the same context twice does not
      // treat the second one as a repeat — Playwright rebuilt its bookkeeping
      // and lost the isolated world it reads a page's title from, so
      // `page.title()` came back empty while everything else still worked.
      const uid = msg.params?.context?.uniqueId;
      if (uid !== undefined) {
        if (state.announced.has(key + uid)) return;
        state.announced.add(key + uid);
      }
      if (state.wantsRuntime.has(sessionId ?? "")) state.scheduleQuiet(sessionId);
    } else if (msg.method === "Runtime.executionContextDestroyed") {
      state.announced.delete(key + msg.params?.executionContextUniqueId);
    } else if (msg.method === "Runtime.executionContextsCleared") {
      for (const k of [...state.announced]) {
        if (k.startsWith(key)) state.announced.delete(k);
      }
    } else if (
      msg.method === "Page.frameNavigated" ||
      msg.method === "Page.navigatedWithinDocument"
    ) {
      // A navigation replaces the execution context, and the client will not
      // hear about the new one while the agent is off.
      if (state.wantsRuntime.has(sessionId ?? "")) {
        state.send("Runtime.enable", sessionId);
        state.scheduleQuiet(sessionId);
      }
    }

    socket.write(frame(raw));
  }
}

export default RuntimeGuard;
