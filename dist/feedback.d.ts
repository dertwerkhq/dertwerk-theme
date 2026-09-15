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
/** Which application a report came from.
 *
 * A union rather than a string, because the server validates the same closed
 * set: a typo here should fail the build, not produce a 422 in front of
 * somebody trying to tell us something is broken. Keep in step with
 * FEEDBACK_APPS in farm-analytics-api/api/schemas/feedback.py.
 *
 * Not the same list as an organization's entitlements. The three dertwerk
 * sites are not products anybody buys, but they are very much places a new
 * user gets lost. */
export type FeedbackApp = 'farmrx' | 'fsacre' | 'agplication' | 'account' | 'admin' | 'landing';
export type FeedbackCategory = 'confusing' | 'broken' | 'suggestion' | 'other';
export interface ConsoleErrorEntry {
    at: string;
    kind: 'console' | 'window' | 'promise';
    text: string;
}
export interface ApiErrorEntry {
    at: string;
    method: string;
    path: string;
    status: number | null;
    detail?: string;
}
export interface FeedbackReport {
    app: FeedbackApp;
    category: FeedbackCategory;
    message: string;
    expected?: string | null;
    page_path: string;
    route_pattern: string | null;
    page_url: string;
    page_title: string | null;
    breadcrumb?: string | null;
    build_sha?: string | null;
    session_id: string;
    palette: string | null;
    theme: string | null;
    viewport_w: number;
    viewport_h: number;
    org_id?: string | null;
    client: Record<string, unknown>;
    console_errors: ConsoleErrorEntry[];
    api_errors: ApiErrorEntry[];
}
export declare function sessionId(): string;
/**
 * Start recording. Call once, before React mounts.
 *
 * Idempotent, because React strict mode and hot reload both run module setup
 * twice in development -- and wrapping an already-wrapped console.error would
 * double every entry.
 */
export declare function installFeedbackRecorder(): void;
/**
 * Record a failed API call.
 *
 * Called from each app's HTTP error path -- an axios response interceptor in
 * the two products, the fetch wrapper in the three sites -- because only the
 * app knows which of its requests failed and what the API said about it. This
 * is what turns "it broke" into something actionable without a reproduction.
 */
export declare function recordApiError(entry: {
    method?: string;
    path?: string;
    status?: number | null;
    detail?: unknown;
}): void;
export declare function routePatternFor(path: string): string;
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
export declare function renderedTheme(): {
    palette: string | null;
    theme: string | null;
};
/** Everything the page can say about itself, gathered at submit time. */
export declare function collectContext(): {
    page_path: string;
    page_url: string;
    page_title: string | null;
    route_pattern: string;
    session_id: string;
    viewport_w: number;
    viewport_h: number;
    client: Record<string, unknown>;
    console_errors: ConsoleErrorEntry[];
    api_errors: ApiErrorEntry[];
};
/** Exposed for the widget's "what will be sent" disclosure, and for tests. */
export declare function bufferedDiagnostics(): {
    console_errors: ConsoleErrorEntry[];
    api_errors: ApiErrorEntry[];
};
