#!/usr/bin/env node
/**
 * An MCP server for Proxya Anty.
 *
 * Two halves, because there are two things worth automating:
 *
 *   * the launcher's own HTTP API — profiles, fingerprints, proxies, folders,
 *     cookies. This is the half that manages identities.
 *   * a launched profile's browser, over the DevTools endpoint the launcher
 *     hands back. This is the half that uses one.
 *
 * The browser half connects to a browser that is already running rather than
 * starting one of its own. That is the whole point: the profile's disguise
 * lives in the engine, and a second browser started by an automation library
 * would have none of it.
 *
 * Configure with two environment variables, both shown in Settings → Local API:
 *
 *   PROXYA_ANTY_URL     default http://127.0.0.1:40427
 *   PROXYA_ANTY_TOKEN   required
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { chromium } from "playwright-core";
import { z } from "zod";

const BASE = (process.env.PROXYA_ANTY_URL || "http://127.0.0.1:40427").replace(/\/$/, "");
const TOKEN = process.env.PROXYA_ANTY_TOKEN || "";

// --------------------------------------------------------------- the API --

async function api(method, path, { body, query } = {}) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    const detail = parsed?.error ?? parsed ?? res.statusText;
    throw new Error(`${method} ${path} -> ${res.status}: ${detail}`);
  }
  return parsed;
}

/** Every tool answers in the same shape, so a client never has to guess. */
const say = (value) => ({
  content: [
    {
      type: "text",
      text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
    },
  ],
});

// ----------------------------------------------------------- the browser --

/**
 * One connection per profile, kept between calls.
 *
 * Reconnecting for every step would be correct and unusably slow: attaching
 * costs a round trip, and a page walked through twenty steps would pay it
 * twenty times.
 */
const attached = new Map();

async function browser(profileId) {
  const held = attached.get(profileId);
  if (held?.browser?.isConnected()) return held;

  const running = await api("GET", "/running");
  const row = running.find((r) => r.profile_id === profileId || r.id === profileId);
  // The launcher reports the endpoint as an object — the websocket URL, the
  // HTTP one, and the port — rather than as a bare string. Reading it as a
  // string produced a connect call with nothing in it, and every browser tool
  // failed identically.
  const cdp = row?.cdp;
  const endpoint =
    typeof cdp === "string" ? cdp : cdp?.web_socket_debugger_url ?? cdp?.http_url;
  if (!endpoint) {
    throw new Error(
      `profile ${profileId} is not running with DevTools exposed — start it with cdp: true`,
    );
  }
  const b = await chromium.connectOverCDP(endpoint);
  const ctx = b.contexts()[0] ?? (await b.newContext());
  const entry = { browser: b, context: ctx };
  attached.set(profileId, entry);
  b.on("disconnected", () => attached.delete(profileId));
  return entry;
}

/** The tab a tool acts on: the one asked for, else the frontmost. */
async function page(profileId, index) {
  const { context } = await browser(profileId);
  const pages = context.pages();
  if (pages.length === 0) return context.newPage();
  if (index === undefined) return pages[pages.length - 1];
  if (index < 0 || index >= pages.length) {
    throw new Error(`no tab ${index}; this profile has ${pages.length}`);
  }
  return pages[index];
}

const server = new McpServer({ name: "proxya-anty", version: "1.0.0" });

const profileArg = z.string().describe("Profile id, from list_profiles.");
const tabArg = z
  .number()
  .int()
  .optional()
  .describe("Tab index; the frontmost tab when omitted.");
const selectorArg = z.string().describe("CSS selector.");

const tool = (name, description, schema, run) =>
  server.tool(name, description, schema, async (args) => {
    try {
      return say(await run(args));
    } catch (err) {
      // Reported rather than thrown: a model that can read the failure can
      // usually fix its own call, where a transport-level error just stops it.
      return { isError: true, content: [{ type: "text", text: String(err.message ?? err) }] };
    }
  });

// ------------------------------------------------------------- identities --

tool("list_profiles", "Every profile, with its device, proxy and whether it is running.", {}, () =>
  api("GET", "/profiles"),
);

tool("get_profile", "One profile in full, including its fingerprint.", { id: profileArg }, ({ id }) =>
  api("GET", `/profiles/${id}`),
);

