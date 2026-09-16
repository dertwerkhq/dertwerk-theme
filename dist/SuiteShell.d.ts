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
import { type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import type { FeedbackApp, FeedbackReport } from './feedback';
import type { SuiteApp } from './catalog';
import type { ThemeChoice } from './theme';
export interface NavItem {
    key: string;
    label: string;
    href: string;
    /** Section heading in the menu, e.g. "Organization". Items without one
     *  come first. */
    group?: string;
    badge?: number | string | null;
    current?: boolean;
}
export interface LocationOption {
    id: string;
    label: string;
    hint?: string;
    /** Groups options inside one level, e.g. "Your organizations" / "Clients". */
    group?: string;
}
export interface LocationLevel {
    key: string;
    /** What this level is called: "Organization", "Farm", "Field". */
    label: string;
    current: LocationOption | null;
    /** Siblings, when already known. */
    options?: LocationOption[];
    /** Siblings, fetched when the switcher opens. */
    loadOptions?: () => Promise<LocationOption[]>;
    /** How many choices exist, when known without loading them. Used to leave a
     *  one-choice level out of the bar. */
    count?: number;
    href: (id: string) => string;
    /** Leave the level out of the bar when it has exactly one choice. It always
     *  stays in the switcher. Default true. */
    hideWhenSingle?: boolean;
    /** Keep it in the bar regardless -- e.g. the organization during a support
     *  session, where knowing whose data this is matters more than space. */
    alwaysShow?: boolean;
    /** Links about one choice, drawn as icons at the end of its row: that
     *  organization's settings, its admin page. Per row, so the gear beside an
     *  organization always means *that* organization's settings, however many
     *  are listed. */
    optionLinks?: (id: string) => LocationOptionLink[];
    /** Links about the whole list, drawn as a footer under it: "All
     *  organizations", "All farms". Never a choice-specific link -- those read as
     *  one more choice when listed among the choices. */
    actions?: {
        key: string;
        label: string;
        href: string;
    }[];
}
export interface LocationOptionLink {
    key: string;
    /** Read by screen readers and shown as a tooltip, e.g. "Mewes Farms settings". */
    label: string;
    href: string;
    icon: 'settings' | 'external';
}
export interface SuiteSession {
    email: string | null;
    isSuperadmin: boolean;
    signOut: () => void;
}
export interface SuiteFeedback {
    app: FeedbackApp;
    enabled: boolean;
    submit: (report: FeedbackReport) => Promise<unknown>;
    orgId?: string | null;
    buildSha?: string | null;
    /** Defaults to the location labels joined with " › ". */
    breadcrumb?: string | null;
}
export interface SuiteShellProps {
    /** This app's id in the catalog. */
    app: string;
    catalog: SuiteApp[];
    layout: 'browse' | 'workspace';
    /** `window` (default): the page scrolls under a sticky bar. `contained`: the
     *  shell is exactly one screen tall and only the content area scrolls --
     *  for apps whose maps and editors size themselves to the space left. */
    scroll?: 'window' | 'contained';
    /** Opens a path inside this app. Absolute URLs are opened by the shell. */
    navigate: (href: string) => void;
    /** Null when nobody is signed in. */
    session: SuiteSession | null;
    onSignIn?: () => void;
    /** Product ids the person can open here; null means do not filter. */
    entitledApps: string[] | null;
    /** Organization in view, carried into links to other apps and the account. */
    orgId?: string | null;
    nav?: NavItem[];
    location?: LocationLevel[];
    theme: ThemeChoice;
    onTheme: (next: ThemeChoice) => void;
    persistTheme?: (next: ThemeChoice) => void;
    feedback?: SuiteFeedback;
    children: ReactNode;
}
/**
 * Declare unsaved work. While `dirty` is true, every navigation the shell owns
 * (app menu, location switcher, account menu) asks first, and so does closing
 * or reloading the tab.
 *
 * Links an app renders itself, and the browser's back button inside a
 * BrowserRouter, are outside the shell's reach: call `useConfirmLeave()` for
 * those.
 */
export declare function useUnsavedChanges(dirty: boolean, message?: string): void;
/** Returns a function that asks before leaving when anything is unsaved, and
 *  reports whether leaving should go ahead. */
export declare function useConfirmLeave(): () => boolean;
export default function SuiteShell(props: SuiteShellProps): import("react").JSX.Element;
export declare function SideNav({ items, go, }: {
    items: NavItem[];
    go: (href: string, e?: ReactMouseEvent) => void;
}): import("react").JSX.Element;
