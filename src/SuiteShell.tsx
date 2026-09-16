/**
 * The frame every DertWerk application sits in: one top bar, the app's own
 * destinations, a location switcher, and the account menu.
 *
 * The contract, from docs/suite-navigation-plan.md in farm-analytics-api:
 *
 *   The bar has three slots and takes no children. Anything about the person
 *   goes in the account menu; anything about the organization goes in its
 *   settings; anything about the app goes in `nav`; a page's own buttons go in
 *   that page's header. Never the bar. That is how it stops filling up.
 *
 * Two layouts. `browse` (FarmRx, FSAcre) keeps the full width for maps and
 * editors and puts the destinations in the app menu. `workspace` (Agplication,
 * rental, account, admin) also shows them as a sidebar on wide screens. On a
 * phone both collapse to one "Menu" drawer: destinations, then the other apps.
 *
 * Deliberately knows nothing about routers, API clients or auth libraries.
 * Each app passes `navigate` for its own paths, its session, and its catalog.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from 'react'

import FeedbackWidget from './FeedbackWidget'
import ThemeToggle from './ThemeToggle'
import type { FeedbackApp, FeedbackReport } from './feedback'
import type { SuiteApp } from './catalog'
import type { ThemeChoice } from './theme'

/* ------------------------------------------------------------------------ */
/* Types                                                                     */
/* ------------------------------------------------------------------------ */

export interface NavItem {
  key: string
  label: string
  href: string
  /** Section heading in the menu, e.g. "Organization". Items without one
   *  come first. */
  group?: string
  badge?: number | string | null
  current?: boolean
}

export interface LocationOption {
  id: string
  label: string
  hint?: string
  /** Groups options inside one level, e.g. "Your organizations" / "Clients". */
  group?: string
}

export interface LocationLevel {
  key: string
  /** What this level is called: "Organization", "Farm", "Field". */
  label: string
  current: LocationOption | null
  /** Siblings, when already known. */
  options?: LocationOption[]
  /** Siblings, fetched when the switcher opens. */
  loadOptions?: () => Promise<LocationOption[]>
  /** How many choices exist, when known without loading them. Used to leave a
   *  one-choice level out of the bar. */
  count?: number
  href: (id: string) => string
  /** Leave the level out of the bar when it has exactly one choice. It always
   *  stays in the switcher. Default true. */
  hideWhenSingle?: boolean
  /** Keep it in the bar regardless -- e.g. the organization during a support
   *  session, where knowing whose data this is matters more than space. */
  alwaysShow?: boolean
  /** Links about one choice, drawn as icons at the end of its row: that
   *  organization's settings, its admin page. Per row, so the gear beside an
   *  organization always means *that* organization's settings, however many
   *  are listed. */
  optionLinks?: (id: string) => LocationOptionLink[]
  /** Links about the whole list, drawn as a footer under it: "All
   *  organizations", "All farms". Never a choice-specific link -- those read as
   *  one more choice when listed among the choices. */
  actions?: { key: string; label: string; href: string }[]
}

export interface LocationOptionLink {
  key: string
  /** Read by screen readers and shown as a tooltip, e.g. "Mewes Farms settings". */
  label: string
  href: string
  icon: 'settings' | 'external'
}

export interface SuiteSession {
  email: string | null
  isSuperadmin: boolean
  signOut: () => void
}

export interface SuiteFeedback {
  app: FeedbackApp
  enabled: boolean
  submit: (report: FeedbackReport) => Promise<unknown>
  orgId?: string | null
  buildSha?: string | null
  /** Defaults to the location labels joined with " › ". */
  breadcrumb?: string | null
}