tool(
  "create_profile",
  "Make a profile. With no fingerprint id the launcher picks a coherent device for the platform.",
  {
    name: z.string().optional(),
    platform: z.enum(["windows", "macos", "linux"]).optional(),
    fingerprint_id: z.string().optional(),
    folder: z.string().optional(),
    proxy: z
      .string()
      .optional()
      .describe("A proxy line such as host:port:user:pass; added to the list if new."),
    proxy_id: z.string().optional(),
  },
  (a) =>
    api("POST", "/profiles", {
      body: {
        name: a.name,
        platform: a.platform,
        fingerprint_id: a.fingerprint_id,
        folder: a.folder,
        proxy: a.proxy,
        proxy_id: a.proxy_id,
      },
    }),
);

tool(
  "create_temporary_profile",
  "Start a throwaway profile: it is hidden from the list and deleted when the browser closes.",
  {
    platform: z.enum(["windows", "macos", "linux"]).optional(),
    proxy: z.string().optional(),
    cdp: z.boolean().optional().describe("Expose DevTools so the browser tools can drive it."),
    headless: z.boolean().optional(),
  },
  (a) => api("POST", "/profiles/temporary", { body: a }),
);

tool(
  "edit_profile",
  "Change a profile's name, notes, folder, proxy, pinned state, or its whole fingerprint.",
  {
    id: profileArg,
    name: z.string().optional(),
    notes: z.string().optional(),
    folder: z.string().optional().describe('"" unfiles it.'),
    proxy_id: z.string().optional().describe('"" unbinds the proxy.'),
    pinned: z.boolean().optional(),
    fingerprint: z.record(z.any()).optional(),
  },
  ({ id, ...rest }) => api("PATCH", `/profiles/${id}`, { body: rest }),
);

tool("delete_profile", "Delete a profile and everything its browser saved.", { id: profileArg }, ({ id }) =>
  api("DELETE", `/profiles/${id}`),
);

tool(
  "start_profile",
  "Launch a profile's browser. Ask for cdp when the browser tools will drive it.",
  {
    id: profileArg,
    cdp: z.boolean().optional(),
    headless: z.boolean().optional(),
  },
  ({ id, cdp, headless }) =>
    api("POST", `/profiles/${id}/start`, { query: { cdp, headless } }),
);

tool("stop_profile", "Close a profile's browser.", { id: profileArg }, ({ id }) =>
  api("POST", `/profiles/${id}/stop`),
);

tool("list_running", "Profiles with a browser open, and their DevTools endpoints.", {}, () =>
  api("GET", "/running"),
);

tool("list_fingerprints", "The device library a profile can be built from.", {}, () =>
  api("GET", "/fingerprints"),
);

tool(
  "new_fingerprint",
  "Generate a fresh coherent device without saving it, to inspect or to pass to create_profile.",
  { platform: z.enum(["windows", "macos", "linux"]).optional() },
  ({ platform }) => api("GET", "/fingerprints/new", { query: { platform } }),
);

tool("list_folders", "Folder names.", {}, () => api("GET", "/folders"));

tool("list_proxies", "Saved proxies.", {}, () => api("GET", "/proxies"));

tool(
  "add_proxy",
  "Add a proxy from a line such as host:port:user:pass.",
  { line: z.string(), name: z.string().optional() },
  ({ line, name }) => api("POST", "/proxies", { body: { proxy: line, name } }),
);

tool("delete_proxy", "Remove a proxy from the list.", { id: z.string() }, ({ id }) =>
  api("DELETE", `/proxies/${id}`),
);

tool("test_proxy", "Check a proxy and report the exit address it comes out on.", { id: z.string() }, ({ id }) =>
  api("POST", `/proxies/${id}/test`),
);

tool("export_cookies", "A profile's cookies.", { id: profileArg }, ({ id }) =>
  api("GET", `/profiles/${id}/cookies`),
);

tool(
  "import_cookies",
  "Load cookies into a profile. Accepts a plain array or the object shape extensions export.",
  { id: profileArg, cookies: z.union([z.array(z.any()), z.record(z.any())]) },
  ({ id, cookies }) =>
    api("POST", `/profiles/${id}/cookies`, {
      // Either shape is accepted from the caller; the launcher wants the jar
      // under a key, so an array is wrapped rather than refused.
      body: Array.isArray(cookies) ? { cookies } : cookies,
    }),
);

