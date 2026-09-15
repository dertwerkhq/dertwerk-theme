import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * The "Feedback" control: a link in the top bar, and the form behind it.
 *
 * Offered only to accounts with the flag (``feedback_enabled`` on GET /me),
 * because it exists for people we have asked to look at the product with fresh
 * eyes -- not as a general support channel, which would need triage capacity
 * nobody has.
 *
 * Three decisions the form's usefulness rests on.
 *
 * **The reporter is never asked about their environment.** No "what browser",
 * no "what were you doing", no "can you reproduce it". A new user cannot
 * answer those and an expert will answer them wrong; the page knows all of it
 * already and attaches it silently. What is left is the one question only the
 * reporter can answer.
 *
 * **Two questions, one of them optional.** What happened, and what you
 * expected. The second is the single most valuable field when it is filled in
 * -- it is the only one that states the mental model the interface failed to
 * match -- and the single fastest way to kill a feedback habit if it is
 * mandatory.
 *
 * **It says what it is sending.** A disclosure lists the page, the build and
 * the error count, because a control that quietly ships browser diagnostics
 * deserves to be looked at, and because seeing "3 errors captured" is itself
 * a reason to press the button.
 *
 * Like ThemeToggle, this takes ``submit`` as a prop rather than calling the
 * API itself: each app already has its own client with its own base URL and
 * auth, and the package has no business knowing about either.
 */
