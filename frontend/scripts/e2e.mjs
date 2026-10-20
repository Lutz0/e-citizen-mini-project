/**
 * End-to-end check of the main workflows through a real browser, plus the
 * screenshots used in the README.
 *
 *   citizen:  register -> validation errors -> photo upload (incl. a spoofed
 *             file) -> submit -> track status -> sees the administrator's update
 *   admin:    dashboard figures -> search & filter -> open request ->
 *             update status through the confirmation dialog
 *   security: protected routes, citizen isolation, non-admin status change
 *
 * Requires the backend and the dev server to be running, and demo data:
 *
 *   python manage.py seed_demo --password "<demo password>"
 *   DEMO_PASSWORD="<demo password>" npm run e2e
 *
 * It creates one new citizen and one new request per run (unique e-mail), so it
 * is meant for a development database. Screenshots go to ../docs/screenshots.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { chromium } from "playwright-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const AXE_SOURCE = fs.readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const SHOTS = path.resolve(here, "../../docs/screenshots");
const PHOTO = path.join(here, "fixtures/pothole.jpg");
const BASE = (process.env.E2E_BASE_URL || "http://localhost:5173").replace(/\/$/, "");
const DEMO_PASSWORD = process.env.DEMO_PASSWORD;
const ADMIN_EMAIL = "admin@example.test";
const SEEDED_CITIZEN = "amina@example.test";

if (!DEMO_PASSWORD) {
  console.error("Set DEMO_PASSWORD to the password used with `manage.py seed_demo`.");
  process.exit(2);
}
fs.mkdirSync(SHOTS, { recursive: true });

const stamp = Date.now();
const newCitizen = {
  name: "Wanjiru Kamau",
  email: `e2e-${stamp}@example.test`,
  // Random and unrelated to the e-mail address, so the server's similarity check passes.
  password: `${randomBytes(9).toString("base64url")}-aZ7!`,
};

const browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL || "chrome", headless: true });
const consoleProblems = [];
const sessions = [];
let step = 0;
const ok = (message) => console.log(`  ✓ ${String(++step).padStart(2, "0")} ${message}`);

async function newSession(name, viewport = { width: 1280, height: 800 }, scale = 1, { tolerateNetworkErrors = false } = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: scale });
  const page = await context.newPage();
  sessions.push({ name, page });
  page.on("console", (m) => {
    if (!["error", "warning"].includes(m.type())) return;
    // Chrome logs every 4xx response as a console error. The negative tests below provoke those on purpose
    // (fake image -> 400, forged status change -> 403, someone else's request -> 404), so only 5xx and
    // genuine script errors count as problems.
    if (/Failed to load resource: the server responded with a status of 4\d\d/.test(m.text())) return;
    if (tolerateNetworkErrors && /Failed to load resource: net::ERR_/.test(m.text())) return; // chaos session blocks requests on purpose
    consoleProblems.push(`[${name}] ${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => consoleProblems.push(`[${name}] pageerror: ${e.message}`));
  return { context, page };
}

async function settle(page) {
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => !document.querySelector(".animate-spin"), null, { timeout: 10000 }).catch(() => {});
}

async function shot(page, name, { full = false } = {}) {
  await settle(page);
  await page.evaluate(() => document.querySelectorAll("[data-toast-region]").forEach((el) => (el.style.visibility = "hidden")));
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: full });
  await page.evaluate(() => document.querySelectorAll("[data-toast-region]").forEach((el) => (el.style.visibility = "")));
}

/**
 * Automated WCAG 2.2 A/AA audit of the current page state (colour contrast, labels, names,
 * roles, landmarks...). Automated checks catch roughly a third of accessibility problems; they
 * complement - not replace - the keyboard and screen-reader considerations built into the UI.
 */
