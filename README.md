# @dertwerk/theme

Appearance for every DertWerk application: the palette, light/dark, the
control that switches them, and the branded sign-in screen.

Public because the five apps that consume it build on AWS Amplify from private
repositories, and a private dependency would mean a credential in five build
environments plus a sixth to remember for the next app. Nothing in here is a
secret — design tokens, a toggle, and a wrapper around the Amplify
authenticator. It does name the `dw_ui` cookie and the `/me/ui-prefs` endpoint,
both of which are visible to anyone with the browser devtools open anyway.

## Using it

```
npm i github:colgatecompanies/dertwerk-theme#v1.0.0
```

```ts
// main.tsx — before createRoot, so the first paint is already right
import { bootstrapTheme } from '@dertwerk/theme'
bootstrapTheme()
```

```tsx
import ThemeToggle from '@dertwerk/theme/ThemeToggle'
import { BrandedAuthenticator } from '@dertwerk/theme/BrandedAuthenticator'
import '@dertwerk/theme/themetoggle.css'
```

## The feedback control

A "Feedback" button in the top bar and the form behind it, offered only to
accounts the API has flagged. It exists so somebody looking at the product with
fresh eyes can say what confused them without leaving the page, and so the
report carries the context they could not describe themselves.

```ts
// main.tsx — before createRoot, so an error during first mount is captured
import { installFeedbackRecorder } from '@dertwerk/theme/feedback'
installFeedbackRecorder()
```

```ts
// wherever the app handles a failed request — an axios response interceptor,
// or the fetch wrapper. Only the app knows which call failed.
import { recordApiError } from '@dertwerk/theme/feedback'
recordApiError({ method, path, status, detail })
```

```tsx
import FeedbackWidget from '@dertwerk/theme/FeedbackWidget'
import '@dertwerk/theme/feedback.css'

<FeedbackWidget
  app="farmrx"
  enabled={me.feedback_enabled}   // from GET /me
  orgId={currentOrg?.org_id}
  breadcrumb={crumbs.join(' › ')}
  buildSha={import.meta.env.VITE_BUILD_SHA}
  className="topnav__action"      // the host's own nav-button class
  submit={(report) => api.post('/feedback', report)}
/>
```

`submit` is a prop for the same reason `persist` is on ThemeToggle: each app
has its own client, base URL and auth, and the package has no business knowing
about any of them. `className` is the host's nav-button class, so the control
looks like the buttons beside it rather than like a widget bolted on.

The page reports on itself. The route pattern is derived from the path
(`/fields/7c3e…` becomes `/fields/:id`), so reports group by page instead of
scattering across one row per record — no router required, which matters
because three of the five apps have none. Also carried: title, breadcrumb,
palette and mode, viewport, build, user agent, timezone, the previous route,
a per-sitting id, and a rolling buffer of the last twenty console errors and
failed API calls.

## What the host app must provide

Three role tokens. The package deliberately does not guess at them, because
the answers genuinely differ between a marketing site and a dense product UI.

| token | what it answers |
|---|---|
| `--auth-mode` | `light` or `dark`, declared in each mode's scope. The sign-in screen reads it rather than inferring the mode from class names. |
| `--control-ink` | the ink of whatever the appearance control sits on — a page surface on the dertwerk sites, the brand-coloured bar in the products. |
| `--control-ground` | what is behind the control, used as the label colour once a button fills with `--control-ink`. |

`theme.css` carries the four palette scopes and is what the three dertwerk
sites import. The two product apps declare their own tokens, in the same
vocabulary, inside their `index.css`.

## The vocabulary

Names say the role, never the colour, because the colour moves:
`--ground --surface --surface-sunk --ink --ink-muted --ink-subtle --accent
--accent-strong --accent-edge --accent-ink --accent-wash --on-accent --link
--link-wash --edge --edge-strong`.

Two independent axes, both as classes on `<html>`, both always written
explicitly: `palette-gold` / absent, and `theme-dark` / `theme-light`.
No classes at all is Field/Dark, which is the default everywhere.
