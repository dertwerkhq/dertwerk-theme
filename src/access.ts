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
  org_id: string
  name: string
  role?: string
  entitled_apps: string[]
}

export interface MeLike {
  email?: string | null
  is_superadmin: boolean
  access_status: 'member' | 'pending' | 'denied' | 'none'
  memberships: MembershipLike[]
}

export type AccessDecision<M extends MembershipLike = MembershipLike> =
  /** Superadmins belong to no organization by design and are never walled. */
  | { kind: 'superadmin' }
  | { kind: 'no-organization'; accessStatus: MeLike['access_status'] }
  | { kind: 'not-entitled'; org: M }
  | { kind: 'ok'; org: M }

/** Which organization an address names, if any: the first `/orgs/<uuid>`. */
export function orgIdFromPath(pathname: string): string | null {
  return pathname.match(/\/orgs\/([0-9a-f-]{36})(?:\/|$)/i)?.[1] ?? null
}

/** The membership being looked at: the one the URL names, else the first.
 *
 *  Falling back to the first is today's behaviour in both products and is kept
 *  deliberately; which organization to open with no URL is the resume
 *  resolver's decision, not the gate's. */
export function currentMembership<M extends MembershipLike>(
  memberships: M[],
  orgId: string | null,
): M | undefined {
  return memberships.find((m) => m.org_id === orgId) ?? memberships[0]
}

export function decideAccess<M extends MembershipLike>(
  me: Omit<MeLike, 'memberships'> & { memberships: M[] },
  app: string,
  orgId: string | null,
): AccessDecision<M> {
  if (me.is_superadmin) return { kind: 'superadmin' }
  if (me.memberships.length === 0) return { kind: 'no-organization', accessStatus: me.access_status }
  const org = currentMembership(me.memberships, orgId)!
  if (!org.entitled_apps.includes(app)) return { kind: 'not-entitled', org }
  return { kind: 'ok', org }
}

/** The applications a person can open in one organization, for the app menu.
 *  Superadmins see every product. Signed-out visitors (null) are not filtered:
 *  the menu shows them the whole suite. */
export function entitledAppIds(
  me: MeLike | null,
  orgId: string | null,
): string[] | null {
  if (!me) return null
  if (me.is_superadmin) return null
  const org = currentMembership(me.memberships, orgId)
  return org ? org.entitled_apps : []
}
