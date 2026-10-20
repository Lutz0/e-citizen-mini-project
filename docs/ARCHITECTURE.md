# Architecture and design decisions

This document explains how the system is organised and, more importantly, **why** — including the trade-offs that were
accepted. For setup and usage see the [README](../README.md); for endpoints see the [API reference](API.md).

## 1. Overview

```
┌────────────────────┐   /api (same origin)   ┌─────────────────────────────────────────────┐   ┌──────────────┐
│  React SPA (Vite)  │ ─────────────────────► │  Django + DRF                               │ ► │ SQLite /     │
│  pages, components │  JSON, session cookie  │  views → serializers → services → models    │   │ PostgreSQL   │
│  hooks, API client │ ◄───────────────────── │            selectors (role-scoped reads)    │   └──────────────┘
└────────────────────┘    + CSRF header       │  images on disk (private) · email on change │
                                              └─────────────────────────────────────────────┘
```

Three clearly separated responsibilities: the **frontend** only presents and collects input; the **backend** owns every
rule and decision; the **database** stores the records and guards their consistency with constraints.

### Backend layers (`backend/apps/service_requests` is the model to follow)

| File | Responsibility | Knows about HTTP? |
| --- | --- | --- |
| `domain.py` | Vocabulary (categories, statuses, severities) and the lifecycle table `ALLOWED_TRANSITIONS` | no |
| `models.py` | Tables, relations, the DB `CHECK` constraint | no |
| `services.py` | **Business rules**: create a request, change status (permission check, locked re-read, transition validation, audit row, notification), add a comment | no |
| `selectors.py` | **Read queries that depend on who is asking** (`visible_requests(user)`) | no |
| `validators.py` | The image pipeline | no |
| `notifications.py` | Email | no |
| `filters.py` | Query-string filters, search and sorting | yes (query params) |
| `serializers.py` | Input validation and output shape (incl. what each role may see) | yes |
| `views.py`, `urls.py` | Routing, permissions, calling a service, building the response — deliberately thin | yes |

A view never contains a rule; a service never touches a request object. That is what lets the rules be unit-tested directly
and guarantees they hold whichever entry point calls them (the status-change permission check exists in **both** the
permission class and the service).

### Frontend structure

```
src/
  api/          one fetch wrapper (CSRF, error normalisation, 401 handling) + a module per resource
  context/      AuthContext (who is signed in), ToastContext (announced messages)
  hooks/        useApi (loading + stale-response safety), useForm, useRequestFilters (URL-synced), …
  utils/        validation (mirrors the server), formatting, chart maths, shared vocabulary
  components/
    ui/         buttons, fields, badges, modal, pagination, states   ← reusable, no business knowledge
    layout/     app shell, split-screen auth layout, header, route guards, error boundary
    requests/   list, filters, stepper, timeline, comments, status panel
    analytics/  stat tiles, charts
  pages/        one component per route; compose the above
```

Pages call hooks, hooks call the API modules, components are presentational. There is no global state library: server
data lives in `useApi`, and filters/pagination live in the URL (shareable, survives reload, works with the back button).

## 2. Decisions

### D1. An API-first SPA over Django REST Framework
The brief asks for a clear frontend/backend/database separation. A JSON API with a separate React app gives that, keeps the
UI independently testable, and leaves room for a mobile client. Django supplies migrations, a mature auth system and an
ORM; DRF supplies serializers/permissions/throttling. *Trade-off:* two processes to run in development (mitigated by the
Vite proxy) and the SPA must be served same-origin in production (see D2).

### D2. Session cookie + CSRF, not JWT in `localStorage`
Tokens in `localStorage` are readable by any script that runs on the page, so one XSS bug becomes account takeover. An
**HttpOnly session cookie cannot be read by JavaScript**, logout really invalidates the session server-side, and expiry is
simple. The cost is CSRF exposure, handled with Django's CSRF protection: the SPA echoes the CSRF cookie in `X-CSRFToken`
on every unsafe request. DRF only enforces CSRF for *authenticated* sessions, which would leave **login CSRF** open on the
anonymous `login`/`register` endpoints, so those are explicitly wrapped in `csrf_protect`.
Because cookies are first-party only when the app and API share an origin, development uses the Vite proxy (no CORS at all)
and production should use a reverse proxy. *Trade-off:* a cross-origin deployment would need extra cookie/CORS settings.

