/**
 * Whether a signed-in person may use an application, decided once.
 *
 * This was hand-copied into FarmRx and FSAcre ("Mirror any change") and
 * rewritten again in Agplication. The decision is the same everywhere; what
 * differs is how each app shows a wall, so this file holds only the pure
 * decision and every app keeps its own rendering.
 *
 * The server remains the authority. This decides what to *show*; every route
 * still checks membership and entitlement itself.
 */
export interface MembershipLike {
    org_id: string;
    name: string;
    role?: string;
    entitled_apps: string[];
}
export interface MeLike {
    email?: string | null;
    is_superadmin: boolean;
    access_status: 'member' | 'pending' | 'denied' | 'none';
    memberships: MembershipLike[];
}
export type AccessDecision<M extends MembershipLike = MembershipLike> = 
/** Superadmins belong to no organization by design and are never walled. */
{
    kind: 'superadmin';
} | {
    kind: 'no-organization';
    accessStatus: MeLike['access_status'];
} | {
    kind: 'not-entitled';
    org: M;
} | {
    kind: 'ok';
    org: M;
};
/** Which organization an address names, if any: the first `/orgs/<uuid>`. */
export declare function orgIdFromPath(pathname: string): string | null;
/** The membership being looked at: the one the URL names, else the first.
 *
 *  Falling back to the first is today's behaviour in both products and is kept
 *  deliberately; which organization to open with no URL is the resume
 *  resolver's decision, not the gate's. */
export declare function currentMembership<M extends MembershipLike>(memberships: M[], orgId: string | null): M | undefined;
export declare function decideAccess<M extends MembershipLike>(me: Omit<MeLike, 'memberships'> & {
    memberships: M[];
}, app: string, orgId: string | null): AccessDecision<M>;
/** The applications a person can open in one organization, for the app menu.
 *  Superadmins see every product. Signed-out visitors (null) are not filtered:
 *  the menu shows them the whole suite. */
export declare function entitledAppIds(me: MeLike | null, orgId: string | null): string[] | null;