export interface SuiteShellProps {
  /** This app's id in the catalog. */
  app: string
  catalog: SuiteApp[]
  layout: 'browse' | 'workspace'
  /** `window` (default): the page scrolls under a sticky bar. `contained`: the
   *  shell is exactly one screen tall and only the content area scrolls --
   *  for apps whose maps and editors size themselves to the space left. */
  scroll?: 'window' | 'contained'
  /** Opens a path inside this app. Absolute URLs are opened by the shell. */
  navigate: (href: string) => void
  /** Null when nobody is signed in. */
  session: SuiteSession | null
  onSignIn?: () => void
  /** Product ids the person can open here; null means do not filter. */
  entitledApps: string[] | null
  /** Organization in view, carried into links to other apps and the account. */
  orgId?: string | null
  nav?: NavItem[]
  location?: LocationLevel[]
  theme: ThemeChoice
  onTheme: (next: ThemeChoice) => void
  persistTheme?: (next: ThemeChoice) => void
  feedback?: SuiteFeedback
  children: ReactNode
}

/* ------------------------------------------------------------------------ */
/* Unsaved work                                                              */
/* ------------------------------------------------------------------------ */

type GuardMap = Map<string, string>

const GuardContext = createContext<{
  set: (key: string, message: string | null) => void
  confirmLeave: () => boolean
} | null>(null)

const DEFAULT_UNSAVED = 'You have unsaved changes. Leave this page and lose them?'

/**
 * Declare unsaved work. While `dirty` is true, every navigation the shell owns
 * (app menu, location switcher, account menu) asks first, and so does closing
 * or reloading the tab.
 *
 * Links an app renders itself, and the browser's back button inside a
 * BrowserRouter, are outside the shell's reach: call `useConfirmLeave()` for
 * those.
 */
export function useUnsavedChanges(dirty: boolean, message: string = DEFAULT_UNSAVED): void {
  const ctx = useContext(GuardContext)
  const key = useId()
  useEffect(() => {
    ctx?.set(key, dirty ? message : null)
    return () => ctx?.set(key, null)
  }, [ctx, key, dirty, message])
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])
}

/** Returns a function that asks before leaving when anything is unsaved, and
 *  reports whether leaving should go ahead. */
export function useConfirmLeave(): () => boolean {
  const ctx = useContext(GuardContext)
  return ctx?.confirmLeave ?? (() => true)
}

/* ------------------------------------------------------------------------ */
/* Small pieces                                                              */
/* ------------------------------------------------------------------------ */

function useNarrow(maxWidth = 760): boolean {
  const query = `(max-width: ${maxWidth}px)`
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false,
  )
  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia(query)
    const on = () => setNarrow(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return narrow
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Open/close behaviour shared by every popover, drawer and sheet: Escape
 * closes, a click outside closes, focus moves in on open and returns to the
 * control that opened it on close. `modal` also keeps Tab inside.
 */
function useLayer(
  open: boolean,
  close: () => void,
  panelRef: RefObject<HTMLElement | null>,
  triggerRef: RefObject<HTMLElement | null>,
  modal: boolean,
) {
  useEffect(() => {
    if (!open) return
    const trigger = triggerRef.current
    const panel = panelRef.current
    const first =
      panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel?.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
        return
      }
      if (modal && e.key === 'Tab' && panel) {
        const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
        if (!items.length) return
        const a = items[0]
        const z = items[items.length - 1]
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault()
          z.focus()
        } else if (!e.shiftKey && document.activeElement === z) {
          e.preventDefault()
          a.focus()
        }
      }
    }
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (panel?.contains(t) || trigger?.contains(t)) return
      close()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
      // Only pull focus back if it is still inside the layer being closed;
      // a click that moved focus somewhere on purpose keeps it there.
      if (!document.activeElement || document.activeElement === document.body || panel?.contains(document.activeElement)) {
        trigger?.focus()
      }
    }
  }, [open, close, panelRef, triggerRef, modal])
}

