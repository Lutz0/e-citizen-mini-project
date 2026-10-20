# API reference

JSON over HTTP, served under `/api/`. The examples below are real responses from the running application (trimmed where
noted).

## Conventions

| | |
| --- | --- |
| **Authentication** | Session cookie set by `login`/`register` (HttpOnly). Anonymous calls to protected endpoints get **401**. |
| **CSRF** | Every unsafe request (`POST`, …) must send the `csrftoken` cookie's value in an `X-CSRFToken` header — **including login and register**. `GET /api/auth/session/` (or `/csrf/`) sets the cookie. Missing/invalid token → **403**. |
| **Content type** | `application/json`, except `POST /api/requests/` which also accepts `multipart/form-data` (needed for the photo). |
| **Identifiers** | Requests are addressed by reference number (`SR-2026-K7M3Q9`, case-insensitive), never by database id. |
| **Dates** | ISO 8601 with offset, e.g. `2026-10-15T21:02:44.792569+03:00`. |
| **Roles** | `citizen`, `admin`. Administrators are created by operators; registration always creates citizens. |

### Errors

Every error has the same shape; unexpected exceptions are logged server-side and only a generic message is returned.

```json
{ "detail": "Human-readable summary", "code": "machine_readable_code", "errors": { "field": ["message"] } }
```

`errors` appears only for validation failures (`400`, `code: "validation_error"`). Other codes: `not_authenticated` (401),
`permission_denied` (403), `not_found` (404), `method_not_allowed` (405), `throttled` (429), `server_error` (500).

| Status | Meaning here |
| --- | --- |
| 400 | Validation failed (fields, filters, an illegal status transition, a rejected image) |
| 401 | Not signed in (or the session expired) |
| 403 | Signed in but not allowed (e.g. a citizen changing status), or CSRF failure |
| 404 | Not found — **also returned for another citizen's request**, so its existence isn't revealed |
| 429 | Rate limit hit (login, register) |

### Pagination

List endpoints return:

```json
{ "count": 51, "page": 1, "page_size": 10, "total_pages": 6,
  "next": "…?page=2", "previous": null, "results": [ … ] }
```
`?page=` (1-based) and `?page_size=` (default 10, max 100). An out-of-range page is a `404`.

---

## Authentication — `/api/auth/`

| Method & path | Auth | Purpose |
| --- | --- | --- |
| `GET /csrf/` | none | Set the CSRF cookie. |
| `GET /session/` | none | `{"user": {…}}` or `{"user": null}`; always `200`; also sets the CSRF cookie. Used by the SPA at page load. |
| `POST /register/` | none, throttled | Create a citizen account and sign in. `201` + user. |
| `POST /login/` | none, throttled | Sign in. `200` + user. |
| `POST /logout/` | any | End the session. `204`; harmless if already signed out. |
| `GET /me/` | signed in | The current user (`401` when anonymous). |

**Register** body: `full_name` (2–150), `email`, `phone_number` (optional), `password`, `password_confirm`. The password
must satisfy Django's validators (min 8 chars, not too common, not all digits, not too similar to the email/name).
Any `role`/`is_staff` field sent is ignored.

```json
{ "id": 4, "email": "cynthia@example.test", "full_name": "Cynthia Mutua",
  "phone_number": "", "role": "citizen", "date_joined": "2026-10-19T21:40:05.412034+03:00" }
```

**Login failure** is deliberately generic (same for unknown email, wrong password and disabled account):

```json
{ "detail": "Invalid email or password.", "code": "validation_error",
  "errors": { "non_field_errors": ["Invalid email or password."] } }
```

## Service requests — `/api/requests/`

### `POST /api/requests/` — submit *(citizens only)*

| Field | Rules |
| --- | --- |
| `category` | required: `streetlights`, `water`, `waste`, `roads`, `drainage`, `other` |
| `location` | required, 3–255 chars (trimmed) |
| `description` | required, 10–2000 chars (trimmed) |
| `severity` | optional: `low`, `medium` (default), `high` |
| `image` | optional file — JPEG, PNG or WebP, ≤ 5 MB (see below) |

`status`, `citizen`, `reference`, dates etc. cannot be supplied; if sent they are ignored. Returns `201` with the
**detail** object. Administrators get `403`.

**Image validation** (all must pass; on failure the request is not created and nothing is stored): non-empty and within
the size limit → extension in `.jpg .jpeg .png .webp` → declared `Content-Type` in `image/jpeg|png|webp` → the bytes really
decode as JPEG/PNG/WebP **and** match the extension → pixel count ≤ 25 megapixels. The image is then re-encoded
(dropping EXIF/GPS and any appended or hidden data), downscaled to fit 2560 px, and stored under a random name.

### `GET /api/requests/` — list

Citizens receive **their own** requests; administrators receive **all**. Query parameters:

| Parameter | Values |
| --- | --- |
| `status` | `pending`, `in_progress`, `resolved` |
| `unresolved` | `true` (pending + in progress) / `false` |
| `category` | one of the six categories |
| `severity` | `low`, `medium`, `high` |
| `search` | words must all match somewhere in: reference, location, description, category — and, **for administrators only**, the citizen's name or email |
| `submitted_after`, `submitted_before` | dates (`YYYY-MM-DD`), inclusive |
| `sort` | `newest` (default), `oldest`, `severity` (high first), `updated` |
| `page`, `page_size` | pagination |

