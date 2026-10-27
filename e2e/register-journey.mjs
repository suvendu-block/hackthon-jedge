// register page — walk it like a real user: form, submit, session, errors.
// backend :3000 + frontend :5173 must be up. Run from anywhere.
import { chromium } from 'playwright';

const UI = 'http://localhost:5173';
const stamp = Date.now();
const ORG_EMAIL = `reg-org+${stamp}@ui.dev`;
const JUDGE_EMAIL = `reg-judge+${stamp}@ui.dev`;
const PW = 'password123';

let pass = 0, fail = 0;
const check = (cond, label) => {
    if (cond) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};
const head = (t) => console.log(`\n--- ${t} ---`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('pageerror', (e) => console.log(`  PAGE-ERROR  ${e.message}`));

const shot = (n) => page.screenshot({ path: `e2e/artifacts/${n}.png`, fullPage: true }).catch(() => {});

try {
    head('1 · the register screen renders');
    await page.goto(`${UI}/register`, { waitUntil: 'networkidle' });
    check((await page.locator('.login-eyebrow').textContent())?.trim() === 'create account', 'eyebrow reads "create account"');
    const fields = await page.locator('.login-form input, .login-form select').count();
    check(fields === 4, `form carries all four fields (name, email, password, role) — found ${fields}`);
    // every control inside its <label> — that IS the accessible name, no aria guesswork
    const labeled = await page.evaluate(() =>
        [...document.querySelectorAll('.login-form input, .login-form select')].every((i) => i.closest('label')));
    check(labeled, 'every field sits inside its label (screen readers announce them)');
    const fs = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.login-field input')).fontSize));
    check(fs >= 15, `input text ${fs}px — iOS won't zoom the page on focus`);
    const btn = await page.locator('.login-submit').boundingBox();
    check(btn && btn.height >= 40, `submit is ${btn ? Math.round(btn.height) : 0}px tall (touch-friendly ≥40)`);
    check(await page.locator('.login-select option').count() === 3, 'role picker offers team / judge / organizer');
    check((await page.locator('.login-footer a').textContent()) === 'Sign in', 'footer links back to sign in');
    await shot('reg-1-form');

    head('2 · password rules block a short password');
    await page.fill('input[autocomplete="name"]', `Reg Judge ${stamp}`);
    await page.fill('input[autocomplete="email"]', JUDGE_EMAIL);
    await page.fill('input[autocomplete="new-password"]', 'short');
    await page.click('.login-submit');
    const invalid = await page.evaluate(() =>
        document.querySelector('input[autocomplete="new-password"]').matches(':invalid'));
    check(invalid, '7-char password is :invalid — the form refuses to submit it');
    check(page.url().endsWith('/register'), 'still on /register, nothing sent');
    const nativeMsg = await page.evaluate(() =>
        document.querySelector('input[autocomplete="new-password"]').validationMessage);
    check(nativeMsg.length > 0, `browser explains why: "${nativeMsg.slice(0, 60)}"`);

    head('3 · a real signup lands signed in (judge)');
    await page.fill('input[autocomplete="new-password"]', PW);
    await page.selectOption('.login-select', 'judge');
    await shot('reg-2-filled');
    await page.click('.login-submit');
    await page.waitForURL((u) => u.pathname === '/', { timeout: 15000 });
    await page.waitForSelector('.dash-logout', { timeout: 10000 });
    let body = await page.locator('body').textContent();
    check(body.includes(`Reg Judge ${stamp}`), 'dashboard greets the new account by name');
    check(body.includes('judge'), 'role taken from the picker — signed in as judge');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('user') || 'null'));
    check(stored?.role === 'judge' && stored?.email === JUDGE_EMAIL, 'session persisted (token + user in storage)');
    await shot('reg-3-dashboard');

    head('4 · visiting /register while signed in');
    await page.goto(`${UI}/register`, { waitUntil: 'networkidle' });
    const already = await page.locator('.login-already').textContent();
    check(already.includes('Already logged in') && already.includes(`Reg Judge ${stamp}`), 'sees "Already logged in as Reg Judge…"');
    check(await page.locator('.login-already a').textContent() === 'Go to dashboard', 'offers the way out');
    await shot('reg-4-already');

    head('5 · logout → the login page links over');
    // still on the "already in" screen — take its way out first
    await page.click('.login-already a');
    await page.waitForURL((u) => u.pathname === '/', { timeout: 10000 });
    await page.waitForSelector('.dash-logout', { timeout: 10000 });
    await page.click('.dash-logout');
    await page.waitForURL((u) => u.pathname === '/login', { timeout: 10000 });
    check(true, 'logout drops to /login');
    await page.waitForSelector('.login-footer a[href="/register"]', { timeout: 5000 });
    await page.click('.login-footer a[href="/register"]');
    await page.waitForURL((u) => u.pathname === '/register', { timeout: 10000 });
    check(true, '"Create account" link on the login page reaches /register');

    head('6 · duplicate email — the server says no, the page says what');
    await page.fill('input[autocomplete="name"]', `Reg Dup ${stamp}`);
    await page.fill('input[autocomplete="email"]', JUDGE_EMAIL);
    await page.fill('input[autocomplete="new-password"]', PW);
    await page.click('.login-submit');
    await page.waitForSelector('.login-error', { timeout: 10000 });
    const errTxt = (await page.locator('.login-error').textContent()).trim();
    check(/email|registered|taken/i.test(errTxt), `error surfaces the server truth: "${errTxt}"`);
    check(await page.locator('.login-error').getAttribute('role') === 'alert', 'error is role=alert — announced, not silent');
    const stillUserless = await page.evaluate(() => localStorage.getItem('token'));
    check(!stillUserless, 'no session issued for the failed attempt');
    await shot('reg-5-duplicate');

    head('7 · second real signup through the form (organizer)');
    await page.fill('input[autocomplete="name"]', `Reg Org ${stamp}`);
    await page.fill('input[autocomplete="email"]', ORG_EMAIL);
    await page.selectOption('.login-select', 'organizer');
    await page.click('.login-submit');
    await page.waitForURL((u) => u.pathname === '/', { timeout: 15000 });
    await page.waitForSelector('.dash-logout', { timeout: 10000 });
    body = await page.locator('body').textContent();
    check(body.includes(`Reg Org ${stamp}`) && body.includes('organizer'), 'organizer account created and signed in');

    head('8 · the fresh organizer can actually use the app');
    await page.goto(`${UI}/events`, { waitUntil: 'networkidle' });
    await page.waitForSelector('body', { timeout: 5000 });
    const eventsTxt = await page.locator('body').textContent();
    check(!eventsTxt.includes('No events assigned to you yet'), 'organizer reaches /events without being bounced to login');
    check(page.url().includes('/events'), 'route guard let the new session through');
    await shot('reg-6-events');
} catch (e) {
    fail++;
    console.log(`  CRASH  ${e.message.split('\n')[0]}`);
    await shot('reg-crash');
}

await browser.close();
console.log(`\n================ ${pass} passed, ${fail} failed ================`);
process.exit(fail ? 1 : 0);
