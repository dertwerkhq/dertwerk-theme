/**
 * The list of DertWerk applications and sites, as the suite navigation shows
 * them.
 *
 * The record lives in the API (`GET /api/v1/apps`, backed by
 * `farm-analytics-api/api/app_registry.py`). The copy in catalogSnapshot.ts is
 * what renders before that answers, and for anyone the API cannot reach. It is
 * GENERATED -- `node scripts/snapshot-catalog.mjs` -- and CI fails when it has
 * drifted from the live list, because a hand-kept copy is exactly how the app
 * list ended up in fifteen files that disagreed.
 *
 * This is display data. Whether a person may open an application comes from
 * their memberships on /me, never from here.
 */
import { useEffect, useState } from 'react'

import { CATALOG_SNAPSHOT } from './catalogSnapshot'

export type AppKind = 'product' | 'site'
export type AppStatus = 'live' | 'beta' | 'soon'

export interface SuiteApp {
  id: string
  name: string
  tagline: string
  kind: AppKind
  status: AppStatus
  url: string | null
  public_browse: boolean
  request_access: boolean
  /** e.g. "/orgs/{org_id}". Null where the app has no organization pages. */
  org_path: string | null
}

export { CATALOG_SNAPSHOT }

export const DEFAULT_API_BASE = 'https://api.farmrx.dertwerk.com'

let cached: SuiteApp[] | null = null
let inflight: Promise<SuiteApp[]> | null = null

function isSuiteApp(v: unknown): v is SuiteApp {
  const a = v as SuiteApp
  return !!a && typeof a.id === 'string' && typeof a.name === 'string' && typeof a.kind === 'string'
}

/** Fetch once per page load; every caller shares the answer. Falls back to the
 *  snapshot on any failure rather than rendering a switcher with nothing in it. */
export function loadAppCatalog(apiBase: string = DEFAULT_API_BASE): Promise<SuiteApp[]> {
  if (cached) return Promise.resolve(cached)
  if (!inflight) {
    inflight = fetch(`${apiBase.replace(/\/$/, '')}/api/v1/apps`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body: unknown) => {
        if (!Array.isArray(body) || !body.every(isSuiteApp)) throw new Error('unexpected catalog shape')
        cached = body
        return body
      })
      .catch(() => {
        inflight = null
        return CATALOG_SNAPSHOT
      })
  }
  return inflight
}

export function useAppCatalog(apiBase: string = DEFAULT_API_BASE): SuiteApp[] {
  const [apps, setApps] = useState<SuiteApp[]>(cached ?? CATALOG_SNAPSHOT)
  useEffect(() => {
    let live = true
    void loadAppCatalog(apiBase).then((a) => {
      if (live) setApps(a)
    })
    return () => {
      live = false
    }
  }, [apiBase])
  return apps
}

export function appById(apps: SuiteApp[], id: string): SuiteApp | undefined {
  return apps.find((a) => a.id === id)
}

/** The address of one organization inside an app, or the app's root when it
 *  has no organization pages. Null for an app that does not exist yet. */
export function appOrgUrl(app: SuiteApp, orgId?: string | null): string | null {
  if (!app.url) return null
  if (orgId && app.org_path) return app.url + app.org_path.replace('{org_id}', encodeURIComponent(orgId))
  return app.url
}
