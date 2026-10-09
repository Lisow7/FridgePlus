# Security Policy

> **Public vulnerability disclosure policy for Fridge+.**
> Internal incident-response procedures are kept in private operational documentation.
> Dernière mise à jour : 2026-05-15 (v3.360.0).

## Supported versions

Fridge+ is a continuously deployed web app — only the version currently in production is supported. There are no LTS or backport branches.

| Version | Supported |
|---|---|
| Latest production (`main` deployed via Vercel) | ✅ |
| Older versions / historic commits | ❌ |

If you find a security issue in the deployed app, we will fix it on the latest version. We do **not** issue patches for past versions.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Send your report by email to:

📧 **`support@fridgeplus.app`** (DPO / project owner)

Use the subject line **`[SECURITY] <short description>`** so it doesn't get buried.

If you prefer encryption, request our PGP public key in a first non-sensitive email and we'll send it back.

### What to include

- A clear description of the issue and the impact
- Steps to reproduce (URL, request, payload, screenshots)
- Affected version (commit SHA or production version visible in the footer)
- Your assessment of severity, if you have one
- Your name / handle if you'd like to be credited in the fix release notes (optional)

### What you can expect

- **Acknowledgment within 48 h** (usually under 24 h for P0/P1)
- **Initial assessment within 7 days** with classification (P0–P3) and ETA
- **Fix in production** :
  - P0 (active exploitation, data exposure) : ≤ 24 h
  - P1 (high impact, exploitable) : ≤ 7 days
  - P2 (medium impact) : ≤ 30 days
  - P3 (low impact / theoretical) : best-effort, next major release
- **Public disclosure coordination** : we'll agree on a date with you (typically once the fix is deployed + ~7 days for users to update PWAs)
- **Credit in the changelog and on a future Hall of Fame page** if you wish

## In scope

- The production deployment (the latest `main` branch deployed to Vercel)
- Supabase backend behaviour (RLS policies, Edge Functions, RPCs) when triggered via the production frontend
- Any subdomain we operate (currently none other than the apex domain)

## Out of scope

We will close reports about the following without remediation:

- **Self-XSS** that requires the victim to paste attacker-controlled code into the browser console
- **Missing security headers** that are already mitigated by our existing CSP / HSTS / X-Frame-Options stack — please verify [our headers](https://securityheaders.com) before reporting
- **Spam / phishing emails** sent to our support inbox
- **Best-practice nags** with no demonstrated impact (e.g. "you don't use SameSite=Strict on a non-auth cookie")
- **Denial of service** that requires significant volume of traffic (we have separate abuse-handling procedures; mass DDoS is the host's responsibility)
- **Issues in third-party libraries** that are already on a public CVE without a Fridge+-specific exploitation path — please open the issue with the upstream maintainer
- **Reports requiring physical access** to the user's device
- **Social engineering** of Fridge+ users or staff
- **Vulnerabilities in services we use but do not operate** (Supabase, Vercel, Stripe, Resend, Sentry) — please report them to those vendors directly

## Safe harbour

If you make a **good-faith effort** to comply with this policy when reporting a vulnerability:

1. We won't take legal action against you for accessing data necessary to demonstrate the issue, as long as you don't extract more than needed for the proof of concept.
2. We won't ask law enforcement to investigate you.
3. We'll work with you to understand and resolve the issue.

We consider research conducted under this policy to be authorised, conducted in good faith, and exempted from the [LCEN](https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000801164/) constraints on accessing IT systems without authorisation.

To stay within safe harbour, you must:

- **Stop immediately** if you encounter user data and notify us; do not download, copy, or share it beyond what's strictly necessary to demonstrate the issue
- **Not access** any account that isn't yours (use a test account you create)
- **Not modify or destroy** any data
- **Not run automated scanners** that generate more than a few hundred requests / minute against our production
- **Not publicly disclose** the issue until we've agreed on a date

## Bug bounty

We do **not** currently run a paid bug bounty programme. Fridge+ is bootstrapped and self-funded. You'll get :

- Public credit in the release notes and a future security Hall of Fame
- A genuine "thank you" email and acknowledgment of the disclosure
- (For P0/P1 with clear impact) a Fridge+ Premium subscription comp for life, on request

If a bounty programme is ever set up, it will be announced here first.

## What we cover ourselves

Beyond responding to reports, we run:

- **Quarterly RGPD compliance audits** (internal)
- **Encrypted weekly database backups** retained 90 days (GPG, stored off-site; procedure kept private)
- **Continuous Sentry monitoring** with alerting on error spikes and abnormal patterns
- **`pg_cron` purge jobs** to enforce retention windows on logs and ephemeral tables
- **Strict CSP, HSTS preloaded, X-Frame-Options DENY, Permissions-Policy** on all routes (cf. [`vercel.json`](./vercel.json))

### Content-Security-Policy — deliberate trade-offs

`vercel.json` is strict JSON and cannot carry comments, so the reasoning lives here
and is enforced by [`src/test/unit/csp-policy.test.js`](./src/test/unit/csp-policy.test.js).

- **`script-src` does not allow `'unsafe-inline'`** (removed 2026-08-06). The production
  bundle ships exactly one inline `<script>`: the JSON-LD block in `index.html`.
  Browsers do not treat `application/ld+json` data blocks as executable scripts, so no
  hash or nonce is required — verified by serving the built app under the hardened
  policy. A nonce would not be an option here anyway: `vercel.json` serves **static**
  headers, and a nonce must be unique per request.
- **`script-src` is exactly `'self'`** (since 2026-10-04). It used to also list
  `cdn.jsdelivr.net`, `browser.sentry-cdn.com` and `vercel.live`. None was needed —
  jsDelivr only serves the app *images* (covered by `img-src`), Sentry is the npm
  package — and jsDelivr serves any file of any npm package or public GitHub repo as
  JavaScript: anyone obtaining an HTML injection could run their own script, which
  undid most of the `'unsafe-inline'` removal. Consequence: the Vercel preview toolbar
  no longer loads on previews. Do not add a host without a real `<script src>` for it.
- **`img-src` is `'self' data: blob:` plus the project's Supabase storage host** (since
  2026-10-07). It used to allow any `https:` image: an injected page or badly filtered
  content could make every visitor's browser fetch an image from any server, handing
  over their IP address, browser and current page. App images now come from the site
  itself (emoji included, no longer from Iconify or jsDelivr), `data:` (QR codes, card
  pattern, 2FA QR code), `blob:`, and the project's public storage — the only external
  origin `isProjectStorageUrl` lets through (`src/shared/lib/images/trusted-image-url.js`).
  Guarded by `src/test/unit/csp-policy.test.js` and `e2e/images-sous-la-csp.spec.js`.
  Do not add a host without a real image for it.
- **`style-src` keeps `'unsafe-inline'`** — assumed, not overlooked. React applies
  styling through the `style=` attribute, and *style attributes* are blocked without
  it; neither nonces nor hashes cover them (only `'unsafe-hashes'`, case by case).
  With ~3700 inline styles across the codebase, removing it is a refactor, not a
  hardening.

To test a policy change before shipping it, run `npm run build` then
`node scripts/csp-serve.mjs` — Vite does not apply `vercel.json` headers, so a broken
CSP is otherwise only discovered in production.
- **Lint-staged + pre-commit hooks** (including gitleaks for secret detection)

## Contact escalation

If you don't get a response to a P0/P1 report within 48 h via email, you can ping:

- GitHub : open a **private** advisory at https://github.com/Lisow7/FridgePlus/security/advisories/new (preferred fallback)
- Twitter / X DM to the project owner (less reliable)

For non-urgent reports, email is the only channel.

---

Thank you for helping keep Fridge+ users safe. 🙏
