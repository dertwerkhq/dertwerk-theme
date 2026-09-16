import { CATALOG_SNAPSHOT } from './catalogSnapshot';
export type AppKind = 'product' | 'site';
export type AppStatus = 'live' | 'beta' | 'soon';
export interface SuiteApp {
    id: string;
    name: string;
    tagline: string;
    kind: AppKind;
    status: AppStatus;
    url: string | null;
    public_browse: boolean;
    request_access: boolean;
    /** e.g. "/orgs/{org_id}". Null where the app has no organization pages. */
    org_path: string | null;
}
export { CATALOG_SNAPSHOT };
export declare const DEFAULT_API_BASE = "https://api.farmrx.dertwerk.com";
/** Fetch once per page load; every caller shares the answer. Falls back to the
 *  snapshot on any failure rather than rendering a switcher with nothing in it. */
export declare function loadAppCatalog(apiBase?: string): Promise<SuiteApp[]>;
export declare function useAppCatalog(apiBase?: string): SuiteApp[];
export declare function appById(apps: SuiteApp[], id: string): SuiteApp | undefined;
/** The address of one organization inside an app, or the app's root when it
 *  has no organization pages. Null for an app that does not exist yet. */
export declare function appOrgUrl(app: SuiteApp, orgId?: string | null): string | null;
