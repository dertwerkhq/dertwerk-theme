export interface NavDestination {
    orgId: string | null;
    /** What kind of place this is, e.g. "field", "farm_year", "advisor_page". */
    kind: string;
    entityIds?: Record<string, string>;
    /** The route, without query string or fragment. */
    path: string;
    /** Ordinary work in the organization. False for settings or support views. */
    work?: boolean;
}
export interface SavedNav {
    org_id: string | null;
    kind: string;
    entity_ids: Record<string, string>;
    path: string;
    version: number;
    client_ts: string;
}
export interface NavStateBody {
    org_id: string | null;
    kind: string;
    entity_ids: Record<string, string>;
    path: string;
    version: number;
    client_ts: string;
    work: boolean;
}
/**
 * Send the waiting save now. Call before leaving the page for another app --
 * the shell does, for its own app links. Resolves when the save is done or
 * after a short wait, whichever comes first, so leaving is never held up long.
 */
export declare function flushNavMemory(): Promise<void>;
export declare function useNavMemory({ app, destination, enabled, save, }: {
    app: string;
    destination: NavDestination | null;
    enabled: boolean;
    save: (app: string, body: NavStateBody) => Promise<unknown>;
}): void;
export type Reachability = 'ok' | 'gone' | 'network';
export interface Candidate {
    path: string;
    /** 'ok' if the place loads and may be opened; 'gone' for 403/404 or no
     *  longer a member; 'network' when the answer could not be had. */
    check: () => Promise<Reachability>;
}
/**
 * The first candidate that still opens, in order. Stops at a network failure
 * rather than walking past a place that may be perfectly fine -- the caller
 * offers a retry and the saved record is left alone.
 */
export declare function firstReachable(candidates: Candidate[]): Promise<{
    path: string;
} | {
    network: true;
} | null>;
/** Classify an HTTP failure for `Candidate.check`. Works with fetch Responses
 *  and axios-style errors that carry `response.status`. */
export declare function reachabilityOf(error: unknown): Reachability;
