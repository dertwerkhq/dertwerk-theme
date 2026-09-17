/**
 * Reopening an application where somebody left it.
 *
 * Two halves, both driven by the app, because only the app knows its routes:
 *
 *   useNavMemory   records the place once it has *loaded*. Pass null while a
 *                  page is loading, failed, or is not worth reopening (an OAuth
 *                  return, a half-filled form), and nothing is written. So a
 *                  failed load can never overwrite a good record.
 *
 *   firstReachable at `/`, tries the saved place and then its ancestors
 *                  (field, then farm, then organization) and returns the first
 *                  that still exists and may be opened.
 *
 * The record lives on the account (PUT /me/nav-state/{app}, read back in /me)
 * so it follows somebody from phone to desktop. Writes are throttled with a
 * trailing write -- a short visit still counts -- and nothing is sent on
 * unload. The server keeps whichever write the browser made last.
 *
 * Silent until the API supports it: an app passes `enabled` from whether /me
 * carried a `nav_state` field at all.
 */
import { useEffect, useRef } from 'react'

export interface NavDestination {
  orgId: string | null
  /** What kind of place this is, e.g. "field", "farm_year", "advisor_page". */
  kind: string
  entityIds?: Record<string, string>
  /** The route, without query string or fragment. */
  path: string
  /** Ordinary work in the organization. False for settings or support views. */
  work?: boolean
}

export interface SavedNav {
  org_id: string | null
  kind: string
  entity_ids: Record<string, string>
  path: string
  version: number
  client_ts: string
}

export interface NavStateBody {
  org_id: string | null
  kind: string
  entity_ids: Record<string, string>
  path: string
  version: number
  client_ts: string
  work: boolean
}

// Short, because a place only counts if it is saved before the person leaves
// the app, and switching apps is a full page load that cancels any timer.
// Ten seconds lost every page visited just before switching.
const MIN_INTERVAL_MS = 3_000
const SETTLE_MS = 800
// How long leaving an app will wait for the last save to go out.
const FLUSH_TIMEOUT_MS = 1_500

/** The save waiting on its timer, across every useNavMemory on the page. */
let pending: { timer: ReturnType<typeof setTimeout>; send: () => Promise<unknown> } | null = null

/**
 * Send the waiting save now. Call before leaving the page for another app --
 * the shell does, for its own app links. Resolves when the save is done or
 * after a short wait, whichever comes first, so leaving is never held up long.
 */
export function flushNavMemory(): Promise<void> {
  if (!pending) return Promise.resolve()
  const { timer, send } = pending
  clearTimeout(timer)
  pending = null
  return Promise.race([
    send().then(
      () => undefined,
      () => undefined,
    ),
    new Promise<void>((resolve) => setTimeout(resolve, FLUSH_TIMEOUT_MS)),
  ])
}

export function useNavMemory({
  app,
  destination,
  enabled,
  save,
}: {
  app: string
  destination: NavDestination | null
  enabled: boolean
  save: (app: string, body: NavStateBody) => Promise<unknown>
}): void {
  const lastWritten = useRef<{ path: string; at: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveRef = useRef(save)
  saveRef.current = save

  const key = destination ? `${destination.path}|${destination.orgId ?? ''}|${destination.kind}` : null

  useEffect(() => {
    if (!enabled || !destination) return
    if (lastWritten.current?.path === destination.path) return
    // Captured now: the time somebody reached the place, not when it was sent.
    const body: NavStateBody = {
      org_id: destination.orgId,
      kind: destination.kind,
      entity_ids: destination.entityIds ?? {},
      path: destination.path.replace(/[?#].*$/, ''),
      version: 1,
      client_ts: new Date().toISOString(),
      work: destination.work ?? true,
    }
    const since = lastWritten.current ? Date.now() - lastWritten.current.at : Infinity
    const wait = Math.max(SETTLE_MS, MIN_INTERVAL_MS - since)
    if (timer.current) clearTimeout(timer.current)
    const send = () => {
      lastWritten.current = { path: body.path, at: Date.now() }
      return saveRef.current(app, body).catch(() => {
        // Not worth a message: the worst case is reopening one step behind.
      })
    }
    // Trailing: a newer place replaces the pending one, and whichever is
    // current when the timer fires is the one recorded.
    timer.current = setTimeout(() => {
      timer.current = null
      pending = null
      void send()
    }, wait)
    pending = { timer: timer.current, send }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app, enabled, key])

  useEffect(
    () => () => {
      // Unmounting inside the app (a route change) cancels nothing: the next
      // page's place replaces it anyway. Only an un-flushed page unload loses it.
      if (timer.current && pending?.timer !== timer.current) clearTimeout(timer.current)
    },
    [],
  )
}

export type Reachability = 'ok' | 'gone' | 'network'

export interface Candidate {
  path: string
  /** 'ok' if the place loads and may be opened; 'gone' for 403/404 or no
   *  longer a member; 'network' when the answer could not be had. */
  check: () => Promise<Reachability>
}

/**
 * The first candidate that still opens, in order. Stops at a network failure
 * rather than walking past a place that may be perfectly fine -- the caller
 * offers a retry and the saved record is left alone.
 */
export async function firstReachable(
  candidates: Candidate[],
): Promise<{ path: string } | { network: true } | null> {
  for (const c of candidates) {
    let result: Reachability
    try {
      result = await c.check()
    } catch {
      result = 'network'
    }
    if (result === 'ok') return { path: c.path }
    if (result === 'network') return { network: true }
  }
  return null
}

/** Classify an HTTP failure for `Candidate.check`. Works with fetch Responses
 *  and axios-style errors that carry `response.status`. */
export function reachabilityOf(error: unknown): Reachability {
  const status =
    (error as { status?: number })?.status ?? (error as { response?: { status?: number } })?.response?.status
  if (status === 401 || status === 403 || status === 404 || status === 422) return 'gone'
  return 'network'
}