### D3. `role` on the user model; administrators are never self-service
`User.role` (`citizen` | `admin`) is the one source of truth for application authorisation. Public registration has no role
field, so it can only create citizens; administrators come from `createsuperuser` (which forces `role=admin`) or the Django
admin. *Trade-off:* no in-app admin management (a listed limitation) — but no privilege-escalation path either.

### D4. Authorisation by scoping the queryset (and 404, not 403)
`visible_requests(user)` returns *all* requests for administrators and `filter(citizen=user)` for citizens, and **every**
view starts from it — list, detail, comments, image, analytics. Another citizen's request is therefore simply *not found*:
no id-guessing, no existence leak, and no per-view check to forget. Role checks (`IsAdministrator`, `IsCitizen`) sit on top, and
the services re-check the actor as defence in depth. The mutation test (removing the scoping makes 8 tests fail) shows the
tests really guard this.

### D5. A strict, forward-only lifecycle enforced in three places
`Pending → In Progress → Resolved`, one step at a time, `Resolved` final.
1. **Domain** — `ALLOWED_TRANSITIONS` is the single table of legal moves.
2. **Service** — `change_status` locks the row (`SELECT … FOR UPDATE`), *re-reads* its status and validates against the
   fresh value, so two administrators acting simultaneously cannot both apply a step (proven by a two-thread test on
   PostgreSQL that fails when the lock is removed).
3. **Database** — a `CHECK` constraint ties `status` to `in_progress_at`/`resolved_at`, so even a buggy future code path
   can't store a contradictory row.
The API only ever advertises the single legal next step, so the UI offers one clear button. *Trade-off:* a mistaken
"Resolved" can't be undone in the app (see limitations); reopening would be a deliberate extension of the table.

### D6. Audit trail as an append-only table
Every lifecycle event is a `StatusChange` row (who, from, to, note, when) written in the same transaction as the change,
including the submission itself. The Django admin shows it read-only. Citizens see it with staff names replaced by
"Service team" — accountability for administrators, privacy for staff.

### D7. Reference numbers instead of ids
`SR-2026-K7M3Q9`: human-readable, quotable on the phone (no `0/O/1/I/L`), non-sequential, and used as the URL identifier so
internal ids are never exposed. A unique constraint is the backstop for the (astronomically unlikely) collision.

### D8. Secure image uploads: validate, re-encode, serve privately
Checking the extension is not enough, so an upload must pass every layer — size, extension allow-list, declared MIME type,
**decoding as a real JPEG/PNG/WebP that matches the extension**, and a pixel cap against decompression bombs. Accepted images
are then **re-encoded** with Pillow, which strips EXIF/GPS (a real privacy risk when people photograph their own street) and
discards anything appended or hidden in the file; they are downscaled, given a random name, and stored outside any public
route. Photos are streamed by an authenticated endpoint, so the same access rules protect them as the request itself.
*Trade-off:* Django streams the bytes (fine for an MVP; production would use object storage with signed URLs or
`X-Accel-Redirect`) and there is no malware scanning.

### D9. Analytics computed on demand
Totals, per-category counts and daily series come from aggregate queries on every call; nothing is cached or duplicated.
That guarantees "figures reflect the real records and update when data changes", and the tests prove it (create a
request, change a status — the next call moves). The same endpoint is role-scoped, so citizens get their own numbers.
*Trade-off:* at very large scale this would be cached or pre-aggregated.

### D10. One predictable error contract
All errors are `{detail, code, errors?}`. A custom exception handler also catches *unexpected* exceptions: the full trace
goes to the server log, the client gets a generic message — no stack traces, SQL or paths ever leak. Unknown URLs and 500s are
JSON too. Login errors are intentionally identical for unknown email / wrong password / disabled account.

### D11. Email as a best-effort side effect
Status-change emails are sent after the transaction commits (`transaction.on_commit`), so a rollback never emails anyone, and
a mail failure is logged but never undoes or blocks the change. *Trade-off:* sending is synchronous; a task queue is the
production upgrade. In development emails print to the server console.

