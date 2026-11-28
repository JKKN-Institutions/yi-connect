/* eslint-disable @typescript-eslint/no-require-imports -- plain Node test script */
// Event call list: browser walk-through as real test accounts (Chromium only).
// Shared live database: run by hand against a local `next dev`, on the TEST event made by
//   node tests/call-list/fixtures.cjs setup
// Usage: node tests/call-list/e2e.cjs <base-url> <proof-dir>   (optional env PW_CHROMIUM=<chrome binary>)
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { testSessionCookies } = require('../ec-eoi/test-session.cjs')

const [, , BASE, PROOF] = process.argv
const created = JSON.parse(fs.readFileSync(path.join(__dirname, '.created.json'), 'utf8'))
const EV = created.event_id
if (EV === 'f0116c8d-7e87-4bfe-b6a8-82393dee9d99') throw new Error('refusing: real Erode Annual Day event')
fs.mkdirSync(PROOF, { recursive: true })
const results = []
const check = (name, ok, extra = '') => {
  const line = `${ok ? 'PASS' : 'FAIL'} | ${name}${extra ? ' | ' + extra : ''}`
  results.push(line)
  console.log(line)
}
const DESK = { width: 1366, height: 900 }
const PHONE = { width: 390, height: 844 }

async function contextAs(browser, email, viewport) {
  const ctx = await browser.newContext({ viewport })
  const host = new URL(BASE).hostname
  await ctx.addCookies((await testSessionCookies(email)).map(c => ({ ...c, domain: host, path: '/', httpOnly: false, sameSite: 'Lax' })))
  const p = await ctx.newPage()
  p.setDefaultTimeout(120000)
  return p
}
const shot = (p, n) => p.screenshot({ path: path.join(PROOF, `${n}.png`), fullPage: true })
const total = async (p, id) => Number((await p.textContent(`[data-testid="total-${id}"]`)).trim())
const row = (p, name) => p.locator(`[data-testid="call-row"][data-name="${name}"]`)
async function pick(p, triggerLabel, optionName) {
  await p.getByRole('combobox', { name: triggerLabel }).click()
  await p.getByRole('option', { name: optionName, exact: true }).click()
}
async function waitTotal(p, id, n) {
  await p.waitForFunction(([id, n]) => Number(document.querySelector(`[data-testid="total-${id}"]`)?.textContent) === n, [id, n])
}