tool("engine_status", "Which browser engine the launcher will use.", {}, () => api("GET", "/engine"));

// --------------------------------------------------------------- browsing --

tool(
  "browser_navigate",
  "Go to a URL in a running profile's browser.",
  {
    id: profileArg,
    url: z.string(),
    tab: tabArg,
    wait_until: z.enum(["load", "domcontentloaded", "networkidle", "commit"]).optional(),
  },
  async ({ id, url, tab, wait_until }) => {
    const p = await page(id, tab);
    await p.goto(url, { waitUntil: wait_until ?? "domcontentloaded", timeout: 60_000 });
    return { url: p.url(), title: await p.title() };
  },
);

tool(
  "browser_current",
  "The current URL and title.",
  { id: profileArg, tab: tabArg },
  async ({ id, tab }) => {
    const p = await page(id, tab);
    return { url: p.url(), title: await p.title() };
  },
);

tool(
  "browser_text",
  "The page's visible text, for reading what is on screen.",
  { id: profileArg, tab: tabArg, max: z.number().int().optional() },
  async ({ id, tab, max }) => {
    const p = await page(id, tab);
    const text = await p.evaluate(() => document.body?.innerText ?? "");
    return text.slice(0, max ?? 20_000);
  },
);

tool(
  "browser_html",
  "The page's HTML.",
  { id: profileArg, tab: tabArg, selector: z.string().optional(), max: z.number().int().optional() },
  async ({ id, tab, selector, max }) => {
    const p = await page(id, tab);
    const html = selector ? await p.locator(selector).first().innerHTML() : await p.content();
    return html.slice(0, max ?? 40_000);
  },
);

tool(
  "browser_evaluate",
  "Run JavaScript in the page and return its result.",
  { id: profileArg, tab: tabArg, script: z.string().describe("An expression or a function body.") },
  async ({ id, tab, script }) => {
    const p = await page(id, tab);
    // The script is handed over as a string, so the page evaluates it. Building
    // a function here and calling it ran the code in this process instead:
    // arithmetic happened to work and anything touching `document` came back
    // undefined, which is worse than an error because it looks like an answer.
    try {
      return await p.evaluate(`(${script})`);
    } catch {
      // Not an expression: run it as a body, so `const x = 1; return x` works.
      return p.evaluate(`(() => { ${script} })()`);
    }
  },
);

tool(
  "browser_click",
  "Click the first element matching a selector.",
  { id: profileArg, tab: tabArg, selector: selectorArg, timeout_ms: z.number().int().optional() },
  async ({ id, tab, selector, timeout_ms }) => {
    const p = await page(id, tab);
    await p.locator(selector).first().click({ timeout: timeout_ms ?? 15_000 });
    return { clicked: selector, url: p.url() };
  },
);

tool(
  "browser_fill",
  "Type into a field, replacing what is there.",
  { id: profileArg, tab: tabArg, selector: selectorArg, value: z.string() },
  async ({ id, tab, selector, value }) => {
    const p = await page(id, tab);
    await p.locator(selector).first().fill(value, { timeout: 15_000 });
    return { filled: selector };
  },
);

tool(
  "browser_press",
  "Press a key, such as Enter or Escape.",
  { id: profileArg, tab: tabArg, key: z.string(), selector: z.string().optional() },
  async ({ id, tab, key, selector }) => {
    const p = await page(id, tab);
    if (selector) await p.locator(selector).first().press(key);
    else await p.keyboard.press(key);
    return { pressed: key };
  },
);

tool(
  "browser_select_option",
  "Choose an option in a select element.",
  { id: profileArg, tab: tabArg, selector: selectorArg, value: z.string() },
  async ({ id, tab, selector, value }) => {
    const p = await page(id, tab);
    await p.locator(selector).first().selectOption(value);
    return { selected: value };
  },
);