An invalid value (e.g. `status=bogus`) is a `400`, not an empty list. A list item (real example):

```json
{
  "reference": "SR-2026-GB593X",
  "category": "water", "category_label": "Water supply",
  "location": "Embakasi, Pipeline estate",
  "description": "Tap water has turned brown and smells strongly of chemicals. Several families report stomach upsets.",
  "severity": "high", "severity_label": "High",
  "status": "in_progress", "status_label": "In Progress",
  "has_image": false,
  "citizen": { "id": 4, "full_name": "Cynthia Mutua", "email": "cynthia@example.test", "phone_number": "" },
  "created_at": "2026-10-15T21:02:44.792569+03:00",
  "updated_at": "2026-10-16T07:02:44.792569+03:00",
  "in_progress_at": "2026-10-16T07:02:44.792569+03:00",
  "resolved_at": null
}
```

### `GET /api/requests/{reference}/` — detail

The list fields plus the audit trail, messages and (for administrators) the legal next step. Another citizen's request is
`404`.

```json
{
  "status_changes": [
    { "id": 65, "from_status": "", "from_status_label": "", "to_status": "pending", "to_status_label": "Pending",
      "changed_by_name": "Cynthia Mutua", "changed_by_role": "citizen",
      "note": "Request submitted.", "created_at": "2026-10-15T21:02:44.792569+03:00" },
    { "id": 66, "from_status": "pending", "from_status_label": "Pending", "to_status": "in_progress", "to_status_label": "In Progress",
      "changed_by_name": "Grace Wanjiku", "changed_by_role": "admin",
      "note": "Water utility notified and a repair team is on its way.", "created_at": "2026-10-16T07:02:44.792569+03:00" }
  ],
  "comments": [],
  "allowed_next_statuses": [ { "value": "resolved", "label": "Resolved" } ]
}
```

Privacy: administrators see staff names; **citizens see "Service team"** in place of an administrator's name (in
`changed_by_name` and comment `author_name`). `allowed_next_statuses` is always `[]` for citizens.

### `POST /api/requests/{reference}/status/` — change status *(administrators only)*

```json
{ "status": "in_progress", "note": "Crew scheduled for Tuesday." }
```

`note` is optional (≤ 500 chars). The only legal moves are **pending → in_progress** and **in_progress → resolved**. Anything
else — skipping a step, going backwards, repeating the current status, changing a resolved request — is a `400`:

```json
{ "detail": "Please correct the highlighted fields and try again.", "code": "validation_error",
  "errors": { "status": ["Cannot move a request from Pending to Resolved. The only allowed next status is In Progress."] } }
```

A citizen (even the owner) gets `403`. On success the response is the updated detail object, an audit row is written, and the
citizen is emailed (after the transaction commits; email failures are logged and never undo the change).

### `GET` / `POST /api/requests/{reference}/comments/`

`GET` lists the messages; `POST {"body": "…"}` (1–1000 chars) adds one. Allowed for the owning citizen and administrators;
anyone else gets `404`.

### `GET /api/requests/{reference}/image/`

Streams the photo (`Content-Type` from the stored extension, `X-Content-Type-Options: nosniff`,
`Cache-Control: private`) to the owner or an administrator; `404` for anyone else or when there is no image. Photos are never
served from a public path.

## Analytics — `GET /api/analytics/summary/?days=30`

Any signed-in user. **Administrators** get figures for all requests (`"scope": "all"`); **citizens** get figures for their own
(`"scope": "mine"`). `days` (7–90, default 30) sets only the length of the `over_time` series. Everything is computed from
the database on each call.

```json
{
  "totals": { "total": 51, "pending": 20, "in_progress": 11, "resolved": 20, "unresolved": 31 },
  "resolution_rate": 39.2,
  "avg_resolution_hours": 52.1,
  "high_severity_unresolved": 15,
  "by_category": [
    { "category": "streetlights", "label": "Streetlights", "total": 8, "pending": 3, "in_progress": 1, "resolved": 4, "unresolved": 4 }
    /* … one entry per category, zero-filled */
  ],
  "over_time": [
    { "date": "2026-10-13", "submitted": 3, "resolved": 0 }
    /* … one entry per day, zero-filled */
  ],
  "window_days": 7,
  "scope": "all"
}
```

`unresolved` is always `pending + in_progress`, and `unresolved + resolved = total`.

## Django admin — `/django-admin/`

For operators (`is_staff` accounts only): inspect users and requests, create administrators (set `role`). Status changes
and the audit trail are deliberately read-only there so every change goes through the API and is recorded.

## Rate limits

`POST /auth/login/` — 10 per minute and `POST /auth/register/` — 10 per hour, per client IP (configurable with
`THROTTLE_LOGIN_RATE` / `THROTTLE_REGISTER_RATE`). Exceeding them returns `429`.