;(async () => {
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {})
  try {
    // ---------- Leader (demo Co-Chair, organizer of the test event), desktop ----------
    const L = await contextAs(browser, 'demo-cochair@yi-demo.com', DESK)
    await L.goto(`${BASE}/events/${EV}/calls`)
    await L.getByRole('heading', { name: 'Call list' }).waitFor()
    check('leader opens the call list on a DRAFT event', true)
    check('starts with 1 invitee (the test member RSVP)', (await total(L, 'invited')) === 1, String(await total(L, 'invited')))
    await shot(L, '01-leader-start')

    await L.getByTestId('invite-all').click()
    await L.getByText('No active members found in this chapter.').waitFor()
    check('invite-all on the empty test chapter adds nobody and says so', (await total(L, 'invited')) === 1)

    for (const [name, phone] of [['Test Guest One', '9000000001'], ['Test Guest Two', '9000000002'], ['Test Guest Three', '9000000003']]) {
      if (!(await L.locator('#guest-name').isVisible())) await L.getByRole('button', { name: 'Add guest' }).click()
      await L.fill('#guest-name', name)
      await L.fill('#guest-phone', phone)
      await L.getByRole('button', { name: 'Add', exact: true }).click()
      await row(L, name).waitFor()
    }
    await waitTotal(L, 'invited', 4)
    check('three guests added through the Add guest form', (await total(L, 'invited')) === 4)

    for (const name of ['Test Guest One', 'Test Guest Two', 'Demo Regular Member']) {
      await L.getByRole('checkbox', { name: `Select ${name}` }).click()
    }
    check('selected count shows 3', (await L.textContent('[data-testid="selected-count"]')).trim() === '3 selected')
    await pick(L, 'Assign to', 'Demo Co-Chair')
    await L.getByTestId('assign-btn').click()
    await L.waitForFunction(() =>
      [...document.querySelectorAll('[data-testid="call-row"]')].filter(r => r.querySelector('[data-testid="row-caller"]')?.textContent === 'Demo Co-Chair').length === 3)
    check('batch assign gave 3 names to Demo Co-Chair', true)
    check('the unassigned guest still shows no caller', (await row(L, 'Test Guest Three').locator('[data-testid="row-caller"]').textContent()) === 'none yet')

    await pick(L, 'Result for Test Guest Three', 'No answer')
    await waitTotal(L, 'no-answer', 1)
    check('leader records No answer from the list; Called and No answer go to 1',
      (await total(L, 'called')) === 1 && (await total(L, 'no-answer')) === 1)

    await pick(L, 'Filter by caller', 'No caller yet')
    check('caller filter "No caller yet" shows only Guest Three',
      (await L.locator('[data-testid="call-row"]').count()) === 1 && (await row(L, 'Test Guest Three').count()) === 1)
    await pick(L, 'Filter by caller', 'All callers')
    await pick(L, 'Filter by result', 'No answer')
    check('result filter "No answer" shows only Guest Three', (await L.locator('[data-testid="call-row"]').count()) === 1)
    await pick(L, 'Filter by result', 'All results')
    await shot(L, '02-leader-assigned')

    // ---------- Caller view on a phone (same leader, who gave himself 3 names) ----------
    const C = await contextAs(browser, 'demo-cochair@yi-demo.com', PHONE)
    await C.goto(`${BASE}/events/${EV}/my-calls`)
    await C.getByRole('heading', { name: 'My calls' }).waitFor()
    check('My calls shows exactly the 3 assigned names', (await C.locator('[data-testid="my-call"]').count()) === 3)
    const one = C.locator('[data-testid="my-call"][data-name="Test Guest One"]')
    check('tap-to-call link is tel:+919000000001', (await one.getByRole('link', { name: /Call Test/ }).getAttribute('href')) === 'tel:+919000000001')
    await shot(C, '03-phone-my-calls-before')
    await one.getByRole('textbox').fill('Will come with spouse')
    await one.getByRole('button', { name: 'Coming', exact: true }).click()
    await C.waitForFunction(() => document.querySelector('[data-testid="my-call"][data-name="Test Guest One"] [data-testid="my-call-result"]')?.textContent === 'Coming')
    const two = C.locator('[data-testid="my-call"][data-name="Test Guest Two"]')
    await two.getByRole('button', { name: 'Not coming', exact: true }).click()
    await C.waitForFunction(() => document.querySelector('[data-testid="my-call"][data-name="Test Guest Two"] [data-testid="my-call-result"]')?.textContent === 'Not coming')
    check('caller saved Coming (with note) and Not coming from the phone', true)
    check('saved card shows who called and when', /Last saved .* by Demo Co-Chair/.test(await C.locator('[data-testid="my-call"][data-name="Test Guest One"]').innerText()))
    await shot(C, '04-phone-my-calls-after')

    await L.reload()
    await L.getByRole('heading', { name: 'Call list' }).waitFor()
    const t1 = { invited: await total(L, 'invited'), called: await total(L, 'called'), coming: await total(L, 'coming'), notComing: await total(L, 'not-coming'), noAnswer: await total(L, 'no-answer') }
    check('leader totals moved: invited 4, called 3, coming 1, not coming 1, no answer 1',
      t1.invited === 4 && t1.called === 3 && t1.coming === 1 && t1.notComing === 1 && t1.noAnswer === 1, JSON.stringify(t1))
    check('leader sees the caller note and "Called by"',
      (await row(L, 'Test Guest One').getByRole('textbox').inputValue()) === 'Will come with spouse' &&
      /Called by Demo Co-Chair/.test(await row(L, 'Test Guest One').innerText()))
    await shot(L, '05-leader-totals-after-calls')

    // ---------- A plain Member who is a caller, not a leader ----------
    execFileSync('node', [path.join(__dirname, 'fixtures.cjs'), 'assign-member-caller', 'Test Guest Three'], { stdio: 'inherit' })
    const M = await contextAs(browser, 'demo-member@yi-demo.com', PHONE)
    await M.goto(`${BASE}/events/${EV}/calls`)
    await M.getByText("You don't have access to this call list").waitFor()
    check('Member gets an explicit no-access page on the full call list (no redirect)', M.url().endsWith(`/events/${EV}/calls`))
    await shot(M, '06-member-no-access')
    await M.goto(`${BASE}/events/${EV}/my-calls`)
    await M.getByRole('heading', { name: 'My calls' }).waitFor()
    check('Member caller sees only their 1 name', (await M.locator('[data-testid="my-call"]').count()) === 1)
    await M.locator('[data-testid="my-call"][data-name="Test Guest Three"]').getByRole('button', { name: 'Call back', exact: true }).click()
    await M.waitForFunction(() => document.querySelector('[data-testid="my-call-result"]')?.textContent === 'Call back')
    check('Member caller records Call back', true)
    await shot(M, '07-member-my-calls')

    await L.reload()
    await L.getByRole('heading', { name: 'Call list' }).waitFor()
    check('leader totals after member call: no answer 0, called 3',
      (await total(L, 'no-answer')) === 0 && (await total(L, 'called')) === 3 && (await total(L, 'call-back')) === 1)

    // Event page entry points
    await L.goto(`${BASE}/events/${EV}`)
    check('event page shows the Call list button to the leader', await L.getByRole('link', { name: 'Call list' }).isVisible())
    check('event page shows "My calls (3)" to the leader', await L.getByRole('link', { name: 'My calls (3)' }).isVisible())
    await shot(L, '08-event-page-leader')
  } catch (e) {
    check('walk-through crashed', false, String(e && e.message).slice(0, 300))
  } finally {
    await browser.close()
    fs.writeFileSync(path.join(PROOF, 'results.txt'), results.join('\n') + '\n')
    const fails = results.filter(r => r.startsWith('FAIL')).length
    console.log(`\n${results.length - fails} passed, ${fails} failed`)
    process.exit(fails ? 1 : 0)
  }
})()