### D12. Configuration only through the environment
Everything environment-specific comes from environment variables (`.env` for local use, git-ignored). In production the app
**refuses to start without `SECRET_KEY`**, cookies default to secure when `DEBUG` is off, and `check --deploy` is clean
apart from the optional HSTS-preload advice.

### D13. Frontend: simple, accessible, no heavy dependencies
- **Hand-built charts** (a few hundred lines of SVG/HTML) instead of a charting library: full control over accessibility
  (legend always present, keyboard-operable tooltip, a **table view** of every chart), smaller bundle, and colours that
  follow the *entity* — Pending, In Progress and Resolved are the same hues in badges, stepper and charts. The series
  palette was checked with a colour-blind-safety validator.
- **Native `<dialog>`** for confirmations: focus trap, `Esc`, inert background and focus return come from the browser.
- **Validation twice**: instant client-side checks mirror the server's rules, while the server stays authoritative and its
  messages are shown too.
- **Never colour alone**: statuses have icon + text, severity has 1–3 bars + a word, errors have an icon + text.
- Pages are **code-split** so citizens never download the dashboard and its charts.

### D14. Testing strategy
A pyramid: many fast backend tests for rules and permissions (167, ~5 s) and unit/component tests for the frontend (82), and
a small number of **browser end-to-end checks** (30) that exercise the real stack — including negative paths (a spoofed
image, a forged status change, someone else's request), keyboard behaviour, a failed network load, an expired session, and an
axe-core accessibility audit of 13 screens. Tests are only
worth trusting if they can fail, so key rules were mutation-checked: the suite goes red when citizen scoping, the
transition table, the image allow-list, the admin check or the row lock is removed. Running on PostgreSQL as well as SQLite
caught a bug that SQLite hid (a test helper closing the database connection).

## 3. Threat model summary

| Threat | Mitigation |
| --- | --- |
| Citizen reads/changes another's request | Role-scoped querysets (404), permission classes, service-level checks; tested for list, detail, comments, image, analytics |
| Privilege escalation to admin | No role field on registration; admins only via operator tools; mass-assignment test |
| Non-admin changes status | `IsAdministrator` + service check; transition table; 403 tests |
| CSRF (incl. login CSRF) | CSRF enforced on all unsafe requests; tests with `enforce_csrf_checks` |
| Session theft via XSS | HttpOnly cookie; React escapes output; no `dangerouslySetInnerHTML`; messages stored as plain text |
| Malicious upload (polyglot, SVG/HTML, bomb, oversized, spoofed type) | Layered validation + re-encode + random names + private serving |
| Brute force / credential stuffing | Per-IP throttling; identical error for every failure; Django password validators |
| Rate-limit evasion by spoofing `X-Forwarded-For` | `NUM_PROXIES=0` by default: the header is ignored unless the operator declares trusted proxies (tested) |
| Oversized upload used to exhaust resources | Declared `Content-Length` checked first (413 before the body is read), then the exact size/pixel limits in the image validator |
| Account enumeration | Generic login error (registration does disclose that an email exists — a documented usability trade-off) |
| Information leakage via errors | Central handler returns generic 500s; JSON 404; `DEBUG=false` disables the browsable API |
| Lost updates / double transitions | Row lock + re-read; DB `CHECK`; concurrency test |
| Secrets in the repo | Env-only config; `.env`, DBs, uploads ignored; start-up refuses without `SECRET_KEY` |

## 4. A request's journey (status change)

1. Admin clicks *Mark In Progress*, confirms in the dialog → `POST /api/requests/SR-…/status/ {status, note}` with the CSRF header.
2. DRF authenticates the session, `IsAdministrator` passes, `get_object()` looks the request up via `visible_requests`.
3. The serializer validates the payload; the view calls `services.change_status(...)`.
4. Inside one transaction: lock the row → re-read status → `can_transition?` → update status and timestamp → insert the
   `StatusChange` row → schedule the email for commit.
5. The detail serializer returns the new state; the SPA shows a toast and refreshes; the citizen is emailed; the next
   analytics call reflects the new counts.
