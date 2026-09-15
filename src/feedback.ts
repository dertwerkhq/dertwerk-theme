/**
 * In-app feedback: the context a report carries, and the recorder that
 * collects it.
 *
 * The premise is that a usability complaint is worthless detached from its
 * context. "This page is confusing" cannot be acted on a week later unless
 * something also recorded which page, which build, which palette and what the
 * browser was complaining about at the time -- and the person reporting it is
 * precisely the person who cannot tell you any of that. A new user does not
 * know what a route pattern is, will not think to mention that they were in
 * light mode, and has no idea the console logged a 500 behind the dialog they
 * were looking at. So the page reports on itself.
 *
 * Lives in @dertwerk/theme for the same reason the palette does: five apps
 * install it, and five hand-maintained copies of this would drift apart inside
 * a week.
 *
 * Nothing in here is allowed to throw. It runs on every page of every app to
 * serve a reporting feature; breaking the product it is meant to be reporting
 * on would be the worst possible failure mode, so every entry point is
 * wrapped and every failure is swallowed.
 */

export type FeedbackApp = 'farmrx' | 'fsacre' | 'account' | 'admin' | 'landing'
export type FeedbackCategory = 'confusing' | 'broken' | 'suggestion' | 'other'

export interface ConsoleErrorEntry {
  at: string
  kind: 'console' | 'window' | 'promise'
  text: string
}

export interface ApiErrorEntry {
  at: string
  method: string
  path: string
  status: number | null
  detail?: string
}

export interface FeedbackReport {
  app: FeedbackApp
  category: FeedbackCategory
  message: string
  expected?: string | null

  page_path: string
  route_pattern: string | null
  page_url: string
  page_title: string | null
  breadcrumb?: string | null

  build_sha?: string | null
  session_id: string
  palette: string | null
  theme: string | null
  viewport_w: number
  viewport_h: number
  org_id?: string | null

  client: Record<string, unknown>
  console_errors: ConsoleErrorEntry[]
  api_errors: ApiErrorEntry[]
}

/** How much history a report carries. Enough to cover the interaction being
 *  complained about, short enough that a page looping an error cannot grow
 *  the buffer without bound. The server caps it again at the same number --
 *  this one keeps the browser honest, that one keeps the database honest. */
const BUFFER = 20
const MAX_TEXT = 2000

const consoleErrors: ConsoleErrorEntry[] = []
const apiErrors: ApiErrorEntry[] = []

function push<T>(buf: T[], entry: T) {
  buf.push(entry)
  if (buf.length > BUFFER) buf.splice(0, buf.length - BUFFER)
}

function clip(s: unknown): string {
  const text = typeof s === 'string' ? s : safeStringify(s)
  return text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) : text
}

function safeStringify(v: unknown): string {
  if (v instanceof Error) return `${v.name}: ${v.message}`
  try {
    return typeof v === 'object' ? JSON.stringify(v) ?? String(v) : String(v)
  } catch {
    // Circular structures, getters that throw, DOM nodes. Never worth failing
    // a report over.
    return String(v)
  }
}

/**
 * One sitting's identifier, so a run through the product reads as a sequence
 * rather than five unrelated complaints.
 *
 * sessionStorage, not localStorage: the unit is a sitting, and a tab closed
 * and reopened tomorrow is a different one. Falls back to an in-memory value
 * where storage is unavailable (private mode, blocked site data) rather than
 * losing the grouping or, worse, throwing on module load.
 */
let memorySessionId = ''
const SESSION_KEY = 'dw_fb_session'

