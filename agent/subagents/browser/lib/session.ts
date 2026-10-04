/**
 * The worker's Kernel browser: created lazily, reused for the whole task, and
 * kept or deleted according to how the task ends.
 *
 * Two kinds of memory are in play. eve state is durable and survives the hop
 * to another process between steps, so it holds the Kernel session id. The
 * browser-loop pool holds a live CDP socket, so it can only be cached per
 * process and is rebuilt from the session id when a step lands somewhere cold.
 */
import { type BrowserRefState, type KernelBrowser, LoopExecutionResources, type LoopToolResultContent, loop } from "@onkernel/browser-loop";
import Kernel, { NotFoundError } from "@onkernel/sdk";
import { defineState } from "eve/context";
import { type BrowserConfig, readConfig } from "./config";

/**
 * browser-loop's element-level tools. Left out on purpose: `evaluate` (free-form
 * page JavaScript is a way around the final-click rule) and `drag`.
 */
export const WORKER_TOOL_SPECS = [
  loop.tools.browser.navigate(),
  loop.tools.browser.snapshot(),
  loop.tools.browser.text(),
  loop.tools.browser.find(),
  loop.tools.browser.click(),
  loop.tools.browser.fill(),
  loop.tools.browser.type(),
  loop.tools.browser.key(),
  loop.tools.browser.hover(),
  loop.tools.browser.scroll(),
  loop.tools.browser.scrollTo(),
  loop.tools.browser.waitFor(),
  loop.tools.browser.listTabs(),
  loop.tools.browser.newTab(),
  loop.tools.browser.screenshot(),
];

// Kernel ends the browser after this long with no CDP or live view connection.
// Long enough for the owner to notice a text and open the link; short enough
// that a forgotten browser cannot run for hours on the free plan.
const INACTIVITY_TIMEOUT_SECONDS = 30 * 60;

// A Kernel known-good preset. Smaller than the 1920x1080 default so the live
// view is usable on a phone and screenshots cost the model less.
const VIEWPORT = { width: 1280, height: 800, refresh_rate: 60 };

interface WorkerState {
  readonly sessionId: string | null;
  readonly liveViewUrl: string | null;
  /** browser-loop's element refs (e12 and so on), so they survive a cold process. */
  readonly refs: BrowserRefState | null;
  /** The action last reported with needs_approval. An APPROVED line is checked against it. */
  readonly pendingAction: string | null;
}

/** Subagent state is per child session, so a resumed worker finds its own browser again. */
export const workerState = defineState<WorkerState>("steward.browser.worker", () => ({
  sessionId: null,
  liveViewUrl: null,
  refs: null,
  pendingAction: null,
}));

// Kept on globalThis so every tool shares one cache even if eve bundles each
// tool module with its own copy of this file. `finish` must be able to close a
// socket that a browser_* tool opened.
const POOLS_KEY = Symbol.for("steward.browser.pools");
const registry = globalThis as { [POOLS_KEY]?: Map<string, LoopExecutionResources> };
const pools = (registry[POOLS_KEY] ??= new Map<string, LoopExecutionResources>());

/** Runs one browser-loop tool against the task's browser, opening it on first use. */
export async function runLoopTool(name: string, input: unknown, signal?: AbortSignal): Promise<LoopToolResultContent[]> {
  const spec = WORKER_TOOL_SPECS.find((candidate) => candidate.name === name);
  if (!spec) throw new Error(`Unknown browser tool "${name}".`);

  const pool = await ensurePool();
  const result = await pool.materialize(spec).execute(input, signal);
  workerState.update((state) => ({ ...state, refs: pool.browserExecutor().exportRefState() }));
  return result.content;
}

/**
 * Ends the turn's hold on the browser. The CDP socket is always closed, because
 * an open socket counts as activity and would defeat the inactivity timeout
 * while the browser waits for the owner. The browser itself is deleted unless
 * `keepOpen`; deleting is also what saves new logins back to the profile.
 */
export async function releaseBrowser(keepOpen: boolean): Promise<void> {
  const { sessionId } = workerState.get();
  if (!sessionId) return;

  await pools.get(sessionId)?.dispose();
  pools.delete(sessionId);
  if (keepOpen) return;

  try {
    await kernelClient(readConfig()).browsers.deleteByID(sessionId);
  } catch (error) {
    // Already gone (timed out) is the outcome we wanted.
    if (!(error instanceof NotFoundError)) throw error;
  }
  workerState.update((state) => ({ ...state, sessionId: null, liveViewUrl: null, refs: null }));
}

async function ensurePool(): Promise<LoopExecutionResources> {
  const config = readConfig();
  const client = kernelClient(config);
  const saved = workerState.get();

  if (saved.sessionId) {
    const cached = pools.get(saved.sessionId);
    if (cached) return cached;
    const browser = await retrieveLiveBrowser(client, saved.sessionId);
    if (browser) return openPool(client, browser, saved.refs);
    // The browser timed out while parked. Fall through to a fresh one on the same profile.
  }

  const browser = await createBrowser(client, config);
  workerState.update((state) => ({
    ...state,
    sessionId: browser.session_id,
    liveViewUrl: browser.browser_live_view_url ?? null,
    refs: null,
  }));
  return openPool(client, browser, null);
}

function kernelClient(config: BrowserConfig): Kernel {
  return new Kernel({ apiKey: config.apiKey });
}

function openPool(client: Kernel, browser: KernelBrowser, refs: BrowserRefState | null): LoopExecutionResources {
  const pool = new LoopExecutionResources({ client, browser });
  if (refs) pool.browserExecutor().importRefState(refs);
  pools.set(browser.session_id, pool);
  return pool;
}

async function retrieveLiveBrowser(client: Kernel, sessionId: string): Promise<KernelBrowser | null> {
  try {
    const browser = await client.browsers.retrieve(sessionId);
    return browser.deleted_at ? null : browser;
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}

async function createBrowser(client: Kernel, config: BrowserConfig): Promise<KernelBrowser> {
  // Kernel requires the profile to exist before a browser can load it.
  try {
    await client.profiles.retrieve(config.profileName);
  } catch (error) {
    if (!(error instanceof NotFoundError)) throw error;
    await client.profiles.create({ name: config.profileName });
  }

  return client.browsers.create({
    // save_changes writes cookies back when the session ends, so a login the
    // owner performs once in the live view is there for every later task.
    profile: { name: config.profileName, save_changes: true },
    stealth: config.stealth,
    // Headful, because only a headful browser has a live view to hand over.
    headless: false,
    timeout_seconds: INACTIVITY_TIMEOUT_SECONDS,
    viewport: VIEWPORT,
    tags: { app: "steward" },
  });
}
