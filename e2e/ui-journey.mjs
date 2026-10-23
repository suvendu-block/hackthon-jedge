// the real user test — a browser walks the whole hackathon loop, role by role.
// node e2e/ui-journey.mjs   (backend :3000, frontend dev :5173 must be up — CORS)
import { chromium } from 'playwright';

const UI = 'http://localhost:5173';
const API = 'http://localhost:3000/api';
const stamp = Date.now();
// unique per run — leftover runs share this suite, so names can't collide
const EVENT_NAME = `UI Night Shift ${stamp}`;

let pass = 0, fail = 0;
const dialogs = [];
const check = (cond, label) => {
    if (cond) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};
const head = (t) => console.log(`\n--- ${t} ---`);

// accounts come from the API since the UI has no register screen
async function api(path, opts = {}) {
    const res = await fetch(`${API}${path}`, {
        method: opts.method || 'GET',
        headers: { 'Content-Type': 'application/json', ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
        body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    let data = null;
    try { data = await res.json(); } catch {}
    return { status: res.status, data };
}

async function mk(role, name) {
    const { data } = await api('/auth/register', {
        method: 'POST',
        body: { name, email: `${name}+${stamp}@ui.dev`, password: 'password123', role }
    });
    return { ...data, password: 'password123' };
}

// every confirm() on the page gets recorded + accepted unless a test says otherwise
function wirePage(page, { accept = true } = {}) {
    page.on('dialog', async (d) => {
        dialogs.push(d.message());
        if (accept) await d.accept(); else await d.dismiss();
    });
    page.on('pageerror', (e) => console.log(`  PAGE-ERROR  ${e.message}`));
}

async function shot(page, name) {
    await page.screenshot({ path: `e2e/artifacts/${name}.png`, fullPage: true }).catch(() => {});
}

// range sliders — set the value the way React expects, then confirm the UI reacted
async function setRange(page, label, value) {
    await page.locator(`input[aria-label="${label}"]`).evaluate((node, v) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(node, String(v));
        node.dispatchEvent(new Event('input', { bubbles: true }));
        node.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
}

async function login(page, who) {
    await page.goto(`${UI}/login`);
    await page.fill('input[type=email]', who.email);
    await page.fill('input[type=password]', who.password);
    await page.click('button.login-submit');
    await page.waitForSelector('.login-already', { timeout: 20000 });
    const shown = await page.locator('.login-already').textContent();
    await page.click('.login-already a');
    await page.waitForURL(`${UI}/`, { timeout: 20000 });
    return shown;
}

async function logout(page) {
    await page.goto(`${UI}/`);
    await page.click('.dash-logout');
    await page.waitForURL('**/login', { timeout: 20000 });
    const tok = await page.evaluate(() => localStorage.getItem('token'));
    return tok === null;
}

// the docket reuses .events-empty for its loading line, and React can mount
// it after our first check — wait for a genuinely settled screen instead
async function waitForDocket(page) {
    await page.waitForFunction(() => {
        const body = document.body.innerText;
        if (body.includes('reading the docket')) return false;
        return body.includes('No events yet')
            || body.includes('No open events')
            || body.includes('No events assigned')
            || !!document.querySelector('.event-card');
    }, null, { timeout: 8000 });
}

const ctxArgs = { viewport: { width: 1440, height: 900 } };

// ---------------------------------------------------------------- cast
head('1 · accounts (API setup — the UI has no register screen)');
const org = await mk('organizer', `orgui${stamp}`);
const judge1 = await mk('judge', `judgeOne${stamp}`);
const judge2 = await mk('judge', `judgeTwo${stamp}`);
const team1 = await mk('team', `teamOne${stamp}`);
const team2 = await mk('team', `teamTwo${stamp}`);
check(!!(org.token && judge1.token && judge2.token && team1.token && team2.token), 'organizer + 2 judges + 2 teams exist');

const browser = await chromium.launch();

try {
    // ============================================================ organizer
    head('2 · organizer opens the floor for the first time');
    {
        const page = await browser.newPage(ctxArgs);
        wirePage(page);

        // bounced to login when logged out
        await page.goto(`${UI}/`);
        await page.waitForURL('**/login', { timeout: 20000 });
        check(page.url().endsWith('/login'), 'unauthenticated visit to / lands on the login screen');

        // wrong password gets a real message, not a silent fail
        await page.fill('input[type=email]', org.email);
        await page.fill('input[type=password]', 'nope-nope');
        await page.click('button.login-submit');
        await page.waitForSelector('.login-error', { timeout: 20000 });
        const errMsg = (await page.locator('.login-error').textContent()).trim();
        check(/invalid/i.test(errMsg), `bad password shows an error: "${errMsg}"`);

        // now the real one
        const shown = await login(page, org);
        check(shown.includes(org.name) && shown.includes('organizer'), 'after login it confirms who we are');
        check((await page.locator('.dash-role').textContent()) === 'organizer', 'dashboard shows role: organizer');

        // empty docket
        await page.click('.dash-cta');
        await page.waitForURL('**/events', { timeout: 20000 });
        await waitForDocket(page);
        const emptyOrg = await page.locator('.events-empty').textContent();
        check(emptyOrg.includes('create the first one'), `fresh organizer sees: "${emptyOrg.trim()}"`);

        // create form — the honest path: type a name, don't touch the rubric
        await page.click('.events-new');
        await page.fill('.events-form input', EVENT_NAME);
        await page.fill('.events-form textarea', 'judging that actually adds up');
        const freshMeter = await page.locator('.rubric-total-msg').textContent();
        check(freshMeter.includes('adds up'), `untouched rubric already reads "${freshMeter.trim()}"`);
        check(!(await page.locator('.events-create').isDisabled()), 'create is live for a name + default Σ100 rubric');

        // now shape the rubric to 60/40 and watch the live meter complain first
        const weights = page.locator('.rubric-weight input');
        await weights.nth(0).fill('60');                       // 60+35+25 = 120
        const over1 = await page.locator('.rubric-total-msg').textContent();
        check(over1.includes('over the maximum'), `meter catches 120%: "${over1.trim()}"`);
        check(await page.locator('.events-create').isDisabled(), 'create stays disabled while Σ ≠ 100');

        await weights.nth(1).fill('40');                       // 60+40+25 = 125
        await page.click('.rubric-remove[aria-label="Remove Design"]');   // 60+40 = 100
        const ok100 = await page.locator('.rubric-total-msg').textContent();
        check((await page.locator('.rubric-total-num').textContent()).includes('100'), 'meter reads Σ 100%');
        check(ok100.includes('adds up'), `meter approves: "${ok100.trim()}"`);
        check(!(await page.locator('.events-create').isDisabled()), 'create enables at exactly 100');

        await page.click('.events-create');
        await page.waitForSelector('.event-card', { timeout: 20000 });
        const cardTxt = await page.locator('.event-card').first().textContent();
        check(cardTxt.includes(EVENT_NAME), 'event card appears with the name');
        check(cardTxt.includes('draft'), 'starts life as a draft');
        check(cardTxt.includes('2 criteria'), 'rubric saved as 2 criteria');
        check(cardTxt.includes('0 judges'), 'no judges yet');

        // assign the first judge
        await page.click('.event-assign');
        await page.waitForFunction(() => document.querySelectorAll('.event-picker option').length > 1, null, { timeout: 20000 });
        const opts = await page.locator('.event-picker option').allTextContents();
        const pick = opts.findIndex(o => o.includes(judge1.email));
        check(pick > 0, `judge dropdown lists judges (${opts.length - 1} listed)`);
        await page.locator('.event-picker select').selectOption({ index: pick });
        await page.click('.event-assign-go');
        await page.waitForSelector('.event-judge', { timeout: 20000 });
        const assigned = await page.locator('.event-card').first().textContent();
        check(assigned.includes(judge1.name), `judge chip shows ${judge1.name}`);
        check(assigned.includes('1 judge'), 'judge count now 1');

        // while draft: publish + delete exist, close doesn't yet
        check(await page.locator('.event-publish').isVisible(), 'draft card offers publish');
        check(await page.locator('.event-del').isVisible(), 'draft card offers delete');
        check(await page.locator('.event-close').count() === 0, 'no close button until it is live');

        // do NOT publish yet — first let a team confirm drafts are invisible
        const cleared = await logout(page);
        check(cleared, 'logout clears the token');
    }

    // ------------------------------------------------------------ team sees nothing yet
    head('3 · team checks the docket while the event is still a draft');
    {
        const page = await browser.newPage(ctxArgs);
        wirePage(page);
        await login(page, team1);
        await page.click('.dash-cta');
        await page.waitForSelector('.events-empty, .events-list', { timeout: 20000 });
        await waitForDocket(page);
        const docketTxt = await page.locator('.events').textContent();
        check(!docketTxt.includes(EVENT_NAME), 'team sees nothing while it\'s a draft');
        check(await page.locator('.event-card', { hasText: EVENT_NAME }).count() === 0, 'the draft event itself does not leak to the team');
        await logout(page);
    }

    // ------------------------------------------------------------ organizer publishes
    head('4 · organizer publishes for real');
    {
        const page = await browser.newPage(ctxArgs);
        wirePage(page);
        await login(page, org);
        await page.click('.dash-cta');
        await page.waitForSelector('.event-card', { timeout: 20000 });
        dialogs.length = 0;
        await page.click('.event-publish');
        await page.waitForSelector('.event-status--published', { timeout: 20000 });
        check(dialogs.some(d => d.includes('Publish this event')), `publish asks first: "${dialogs[0] || 'none'}"`);
        const status = await page.locator('.event-status').first().textContent();
        check(status === 'open for judging', `status reads "${status}"`);
        check(await page.locator('.event-close').isVisible(), 'live event now offers close judging');
        await logout(page);
    }

    // ------------------------------------------------------------ team2 submits
    head('5 · team two submits a project');
    {
        const page = await browser.newPage(ctxArgs);
        wirePage(page);
        await login(page, team2);
        await page.click('.dash-cta');
        await page.waitForSelector('.event-card', { timeout: 20000 });
        // older runs leave published events around — ours just has to be among them
        check(await page.locator('.event-card', { hasText: EVENT_NAME }).count() === 1, 'team now sees the published event');
        await page.locator('.event-card', { hasText: EVENT_NAME }).locator('.event-view').click();
        await page.waitForURL('**/submissions', { timeout: 20000 });
        await page.waitForSelector('.subs-new', { timeout: 20000 });
        check((await page.locator('.subs-new').textContent()).includes('submit project'), 'team gets a submit button');

        await page.click('.subs-new');
        await page.fill('.subs-field input >> nth=0', 'MediQueue');
        await page.fill('.subs-field input >> nth=1', 'AI triage for clinics');
        await page.fill('.subs-field textarea', 'boards queue up faster than staff can see patients');
        await page.click('.subs-save');
        await page.waitForSelector('.sub-card', { timeout: 20000 });
        const subTxt = await page.locator('.sub-card').first().textContent();
        check(subTxt.includes('MediQueue') && subTxt.includes('teamTwo'), 'submission card renders with team name');
        check(await page.locator('.sub-edit').isVisible() && await page.locator('.sub-withdraw').isVisible(), 'own card offers edit + withdraw');
        check(await page.locator('.sub-score').count() === 0, 'a team never sees a score button');
        await logout(page);
    }

    // ------------------------------------------------------------ team1 submit + scoping + edit + withdraw
    head('6 · team one: hostile link, scoping, edit, withdraw, re-enter');
    {
        const page = await browser.newPage(ctxArgs);
        wirePage(page);
        await login(page, team1);
        await page.click('.dash-cta');
        await page.waitForSelector('.event-card', { timeout: 20000 });
        await page.locator('.event-card', { hasText: EVENT_NAME }).locator('.event-view').click();
        await page.waitForSelector('.subs-new', { timeout: 20000 });

        // nothing visible — team one hasn't submitted, and team two's is private
        check(await page.locator('.sub-card').count() === 0, `another team's entry is invisible (saw 0 cards)`);

        await page.click('.subs-new');
        await page.fill('.subs-field input >> nth=0', 'ClimateLens');
        await page.fill('.subs-field input >> nth=1', 'satellite data for flood risk');

        // the allowlist, before the round trip
        await page.click('.subs-link-add');
        await page.fill('.subs-link-label', 'pwn');
        await page.fill('.subs-link-url', 'javascript:alert(1)');
        await page.waitForSelector('.subs-link-warn', { timeout: 4000 });
        const warn = await page.locator('.subs-link-warn').textContent();
        check(warn.includes('http'), `javascript: link rejected in-form: "${warn.trim()}"`);
        check(await page.locator('.subs-save').isDisabled(), 'and the form will not submit it');

        await page.fill('.subs-link-url', 'https://github.com/teamone/climatelens');
        await page.waitForTimeout(150);
        check(await page.locator('.subs-link-warn').count() === 0, 'warning clears once it is a real https url');
        check(!(await page.locator('.subs-save').isDisabled()), 'submit re-enables');
        await page.click('.subs-save');
        await page.waitForSelector('.sub-card', { timeout: 20000 });

        const cards = await page.locator('.sub-card').count();
        const bodyTxt = await page.locator('.subs').textContent();
        check(cards === 1 && bodyTxt.includes('ClimateLens') && !bodyTxt.includes('MediQueue'), 'sees exactly its own entry, nobody else\'s');

        // edit
        await page.click('.sub-edit');
        await page.fill('.subs-field input >> nth=1', 'flood risk from orbit');
        await page.click('.subs-save');
        await page.waitForFunction(() => document.body.innerText.includes('flood risk from orbit'), null, { timeout: 20000 });
        check(true, 'edit saves and the card shows the new tagline');

        // withdraw — test the confirm, but bail out first so we keep the entry
        dialogs.length = 0;
        const page2 = page;
        page.removeAllListeners('dialog');
        wirePage(page, { accept: false });
        await page2.click('.sub-withdraw');
        await page.waitForTimeout(300);
        check(dialogs.some(d => d.includes('Withdraw') && d.includes('ClimateLens')), `withdraw asks first: "${dialogs[0] || 'none'}"`);
        check(await page.locator('.sub-card').count() === 1, 'backing out of the confirm keeps the entry');

        // now really withdraw, then re-enter (proves the slot frees up)
        page.removeAllListeners('dialog');
        wirePage(page, { accept: true });
        await page.click('.sub-withdraw');
        await page.waitForSelector('.subs-empty', { timeout: 20000 });
        check((await page.locator('.subs-empty').textContent()).includes('be the first'), 'withdraw empties the slot');

        await page.click('.subs-new');
        await page.fill('.subs-field input >> nth=0', 'ClimateLens');
        await page.fill('.subs-field input >> nth=1', 'satellite data for flood risk');
        await page.click('.subs-save');
        await page.waitForSelector('.sub-card', { timeout: 20000 });
        check(await page.locator('.sub-card').count() === 1, 're-submitting after withdraw works');
        await logout(page);
    }

    // ------------------------------------------------------------ judge scoping
    head('7 · unassigned judge is locked out');
    {
        const page = await browser.newPage(ctxArgs);
        wirePage(page);
        await login(page, judge2);
        await page.click('.dash-cta');
        await page.waitForSelector('.events-empty', { timeout: 20000 });
        await waitForDocket(page);
        const emptyJudge = await page.locator('.events-empty').textContent();
        check(emptyJudge.includes('assigned to you'), `judge two wasn't assigned so sees: "${emptyJudge.trim()}"`);
        await logout(page);
    }

    // ------------------------------------------------------------ judge scores
    head('8 · judge one scores ClimateLens to exactly 82');
    {
        const page = await browser.newPage(ctxArgs);
        wirePage(page);
        await login(page, judge1);
        await page.click('.dash-cta');
        await page.waitForSelector('.event-card', { timeout: 20000 });
        check(await page.locator('.event-card').count() === 1, 'assigned judge sees the event');
        await page.locator('.event-card', { hasText: EVENT_NAME }).locator('.event-view').click();
        await page.waitForSelector('.sub-card', { timeout: 20000 });
        check(await page.locator('.sub-card').count() === 2, 'judge sees both teams\' projects');

        // open the scorecard
        await page.locator('.sub-card', { hasText: 'ClimateLens' }).locator('.sub-score').click();
        await page.waitForSelector('.score-row', { timeout: 20000 });
        check((await page.locator('.score-crit-name').allTextContents()).join(',') === 'Impact,Technical', 'rubric rows render in order');
        const weightsShown = await page.locator('.score-crit-weight').allTextContents();
        check(weightsShown[0] === '60% weight' && weightsShown[1] === '40% weight', `weights shown: ${weightsShown.join(' ')}`);
        check((await page.locator('.score-total-num').textContent()) === '0', 'total starts at 0');
        check((await page.locator('.score-total-note').textContent()) === '0 of 2 scored', 'progress reads 0 of 2');
        check(await page.locator('.score-submit').isDisabled(), 'submit blocked while incomplete');

        // the AI draft — request it, read it, accept one number, keep judging anyway
        await page.click('.ai-ask');
        await page.waitForSelector('.ai-panel .ai-scores', { timeout: 30000 });   // real LLM round-trip (+ retry if a sample comes back off-spec)
        check((await page.locator('.ai-chip').textContent()).trim() === 'AI', 'assistant panel wears the AI chip');
        const evTypes = await page.locator('.ai-ev-type').allTextContents();
        check(evTypes.length >= 1 && evTypes.every(t => /verified|claimed|inferred/.test(t)), `evidence rows carry type labels: ${evTypes.join(' / ')}`);
        check(await page.locator('.ai-limits li').count() >= 1, 'limitations are spelled out');
        check((await page.locator('.ai-score-num').first().textContent()).includes('confidence'), 'every suggestion states its confidence');

        // accept the Impact suggestion — prefills the slider, behind a confirm
        const impactRow = page.locator('.ai-score', { hasText: 'Impact' });
        const suggestedTxt = await impactRow.locator('.ai-score-num').textContent();
        const suggestedVal = Number(suggestedTxt.match(/draft (\d+)/)[1]);
        dialogs.length = 0;
        await impactRow.locator('.ai-use').click();
        check(dialogs.some(d => d.includes('AI draft')), `accept asks first: "${dialogs[0] || 'none'}"`);
        await page.waitForFunction((v) => document.querySelector('input[aria-label="Impact score"]')?.value === String(v), suggestedVal);
        check(true, `slider took the draft value ${suggestedVal} — still the judge's to move`);

        // Impact 9/10 → 9/10×60 = 54 — and there's the override, AI included
        await setRange(page, 'Impact score', 9);
        await page.waitForFunction(() => document.querySelector('.score-total-num')?.textContent === '54');
        check(true, 'Impact 9 → running total 54');
        check((await page.locator('.score-row').nth(0).locator('.score-contrib').textContent()) === '+54', 'contribution chip reads +54');
        check((await page.locator('.score-total-note').textContent()) === '1 of 2 scored', 'progress reads 1 of 2');
        check(await page.locator('.score-submit').isDisabled(), 'still blocked with one criterion missing');

        // Technical 7/10 → 7/10×40 = 28 → 82
        await setRange(page, 'Technical score', 7);
        await page.waitForFunction(() => document.querySelector('.score-total-num')?.textContent === '82');
        check(true, 'Technical 7 → running total 82 (54+28, matches hand math)');
        check((await page.locator('.score-row').nth(1).locator('.score-contrib').textContent()) === '+28', 'contribution chip reads +28');
        check((await page.locator('.score-total-note').textContent()) === 'all criteria scored', 'progress complete');

        await page.fill('.score-comments textarea', 'Strong data pipeline, UI rough around the edges.');
        const submitTxt = await page.locator('.score-submit').textContent();
        check(submitTxt === 'submit — 82/100', `button shows "${submitTxt}"`);
        check(!(await page.locator('.score-submit').isDisabled()), 'submit now available');

        dialogs.length = 0;
        await page.click('.score-submit');
        await page.waitForSelector('.score-final', { timeout: 20000 });
        check(dialogs.some(d => d.includes('82/100')), `confirm names the final score: "${dialogs[0] || 'none'}"`);
        check((await page.locator('.score-total-note').textContent()) === 'submitted — final', 'header flips to submitted — final');
        check((await page.locator('.score-final').textContent()).includes('locked'), 'locked notice with a timestamp');
        check(await page.locator('input[aria-label="Impact score"]').isDisabled(), 'sliders lock after submit');
        check(await page.locator('.score-submit').count() === 0, 'no second chance to submit');

        // survives a reload
        await page.reload();
        await page.waitForSelector('.score-final', { timeout: 20000 });
        check((await page.locator('.score-total-num').textContent()) === '82', 'reload keeps total at 82');
        check((await page.locator('.score-comments textarea').isDisabled()), 'justification read-only after submit');
        check(await page.locator('.ai-panel .ai-scores').count() === 1, 'the stored AI draft rides along after reload');
        check(await page.locator('.ai-use').first().isDisabled(), 'suggestions lock once the scorecard is submitted');

        // the results door is already on the card — but it stays shut for judges
        await page.goto(`${UI}/events`);
        await waitForDocket(page);
        await page.locator('.event-card', { hasText: EVENT_NAME }).locator('.event-results').click();
        await page.waitForSelector('.lb-sealed', { timeout: 15000 });
        check((await page.locator('.lb-sealed h2').textContent()).includes('sealed'), 'judge hits the sealed screen, not numbers');
        const sealedTxt = await page.locator('.lb-sealed').textContent();
        check(!sealedTxt.includes('82'), 'not one score leaks through the sealed panel');

        await logout(page);
    }

    // ------------------------------------------------------------ organizer assigns judge two mid-event
    head('9 · organizer hands judge two a badge while judging is live');
    {
        const page = await browser.newPage(ctxArgs);
        wirePage(page);
        await login(page, org);
        await page.click('.dash-cta');
        await page.waitForSelector('.event-card', { timeout: 20000 });
        await page.locator('.event-card', { hasText: EVENT_NAME }).locator('.event-assign').click();
        await page.waitForFunction(() => document.querySelectorAll('.event-picker option').length > 1, null, { timeout: 20000 });
        const opts = await page.locator('.event-picker option').allTextContents();
        const pick = opts.findIndex(o => o.includes(judge2.email));
        check(pick > 0, 'judge two appears in the picker');
        await page.locator('.event-picker select').selectOption({ index: pick });
        await page.click('.event-assign-go');
        // wait for the assign round-trip, not for judge one's old chip
        await page.waitForFunction(() => document.querySelector('.event-card')?.textContent?.includes('2 judges'), null, { timeout: 20000 });
        const cardTxt = await page.locator('.event-card', { hasText: EVENT_NAME }).textContent();
        check(cardTxt.includes(judge2.name) && cardTxt.includes('2 judges'), 'the card now carries both judges');
        await logout(page);
    }

    // ------------------------------------------------------------ judge two scores
    head('10 · judge two scores MediQueue to exactly 50');
    {
        const page = await browser.newPage(ctxArgs);
        wirePage(page);
        await login(page, judge2);
        await page.click('.dash-cta');
        await page.waitForSelector('.event-card', { timeout: 20000 });
        check(await page.locator('.event-card').count() === 1, 'the fresh badge works — judge two sees the event');
        await page.locator('.event-card', { hasText: EVENT_NAME }).locator('.event-view').click();
        await page.waitForSelector('.sub-card', { timeout: 20000 });
        await page.locator('.sub-card', { hasText: 'MediQueue' }).locator('.sub-score').click();
        await page.waitForSelector('.score-row', { timeout: 20000 });

        // 5/10 × 60 + 5/10 × 40 = 50
        await setRange(page, 'Impact score', 5);
        await setRange(page, 'Technical score', 5);
        await page.waitForFunction(() => document.querySelector('.score-total-num')?.textContent === '50');
        check(true, '5 + 5 lands on 50 (30 + 20, hand math holds)');

        dialogs.length = 0;
        await page.click('.score-submit');
        await page.waitForSelector('.score-final', { timeout: 20000 });
        check(dialogs.some(d => d.includes('50/100')), `judge two's submit confirms: "${dialogs[0] || 'none'}"`);

        // he waits at the sealed door too
        await page.goto(`${UI}/events`);
        await waitForDocket(page);
        await page.locator('.event-card', { hasText: EVENT_NAME }).locator('.event-results').click();
        await page.waitForSelector('.lb-sealed', { timeout: 15000 });
        check(true, 'judge two also waits at the sealed door');
        await logout(page);
    }

    // ------------------------------------------------------------ organizer closes, previews, releases
    head('11 · organizer closes judging, previews, releases, exports');
    {
        const page = await browser.newPage(ctxArgs);
        wirePage(page);
        await login(page, org);
        await page.click('.dash-cta');
        await page.waitForSelector('.event-card', { timeout: 20000 });
        dialogs.length = 0;
        await page.click('.event-close');
        await page.waitForSelector('.event-status--closed', { timeout: 20000 });
        check(dialogs.some(d => d.includes('Close judging')), `close asks first: "${dialogs[0] || 'none'}"`);
        const status = await page.locator('.event-status').first().textContent();
        check(status === 'closed', `status reads "${status}"`);
        check(await page.locator('.event-publish').count() === 0, 'no way to re-publish from the card');
        check(await page.locator('.event-assign').count() === 0, 'judge assignment ends with the event');

        // read-only view of the field
        await page.locator('.event-card', { hasText: EVENT_NAME }).locator('.event-view').click();
        await page.waitForSelector('.subs-locked', { timeout: 20000 });
        check((await page.locator('.subs-locked').textContent()).includes('read-only'), 'organizer sees the closed notice');
        check(await page.locator('.sub-card').count() === 2, 'both entries still readable');

        // now the standings — preview first, then the big red switch
        await page.goto(`${UI}/events`);
        await waitForDocket(page);
        await page.locator('.event-card', { hasText: EVENT_NAME }).locator('.event-results').click();
        await page.waitForSelector('.lb-table', { timeout: 15000 });
        check((await page.locator('.lb-preview').textContent()).includes('Preview'), 'organizer gets a pre-release preview strip');
        check(await page.locator('.lb-release').isVisible(), 'the release button waits for them');

        // hand math: ClimateLens 82 (judge one), MediQueue 50 (judge two)
        const firstRow = await page.locator('.lb-table tbody tr').nth(0).textContent();
        const secondRow = await page.locator('.lb-table tbody tr').nth(1).textContent();
        check(firstRow.includes('ClimateLens') && firstRow.includes('82'), `rank 1 reads: ClimateLens 82`);
        check(secondRow.includes('MediQueue') && secondRow.includes('50'), `rank 2 reads: MediQueue 50`);
        check(firstRow.includes('1/2') && secondRow.includes('1/2'), 'both rows show coverage 1/2 judges');

        dialogs.length = 0;
        await page.click('.lb-release');
        await page.waitForSelector('.lb-released', { timeout: 15000 });
        check(dialogs.some(d => d.includes('Release results')), `release asks first: "${dialogs[0] || 'none'}"`);
        check((await page.locator('.lb-released').textContent()).includes('Released'), 'released strip replaces the preview');
        check(await page.locator('.lb-release').count() === 0, 'the switch is gone — one way only');

        // the export comes down as a real file
        const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 8000 }),
            page.click('.lb-csv')
        ]);
        const fname = download.suggestedFilename();
        check(fname.endsWith('-results.csv'), `download named ${fname}`);
        const chunks = [];
        for await (const chunk of await download.createReadStream()) chunks.push(chunk);
        const csv = Buffer.concat(chunks).toString('utf8');
        check(csv.includes('rank,project,team,average,judged,assigned'), 'CSV carries the header row');
        check(csv.includes('ClimateLens') && csv.includes('82'), 'CSV carries ClimateLens at 82');
        await logout(page);
    }

    // ------------------------------------------------------------ team after close
    head('12 · team finds the door shut after close — but the results are open');
    {
        const page = await browser.newPage(ctxArgs);
        wirePage(page);
        await login(page, team1);
        await page.click('.dash-cta');
        await page.waitForSelector('.event-card', { timeout: 20000 });
        await page.locator('.event-card', { hasText: EVENT_NAME }).locator('.event-view').click();
        await page.waitForSelector('.subs-locked', { timeout: 20000 });
        check(await page.locator('.subs-new').count() === 0, 'no submit button once closed');
        check(await page.locator('.sub-edit').count() === 0, 'no edit once closed');
        check(await page.locator('.sub-withdraw').count() === 0, 'no withdraw once closed');
        const locked = await page.locator('.subs-locked').textContent();
        check(locked.includes('read-only'), `team reads: "${locked.trim()}"`);

        // submissions are shut, but the results door is wide open now
        await page.goto(`${UI}/events`);
        await waitForDocket(page);
        await page.locator('.event-card', { hasText: EVENT_NAME }).locator('.event-results').click();
        await page.waitForSelector('.lb-table', { timeout: 15000 });
        check(await page.locator('.lb-sealed').count() === 0, 'no more sealing — the team is let in');
        const rows = await page.locator('.lb-table tbody tr').allTextContents();
        check(rows[0].includes('ClimateLens') && rows[0].includes('82'), 'team reads the same rank 1: ClimateLens 82');
        check(rows.some(r => r.includes('MediQueue') && r.includes('50')), 'and MediQueue at 50');
        check(await page.locator('.lb-release').count() === 0, 'a team never sees the release switch');
        await logout(page);
    }

} catch (err) {
    fail++;
    console.log(`\n  CRASH  ${err.message}`);
} finally {
    await browser.close();
}

console.log(`\n================ ${pass} passed, ${fail} failed ================\n`);
process.exit(fail > 0 ? 1 : 0);