const audited = [];
async function auditAccessibility(page, label) {
  await settle(page);
  await page.evaluate(AXE_SOURCE);
  const { violations } = await page.evaluate(() =>
    window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } }),
  );
  audited.push(label);
  const summary = violations.map((v) => {
    const first = v.nodes[0];
    const detail = first.any?.[0]?.message || first.failureSummary || "";
    return (
      `  - [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} element${v.nodes.length === 1 ? "" : "s"})\n` +
      `      e.g. ${first.target.join(" ")}\n      ${first.html.slice(0, 160)}\n      ${detail}`
    );
  });
  assert.deepEqual(summary, [], `accessibility violations on "${label}":\n${summary.join("\n")}`);
}

/** Wait until `locator` matches exactly `expected` elements (lists update after a short search debounce). */
async function waitForCount(locator, expected, timeout = 8000) {
  const deadline = Date.now() + timeout;
  let count = await locator.count();
  while (count !== expected && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    count = await locator.count();
  }
  assert.equal(count, expected, `expected ${expected} matching elements, found ${count}`);
}

async function expectNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, `${label}: page overflows horizontally by ${overflow}px`);
}

async function signIn(page, email, password) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  await settle(page);
}

async function csrfHeaders(context) {
  const cookies = await context.cookies();
  return { "X-CSRFToken": cookies.find((c) => c.name === "csrftoken")?.value ?? "", Origin: BASE };
}

const api = async (page, url) => (await page.request.get(`${BASE}/api${url}`)).json();

