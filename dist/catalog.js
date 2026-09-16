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
import { useEffect, useState } from 'react';
import { CATALOG_SNAPSHOT } from './catalogSnapshot';
export { CATALOG_SNAPSHOT };
export const DEFAULT_API_BASE = 'https://api.farmrx.dertwerk.com';
let cached = null;
let inflight = null;
function isSuiteApp(v) {
    const a = v;
    return !!a && typeof a.id === 'string' && typeof a.name === 'string' && typeof a.kind === 'string';
}
/** Fetch once per page load; every caller shares the answer. Falls back to the
 *  snapshot on any failure rather than rendering a switcher with nothing in it. */
export function loadAppCatalog(apiBase = DEFAULT_API_BASE) {
    if (cached)
        return Promise.resolve(cached);
    if (!inflight) {
        inflight = fetch(`${apiBase.replace(/\/$/, '')}/api/v1/apps`)
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then((body) => {
            if (!Array.isArray(body) || !body.every(isSuiteApp))
                throw new Error('unexpected catalog shape');
            cached = body;
            return body;
        })
            .catch(() => {
            inflight = null;
            return CATALOG_SNAPSHOT;
        });
    }
    return inflight;
}
export function useAppCatalog(apiBase = DEFAULT_API_BASE) {
    const [apps, setApps] = useState(cached ?? CATALOG_SNAPSHOT);
    useEffect(() => {
        let live = true;
        void loadAppCatalog(apiBase).then((a) => {
            if (live)
                setApps(a);
        });
        return () => {
            live = false;
        };
    }, [apiBase]);
    return apps;
}
export function appById(apps, id) {
    return apps.find((a) => a.id === id);
}
/** The address of one organization inside an app, or the app's root when it
 *  has no organization pages. Null for an app that does not exist yet. */
export function appOrgUrl(app, orgId) {
    if (!app.url)
        return null;
    if (orgId && app.org_path)
        return app.url + app.org_path.replace('{org_id}', encodeURIComponent(orgId));
    return app.url;
}
/** The query parameter carrying the organization to an app's front door. */
export const ORG_HINT_PARAM = 'org';
/**
 * Where to send someone switching to another application: its front door,
 * with the organization they were in as a hint. The app reopens their saved
 * place in that organization, or opens the organization, rather than a link
 * straight to the organization's page -- an address always wins over a saved
 * place, so linking to a page would make switching apps forget where they were.
 */
export function appResumeUrl(app, orgId) {
    if (!app.url)
        return null;
    if (orgId && app.org_path)
        return `${app.url}/?${ORG_HINT_PARAM}=${encodeURIComponent(orgId)}`;
    return app.url;
}
/** The organization hint on this page's address, if any. */
export function orgHintFromLocation(search = typeof window !== 'undefined' ? window.location.search : '') {
    return new URLSearchParams(search).get(ORG_HINT_PARAM);
}
