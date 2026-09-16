import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, } from 'react';
import FeedbackWidget from './FeedbackWidget';
import ThemeToggle from './ThemeToggle';
const GuardContext = createContext(null);
const DEFAULT_UNSAVED = 'You have unsaved changes. Leave this page and lose them?';
/**
 * Declare unsaved work. While `dirty` is true, every navigation the shell owns
 * (app menu, location switcher, account menu) asks first, and so does closing
 * or reloading the tab.
 *
 * Links an app renders itself, and the browser's back button inside a
 * BrowserRouter, are outside the shell's reach: call `useConfirmLeave()` for
 * those.
 */
export function useUnsavedChanges(dirty, message = DEFAULT_UNSAVED) {
    const ctx = useContext(GuardContext);
    const key = useId();
    useEffect(() => {
        ctx?.set(key, dirty ? message : null);
        return () => ctx?.set(key, null);
    }, [ctx, key, dirty, message]);
    useEffect(() => {
        if (!dirty)
            return;
        const onBeforeUnload = (e) => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [dirty]);
}
/** Returns a function that asks before leaving when anything is unsaved, and
 *  reports whether leaving should go ahead. */
export function useConfirmLeave() {
    const ctx = useContext(GuardContext);
    return ctx?.confirmLeave ?? (() => true);
}
/* ------------------------------------------------------------------------ */
/* Small pieces                                                              */
/* ------------------------------------------------------------------------ */
function useNarrow(maxWidth = 760) {
    const query = `(max-width: ${maxWidth}px)`;
    const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false);
    useEffect(() => {
        if (!window.matchMedia)
            return;
        const mq = window.matchMedia(query);
        const on = () => setNarrow(mq.matches);
        on();
        mq.addEventListener('change', on);
        return () => mq.removeEventListener('change', on);
    }, [query]);
    return narrow;
}
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
/**
 * Open/close behaviour shared by every popover, drawer and sheet: Escape
 * closes, a click outside closes, focus moves in on open and returns to the
 * control that opened it on close. `modal` also keeps Tab inside.
 */
