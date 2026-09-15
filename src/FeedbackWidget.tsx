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
import { useEffect, useRef, useState } from 'react'

import {
  collectContext,
  renderedTheme,
  type FeedbackApp,
  type FeedbackCategory,
  type FeedbackReport,
} from './feedback'

const CATEGORIES: { key: FeedbackCategory; label: string; hint: string }[] = [
  // Plain words, not a severity scale. A new user genuinely cannot tell a P2
  // from a P3, and asking them to guess is how a feedback form stops being
  // filled in.
  { key: 'confusing', label: 'Confusing', hint: "I could not tell what to do" },
  { key: 'broken', label: 'Broken', hint: "It did not work" },
  { key: 'suggestion', label: 'Idea', hint: 'It would be better if…' },
  { key: 'other', label: 'Other', hint: 'Something else' },
]

export default function FeedbackWidget({
  app,
  submit,
  enabled = true,
  orgId,
  buildSha,
  breadcrumb,
  routePattern,
  label = 'Feedback',
  className = 'topnav__action',
}: {
  app: FeedbackApp
  /** Posts the report. Each app passes its own API client. */
  submit: (report: FeedbackReport) => Promise<unknown>
  /** ``feedback_enabled`` from GET /me. Renders nothing when false, so a host
   *  app cannot accidentally show the control to everybody by forgetting the
   *  conditional. */
  enabled?: boolean
  /** Which organization was on screen. The server verifies membership before
   *  believing it. */
  orgId?: string | null
  buildSha?: string | null
  /** The trail the app is already displaying, which says in words which field
   *  or certification was open -- how the reporter will describe it later. */
  breadcrumb?: string | null
  /** Overrides the pattern derived from the path, for an app that knows its
   *  own routes better than the generic rule does. */
  routePattern?: string | null
  label?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<FeedbackCategory>('confusing')
  const [message, setMessage] = useState('')
  const [expected, setExpected] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Captured when the dialog opens, not when it is submitted. By the time
  // somebody has finished typing, a background refresh may have cleared the
  // very error they are describing -- and the context must describe the page
  // they were complaining about, not the one they ended up on.
  const [context, setContext] = useState<ReturnType<typeof collectContext> | null>(null)

  const firstFieldRef = useRef<HTMLTextAreaElement>(null)
  const openerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    setContext(collectContext())
    // Focus the question, not the dialog: the reporter came here to type.
    const t = setTimeout(() => firstFieldRef.current?.focus(), 0)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!enabled) return null

  function close() {
    setOpen(false)
    setError(null)
    // Deliberately keeps nothing: the next report is about a different page,
    // and a form pre-filled with the last complaint invites a duplicate.
    setMessage('')
    setExpected('')
    setCategory('confusing')
    setSent(false)
    // Return focus where it came from, so a keyboard user is not dropped at
    // the top of the document.
    openerRef.current?.focus()
  }

  async function send() {
    if (!message.trim() || sending) return
    setSending(true)
    setError(null)
    const ctx = context ?? collectContext()
    const appearance = renderedTheme()
    const report: FeedbackReport = {
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
    }
    try {
      await submit(report)
      setSent(true)
    } catch (e) {
      // Kept open with the text intact. Losing what somebody just wrote
      // because the network blipped is how you stop being told things.
      setError(
        'That did not send. Your note is still here — try again in a moment.'
      )
      console.error('feedback submit failed', e)
    } finally {
      setSending(false)
    }
  }

  const errorCount =
    (context?.console_errors.length ?? 0) + (context?.api_errors.length ?? 0)

  return (
    <>
      <button
        type="button"
        ref={openerRef}
        className={className}
        onClick={() => setOpen(true)}
        title="Tell us what is confusing or broken on this page"
      >
        {label}
      </button>

      {open && (
        <div className="dwfb__scrim" onMouseDown={close}>
          <div
            className="dwfb"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dwfb-title"
            /* The scrim closes on click; the dialog must not close when the
               click merely started inside it and drifted out -- which is what
               selecting text across the edge of a textarea does. */
            onMouseDown={(e) => e.stopPropagation()}
          >
            {sent ? (
              <div className="dwfb__done">
                <h2 id="dwfb-title" className="dwfb__title">Thank you</h2>
                <p className="dwfb__lede">
                  That is logged against this page. Nothing else is needed from
                  you — keep going, and tell us the next thing.
                </p>
                <div className="dwfb__actions">
                  <button type="button" className="dwfb__btn dwfb__btn--go" onClick={close}>
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 id="dwfb-title" className="dwfb__title">
                  What happened on this page?
                </h2>
                <p className="dwfb__lede">
                  Say it however you would say it out loud. We record the page,
                  the browser and any errors for you.
                </p>

                <div className="dwfb__cats" role="group" aria-label="Kind of feedback">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      className={
                        category === c.key ? 'dwfb__cat dwfb__cat--on' : 'dwfb__cat'
                      }
                      aria-pressed={category === c.key}
                      onClick={() => setCategory(c.key)}
                      title={c.hint}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                <label className="dwfb__label" htmlFor="dwfb-message">
                  What went wrong, or what confused you
                </label>
                <textarea
                  id="dwfb-message"
                  ref={firstFieldRef}
                  className="dwfb__field"
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="I clicked Save and nothing seemed to happen…"
                />

                <label className="dwfb__label" htmlFor="dwfb-expected">
                  What did you expect instead? <span className="dwfb__opt">optional</span>
                </label>
                <textarea
                  id="dwfb-expected"
                  className="dwfb__field"
                  rows={2}
                  value={expected}
                  onChange={(e) => setExpected(e.target.value)}
                  placeholder="I expected it to go back to the field list."
                />

                <details className="dwfb__what">
                  <summary>What gets sent with this</summary>
                  <ul className="dwfb__whatlist">
                    <li>
                      <span className="dwfb__k">Page</span>
                      <span className="dwfb__v">{context?.page_title || context?.page_path}</span>
                    </li>
                    <li>
                      <span className="dwfb__k">Address</span>
                      <span className="dwfb__v dwfb__v--mono">{context?.page_path}</span>
                    </li>
                    <li>
                      <span className="dwfb__k">Screen</span>
                      <span className="dwfb__v">
                        {context ? `${context.viewport_w}×${context.viewport_h}` : '—'}
                      </span>
                    </li>
                    <li>
                      <span className="dwfb__k">Appearance</span>
                      <span className="dwfb__v">
                        {renderedTheme().palette === 'gold' ? 'Gold' : 'Green'},{' '}
                        {renderedTheme().theme ?? '—'}
                      </span>
                    </li>
                    <li>
                      <span className="dwfb__k">Errors captured</span>
                      <span className="dwfb__v">{errorCount}</span>
                    </li>
                  </ul>
                </details>

                {error && <p className="dwfb__err" role="alert">{error}</p>}

                <div className="dwfb__actions">
                  <button type="button" className="dwfb__btn" onClick={close}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="dwfb__btn dwfb__btn--go"
                    onClick={send}
                    disabled={!message.trim() || sending}
                  >
                    {sending ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
