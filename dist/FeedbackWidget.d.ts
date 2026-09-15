import { type FeedbackApp, type FeedbackReport } from './feedback';
export default function FeedbackWidget({ app, submit, enabled, orgId, buildSha, breadcrumb, routePattern, label, className, }: {
    app: FeedbackApp;
    /** Posts the report. Each app passes its own API client. */
    submit: (report: FeedbackReport) => Promise<unknown>;
    /** ``feedback_enabled`` from GET /me. Renders nothing when false, so a host
     *  app cannot accidentally show the control to everybody by forgetting the
     *  conditional. */
    enabled?: boolean;
    /** Which organization was on screen. The server verifies membership before
     *  believing it. */
    orgId?: string | null;
    buildSha?: string | null;
    /** The trail the app is already displaying, which says in words which field
     *  or certification was open -- how the reporter will describe it later. */
    breadcrumb?: string | null;
    /** Overrides the pattern derived from the path, for an app that knows its
     *  own routes better than the generic rule does. */
    routePattern?: string | null;
    label?: string;
    className?: string;
}): import("react").JSX.Element | null;