tool(
  "browser_wait_for",
  "Wait for an element to appear, or for a plain delay.",
  {
    id: profileArg,
    tab: tabArg,
    selector: z.string().optional(),
    ms: z.number().int().optional(),
    state: z.enum(["attached", "detached", "visible", "hidden"]).optional(),
  },
  async ({ id, tab, selector, ms, state }) => {
    const p = await page(id, tab);
    if (selector) {
      await p.locator(selector).first().waitFor({ state: state ?? "visible", timeout: 30_000 });
      return { appeared: selector };
    }
    await p.waitForTimeout(ms ?? 1000);
    return { waited_ms: ms ?? 1000 };
  },
);

tool(
  "browser_screenshot",
  "A PNG of the page, returned as an image.",
  { id: profileArg, tab: tabArg, full_page: z.boolean().optional(), selector: z.string().optional() },
  async ({ id, tab, full_page, selector }) => {
    const p = await page(id, tab);
    const shot = selector
      ? await p.locator(selector).first().screenshot()
      : await p.screenshot({ fullPage: full_page ?? false });
    return { image_base64: shot.toString("base64"), bytes: shot.length };
  },
);

tool(
  "browser_query",
  "How many elements match a selector, and the text of the first few.",
  { id: profileArg, tab: tabArg, selector: selectorArg, limit: z.number().int().optional() },
  async ({ id, tab, selector, limit }) => {
    const p = await page(id, tab);
    const items = p.locator(selector);
    const count = await items.count();
    const take = Math.min(count, limit ?? 20);
    const texts = [];
    for (let i = 0; i < take; i++) texts.push((await items.nth(i).innerText()).trim());
    return { count, texts };
  },
);

tool(
  "browser_attribute",
  "One attribute of the first element matching a selector.",
  { id: profileArg, tab: tabArg, selector: selectorArg, name: z.string() },
  async ({ id, tab, selector, name }) => {
    const p = await page(id, tab);
    return { [name]: await p.locator(selector).first().getAttribute(name) };
  },
);

tool(
  "browser_scroll",
  "Scroll the page.",
  { id: profileArg, tab: tabArg, to: z.enum(["top", "bottom"]).optional(), by: z.number().optional() },
  async ({ id, tab, to, by }) => {
    const p = await page(id, tab);
    await p.evaluate(
      ([to, by]) => {
        if (to === "top") window.scrollTo({ top: 0 });
        else if (to === "bottom") window.scrollTo({ top: document.body.scrollHeight });
        else window.scrollBy({ top: by ?? 600 });
      },
      [to, by],
    );
    return { scrolled: to ?? `${by ?? 600}px` };
  },
);

tool("browser_reload", "Reload the page.", { id: profileArg, tab: tabArg }, async ({ id, tab }) => {
  const p = await page(id, tab);
  await p.reload({ waitUntil: "domcontentloaded" });
  return { url: p.url() };
});

tool("browser_back", "Go back in history.", { id: profileArg, tab: tabArg }, async ({ id, tab }) => {
  const p = await page(id, tab);
  await p.goBack({ waitUntil: "domcontentloaded" });
  return { url: p.url() };
});

tool("browser_tabs", "Every open tab, with its index, URL and title.", { id: profileArg }, async ({ id }) => {
  const { context } = await browser(id);
  return Promise.all(
    context.pages().map(async (p, index) => ({ index, url: p.url(), title: await p.title() })),
  );
});

tool(
  "browser_open_tab",
  "Open a tab, optionally at a URL. Returns its index.",
  { id: profileArg, url: z.string().optional() },
  async ({ id, url }) => {
    const { context } = await browser(id);
    const p = await context.newPage();
    if (url) await p.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    return { index: context.pages().length - 1, url: p.url() };
  },
);

tool(
  "browser_close_tab",
  "Close a tab by index.",
  { id: profileArg, tab: z.number().int() },
  async ({ id, tab }) => {
    const p = await page(id, tab);
    await p.close();
    return { closed: tab };
  },
);

tool(
  "browser_cookies",
  "Cookies as the live browser holds them, which is not the same as the ones saved to disk.",
  { id: profileArg, urls: z.array(z.string()).optional() },
  async ({ id, urls }) => {
    const { context } = await browser(id);
    return context.cookies(urls);
  },
);

// ------------------------------------------------------------------ start --

if (!TOKEN) {
  console.error(
    "PROXYA_ANTY_TOKEN is not set. Copy the token from Proxya Anty → Settings → Local API.",
  );
  process.exit(1);
}

await server.connect(new StdioServerTransport());