import { useEffect, useRef, useState } from 'react';
import { collectContext, renderedTheme, } from './feedback';
const CATEGORIES = [
    // Plain words, not a severity scale. A new user genuinely cannot tell a P2
    // from a P3, and asking them to guess is how a feedback form stops being
    // filled in.
    { key: 'confusing', label: 'Confusing', hint: "I could not tell what to do" },
    { key: 'broken', label: 'Broken', hint: "It did not work" },
    { key: 'suggestion', label: 'Idea', hint: 'It would be better if…' },
    { key: 'other', label: 'Other', hint: 'Something else' },
];
export default function FeedbackWidget({ app, submit, enabled = true, orgId, buildSha, breadcrumb, routePattern, label = 'Feedback', className = 'topnav__action', }) {
    const [open, setOpen] = useState(false);
    const [category, setCategory] = useState('confusing');
    const [message, setMessage] = useState('');
    const [expected, setExpected] = useState('');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState(null);
    // Captured when the dialog opens, not when it is submitted. By the time
    // somebody has finished typing, a background refresh may have cleared the
    // very error they are describing -- and the context must describe the page
    // they were complaining about, not the one they ended up on.
    const [context, setContext] = useState(null);
    const firstFieldRef = useRef(null);
    const openerRef = useRef(null);
    useEffect(() => {
        if (!open)
            return;
        setContext(collectContext());
        // Focus the question, not the dialog: the reporter came here to type.
        const t = setTimeout(() => firstFieldRef.current?.focus(), 0);
        const onKey = (e) => {
            if (e.key === 'Escape')
                close();
        };
        document.addEventListener('keydown', onKey);
        return () => {
            clearTimeout(t);
            document.removeEventListener('keydown', onKey);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);
    if (!enabled)
        return null;
    function close() {
        setOpen(false);
        setError(null);
        // Deliberately keeps nothing: the next report is about a different page,
        // and a form pre-filled with the last complaint invites a duplicate.
        setMessage('');
        setExpected('');
        setCategory('confusing');
        setSent(false);
        // Return focus where it came from, so a keyboard user is not dropped at
        // the top of the document.
        openerRef.current?.focus();
    }
    async function send() {
        if (!message.trim() || sending)
            return;
        setSending(true);
        setError(null);
        const ctx = context ?? collectContext();
        const appearance = renderedTheme();
        const report = {
            app,
            category,
            message: message.trim(),
            expected: expected.trim() || null,
            ...ctx,
            route_pattern: routePattern ?? ctx.route_pattern,
            breadcrumb: breadcrumb ?? null,
            build_sha: buildSha ?? null,
            org_id: orgId ?? null,
            palette: appearance.palette,
            theme: appearance.theme,
        };
        try {
            await submit(report);
            setSent(true);
        }
        catch (e) {
            // Kept open with the text intact. Losing what somebody just wrote
            // because the network blipped is how you stop being told things.
            setError('That did not send. Your note is still here — try again in a moment.');
            console.error('feedback submit failed', e);
        }
        finally {
            setSending(false);
        }
    }
    const errorCount = (context?.console_errors.length ?? 0) + (context?.api_errors.length ?? 0);
    return (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", ref: openerRef, className: className, onClick: () => setOpen(true), title: "Tell us what is confusing or broken on this page", children: label }), open && (_jsx("div", { className: "dwfb__scrim", onMouseDown: close, children: _jsx("div", { className: "dwfb", role: "dialog", "aria-modal": "true", "aria-labelledby": "dwfb-title", 
                    /* The scrim closes on click; the dialog must not close when the
                       click merely started inside it and drifted out -- which is what
                       selecting text across the edge of a textarea does. */
                    onMouseDown: (e) => e.stopPropagation(), children: sent ? (_jsxs("div", { className: "dwfb__done", children: [_jsx("h2", { id: "dwfb-title", className: "dwfb__title", children: "Thank you" }), _jsx("p", { className: "dwfb__lede", children: "That is logged against this page. Nothing else is needed from you \u2014 keep going, and tell us the next thing." }), _jsx("div", { className: "dwfb__actions", children: _jsx("button", { type: "button", className: "dwfb__btn dwfb__btn--go", onClick: close, children: "Close" }) })] })) : (_jsxs(_Fragment, { children: [_jsx("h2", { id: "dwfb-title", className: "dwfb__title", children: "What happened on this page?" }), _jsx("p", { className: "dwfb__lede", children: "Say it however you would say it out loud. We record the page, the browser and any errors for you." }), _jsx("div", { className: "dwfb__cats", role: "group", "aria-label": "Kind of feedback", children: CATEGORIES.map((c) => (_jsx("button", { type: "button", className: category === c.key ? 'dwfb__cat dwfb__cat--on' : 'dwfb__cat', "aria-pressed": category === c.key, onClick: () => setCategory(c.key), title: c.hint, children: c.label }, c.key))) }), _jsx("label", { className: "dwfb__label", htmlFor: "dwfb-message", children: "What went wrong, or what confused you" }), _jsx("textarea", { id: "dwfb-message", ref: firstFieldRef, className: "dwfb__field", rows: 4, value: message, onChange: (e) => setMessage(e.target.value), placeholder: "I clicked Save and nothing seemed to happen\u2026" }), _jsxs("label", { className: "dwfb__label", htmlFor: "dwfb-expected", children: ["What did you expect instead? ", _jsx("span", { className: "dwfb__opt", children: "optional" })] }), _jsx("textarea", { id: "dwfb-expected", className: "dwfb__field", rows: 2, value: expected, onChange: (e) => setExpected(e.target.value), placeholder: "I expected it to go back to the field list." }), _jsxs("details", { className: "dwfb__what", children: [_jsx("summary", { children: "What gets sent with this" }), _jsxs("ul", { className: "dwfb__whatlist", children: [_jsxs("li", { children: [_jsx("span", { className: "dwfb__k", children: "Page" }), _jsx("span", { className: "dwfb__v", children: context?.page_title || context?.page_path })] }), _jsxs("li", { children: [_jsx("span", { className: "dwfb__k", children: "Address" }), _jsx("span", { className: "dwfb__v dwfb__v--mono", children: context?.page_path })] }), _jsxs("li", { children: [_jsx("span", { className: "dwfb__k", children: "Screen" }), _jsx("span", { className: "dwfb__v", children: context ? `${context.viewport_w}×${context.viewport_h}` : '—' })] }), _jsxs("li", { children: [_jsx("span", { className: "dwfb__k", children: "Appearance" }), _jsxs("span", { className: "dwfb__v", children: [renderedTheme().palette === 'gold' ? 'Gold' : 'Green', ",", ' ', renderedTheme().theme ?? '—'] })] }), _jsxs("li", { children: [_jsx("span", { className: "dwfb__k", children: "Errors captured" }), _jsx("span", { className: "dwfb__v", children: errorCount })] })] })] }), error && _jsx("p", { className: "dwfb__err", role: "alert", children: error }), _jsxs("div", { className: "dwfb__actions", children: [_jsx("button", { type: "button", className: "dwfb__btn", onClick: close, children: "Cancel" }), _jsx("button", { type: "button", className: "dwfb__btn dwfb__btn--go", onClick: send, disabled: !message.trim() || sending, children: sending ? 'Sending…' : 'Send' })] })] })) }) }))] }));
}