const Icon = {
  grid: (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="sw-icon">
      {[3, 8, 13].flatMap((y) => [3, 8, 13].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.5" />))}
    </svg>
  ),
  menu: (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="sw-icon">
      <rect x="2" y="3" width="12" height="1.6" rx=".8" />
      <rect x="2" y="7.2" width="12" height="1.6" rx=".8" />
      <rect x="2" y="11.4" width="12" height="1.6" rx=".8" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="sw-icon">
      <path d="M9.4 1.2 9.8 3a5.3 5.3 0 0 1 1.3.75l1.75-.6 1.4 2.43-1.38 1.23a5.4 5.4 0 0 1 0 1.5l1.38 1.23-1.4 2.43-1.75-.6A5.3 5.3 0 0 1 9.8 13l-.4 1.8H6.6L6.2 13a5.3 5.3 0 0 1-1.3-.75l-1.75.6-1.4-2.43 1.38-1.23a5.4 5.4 0 0 1 0-1.5L1.75 6.46l1.4-2.43 1.75.6A5.3 5.3 0 0 1 6.2 3l.4-1.8h2.8ZM8 5.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Z" />
    </svg>
  ),
  external: (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="sw-icon">
      <path d="M9 2h5v5h-1.6V4.7L7.6 9.5 6.5 8.4l4.8-4.8H9V2ZM3 4h4v1.6H4.6v5.8h5.8V9H12v4H3V4Z" />
    </svg>
  ),
  chevron: (
    <svg viewBox="0 0 10 10" aria-hidden="true" className="sw-chev">
      <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
}

function initials(email: string | null): string {
  if (!email) return '?'
  const name = email.split('@')[0]
  const parts = name.split(/[._-]+/).filter(Boolean)
  const s = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)
  return s.toUpperCase()
}

/* ------------------------------------------------------------------------ */
/* The shell                                                                 */
/* ------------------------------------------------------------------------ */

type OpenLayer = null | 'apps' | 'account' | { location: string }

export default function SuiteShell(props: SuiteShellProps) {
  const {
    app,
    catalog,
    layout,
    scroll = 'window',
    navigate,
    session,
    onSignIn,
    entitledApps,
    orgId = null,
    nav = [],
    location = [],
    theme,
    onTheme,
    persistTheme,
    feedback,
    children,
  } = props

  const narrow = useNarrow()
  const [layer, setLayer] = useState<OpenLayer>(null)
  const close = useCallback(() => setLayer(null), [])

  // --- unsaved work ------------------------------------------------------
  const guards = useRef<GuardMap>(new Map())
  const guardApi = useMemo(
    () => ({
      set: (key: string, message: string | null) => {
        if (message) guards.current.set(key, message)
        else guards.current.delete(key)
      },
      confirmLeave: () => {
        const first = guards.current.values().next()
        return first.done ? true : window.confirm(first.value)
      },
    }),
    [],
  )

  const go = useCallback(
    (href: string, e?: ReactMouseEvent) => {
      // Let the browser handle new-tab and new-window clicks untouched.
      if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)) return
      e?.preventDefault()
      if (!guardApi.confirmLeave()) return
      setLayer(null)
      if (/^https?:\/\//.test(href)) window.location.assign(href)
      else navigate(href)
    },
    [guardApi, navigate],
  )

  // --- the catalog, as this person sees it ------------------------------
  const self = catalog.find((a) => a.id === app)
  const account = catalog.find((a) => a.id === 'account')
  const admin = catalog.find((a) => a.id === 'admin')
  const home = catalog.find((a) => a.id === 'landing')
  const otherProducts = catalog.filter(
    (a) =>
      a.kind === 'product' &&
      a.id !== app &&
      a.status !== 'soon' &&
      a.url &&
      (entitledApps === null || entitledApps.includes(a.id) || a.public_browse),
  )
  const hiddenProducts =
    entitledApps !== null &&
    catalog.some((a) => a.kind === 'product' && a.status !== 'soon' && a.request_access && !entitledApps.includes(a.id))

  const withOrg = (a: SuiteApp | undefined): string | null => {
    if (!a?.url) return null
    if (orgId && a.org_path) return a.url + a.org_path.replace('{org_id}', encodeURIComponent(orgId))
    return a.url
  }

  // --- location, as the bar shows it ------------------------------------
  // A level with one choice has nothing to switch to, so it stays out of the
  // bar -- including the deepest level. Showing the only organization on a
  // page that is nothing but that organization's home just repeats it.
  const barLevels = location.filter((lvl) => {
    if (!lvl.current) return false
    if (lvl.alwaysShow) return true
    const count = lvl.count ?? lvl.options?.length
    return !((lvl.hideWhenSingle ?? true) && count === 1)
  })

  // With nothing to switch to, the bar still names the place: the two deepest
  // levels, e.g. "Mewes Farms, Inc. / 2026".
  const staticPlace =
    location
      .filter((l) => l.current)
      .slice(-2)
      .map((l) => l.current!.label)
      .join(' / ') || null

  const breadcrumb =
    feedback?.breadcrumb ?? (location.map((l) => l.current?.label).filter(Boolean).join(' › ') || null)

  const appsTrigger = useRef<HTMLButtonElement>(null)
  const accountTrigger = useRef<HTMLButtonElement>(null)
  const locationTrigger = useRef<HTMLButtonElement | null>(null)
  const feedbackHost = useRef<HTMLDivElement>(null)

  const hasSidebar = layout === 'workspace' && nav.length > 0 && !narrow

  return (
    <GuardContext.Provider value={guardApi}>
      <div
        className={`sw-shell sw-shell--${layout}${scroll === 'contained' ? ' sw-shell--contained' : ''}${
          hasSidebar ? ' sw-shell--sidebar' : ''
        }`}
      >
        <header className="sw-bar">
          <button
            ref={appsTrigger}
            type="button"
            className={`sw-bar__apps${layer === 'apps' ? ' is-open' : ''}`}
            aria-expanded={layer === 'apps'}
            aria-haspopup="dialog"
            aria-label={narrow ? 'Menu' : `${self?.name ?? app} menu`}
            onClick={() => setLayer(layer === 'apps' ? null : 'apps')}
          >
            {narrow ? (
              <>
                {Icon.menu}
                <span className="sw-bar__menu-label">Menu</span>
              </>
            ) : (
              <>
                {Icon.grid}
                <span className="sw-bar__name">{self?.name ?? app}</span>
                {Icon.chevron}
              </>
            )}
          </button>

          <nav className="sw-bar__location" aria-label="Location">
            {barLevels.length === 0 && staticPlace && (
              // Nothing to switch to at any level: say where this is, without
              // a control that opens a menu with no choices in it.
              <span className="sw-seg sw-seg--current sw-seg--static">
                <span className="sw-seg__text">{staticPlace}</span>
              </span>
            )}
            {barLevels.map((lvl, i) => (
              <span key={lvl.key} className="sw-seg-wrap">
                {i > 0 && <span className="sw-seg-sep" aria-hidden="true">/</span>}
                <button
                  type="button"
                  className={`sw-seg${i === barLevels.length - 1 ? ' sw-seg--current' : ''}${
                    typeof layer === 'object' && layer?.location === lvl.key ? ' is-open' : ''
                  }`}
                  aria-haspopup="dialog"
                  aria-expanded={typeof layer === 'object' && layer?.location === lvl.key}
                  aria-label={`${lvl.label}: ${lvl.current!.label}. Change`}
                  onClick={(e) => {
                    locationTrigger.current = e.currentTarget
                    setLayer(typeof layer === 'object' && layer?.location === lvl.key ? null : { location: lvl.key })
                  }}
                >
                  <span className="sw-seg__text">{lvl.current!.label}</span>
                  {Icon.chevron}
                </button>
              </span>
            ))}
          </nav>

          <div className="sw-bar__you">
            {session ? (
              <button
                ref={accountTrigger}
                type="button"
                className={`sw-avatar${layer === 'account' ? ' is-open' : ''}`}
                aria-haspopup="dialog"
                aria-expanded={layer === 'account'}
                aria-label={`Account menu${session.email ? ` for ${session.email}` : ''}`}
                onClick={() => setLayer(layer === 'account' ? null : 'account')}
              >
                {initials(session.email)}
              </button>
            ) : (
              <>
                <ThemeToggle value={theme} onChange={onTheme} persist={persistTheme} compact />
                {onSignIn && (
                  <button type="button" className="sw-btn sw-btn--primary" onClick={onSignIn}>
                    Sign In
                  </button>
                )}
              </>
            )}
          </div>
        </header>

        {layer === 'apps' && (
          <AppsLayer
            narrow={narrow}
            close={close}
            triggerRef={appsTrigger}
            self={self}
            // With the sidebar on screen, the menu does not repeat it: it is the
            // way to other applications. Without one (browse apps, and every app
            // on a phone) it carries the app's destinations too.
            nav={hasSidebar ? [] : nav}
            otherProducts={otherProducts}
            home={home}
            account={account}
            hiddenProducts={hiddenProducts}
            go={go}
            withOrg={withOrg}
          />
        )}

        {typeof layer === 'object' && layer !== null && (
          <LocationLayer
            narrow={narrow}
            close={close}
            triggerRef={locationTrigger}
            levels={location}
            focusKey={layer.location}
            go={go}
          />
        )}

        {layer === 'account' && session && (
          <AccountLayer
            narrow={narrow}
            close={close}
            triggerRef={accountTrigger}
            session={session}
            accountHref={session.isSuperadmin ? admin?.url ?? null : withOrg(account)}
            accountLabel={session.isSuperadmin ? 'Admin' : 'Account'}
            onAccountSite={app === 'account' || app === 'admin'}
            theme={theme}
            onTheme={onTheme}
            persistTheme={persistTheme}
            feedbackEnabled={!!feedback?.enabled}
            openFeedback={() => {
              setLayer(null)
              // The widget owns its dialog; open it through its own button.
              feedbackHost.current?.querySelector<HTMLButtonElement>('button')?.click()
            }}
            go={go}
          />
        )}

        <div className="sw-body">
          {hasSidebar && (
            <aside className="sw-side" aria-label={`${self?.name ?? app} navigation`}>
              <SideNav items={nav} go={go} />
            </aside>
          )}
          <main className="sw-main">{children}</main>
        </div>

        {feedback?.enabled && (
          <div ref={feedbackHost} className="sw-feedback">
            <FeedbackWidget
              app={feedback.app}
              enabled
              submit={feedback.submit}
              orgId={feedback.orgId ?? orgId}
              buildSha={feedback.buildSha ?? null}
              breadcrumb={breadcrumb}
              className="sw-feedback__tab"
            />
          </div>
        )}
      </div>
    </GuardContext.Provider>
  )
}

/* ------------------------------------------------------------------------ */
/* Layers                                                                    */
/* ------------------------------------------------------------------------ */

function Layer({
  narrow,
  side,
  align,
  label,
  close,
  triggerRef,
  children,
}: {
  narrow: boolean
  /** How it presents on a phone. */
  side: 'drawer' | 'sheet'
  align: 'start' | 'center' | 'end'
  label: string
  close: () => void
  triggerRef: RefObject<HTMLElement | null>
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useLayer(true, close, ref, triggerRef, narrow)
  // A popover hangs under the control that opened it, kept on screen.
  const [left, setLeft] = useState<number | undefined>(undefined)
  useEffect(() => {
    if (narrow || align !== 'center') return
    const r = triggerRef.current?.getBoundingClientRect()
    const w = ref.current?.offsetWidth ?? 300
    if (r) setLeft(Math.max(10, Math.min(r.left, window.innerWidth - w - 10)))
  }, [narrow, align, triggerRef])
  if (narrow) {
    return (
      <div className="sw-scrim">
        <div
          ref={ref}
          className={`sw-${side}`}
          role="dialog"
          aria-modal="true"
          aria-label={label}
        >
          {side === 'sheet' && <div className="sw-sheet__grab" aria-hidden="true" />}
          {children}
        </div>
      </div>
    )
  }
  return (
    <div
      ref={ref}
      className={`sw-pop sw-pop--${align}`}
      role="dialog"
      aria-label={label}
      style={left !== undefined ? { left } : undefined}
    >
      {children}
    </div>
  )
}

function ItemLink({
  href,
  go,
  current,
  badge,
  external,
  children,
}: {
  href: string
  go: (href: string, e?: ReactMouseEvent) => void
  current?: boolean
  badge?: number | string | null
  external?: boolean
  children: ReactNode
}) {
  return (
    <a
      className={`sw-item${current ? ' is-current' : ''}`}
      href={href}
      aria-current={current ? 'page' : undefined}
      onClick={(e) => go(href, e)}
    >
      <span className="sw-item__label">{children}</span>
      {badge != null && badge !== 0 && <span className="sw-badge">{badge}</span>}
      {external && <span className="sw-item__ext" aria-hidden="true">↗</span>}
    </a>
  )
}

function groupItems(items: NavItem[]): [string | null, NavItem[]][] {
  const out: [string | null, NavItem[]][] = []
  for (const it of items) {
    const g = it.group ?? null
    const hit = out.find(([k]) => k === g)
    if (hit) hit[1].push(it)
    else out.push([g, [it]])
  }
  // Ungrouped destinations lead.
  return out.sort(([a], [b]) => (a === null ? -1 : b === null ? 1 : 0))
}

export function SideNav({
  items,
  go,
}: {
  items: NavItem[]
  go: (href: string, e?: ReactMouseEvent) => void
}) {
  return (
    <div className="sw-nav">
      {groupItems(items).map(([group, its]) => (
        <div key={group ?? '_'} className="sw-group">
          {group && <div className="sw-group__title">{group}</div>}
          {its.map((it) => (
            <ItemLink key={it.key} href={it.href} go={go} current={it.current} badge={it.badge}>
              {it.label}
            </ItemLink>
          ))}
        </div>
      ))}
    </div>
  )
}

function AppsLayer({
  narrow,
  close,
  triggerRef,
  self,
  nav,
  otherProducts,
  home,
  account,
  hiddenProducts,
  go,
  withOrg,
}: {
  narrow: boolean
  close: () => void
  triggerRef: RefObject<HTMLElement | null>
  self: SuiteApp | undefined
  nav: NavItem[]
  otherProducts: SuiteApp[]
  home: SuiteApp | undefined
  account: SuiteApp | undefined
  hiddenProducts: boolean
  go: (href: string, e?: ReactMouseEvent) => void
  withOrg: (a: SuiteApp | undefined) => string | null
}) {
  const accountUrl = withOrg(account)
  return (
    <Layer narrow={narrow} side="drawer" align="start" label="Menu" close={close} triggerRef={triggerRef}>
      {nav.length > 0 && (
        <>
          {narrow && <div className="sw-group__title sw-group__title--app">{self?.name}</div>}
          <SideNav items={nav} go={go} />
          <div className="sw-rule" />
        </>
      )}
      <div className="sw-group">
        <div className="sw-group__title">Apps</div>
        {otherProducts.map((a) => {
          const href = withOrg(a)!
          return (
            <ItemLink key={a.id} href={href} go={go}>
              <span className="sw-app">
                <span className="sw-app__name">{a.name}</span>
                <span className="sw-app__tag">{a.tagline}</span>
              </span>
            </ItemLink>
          )
        })}
        {home?.url && self?.id !== home.id && (
          <ItemLink href={home.url} go={go}>
            DertWerk Home
          </ItemLink>
        )}
        {hiddenProducts && accountUrl && (
          <ItemLink href={accountUrl} go={go}>
            <span className="sw-item__more">Get More Apps</span>
          </ItemLink>
        )}
      </div>
    </Layer>
  )
}

function LocationLayer({
  narrow,
  close,
  triggerRef,
  levels,
  focusKey,
  go,
}: {
  narrow: boolean
  close: () => void
  triggerRef: RefObject<HTMLElement | null>
  levels: LocationLevel[]
  focusKey: string
  go: (href: string, e?: ReactMouseEvent) => void
}) {
  return (
    <Layer narrow={narrow} side="sheet" align="center" label="Change location" close={close} triggerRef={triggerRef}>
      <div className="sw-loc">
        <NestedLevels levels={levels} index={0} focusKey={focusKey} narrow={narrow} go={go} />
      </div>
    </Layer>
  )
}

/**
 * Each level drawn inside the one above it -- a farm inside its organization,
 * a field inside its farm -- indented, with a guide line down the left edge of
 * everything that belongs to the level above. Stacked flat, the levels read as
 * unrelated lists.
 */
function NestedLevels({
  levels,
  index,
  focusKey,
  narrow,
  go,
}: {
  levels: LocationLevel[]
  index: number
  focusKey: string
  narrow: boolean
  go: (href: string, e?: ReactMouseEvent) => void
}) {
  const lvl = levels[index]
  if (!lvl) return null
  const deepest = index === levels.length - 1
  return (
    <LocationSection level={lvl} focus={lvl.key === focusKey} narrow={narrow} deepest={deepest} go={go}>
      {!deepest && (
        <div className="sw-loc__child">
          <NestedLevels levels={levels} index={index + 1} focusKey={focusKey} narrow={narrow} go={go} />
        </div>
      )}
    </LocationSection>
  )
}

const SEARCH_AFTER = 8

function samePath(a: string, b: string): boolean {
  const norm = (p: string) => p.replace(/[?#].*$/, '').replace(/\/+$/, '') || '/'
  return norm(a) === norm(b)
}

function LocationSection({
  level,
  focus,
  narrow,
  deepest,
  go,
  children,
}: {
  level: LocationLevel
  focus: boolean
  narrow: boolean
  deepest: boolean
  go: (href: string, e?: ReactMouseEvent) => void
  children?: ReactNode
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const [options, setOptions] = useState<LocationOption[] | null>(level.options ?? null)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (level.options || !level.loadOptions) return
    let live = true
    level
      .loadOptions()
      .then((o) => live && setOptions(o))
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
    // Load once per opening; the level object is rebuilt on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Show where you are in a long list rather than its first screenful.
  useEffect(() => {
    const cur = listRef.current?.querySelector<HTMLElement>('.is-current')
    const box = listRef.current
    if (cur && box && box.scrollHeight > box.clientHeight) {
      box.scrollTop = cur.offsetTop - box.offsetTop - box.clientHeight / 2 + cur.offsetHeight / 2
    }
  }, [options])

  const list = options ?? (level.current ? [level.current] : [])
  const q = query.trim().toLowerCase()
  const shown = q ? list.filter((o) => o.label.toLowerCase().includes(q) || o.hint?.toLowerCase().includes(q)) : list
  const searchable = list.length > SEARCH_AFTER

  const groups: [string | null, LocationOption[]][] = []
  for (const o of shown) {
    const g = o.group ?? null
    const hit = groups.find(([k]) => k === g)
    if (hit) hit[1].push(o)
    else groups.push([g, [o]])
  }

  return (
    <section
      className={`sw-group sw-loc__level${deepest ? ' sw-loc__level--deepest' : ''}`}
      aria-label={level.label}
    >
      <div className="sw-group__title">{level.label}</div>
      {searchable && (
        <input
          className="sw-search"
          type="search"
          placeholder={`Search ${list.length} ${level.label.toLowerCase()}s`}
          aria-label={`Search ${level.label.toLowerCase()}s`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          // Not on a phone: focusing a text box raises the keyboard over the
          // very list the person opened this to look at.
          data-autofocus={focus && !narrow ? '' : undefined}
        />
      )}
      <div ref={listRef} className={searchable ? 'sw-loc__list sw-loc__list--scroll' : 'sw-loc__list'}>
        {groups.map(([g, opts]) => (
          <div key={g ?? '_'}>
            {g && <div className="sw-loc__sub">{g}</div>}
            {opts.map((o) => {
              const current = o.id === level.current?.id
              const href = level.href(o.id)
              // The current item is still a link from anywhere below it: on an
              // operation page, "Field 9" is the way back to the field. Only on
              // the level's own page is it inert.
              const here = current && samePath(href, window.location.pathname)
              const links = level.optionLinks?.(o.id) ?? []
              return (
                <div key={o.id} className={`sw-optrow${current ? ' is-current' : ''}`}>
                  <a
                    className={`sw-item${current ? ' is-current' : ''}`}
                    href={href}
                    aria-current={current ? 'location' : undefined}
                    onClick={(e) => (here ? (e.preventDefault(), undefined) : go(href, e))}
                    data-autofocus={focus && current && (!searchable || narrow) ? '' : undefined}
                  >
                    <span className="sw-item__label">{o.label}</span>
                    {o.hint && <span className="sw-item__hint">{o.hint}</span>}
                  </a>
                  {links.map((l) => (
                    <a
                      key={l.key}
                      className="sw-optlink"
                      href={l.href}
                      aria-label={l.label}
                      title={l.label}
                      onClick={(e) => go(l.href, e)}
                    >
                      {Icon[l.icon]}
                    </a>
                  ))}
                </div>
              )
            })}
          </div>
        ))}
        {options === null && !failed && level.loadOptions && <div className="sw-item sw-item--quiet">Loading…</div>}
        {failed && <div className="sw-item sw-item--quiet">Couldn't load the list.</div>}
        {q && shown.length === 0 && <div className="sw-item sw-item--quiet">No match</div>}
      </div>
      {level.actions && level.actions.length > 0 && (
        <div className="sw-loc__footer">
          {level.actions.map((a) => (
            <a key={a.key} className="sw-loc__footlink" href={a.href} onClick={(e) => go(a.href, e)}>
              {a.label} →
            </a>
          ))}
        </div>
      )}
      {children}
    </section>
  )
}

function AccountLayer({
  narrow,
  close,
  triggerRef,
  session,
  accountHref,
  accountLabel,
  onAccountSite,
  theme,
  onTheme,
  persistTheme,
  feedbackEnabled,
  openFeedback,
  go,
}: {
  narrow: boolean
  close: () => void
  triggerRef: RefObject<HTMLElement | null>
  session: SuiteSession
  accountHref: string | null
  accountLabel: string
  onAccountSite: boolean
  theme: ThemeChoice
  onTheme: (t: ThemeChoice) => void
  persistTheme?: (t: ThemeChoice) => void
  feedbackEnabled: boolean
  openFeedback: () => void
  go: (href: string, e?: ReactMouseEvent) => void
}) {
  return (
    <Layer narrow={narrow} side="sheet" align="end" label="Account" close={close} triggerRef={triggerRef}>
      <div className="sw-group">
        {session.email && <div className="sw-who">{session.email}</div>}
        <div className="sw-appearance">
          <span className="sw-appearance__label">Appearance</span>
          <ThemeToggle value={theme} onChange={onTheme} persist={persistTheme} compact />
        </div>
        {feedbackEnabled && (
          <button type="button" className="sw-item" onClick={openFeedback}>
            <span className="sw-item__label">Send Feedback</span>
          </button>
        )}
        {accountHref && !onAccountSite && (
          <ItemLink href={accountHref} go={go} external>
            {accountLabel}
          </ItemLink>
        )}
        <div className="sw-rule" />
        <button
          type="button"
          className="sw-item"
          onClick={() => {
            close()
            session.signOut()
          }}
        >
          <span className="sw-item__label">Sign Out</span>
        </button>
      </div>
    </Layer>
  )
}