function useLayer(open, close, panelRef, triggerRef, modal) {
    useEffect(() => {
        if (!open)
            return;
        const trigger = triggerRef.current;
        const panel = panelRef.current;
        const first = panel?.querySelector('[data-autofocus]') ?? panel?.querySelector(FOCUSABLE);
        first?.focus();
        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                close();
                return;
            }
            if (modal && e.key === 'Tab' && panel) {
                const items = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
                if (!items.length)
                    return;
                const a = items[0];
                const z = items[items.length - 1];
                if (e.shiftKey && document.activeElement === a) {
                    e.preventDefault();
                    z.focus();
                }
                else if (!e.shiftKey && document.activeElement === z) {
                    e.preventDefault();
                    a.focus();
                }
            }
        };
        const onDown = (e) => {
            const t = e.target;
            if (panel?.contains(t) || trigger?.contains(t))
                return;
            close();
        };
        document.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', onDown);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('mousedown', onDown);
            // Only pull focus back if it is still inside the layer being closed;
            // a click that moved focus somewhere on purpose keeps it there.
            if (!document.activeElement || document.activeElement === document.body || panel?.contains(document.activeElement)) {
                trigger?.focus();
            }
        };
    }, [open, close, panelRef, triggerRef, modal]);
}
const Icon = {
    grid: (_jsx("svg", { viewBox: "0 0 16 16", "aria-hidden": "true", className: "sw-icon", children: [3, 8, 13].flatMap((y) => [3, 8, 13].map((x) => _jsx("circle", { cx: x, cy: y, r: "1.5" }, `${x}${y}`))) })),
    menu: (_jsxs("svg", { viewBox: "0 0 16 16", "aria-hidden": "true", className: "sw-icon", children: [_jsx("rect", { x: "2", y: "3", width: "12", height: "1.6", rx: ".8" }), _jsx("rect", { x: "2", y: "7.2", width: "12", height: "1.6", rx: ".8" }), _jsx("rect", { x: "2", y: "11.4", width: "12", height: "1.6", rx: ".8" })] })),
    settings: (_jsx("svg", { viewBox: "0 0 16 16", "aria-hidden": "true", className: "sw-icon", children: _jsx("path", { d: "M9.4 1.2 9.8 3a5.3 5.3 0 0 1 1.3.75l1.75-.6 1.4 2.43-1.38 1.23a5.4 5.4 0 0 1 0 1.5l1.38 1.23-1.4 2.43-1.75-.6A5.3 5.3 0 0 1 9.8 13l-.4 1.8H6.6L6.2 13a5.3 5.3 0 0 1-1.3-.75l-1.75.6-1.4-2.43 1.38-1.23a5.4 5.4 0 0 1 0-1.5L1.75 6.46l1.4-2.43 1.75.6A5.3 5.3 0 0 1 6.2 3l.4-1.8h2.8ZM8 5.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Z" }) })),
    external: (_jsx("svg", { viewBox: "0 0 16 16", "aria-hidden": "true", className: "sw-icon", children: _jsx("path", { d: "M9 2h5v5h-1.6V4.7L7.6 9.5 6.5 8.4l4.8-4.8H9V2ZM3 4h4v1.6H4.6v5.8h5.8V9H12v4H3V4Z" }) })),
    chevron: (_jsx("svg", { viewBox: "0 0 10 10", "aria-hidden": "true", className: "sw-chev", children: _jsx("path", { d: "M2 3.5 5 6.5 8 3.5", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }) })),
};
function initials(email) {
    if (!email)
        return '?';
    const name = email.split('@')[0];
    const parts = name.split(/[._-]+/).filter(Boolean);
    const s = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
    return s.toUpperCase();
}
export default function SuiteShell(props) {
    const { app, catalog, layout, scroll = 'window', navigate, session, onSignIn, entitledApps, orgId = null, nav = [], location = [], theme, onTheme, persistTheme, feedback, children, } = props;
    const narrow = useNarrow();
    const [layer, setLayer] = useState(null);
    const close = useCallback(() => setLayer(null), []);
    // --- unsaved work ------------------------------------------------------
    const guards = useRef(new Map());
    const guardApi = useMemo(() => ({
        set: (key, message) => {
            if (message)
                guards.current.set(key, message);
            else
                guards.current.delete(key);
        },
        confirmLeave: () => {
            const first = guards.current.values().next();
            return first.done ? true : window.confirm(first.value);
        },
    }), []);
    const go = useCallback((href, e) => {
        // Let the browser handle new-tab and new-window clicks untouched.
        if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0))
            return;
        e?.preventDefault();
        if (!guardApi.confirmLeave())
            return;
        setLayer(null);
        if (/^https?:\/\//.test(href))
            window.location.assign(href);
        else
            navigate(href);
    }, [guardApi, navigate]);
    // --- the catalog, as this person sees it ------------------------------
    const self = catalog.find((a) => a.id === app);
    const account = catalog.find((a) => a.id === 'account');
    const admin = catalog.find((a) => a.id === 'admin');
    const home = catalog.find((a) => a.id === 'landing');
    const otherProducts = catalog.filter((a) => a.kind === 'product' &&
        a.id !== app &&
        a.status !== 'soon' &&
        a.url &&
        (entitledApps === null || entitledApps.includes(a.id) || a.public_browse));
    const hiddenProducts = entitledApps !== null &&
        catalog.some((a) => a.kind === 'product' && a.status !== 'soon' && a.request_access && !entitledApps.includes(a.id));
    const resumeUrl = (a) => {
        if (!a?.url)
            return null;
        if (orgId && a.org_path)
            return `${a.url}/?org=${encodeURIComponent(orgId)}`;
        return a.url;
    };
    const withOrg = (a) => {
        if (!a?.url)
            return null;
        if (orgId && a.org_path)
            return a.url + a.org_path.replace('{org_id}', encodeURIComponent(orgId));
        return a.url;
    };
    // --- location, as the bar shows it ------------------------------------
    // A level with one choice has nothing to switch to, so it stays out of the
    // bar -- including the deepest level. Showing the only organization on a
    // page that is nothing but that organization's home just repeats it.
    const barLevels = location.filter((lvl) => {
        if (!lvl.current)
            return false;
        if (lvl.alwaysShow)
            return true;
        const count = lvl.count ?? lvl.options?.length;
        return !((lvl.hideWhenSingle ?? true) && count === 1);
    });
    // With nothing to switch to, the bar still names the place: the two deepest
    // levels, e.g. "Mewes Farms, Inc. / 2026".
    const staticPlace = location
        .filter((l) => l.current)
        .slice(-2)
        .map((l) => l.current.label)
        .join(' / ') || null;
    const breadcrumb = feedback?.breadcrumb ?? (location.map((l) => l.current?.label).filter(Boolean).join(' › ') || null);
    const appsTrigger = useRef(null);
    const accountTrigger = useRef(null);
    const locationTrigger = useRef(null);
    const feedbackHost = useRef(null);
    const hasSidebar = layout === 'workspace' && nav.length > 0 && !narrow;
    return (_jsx(GuardContext.Provider, { value: guardApi, children: _jsxs("div", { className: `sw-shell sw-shell--${layout}${scroll === 'contained' ? ' sw-shell--contained' : ''}${hasSidebar ? ' sw-shell--sidebar' : ''}`, children: [_jsxs("header", { className: "sw-bar", children: [_jsx("button", { ref: appsTrigger, type: "button", className: `sw-bar__apps${layer === 'apps' ? ' is-open' : ''}`, "aria-expanded": layer === 'apps', "aria-haspopup": "dialog", "aria-label": narrow ? 'Menu' : `${self?.name ?? app} menu`, onClick: () => setLayer(layer === 'apps' ? null : 'apps'), children: narrow ? (_jsxs(_Fragment, { children: [Icon.menu, _jsx("span", { className: "sw-bar__menu-label", children: "Menu" })] })) : (_jsxs(_Fragment, { children: [Icon.grid, _jsx("span", { className: "sw-bar__name", children: self?.name ?? app }), Icon.chevron] })) }), _jsxs("nav", { className: "sw-bar__location", "aria-label": "Location", children: [barLevels.length === 0 && staticPlace && (_jsx("span", { className: "sw-seg sw-seg--current sw-seg--static", children: _jsx("span", { className: "sw-seg__text", children: staticPlace }) })), barLevels.map((lvl, i) => (_jsxs("span", { className: "sw-seg-wrap", children: [i > 0 && _jsx("span", { className: "sw-seg-sep", "aria-hidden": "true", children: "/" }), _jsxs("button", { type: "button", className: `sw-seg${i === barLevels.length - 1 ? ' sw-seg--current' : ''}${typeof layer === 'object' && layer?.location === lvl.key ? ' is-open' : ''}`, "aria-haspopup": "dialog", "aria-expanded": typeof layer === 'object' && layer?.location === lvl.key, "aria-label": `${lvl.label}: ${lvl.current.label}. Change`, onClick: (e) => {
                                                locationTrigger.current = e.currentTarget;
                                                setLayer(typeof layer === 'object' && layer?.location === lvl.key ? null : { location: lvl.key });
                                            }, children: [_jsx("span", { className: "sw-seg__text", children: lvl.current.label }), Icon.chevron] })] }, lvl.key)))] }), _jsx("div", { className: "sw-bar__you", children: session ? (_jsx("button", { ref: accountTrigger, type: "button", className: `sw-avatar${layer === 'account' ? ' is-open' : ''}`, "aria-haspopup": "dialog", "aria-expanded": layer === 'account', "aria-label": `Account menu${session.email ? ` for ${session.email}` : ''}`, onClick: () => setLayer(layer === 'account' ? null : 'account'), children: initials(session.email) })) : (_jsxs(_Fragment, { children: [_jsx(ThemeToggle, { value: theme, onChange: onTheme, persist: persistTheme, compact: true }), onSignIn && (_jsx("button", { type: "button", className: "sw-btn sw-btn--primary", onClick: onSignIn, children: "Sign In" }))] })) })] }), layer === 'apps' && (_jsx(AppsLayer, { narrow: narrow, close: close, triggerRef: appsTrigger, self: self, 
                    // With the sidebar on screen, the menu does not repeat it: it is the
                    // way to other applications. Without one (browse apps, and every app
                    // on a phone) it carries the app's destinations too.
                    nav: hasSidebar ? [] : nav, otherProducts: otherProducts, home: home, account: account, hiddenProducts: hiddenProducts, go: go, withOrg: withOrg, resumeUrl: resumeUrl })), typeof layer === 'object' && layer !== null && (_jsx(LocationLayer, { narrow: narrow, close: close, triggerRef: locationTrigger, levels: location, focusKey: layer.location, go: go })), layer === 'account' && session && (_jsx(AccountLayer, { narrow: narrow, close: close, triggerRef: accountTrigger, session: session, accountHref: session.isSuperadmin ? admin?.url ?? null : withOrg(account), accountLabel: session.isSuperadmin ? 'Admin' : 'Account', onAccountSite: app === 'account' || app === 'admin', theme: theme, onTheme: onTheme, persistTheme: persistTheme, feedbackEnabled: !!feedback?.enabled, openFeedback: () => {
                        setLayer(null);
                        // The widget owns its dialog; open it through its own button.
                        feedbackHost.current?.querySelector('button')?.click();
                    }, go: go })), _jsxs("div", { className: "sw-body", children: [hasSidebar && (_jsx("aside", { className: "sw-side", "aria-label": `${self?.name ?? app} navigation`, children: _jsx(SideNav, { items: nav, go: go }) })), _jsx("main", { className: "sw-main", children: children })] }), feedback?.enabled && (_jsx("div", { ref: feedbackHost, className: "sw-feedback", children: _jsx(FeedbackWidget, { app: feedback.app, enabled: true, submit: feedback.submit, orgId: feedback.orgId ?? orgId, buildSha: feedback.buildSha ?? null, breadcrumb: breadcrumb, className: "sw-feedback__tab" }) }))] }) }));
}
/* ------------------------------------------------------------------------ */
/* Layers                                                                    */
/* ------------------------------------------------------------------------ */
function Layer({ narrow, side, align, label, close, triggerRef, children, }) {
    const ref = useRef(null);
    useLayer(true, close, ref, triggerRef, narrow);
    // A popover hangs under the control that opened it, kept on screen.
    const [left, setLeft] = useState(undefined);
    useEffect(() => {
        if (narrow || align !== 'center')
            return;
        const r = triggerRef.current?.getBoundingClientRect();
        const w = ref.current?.offsetWidth ?? 300;
        if (r)
            setLeft(Math.max(10, Math.min(r.left, window.innerWidth - w - 10)));
    }, [narrow, align, triggerRef]);
    if (narrow) {
        return (_jsx("div", { className: "sw-scrim", children: _jsxs("div", { ref: ref, className: `sw-${side}`, role: "dialog", "aria-modal": "true", "aria-label": label, children: [side === 'sheet' && _jsx("div", { className: "sw-sheet__grab", "aria-hidden": "true" }), children] }) }));
    }
    return (_jsx("div", { ref: ref, className: `sw-pop sw-pop--${align}`, role: "dialog", "aria-label": label, style: left !== undefined ? { left } : undefined, children: children }));
}
function ItemLink({ href, go, current, badge, external, children, }) {
    return (_jsxs("a", { className: `sw-item${current ? ' is-current' : ''}`, href: href, "aria-current": current ? 'page' : undefined, onClick: (e) => go(href, e), children: [_jsx("span", { className: "sw-item__label", children: children }), badge != null && badge !== 0 && _jsx("span", { className: "sw-badge", children: badge }), external && _jsx("span", { className: "sw-item__ext", "aria-hidden": "true", children: "\u2197" })] }));
}
function groupItems(items) {
    const out = [];
    for (const it of items) {
        const g = it.group ?? null;
        const hit = out.find(([k]) => k === g);
        if (hit)
            hit[1].push(it);
        else
            out.push([g, [it]]);
    }
    // Ungrouped destinations lead.
    return out.sort(([a], [b]) => (a === null ? -1 : b === null ? 1 : 0));
}
export function SideNav({ items, go, }) {
    return (_jsx("div", { className: "sw-nav", children: groupItems(items).map(([group, its]) => (_jsxs("div", { className: "sw-group", children: [group && _jsx("div", { className: "sw-group__title", children: group }), its.map((it) => (_jsx(ItemLink, { href: it.href, go: go, current: it.current, badge: it.badge, children: it.label }, it.key)))] }, group ?? '_'))) }));
}
function AppsLayer({ narrow, close, triggerRef, self, nav, otherProducts, home, account, hiddenProducts, go, withOrg, resumeUrl, }) {
    const accountUrl = withOrg(account);
    return (_jsxs(Layer, { narrow: narrow, side: "drawer", align: "start", label: "Menu", close: close, triggerRef: triggerRef, children: [nav.length > 0 && (_jsxs(_Fragment, { children: [narrow && _jsx("div", { className: "sw-group__title sw-group__title--app", children: self?.name }), _jsx(SideNav, { items: nav, go: go }), _jsx("div", { className: "sw-rule" })] })), _jsxs("div", { className: "sw-group", children: [_jsx("div", { className: "sw-group__title", children: "Apps" }), otherProducts.map((a) => {
                        // The app's front door with the organization as a hint, so it reopens
                        // where this person left off there instead of at the organization page.
                        const href = resumeUrl(a);
                        return (_jsx(ItemLink, { href: href, go: go, children: _jsxs("span", { className: "sw-app", children: [_jsx("span", { className: "sw-app__name", children: a.name }), _jsx("span", { className: "sw-app__tag", children: a.tagline })] }) }, a.id));
                    }), home?.url && self?.id !== home.id && (_jsx(ItemLink, { href: home.url, go: go, children: "DertWerk Home" })), hiddenProducts && accountUrl && (_jsx(ItemLink, { href: accountUrl, go: go, children: _jsx("span", { className: "sw-item__more", children: "Get More Apps" }) }))] })] }));
}
function LocationLayer({ narrow, close, triggerRef, levels, focusKey, go, }) {
    return (_jsx(Layer, { narrow: narrow, side: "sheet", align: "center", label: "Change location", close: close, triggerRef: triggerRef, children: _jsx("div", { className: "sw-loc", children: _jsx(NestedLevels, { levels: levels, index: 0, focusKey: focusKey, narrow: narrow, go: go }) }) }));
}
/**
 * Each level drawn inside the one above it -- a farm inside its organization,
 * a field inside its farm -- indented, with a guide line down the left edge of
 * everything that belongs to the level above. Stacked flat, the levels read as
 * unrelated lists.
 */