function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID().slice(0, 32)
    }
  } catch {
    /* fall through */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function sessionId(): string {
  try {
    const found = sessionStorage.getItem(SESSION_KEY)
    if (found) return found
    const made = newId()
    sessionStorage.setItem(SESSION_KEY, made)
    return made
  } catch {
    if (!memorySessionId) memorySessionId = newId()
    return memorySessionId
  }
}

/** The route the reporter came from, which is often the real answer to "how
 *  did you get here?" on a page they say they did not mean to open. */
let previousPath: string | null = null
let currentPath: string | null = null

function notePath(path: string) {
  if (path === currentPath) return
  previousPath = currentPath
  currentPath = path
}

let installed = false

/**
 * Start recording. Call once, before React mounts.
 *
 * Idempotent, because React strict mode and hot reload both run module setup
 * twice in development -- and wrapping an already-wrapped console.error would
 * double every entry.
 */
export function installFeedbackRecorder(): void {
  if (installed || typeof window === 'undefined') return
  installed = true

  try {
    notePath(window.location.pathname)

    const original = console.error
    console.error = function (...args: unknown[]) {
      try {
        push(consoleErrors, {
          at: new Date().toISOString(),
          kind: 'console',
          text: clip(args.map(safeStringify).join(' ')),
        })
      } catch {
        /* never let recording break logging */
      }
      // Always call through. A recorder that swallowed console output would
      // make the product harder to debug in exactly the situation it exists
      // to help with.
      return original.apply(console, args as [])
    }

    window.addEventListener('error', (e: ErrorEvent) => {
      try {
        push(consoleErrors, {
          at: new Date().toISOString(),
          kind: 'window',
          text: clip(
            e.message
              ? `${e.message}${e.filename ? ` (${e.filename}:${e.lineno})` : ''}`
              : safeStringify(e.error)
          ),
        })
      } catch {
        /* ignore */
      }
    })

    window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
      try {
        push(consoleErrors, {
          at: new Date().toISOString(),
          kind: 'promise',
          text: clip(e.reason),
        })
      } catch {
        /* ignore */
      }
    })

    // Track navigation without depending on a router: the package is shared
    // with three apps that have none. popstate covers back/forward; patching
    // pushState/replaceState covers a router's own navigation, which fires no
    // event of its own.
    const track = () => {
      try {
        notePath(window.location.pathname)
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('popstate', track)
    const { pushState, replaceState } = window.history
    window.history.pushState = function (...args) {
      const out = pushState.apply(this, args as Parameters<typeof pushState>)
      track()
      return out
    }
    window.history.replaceState = function (...args) {
      const out = replaceState.apply(this, args as Parameters<typeof replaceState>)
      track()
      return out
    }
  } catch {
    /* A browser that refuses any of this still gets the form, just with less
       context attached. That is much better than no form. */
  }
}

/**
 * Record a failed API call.
 *
 * Called from each app's HTTP error path -- an axios response interceptor in
 * the two products, the fetch wrapper in the three sites -- because only the
 * app knows which of its requests failed and what the API said about it. This
 * is what turns "it broke" into something actionable without a reproduction.
 */
export function recordApiError(entry: {
  method?: string
  path?: string
  status?: number | null
  detail?: unknown
}): void {
  try {
    push(apiErrors, {
      at: new Date().toISOString(),
      method: (entry.method || 'GET').toUpperCase(),
      path: clip(entry.path || ''),
      status: entry.status ?? null,
      detail: entry.detail === undefined ? undefined : clip(entry.detail),
    })
  } catch {
    /* ignore */
  }
}

/**
 * Collapse a literal path into the page it is an instance of.
 *
 * '/fields/123e4567-.../zones' becomes '/fields/:id/zones'. This is the single
 * most useful thing the report carries: grouped by the literal path, twenty
 * complaints about one broken page scatter across twenty field ids and look
 * like twenty unrelated problems; grouped by the pattern they are one thing to
 * fix, with a count next to it.
 *
 * Derived here rather than read off a router, because three of the five apps
 * have no router at all and the two that do would each need wiring. An app
 * that knows better can pass ``routePattern`` and override this.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NUMERIC = /^\d+$/
// A bare opaque token -- a slug is words, an id is not. Length and the absence
// of a vowel-ish shape is the cheapest rule that separates '/farms/north-80'
// (keep) from '/certs/a1b2c3d4e5' (mask).
const OPAQUE = /^(?=.*\d)[a-z0-9_-]{12,}$/i

export function routePatternFor(path: string): string {
  try {
    return (
      '/' +
      path
        .split('/')
        .filter(Boolean)
        .map((seg) => {
          if (UUID.test(seg)) return ':id'
          if (NUMERIC.test(seg)) return ':n'
          if (OPAQUE.test(seg)) return ':id'
          return seg
        })
        .join('/')
    )
  } catch {
    return path
  }
}

/**
 * The palette and mode actually on screen.
 *
 * Read off the classes ``applyTheme`` stamps on <html>, not off the ``dw_ui``
 * cookie. The classes are what the stylesheet matched, so they are what the
 * reporter saw; the cookie is only where the choice is remembered, and it is
 * empty in the two cases that matter most -- localhost, which has no shared
 * parent domain to set it on, and any browser with site data blocked. A
 * report that could not say whether it was Gold or Green would be missing the
 * one field that separates "this is unreadable" from "this is unreadable in
 * light mode", which is a different bug.
 */
export function renderedTheme(): { palette: string | null; theme: string | null } {
  try {
    const cl = document.documentElement.classList
    return {
      palette: cl.contains('palette-gold') ? 'gold' : 'field',
      theme: cl.contains('theme-light') ? 'light' : cl.contains('theme-dark') ? 'dark' : null,
    }
  } catch {
    return { palette: null, theme: null }
  }
}

/** Everything the page can say about itself, gathered at submit time. */
export function collectContext(): {
  page_path: string
  page_url: string
  page_title: string | null
  route_pattern: string
  session_id: string
  viewport_w: number
  viewport_h: number
  client: Record<string, unknown>
  console_errors: ConsoleErrorEntry[]
  api_errors: ApiErrorEntry[]
} {
  const path = safeGet(() => window.location.pathname, '/')
  return {
    page_path: path,
    // Full href: both products keep real state in the query string -- the open
    // tab, the active layer, the filter -- and a report about "the wrong thing
    // is showing" is unreproducible without it.
    page_url: safeGet(() => window.location.href, path),
    page_title: safeGet(() => document.title || null, null),
    route_pattern: routePatternFor(path),
    session_id: sessionId(),
    viewport_w: safeGet(() => window.innerWidth, 0),
    viewport_h: safeGet(() => window.innerHeight, 0),
    client: {
      ua: safeGet(() => navigator.userAgent, null),
      platform: safeGet(() => (navigator as Navigator).platform, null),
      languages: safeGet(() => navigator.language, null),
      pixel_ratio: safeGet(() => window.devicePixelRatio, null),
      timezone: safeGet(
        () => Intl.DateTimeFormat().resolvedOptions().timeZone,
        null
      ),
      // The client's own clock. Worth having when a report's ordering looks
      // impossible next to the server timestamps.
      client_time: new Date().toISOString(),
      referrer: safeGet(() => document.referrer || null, null),
      // How they got here, which is often the real answer on a page somebody
      // says they did not mean to open.
      previous_path: previousPath,
      // A touch device narrows what "the button is hard to hit" can mean.
      touch: safeGet(() => navigator.maxTouchPoints > 0, null),
      online: safeGet(() => navigator.onLine, null),
    },
    console_errors: consoleErrors.slice(),
    api_errors: apiErrors.slice(),
  }
}

function safeGet<T>(fn: () => T, fallback: T): T {
  try {
    const v = fn()
    return v === undefined ? fallback : v
  } catch {
    return fallback
  }
}

/** Exposed for the widget's "what will be sent" disclosure, and for tests. */
export function bufferedDiagnostics(): {
  console_errors: ConsoleErrorEntry[]
  api_errors: ApiErrorEntry[]
} {
  return { console_errors: consoleErrors.slice(), api_errors: apiErrors.slice() }
}
