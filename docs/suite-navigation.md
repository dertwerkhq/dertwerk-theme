# Suite navigation: the contract

Every DertWerk application and site sits in `SuiteShell`. This page is the rule
for using it. The reasoning, the alternatives and the rollout live in
`farm-analytics-api/docs/suite-navigation-plan.md`.

## The bar

Three slots, and it takes no children:

1. **App menu.** This app's destinations (`nav`), then the other apps the
   person can open, DertWerk home, and "Get more apps".
2. **Location.** One segment per level (`location`). A level with a single
   choice is left out of the bar, at any depth, and stays in the switcher
   (`alwaysShow` overrides this, e.g. for support sessions). The bar may show no
   location at all. Links about one choice (its settings) go in `optionLinks`,
   as icons on that choice's row. Links about the whole list go in `actions`.
3. **You.** The account menu: email, Appearance, Send feedback, Account or
   Admin, Sign out. Signed out: Sign in plus a compact appearance control.

## Where a new thing goes

| it is about | it goes in |
| --- | --- |
| the person | the account menu (or the account site's "You" section) |
| the organization | that app's organization settings, reached from `nav` and the gear on the organization's row in the location switcher |
| the app | `nav` |
| one page | that page's own header |
| none of these | ask before adding it anywhere |

**Never the bar.** If something seems to need the bar, the table is missing a
row. Change this document first.

## Layouts

- `browse`: record hierarchies with wide maps or editors (FarmRx, FSAcre). No
  persistent sidebar.
- `workspace`: a fixed set of destinations (Agplication, equipment rental,
  account, admin). A sidebar on wide screens.

Both use the same drawer on a phone (≤760px).

## Rules for an app

- Import the chrome; don't copy it. Use `SuiteShell`, `useAppCatalog` and
  `decideAccess` from this package. A local *adapter* (turning your `/me`
  into a session, your routes into `location`) is expected. A local copy of an
  access *decision* or of the header is not.
- Links to other DertWerk apps come from the catalog (`appOrgUrl`), never a
  typed-out `https://….dertwerk.com`.
- Carry the organization: pass `orgId` so Account and other apps open on the
  same organization.
- Declare unsaved work with `useUnsavedChanges(dirty)`. Links the app renders
  itself call `useConfirmLeave()`.
- Put the org name in the heading of settings pages, and in any confirmation of
  a consequential action.

## New app checklist

1. Add it to `farm-analytics-api/api/app_registry.py`. Grant policy
   (`ALLOWED_APPS`, `PRODUCT_APPS`) is a separate, deliberate decision.
2. Add its origin to the API's CORS list (`infra/lib/compute-stack.ts`).
3. Regenerate the snapshot here: `node scripts/snapshot-catalog.mjs`, then
   release.
4. Wrap the app in `SuiteShell` with `layout`, `nav` and `location`.
5. Check it at 390px: nothing cut off, and Sign out reachable.

## Releasing

Tag, push the tag, then regenerate every consumer's lockfile. A `package.json`
bump alone leaves the lockfile pinned to the old commit, and Amplify builds the
old theme without failing. Security or contract changes go to every app
together; compatible changes can be adopted app by app.