function NestedLevels({ levels, index, focusKey, narrow, go, }) {
    const lvl = levels[index];
    if (!lvl)
        return null;
    const deepest = index === levels.length - 1;
    return (_jsx(LocationSection, { level: lvl, focus: lvl.key === focusKey, narrow: narrow, deepest: deepest, go: go, children: !deepest && (_jsx("div", { className: "sw-loc__child", children: _jsx(NestedLevels, { levels: levels, index: index + 1, focusKey: focusKey, narrow: narrow, go: go }) })) }));
}
const SEARCH_AFTER = 8;
function samePath(a, b) {
    const norm = (p) => p.replace(/[?#].*$/, '').replace(/\/+$/, '') || '/';
    return norm(a) === norm(b);
}
function LocationSection({ level, focus, narrow, deepest, go, children, }) {
    const listRef = useRef(null);
    const [options, setOptions] = useState(level.options ?? null);
    const [failed, setFailed] = useState(false);
    const [query, setQuery] = useState('');
    useEffect(() => {
        if (level.options || !level.loadOptions)
            return;
        let live = true;
        level
            .loadOptions()
            .then((o) => live && setOptions(o))
            .catch(() => live && setFailed(true));
        return () => {
            live = false;
        };
        // Load once per opening; the level object is rebuilt on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Show where you are in a long list rather than its first screenful.
    useEffect(() => {
        const cur = listRef.current?.querySelector('.is-current');
        const box = listRef.current;
        if (cur && box && box.scrollHeight > box.clientHeight) {
            box.scrollTop = cur.offsetTop - box.offsetTop - box.clientHeight / 2 + cur.offsetHeight / 2;
        }
    }, [options]);
    const list = options ?? (level.current ? [level.current] : []);
    const q = query.trim().toLowerCase();
    const shown = q ? list.filter((o) => o.label.toLowerCase().includes(q) || o.hint?.toLowerCase().includes(q)) : list;
    const searchable = list.length > SEARCH_AFTER;
    const groups = [];
    for (const o of shown) {
        const g = o.group ?? null;
        const hit = groups.find(([k]) => k === g);
        if (hit)
            hit[1].push(o);
        else
            groups.push([g, [o]]);
    }
    return (_jsxs("section", { className: `sw-group sw-loc__level${deepest ? ' sw-loc__level--deepest' : ''}`, "aria-label": level.label, children: [_jsx("div", { className: "sw-group__title", children: level.label }), searchable && (_jsx("input", { className: "sw-search", type: "search", placeholder: `Search ${list.length} ${level.label.toLowerCase()}s`, "aria-label": `Search ${level.label.toLowerCase()}s`, value: query, onChange: (e) => setQuery(e.target.value), "data-autofocus": focus && !narrow ? '' : undefined })), _jsxs("div", { ref: listRef, className: searchable ? 'sw-loc__list sw-loc__list--scroll' : 'sw-loc__list', children: [groups.map(([g, opts]) => (_jsxs("div", { children: [g && _jsx("div", { className: "sw-loc__sub", children: g }), opts.map((o) => {
                                const current = o.id === level.current?.id;
                                const href = level.href(o.id);
                                // The current item is still a link from anywhere below it: on an
                                // operation page, "Field 9" is the way back to the field. Only on
                                // the level's own page is it inert.
                                const here = current && samePath(href, window.location.pathname);
                                const links = level.optionLinks?.(o.id) ?? [];
                                return (_jsxs("div", { className: `sw-optrow${current ? ' is-current' : ''}`, children: [_jsxs("a", { className: `sw-item${current ? ' is-current' : ''}`, href: href, "aria-current": current ? 'location' : undefined, onClick: (e) => (here ? (e.preventDefault(), undefined) : go(href, e)), "data-autofocus": focus && current && (!searchable || narrow) ? '' : undefined, children: [_jsx("span", { className: "sw-item__label", children: o.label }), o.hint && _jsx("span", { className: "sw-item__hint", children: o.hint })] }), links.map((l) => (_jsx("a", { className: "sw-optlink", href: l.href, "aria-label": l.label, title: l.label, onClick: (e) => go(l.href, e), children: Icon[l.icon] }, l.key)))] }, o.id));
                            })] }, g ?? '_'))), options === null && !failed && level.loadOptions && _jsx("div", { className: "sw-item sw-item--quiet", children: "Loading\u2026" }), failed && _jsx("div", { className: "sw-item sw-item--quiet", children: "Couldn't load the list." }), q && shown.length === 0 && _jsx("div", { className: "sw-item sw-item--quiet", children: "No match" })] }), level.actions && level.actions.length > 0 && (_jsx("div", { className: "sw-loc__footer", children: level.actions.map((a) => (_jsxs("a", { className: "sw-loc__footlink", href: a.href, onClick: (e) => go(a.href, e), children: [a.label, " \u2192"] }, a.key))) })), children] }));
}
function AccountLayer({ narrow, close, triggerRef, session, accountHref, accountLabel, onAccountSite, theme, onTheme, persistTheme, feedbackEnabled, openFeedback, go, }) {
    return (_jsx(Layer, { narrow: narrow, side: "sheet", align: "end", label: "Account", close: close, triggerRef: triggerRef, children: _jsxs("div", { className: "sw-group", children: [session.email && _jsx("div", { className: "sw-who", children: session.email }), _jsxs("div", { className: "sw-appearance", children: [_jsx("span", { className: "sw-appearance__label", children: "Appearance" }), _jsx(ThemeToggle, { value: theme, onChange: onTheme, persist: persistTheme, compact: true })] }), feedbackEnabled && (_jsx("button", { type: "button", className: "sw-item", onClick: openFeedback, children: _jsx("span", { className: "sw-item__label", children: "Send Feedback" }) })), accountHref && !onAccountSite && (_jsx(ItemLink, { href: accountHref, go: go, external: true, children: accountLabel })), _jsx("div", { className: "sw-rule" }), _jsx("button", { type: "button", className: "sw-item", onClick: () => {
                        close();
                        session.signOut();
                    }, children: _jsx("span", { className: "sw-item__label", children: "Sign Out" }) })] }) }));
}