try {
  console.log(`E2E against ${BASE}\n`);

  // ===================================================================== public
  const anon = await newSession("anonymous");
  await anon.page.goto(BASE);
  await settle(anon.page);
  await expectNoHorizontalOverflow(anon.page, "landing");
  assert.match(await anon.page.locator("h1").first().innerText(), /report a problem in your community/i);
  await shot(anon.page, "01-landing");
  await auditAccessibility(anon.page, "landing page");
  ok("landing page explains the platform's purpose");

  await anon.page.keyboard.press("Tab");
  const firstStop = await anon.page.evaluate(() => document.activeElement?.textContent?.trim());
  assert.match(firstStop, /skip to main content/i, "the first Tab stop must be the skip link");
  await anon.page.keyboard.press("Enter");
  assert.equal(await anon.page.evaluate(() => location.hash), "#main");
  ok("keyboard: the first Tab stop is a 'Skip to main content' link that works");

  for (const protectedPath of ["/requests", "/requests/new", "/admin"]) {
    await anon.page.goto(`${BASE}${protectedPath}`);
    await anon.page.waitForURL(/\/login/);
  }
  ok("anonymous visitors are redirected to sign in from every protected route");

  await expectNoHorizontalOverflow(anon.page, "sign-in page");
  await shot(anon.page, "16-sign-in");
  await auditAccessibility(anon.page, "sign-in page");
  await anon.context.close();

  // ============================================================ citizen: register
  const citizen = await newSession("citizen");
  const cp = citizen.page;
  await cp.goto(`${BASE}/register`);
  await settle(cp);

  await cp.getByRole("button", { name: "Create account" }).click();
  await cp.getByText("Please enter your full name.").waitFor();
  await cp.getByLabel("Full name").fill(newCitizen.name);
  await cp.getByLabel("Email address").fill("not-an-email");
  await cp.getByLabel("Password", { exact: true }).fill("12345678");
  await cp.getByLabel("Confirm password", { exact: true }).fill("different");
  await cp.getByRole("button", { name: "Create account" }).click();
  await cp.getByText(/enter a valid email address/i).waitFor();
  await cp.getByText(/can't be only numbers/i).waitFor();
  await cp.getByText(/do not match/i).waitFor();
  await shot(cp, "02-register-validation");
  await auditAccessibility(cp, "register form with validation errors");
  ok("registration shows clear, field-level validation errors");

  await cp.getByLabel("Email address").fill(newCitizen.email);
  await cp.getByLabel("Password", { exact: true }).fill(newCitizen.password);
  await cp.getByLabel("Confirm password", { exact: true }).fill(newCitizen.password);
  await cp.getByRole("button", { name: "Create account" }).click();
  await cp.waitForURL(`${BASE}/requests`);
  await cp.getByRole("heading", { name: "You haven't reported anything yet" }).waitFor();
  await shot(cp, "03-citizen-empty-state");
  await auditAccessibility(cp, "citizen empty state");
  ok("citizen registers, is signed in and sees a helpful empty state");

  // ======================================================== citizen: new request
  await cp.getByRole("link", { name: "New request" }).first().click();
  await cp.waitForURL(/\/requests\/new/);
  await cp.getByRole("button", { name: "Submit request" }).click();
  await cp.getByText("Select a category.").waitFor();
  await cp.getByText("Please describe the problem.").waitFor();
  await auditAccessibility(cp, "new-request form with validation errors");
  ok("empty submission is blocked with errors on category, location and description");

  await cp.locator("label", { hasText: "Roads" }).first().click();
  await cp.getByLabel("Where is it?").fill("Thika Road, Roysambu flyover exit");
  await cp.getByLabel("What is the problem?").fill("A deep pothole in the left lane is damaging vehicles and forcing drivers to swerve into traffic.");
  await cp.locator("label", { hasText: "High" }).first().click();

  // client-side image check: a GIF is refused straight away and never previewed
  await cp.locator('input[type="file"]').setInputFiles({ name: "animation.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") });
  await cp.getByText(/unsupported file type/i).waitFor();
  ok("unsupported image type is rejected in the browser");

  // a spoofed "image": passes the browser's type check, must be caught by the server
  await cp.locator('input[type="file"]').setInputFiles({ name: "holiday.png", mimeType: "image/png", buffer: Buffer.from("this is not really a PNG") });
  await cp.getByText("holiday.png").waitFor();
  await cp.getByRole("button", { name: "Submit request" }).click();
  await cp.getByText(/not a valid image or is corrupted/i).waitFor();
  assert.match(cp.url(), /\/requests\/new/, "a rejected upload must not create a request");
  ok("a fake image is rejected by the server, and nothing is created");

  await cp.getByRole("button", { name: "Remove photo" }).click();
  await cp.locator('input[type="file"]').setInputFiles(PHOTO);
  await cp.getByAltText(/preview of the photo/i).waitFor();
  await shot(cp, "04-new-request-form", { full: true });
  await auditAccessibility(cp, "new-request form with photo preview");
  await expectNoHorizontalOverflow(cp, "new request");

  await cp.getByRole("button", { name: "Submit request" }).click();
  await cp.waitForURL(/\/requests\/SR-[A-Z0-9-]+$/);
  const reference = cp.url().split("/").pop();
  await cp.getByText("Your request has been submitted").waitFor();
  await cp.getByAltText(new RegExp(`photo submitted with request ${reference}`, "i")).waitFor();
  await cp.waitForFunction(() => document.querySelector("img[alt^='Photo submitted']")?.naturalWidth > 0);
  assert.match(reference, /^SR-\d{4}-[A-Z0-9]{6}$/);
  await shot(cp, "05-request-submitted", { full: true });
  await auditAccessibility(cp, "request detail (citizen, just submitted)");
  ok(`request ${reference} submitted with a photo; reference number and Pending status shown`);

  const mine = await api(cp, "/requests/");
  assert.equal(mine.count, 1);
  assert.equal(mine.results[0].status, "pending");
  ok("request persisted in the database with status Pending");

  // ================================================================== admin side
  const admin = await newSession("admin");
  const ap = admin.page;
  await signIn(ap, ADMIN_EMAIL, DEMO_PASSWORD);
  await ap.getByRole("heading", { name: "Administration dashboard" }).waitFor();

  // Baseline: the citizen's new request already exists and is Pending.
  const before = (await api(ap, "/analytics/summary/")).totals;
  assert.equal(before.total, before.pending + before.in_progress + before.resolved);
  assert.equal(before.unresolved, before.pending + before.in_progress);
  // Match the tile by its exact label ("Pending" must not match the "Pending + In Progress" hint on another tile).
  const tileValue = async (label) =>
    Number(
      await ap
        .locator("section[aria-label='Summary'] a", { has: ap.getByText(label, { exact: true }) })
        .locator("p")
        .first()
        .innerText(),
    );
  assert.equal(await tileValue("Total requests"), before.total);
  assert.equal(await tileValue("Unresolved"), before.unresolved);
  assert.equal(await tileValue("Pending"), before.pending);
  assert.equal(await tileValue("In Progress"), before.in_progress);
  assert.equal(await tileValue("Resolved"), before.resolved);
  await expectNoHorizontalOverflow(ap, "admin dashboard");
  await shot(ap, "06-admin-dashboard", { full: true });
  await auditAccessibility(ap, "administrator dashboard (stat tiles, charts, table)");
  ok(`dashboard tiles match the database (total ${before.total}, unresolved ${before.unresolved}, resolved ${before.resolved})`);

  await ap.getByRole("searchbox").fill(reference);
  await waitForCount(ap.locator("a:visible", { hasText: /^SR-/ }), 1); // search narrowed the table to this one request
  await ap.getByLabel("Filter by status").selectOption("pending");
  await ap.getByLabel("Filter by category").selectOption("roads");
  await ap.getByRole("link", { name: reference }).waitFor();
  await ap.getByLabel("Filter by category").selectOption("water");
  await ap.getByRole("heading", { name: "No requests match your filters" }).waitFor();
  ok("administrator can search by reference and filter by category and status");

  await ap.getByRole("button", { name: "Clear filters" }).first().click();
  await ap.getByRole("searchbox").fill(reference);
  await ap.getByRole("link", { name: reference }).click();
  await ap.waitForURL(new RegExp(`/requests/${reference}$`));
  await ap.getByText(newCitizen.name).first().waitFor();
  await ap.getByText(newCitizen.email).first().waitFor();
  await ap.getByAltText(/photo submitted/i).waitFor();
  await ap.waitForFunction(() => document.querySelector("img[alt^='Photo submitted']")?.naturalWidth > 0);
  ok("request detail shows description, uploaded image, date and the citizen who submitted it");

  // --- status: Pending -> In Progress (through the confirmation dialog)
  const startWork = ap.getByRole("button", { name: /mark in progress/i });
  await startWork.click();
  await ap.getByRole("dialog").waitFor();
  await ap.keyboard.press("Escape");
  await ap.getByRole("dialog").waitFor({ state: "hidden" });
  assert.ok(await startWork.evaluate((el) => el === document.activeElement), "focus must return to the button that opened the dialog");
  ok("keyboard: Esc closes the confirmation dialog and focus returns to its trigger; nothing changed");
  assert.equal((await api(ap, `/requests/${reference}/`)).status, "pending");

  await startWork.click();
  const dialog = ap.getByRole("dialog");
  await dialog.getByRole("heading", { name: "Mark as In Progress?" }).waitFor();
  await dialog.getByLabel(/note to the citizen/i).fill("A road crew has been scheduled for Tuesday morning.");
  await shot(ap, "07-admin-confirm-status");
  await auditAccessibility(ap, "status confirmation dialog");
  await dialog.getByRole("button", { name: "Mark as In Progress" }).click();
  await ap.getByText(/is now In Progress/i).waitFor();
  await ap.getByText("Status changed from Pending to In Progress").waitFor();
  ok("administrator moves the request to In Progress after confirming");

  const mid = (await api(ap, "/analytics/summary/")).totals;
  assert.deepEqual(
    [mid.total, mid.pending, mid.in_progress, mid.resolved, mid.unresolved],
    [before.total, before.pending - 1, before.in_progress + 1, before.resolved, before.unresolved],
  );
  ok("analytics moved one request from Pending to In Progress (unresolved unchanged)");

  // --- a citizen may not change status; neither may an illegal jump
  const citizenHeaders = await csrfHeaders(citizen.context);
  const forged = await cp.request.post(`${BASE}/api/requests/${reference}/status/`, {
    headers: citizenHeaders,
    data: { status: "resolved" },
  });
  assert.equal(forged.status(), 403);
  ok("a citizen calling the status API directly is refused (403)");

  const otherPending = (await api(ap, "/requests/?status=pending&page_size=1")).results[0];
  const skip = await ap.request.post(`${BASE}/api/requests/${otherPending.reference}/status/`, {
    headers: await csrfHeaders(admin.context),
    data: { status: "resolved" },
  });
  assert.equal(skip.status(), 400);
  assert.match((await skip.json()).errors.status[0], /Cannot move a request from Pending to Resolved/);
  ok("skipping a step (Pending -> Resolved) is rejected by the API (400)");

  // --- citizen sees the change and can't see anyone else's request
  await cp.reload();
  await cp.getByText("In Progress", { exact: true }).first().waitFor();
  assert.equal(await cp.getByText("Your request has been submitted").count(), 0, "the 'just submitted' banner must not outlive the first view");
  await cp.getByText("A road crew has been scheduled for Tuesday morning.").waitFor();
  await cp.getByText("Service team").first().waitFor();
  assert.equal(await cp.getByText("Grace Wanjiku").count(), 0, "staff names are hidden from citizens");
  await shot(cp, "08-citizen-tracks-status", { full: true });
  await auditAccessibility(cp, "request detail (citizen, in progress)");
  ok("citizen sees In Progress, the team's note and timestamps - without staff names");

  await cp.goto(`${BASE}/requests/${otherPending.reference}`);
  await cp.getByRole("heading", { name: "Request not found" }).waitFor();
  await shot(cp, "09-citizen-cannot-open-others-request");
  ok("a citizen opening someone else's request gets 'not found'");

  await cp.goto(`${BASE}/admin`);
  await cp.getByRole("heading", { name: /don't have access/i }).waitFor();
  ok("a citizen opening the admin dashboard is told they don't have access");

  // --- resolve
  await ap.getByRole("button", { name: /mark as resolved/i }).click();
  await ap.getByRole("dialog").getByLabel(/note to the citizen/i).fill("Pothole filled and the surface re-sealed.");
  await ap.getByRole("dialog").getByRole("button", { name: "Mark as Resolved" }).click();
  await ap.getByText("This request is resolved.").waitFor();
  await ap.getByText("Status changed from In Progress to Resolved").waitFor();
  assert.equal(await ap.getByRole("button", { name: /mark as/i }).count(), 0, "resolved is final: no more actions");
  await shot(ap, "10-admin-request-resolved", { full: true });
  await auditAccessibility(ap, "request detail (administrator, resolved)");
  ok("administrator resolves it; Resolved is final and the audit trail shows both changes");

  // --- analytics follow the data
  const after = (await api(ap, "/analytics/summary/")).totals;
  assert.equal(after.total, before.total, "resolving a request does not change the total");
  assert.equal(after.resolved, before.resolved + 1);
  assert.equal(after.unresolved, before.unresolved - 1);
  assert.equal(after.in_progress, before.in_progress);
  assert.equal(after.pending, before.pending - 1);
  await ap.goto(`${BASE}/admin`);
  await ap.getByRole("heading", { name: "Administration dashboard" }).waitFor();
  assert.equal(await tileValue("Resolved"), after.resolved);
  ok(`analytics follow the data: resolved ${before.resolved}→${after.resolved}, unresolved ${before.unresolved}→${after.unresolved}, total ${after.total}`);

  await cp.goto(`${BASE}/requests`);
  await cp.getByRole("link", { name: reference }).first().waitFor();
  await cp.getByText("Resolved", { exact: true }).first().waitFor();
  ok("citizen's list shows the request as Resolved");

  // --- sign out really ends the session
  await cp.getByRole("button", { name: "Sign out" }).click();
  await cp.waitForURL(`${BASE}/`);
  await cp.goto(`${BASE}/requests`);
  await cp.waitForURL(/\/login/);
  ok("signing out ends the session");
  await citizen.context.close();
  await admin.context.close();

  // ============================================================ resilience
  const chaos = await newSession("resilience", { width: 1280, height: 800 }, 1, { tolerateNetworkErrors: true });
  const xp = chaos.page;
  await signIn(xp, SEEDED_CITIZEN, DEMO_PASSWORD);
  await xp.getByRole("heading", { name: "My requests" }).first().waitFor();

  // network failure while loading the list -> friendly error state, then Retry recovers
  await xp.route("**/api/requests/?*", (route) => route.abort());
  await xp.reload();
  await xp.getByRole("heading", { name: "We couldn't load the requests" }).waitFor();
  await xp.getByText(/couldn't reach the server/i).first().waitFor();
  assert.equal(await xp.getByText(/Traceback|TypeError|fetch failed/i).count(), 0, "no technical details shown to the user");
  await shot(xp, "15-error-state");
  await auditAccessibility(xp, "error state with retry");
  await xp.unroute("**/api/requests/?*");
  await xp.getByRole("button", { name: "Try again" }).click();
  await xp.getByRole("link", { name: /^SR-/ }).first().waitFor();
  ok("a failed load shows a friendly error state; Retry recovers without a page reload");

  // session expires while using the app -> told why, sent to sign in
  await chaos.context.clearCookies({ name: "sessionid" });
  await xp.getByLabel("Filter by status").selectOption("pending");
  await xp.waitForURL(/\/login/);
  await xp.getByText(/your session has expired/i).waitFor();
  ok("an expired session is explained ('Your session has expired') and sends the user to sign in");
  await chaos.context.close();

  // ================================================== screenshots with seeded data
  const seeded = await newSession("seeded-citizen");
  await signIn(seeded.page, SEEDED_CITIZEN, DEMO_PASSWORD);
  await seeded.page.getByRole("heading", { name: "My requests" }).first().waitFor();
  await shot(seeded.page, "11-citizen-my-requests");
  await seeded.context.close();

  // ====================================================================== mobile
  const mobile = await newSession("mobile", { width: 390, height: 844 }, 2);
  const mp = mobile.page;
  await mp.goto(BASE);
  await settle(mp);
  await expectNoHorizontalOverflow(mp, "mobile landing");
  await shot(mp, "12-mobile-landing");
  await signIn(mp, SEEDED_CITIZEN, DEMO_PASSWORD);
  await mp.getByRole("heading", { name: "My requests" }).first().waitFor();
  await expectNoHorizontalOverflow(mp, "mobile citizen list");
  await shot(mp, "13-mobile-my-requests");
  await mp.getByRole("button", { name: "Open menu" }).click();
  await mp.getByRole("button", { name: "Sign out" }).click();
  await mp.waitForURL(`${BASE}/`);
  await signIn(mp, ADMIN_EMAIL, DEMO_PASSWORD);
  await mp.getByRole("heading", { name: "Administration dashboard" }).waitFor();
  await expectNoHorizontalOverflow(mp, "mobile admin dashboard");
  await shot(mp, "14-mobile-admin-dashboard");
  await auditAccessibility(mp, "administrator dashboard at phone width");
  await mobile.context.close();
  ok("layouts hold up at phone width (no horizontal overflow); mobile screenshots captured");

  assert.deepEqual(consoleProblems, [], `browser console reported problems:\n${consoleProblems.join("\n")}`);
  ok("no console errors or warnings in any session");
  ok(`no WCAG 2.2 A/AA violations found by axe-core on ${audited.length} screens: ${audited.join("; ")}`);

  console.log(`\nAll ${step} checks passed. Screenshots saved to ${SHOTS}`);
} catch (error) {
  console.error(`\n✗ FAILED after ${step} passing checks:\n${error.stack || error}`);
  // Leave evidence behind: a screenshot of every page that is still open (git-ignored folder).
  const evidenceDir = path.resolve(here, "../test-results");
  fs.mkdirSync(evidenceDir, { recursive: true });
  for (const { name, page } of sessions) {
    await page
      .screenshot({ path: path.join(evidenceDir, `failure-${name}.png`), fullPage: true })
      .then(() => console.error(`  saved test-results/failure-${name}.png (${page.url()})`))
      .catch(() => {});
  }
  if (consoleProblems.length) console.error(`\nConsole problems:\n${consoleProblems.join("\n")}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
