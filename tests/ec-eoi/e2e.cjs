// Yi Erode EC 2027 EOI: browser walk-through (Playwright).
// Not part of CI: run by hand against a local `next dev` that points at the shared database.
//   node tests/ec-eoi/e2e.cjs <base-url> <proof-dir> <phase> <viewport> [admin-demo-email]
// phase "preview": form CLOSED. Checks header/footer, closed page, sign-in gate, no-access,
//   leadership-preview journey, lost-reply retry, desk, downloads, second device, sign out.
// phase "open": form OPEN, no login. Keyboard-only journey with an awkward entry; saves the
//   captured member request to <proof-dir>/save-request.json for the closed-form replay.
// phase "desk-awkward": signed in, checks the awkward entry in table, dialog and Excel.
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const [, , BASE, PROOF, PHASE, TAG, ADMIN_EMAIL = 'demo-chair@yi-demo.com'] = process.argv
const SHOTS = path.join(PROOF, 'live')
const DL = path.join(PROOF, 'downloads')
fs.mkdirSync(SHOTS, { recursive: true })
fs.mkdirSync(DL, { recursive: true })
const results = []
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'} | ${TAG} | ${name}${extra ? ' | ' + extra : ''}`)
const VP = TAG === 'phone' ? { width: 390, height: 844 } : { width: 1366, height: 900 }
const AWK_NAME = 'தமிழ் "Quote" <script>x</script> ' + TAG
const LONG = ('=SUM(A1:A9) is not a formula here. ' + 'Erode needs steady mentoring for first-generation founders, with practical sessions every month. ').repeat(23).slice(0, 2950).trim() + ' End.'

const { testSessionCookies } = require('./test-session.cjs')
// Signs a TEST account into Yi Connect in this browser (the app's own demo buttons are broken).
async function yiLogin(page, email) {
  const ctx = page.context()
  await ctx.clearCookies()
  const host = new URL(BASE).hostname
  await ctx.addCookies((await testSessionCookies(email)).map(c => ({ ...c, domain: host, path: '/', httpOnly: false, sameSite: 'Lax' })))
}
async function openDesk(page) {
  await page.goto(BASE + '/ec-2027/admin')
  await page.waitForSelector('#dashboard')
  await page.waitForFunction(() => /Showing/.test(document.getElementById('table-status').textContent))
}

async function preview(browser) {
  const ctx = await browser.newContext({ viewport: VP, acceptDownloads: true })
  const p = await ctx.newPage()
  p.setDefaultTimeout(180000)
  p.on('dialog', d => d.accept())
  const shot = n => p.screenshot({ path: `${SHOTS}/${TAG}-${n}.png`, fullPage: true })

  await p.goto(BASE + '/ec-2027')
  check('closed form hidden from a visitor', /not open yet/.test(await p.textContent('#app')) && !(await p.$('#details-form')))
  await shot('00-closed')
  const hdr = (await p.innerText('header.header')).replace(/\s+/g, ' ').trim()
  check('header text exact', hdr === 'ERODE CHAPTER Enablers of Change (EC) 2027', hdr)
  check('Yi logo left, CII logo right, both load', await p.evaluate(() => {
    const yi = document.querySelector('.yi-logo'), cii = document.querySelector('.cii-logo')
    return yi.getBoundingClientRect().left < cii.getBoundingClientRect().left && yi.naturalWidth > 0 && cii.naturalWidth > 0
  }))
  const story = (await p.innerText('aside.story')).replace(/\s+/g, ' ')
  check('story text exact', story.includes('AN INVITATION TO LEAD') && story.includes('Big change. Local roots. Your next step.') && story.includes('Bring your ideas, your energy, and your commitment. Help shape what Yi Erode does next.'))
  const foot = (await p.innerText('#member-view footer')).replace(/\s+/g, ' ').trim()
  const help = (await p.innerText('.help-note')).replace(/\s+/g, ' ').trim()
  check('footer text exact', foot === 'A shared purpose. A stronger Erode. Admin login Expression of Interest / EC 2027' && help === 'YOUNG INDIANS · ERODE We can. We will.', foot + ' || ' + help)
  check('no demo/preview wording', !/demo only|INTERACTIVE PREVIEW|Nothing is sent/i.test(await p.innerText('body')))
  const unauth = await p.request.get(BASE + '/ec-2027/admin/export?kind=all')
  check('download refused when signed out', unauth.status() === 401, String(unauth.status()))

  await p.click('text=Admin login')
  await p.waitForSelector('#login-button')
  check('signed-out desk asks for Yi Connect sign-in', /Sign in with Yi Connect/.test(await p.textContent('#login-button')) && !(await p.$('#dashboard')))
  await shot('01-admin-signin')
  await yiLogin(p, 'demo-member@yi-demo.com')
  await p.goto(BASE + '/ec-2027/admin')
  await p.waitForSelector('#switch-account')
  check('account without Yi Erode role refused with a message', /don.t have access/.test(await p.innerText('.login-card')) && !(await p.$('#dashboard')))
  const noRole = await p.request.get(BASE + '/ec-2027/admin/export?kind=all')
  check('download refused for account without role', noRole.status() === 401, String(noRole.status()))
  await shot('02-no-access')
  await p.click('#switch-account')
  await p.waitForURL(u => u.pathname.startsWith('/login'))
  check('"different account" signs out to the login page', true)
  await yiLogin(p, ADMIN_EMAIL)
  await openDesk(p)
  const startTotal = Number(await p.textContent('#total'))
  check('Yi Erode role opens the desk', true, 'entries at start ' + startTotal)

  await p.goto(BASE + '/ec-2027')
  await p.waitForSelector('#details-form')
  check('leadership preview banner while closed', /LEADERSHIP PREVIEW/.test(await p.textContent('.sample-banner')))
  check('help contact line', /Questions\? Contact Sharabheshwaran, Co-Chair, Yi Erode\./.test(await p.innerText('#app')))
  await shot('03-details')
  await p.click('#details-form button[type=submit]')
  check('empty name and phone rejected', /full name/.test(await p.textContent('#name-error')) && /10-digit/.test(await p.textContent('#phone-error')))
  await p.fill('#member-name', 'A')
  await p.fill('#member-phone', '12345')
  await p.click('#details-form button[type=submit]')
  check('1-letter name and bad phone rejected', /full name/.test(await p.textContent('#name-error')) && /10-digit/.test(await p.textContent('#phone-error')))
  const name = 'Test Member ' + TAG
  await p.fill('#member-name', name)
  await p.fill('#member-phone', '+91 (98765) 43-210')
  await p.click('#details-form button[type=submit]')
  await p.waitForSelector('#commitment-form')
  const cards = await p.$$eval('.commitment h3', e => e.map(x => x.textContent).join('|'))
  check('four commitment cards', cards === 'Pathfinder|EC Leader Academy (EC LA)|Regional Council Meeting 2027 (RCM)|EC Meetings', cards)
  check('four mandatory labels', (await p.$$('.event-tag')).length === 4)
  await shot('04-commitments')
  await p.click('#commitment-form button[type=submit]')
  check('acknowledgement required', /acknowledge/.test(await p.textContent('#ack-error')))
  await p.click('[data-back]')
  await p.waitForSelector('#details-form')
  check('Back keeps details', (await p.inputValue('#member-name')) === name && (await p.inputValue('#member-phone')) === '9876543210')
  await p.click('#details-form button[type=submit]')
  await p.check('#ack')
  await p.click('#commitment-form button[type=submit]')
  await p.waitForSelector('#interests-form')
  check('14 roles listed', (await p.$$('[data-choice]')).length === 14)
  check('"Focus on what matters to Erode" note', /Focus on what matters to Erode/.test(await p.textContent('.selection-purpose')))
  await p.click('#interests-form button[type=submit]')
  check('0 roles fails', /between one and three/.test(await p.textContent('#selection-error')))
  await p.check('#vertical-4')
  check('selecting opens its description', !(await p.$eval('#detail-vertical-4', e => e.hidden)))
  await p.check('#vertical-11')
  check('opening another closes the previous, keeps selection', (await p.$eval('#detail-vertical-4', e => e.hidden)) && !(await p.$eval('#detail-vertical-11', e => e.hidden)) && (await p.isChecked('#vertical-4')))
  check('2027 note inside the role', /Any new programmes or responsibilities introduced for 2027/.test(await p.textContent('#detail-vertical-11')))
  await p.check('#vertical-12')
  check('fourth cannot be added', (await p.isDisabled('#vertical-0')) && /3 of 3/.test(await p.textContent('#selected-count')))
  await p.click('[data-expand="vertical-0"]')
  check('descriptions readable at the limit', !(await p.$eval('#detail-vertical-0', e => e.hidden)))
  await shot('05-interests')
  await p.click('#interests-form button[type=submit]')
  await p.waitForSelector('#ideas-form')
  await p.fill('#answer-vertical-4', 'Only one sentence here.')
  await p.fill('#answer-vertical-11', 'Learning matters in Erode. I will run monthly sessions! Speakers from local industry? Yes.')
  await p.fill('#answer-vertical-12', 'Sports for all members. A cricket league in Erode.')
  await p.click('#ideas-form button[type=submit]')
  check('1 sentence fails', /at least 2 sentences/.test(await p.textContent('#error-vertical-4')))
  await p.fill('#answer-vertical-4', 'Mental health sessions for Yuva in Erode colleges. We will work with local counsellors. Six. Seven. Eight. Nine sentences are fine too.')
  await p.click('[data-back]')
  await p.waitForSelector('#interests-form')
  await p.uncheck('#vertical-12')
  await p.click('#interests-form button[type=submit]')
  await p.waitForSelector('#ideas-form')
  check('deselected role leaves step 4, other answers kept', !(await p.$('#answer-vertical-12')) && (await p.inputValue('#answer-vertical-4')).startsWith('Mental health'))
  await shot('06-ideas')

  let dropped = 0
  await p.route('**/ec-2027', async route => {
    if (route.request().method() === 'POST' && dropped === 0) {
      dropped++
      await route.fetch()
      return route.abort('failed')
    }
    return route.continue()
  })
  await p.click('#ideas-form button[type=submit]')
  await p.waitForFunction(() => document.getElementById('submit-error')?.textContent.length > 0)
  check('lost reply: retry message, answers kept', /could not save/.test(await p.textContent('#submit-error')) && (await p.inputValue('#answer-vertical-11')).startsWith('Learning'))
  check('Submit usable again', !(await p.isDisabled('#ideas-form button[type=submit]')))
  await shot('07-failure')
  await p.click('#ideas-form button[type=submit]')
  await p.waitForSelector('.success')
  await p.unroute('**/ec-2027')
  const succ = await p.innerText('.success')
  check('success only after save', /Your first step to\s*nation building/.test(succ) && /Your EOI has been received\./.test(succ) && /leadership team will get back to you after discussions/.test(succ))
  await shot('08-success')
  const [rcpt] = await Promise.all([p.waitForEvent('download'), p.click('#download')])
  const rpath = `${DL}/${TAG}-${rcpt.suggestedFilename()}`
  await rcpt.saveAs(rpath)
  const rtxt = fs.readFileSync(rpath, 'utf8')
  check('receipt downloads', rcpt.suggestedFilename() === 'Yi-Erode-EC-2027-EOI.txt' && /SUBMITTED/.test(rtxt) && !/Sports/.test(rtxt) && /\+91 9876543210/.test(rtxt))
  await p.click('#restart')
  await p.waitForSelector('#details-form')
  check('Start another entry resets', (await p.inputValue('#member-name')) === '')

  await openDesk(p)
  const total = Number(await p.textContent('#total'))
  check('exactly one new entry despite the retry', total === startTotal + 1, `${startTotal} -> ${total}`)
  await shot('09-desk')
  await p.fill('#search', name)
  const named = await p.$$eval('#entry-rows tr', rs => rs.map(r => r.cells[0].innerText))
  check('search by name', named.length >= 1 && named.every(t => t.includes(name)), named.length + ' rows')
  await p.fill('#search', '+91 98765')
  check('search by number', (await p.$$('#entry-rows tr')).length >= 1)
  await p.fill('#search', 'zzzz-nobody')
  check('no-match message', /No matching entries/.test(await p.textContent('#empty')) && !(await p.$eval('#empty', e => e.hidden)))
  await p.fill('#search', '')
  await p.selectOption('#area-filter', 'vertical-11')
  check('area filter shows that answer', /Learning matters in Erode/.test(await p.textContent('#entry-rows')) && !(await p.isDisabled('#export-area')))
  await p.click(`[aria-label="View responses from ${name}"] >> nth=0`)
  const dlg = await p.innerText('#entry-detail')
  check('dialog shows only that area', /Learning matters/.test(dlg) && !/Mental health/.test(dlg))
  await shot('10-dialog')
  await p.click('#close-dialog')
  await p.selectOption('#area-filter', '')
  await p.click(`[aria-label="View responses from ${name}"] >> nth=0`)
  const dlgAll = await p.innerText('#entry-detail')
  check('dialog shows every area with All areas', /Learning matters/.test(dlgAll) && /Mental health/.test(dlgAll) && !/Sports for all/.test(dlgAll))
  await p.click('#close-dialog')
  await p.selectOption('#area-filter', 'vertical-12')
  check('empty area disables its download', await p.isDisabled('#export-area'))
  await p.selectOption('#area-filter', 'vertical-11')
  for (const [id, label] of [['export', 'all'], ['export-area', 'area'], ['export-verticals', 'zip']]) {
    const [d] = await Promise.all([p.waitForEvent('download'), p.click('#' + id)])
    const out = `${DL}/${TAG}-${d.suggestedFilename()}`
    await d.saveAs(out)
    check('download ' + label, fs.statSync(out).size > 500, d.suggestedFilename())
  }
  await p.click('#refresh')
  await p.waitForTimeout(1500)
  check('Refresh keeps the area filter', (await p.inputValue('#area-filter')) === 'vertical-11')

  const ctx2 = await browser.newContext({ viewport: VP })
  const p2 = await ctx2.newPage()
  p2.setDefaultTimeout(180000)
  await yiLogin(p2, ADMIN_EMAIL)
  await openDesk(p2)
  check('entry visible from a second signed-in device', (await p2.textContent('#entry-rows')).includes(name))
  await ctx2.close()

  await p.click('#logout')
  await p.waitForSelector('#login-button')
  check('sign out returns to the sign-in card', /Sign in with Yi Connect/.test(await p.textContent('#login-button')))
  const after = await p.request.get(BASE + '/ec-2027/admin/export?kind=all')
  check('download refused after sign out', after.status() === 401, String(after.status()))
  await shot('11-signed-out')
  await ctx.close()
}

async function open(browser) {
  const ctx = await browser.newContext({ viewport: VP })
  const p = await ctx.newPage()
  p.setDefaultTimeout(180000)
  let saveReq = null
  p.on('request', r => {
    if (r.method() === 'POST' && r.url().endsWith('/ec-2027') && r.headers()['next-action']) saveReq = { headers: r.headers(), body: r.postData() }
  })
  await p.goto(BASE + '/ec-2027')
  await p.waitForSelector('#details-form')
  check('open form shown with no login', /EXPRESSION OF INTEREST/.test(await p.textContent('.sample-banner')))
  await p.screenshot({ path: `${SHOTS}/${TAG}-12-open.png`, fullPage: true })
  const tabTo = async sel => {
    for (let i = 0; i < 90; i++) {
      if (await p.evaluate(s => !!document.activeElement && document.activeElement.matches(s), sel)) return true
      await p.keyboard.press('Tab')
    }
    return false
  }
  let kb = await tabTo('#member-name')
  await p.keyboard.type(AWK_NAME)
  kb = kb && (await tabTo('#member-phone'))
  await p.keyboard.type('9123456780')
  await p.keyboard.press('Enter')
  await p.waitForSelector('#commitment-form')
  kb = kb && (await tabTo('#ack'))
  await p.keyboard.press('Space')
  kb = kb && (await tabTo('#commitment-form button[type=submit]'))
  await p.keyboard.press('Enter')
  await p.waitForSelector('#interests-form')
  kb = kb && (await tabTo('#vertical-9'))
  await p.keyboard.press('Space')
  kb = kb && (await tabTo('[data-expand="vertical-13"]'))
  await p.keyboard.press('Enter')
  const expanded = await p.getAttribute('[data-expand="vertical-13"]', 'aria-expanded')
  kb = kb && (await tabTo('#interests-form button[type=submit]'))
  await p.keyboard.press('Enter')
  await p.waitForSelector('#ideas-form')
  kb = kb && (await tabTo('#answer-vertical-9'))
  await p.keyboard.insertText(LONG)
  const len = (await p.inputValue('#answer-vertical-9')).length
  check('answer box holds up to 3000 characters', len <= 3000 && len > 2900, String(len))
  kb = kb && (await tabTo('#ideas-form button[type=submit]'))
  await p.keyboard.press('Enter')
  await p.waitForSelector('.success')
  check('keyboard-only journey completes', kb && expanded === 'true')
  check('success shows code-like name as plain text', (await p.innerText('.success strong')).includes('<script>x</script>') && !(await p.$('.success script')))
  await p.screenshot({ path: `${SHOTS}/${TAG}-13-open-success.png`, fullPage: true })
  fs.writeFileSync(path.join(PROOF, 'save-request.json'), JSON.stringify(saveReq))
  check('member save request captured for the replay test', !!saveReq)
  await ctx.close()
}

async function deskAwkward(browser) {
  const ctx = await browser.newContext({ viewport: VP, acceptDownloads: true })
  const p = await ctx.newPage()
  p.setDefaultTimeout(180000)
  await yiLogin(p, ADMIN_EMAIL)
  await openDesk(p)
  await p.fill('#search', 'தமிழ்')
  check('Tamil search finds the awkward entries', (await p.$$('#entry-rows tr')).length >= 1)
  check('table shows code-like text as plain text', (await p.innerText('#entry-rows')).includes('<script>x</script>') && !(await p.$('#entry-rows script')))
  await p.selectOption('#area-filter', 'vertical-9')
  check('long answer shown in area view', (await p.innerText('#entry-rows')).includes('=SUM(A1:A9) is not a formula here.'))
  await p.click('#entry-rows [data-view] >> nth=0')
  check('dialog shows code-like text as plain text', (await p.innerText('#entry-detail')).includes('<script>x</script>') && !(await p.$('#entry-detail script')))
  await p.screenshot({ path: `${SHOTS}/${TAG}-14-awkward-dialog.png` })
  await p.click('#close-dialog')
  const [d] = await Promise.all([p.waitForEvent('download'), p.click('#export')])
  await d.saveAs(`${DL}/awkward-all.xlsx`)
  check('all-entries Excel with awkward entries downloads', fs.statSync(`${DL}/awkward-all.xlsx`).size > 500)
  await ctx.close()
}

;(async () => {
  const browser = await chromium.launch()
  try {
    if (PHASE === 'preview') await preview(browser)
    else if (PHASE === 'open') await open(browser)
    else if (PHASE === 'desk-awkward') await deskAwkward(browser)
    else throw new Error('unknown phase ' + PHASE)
  } catch (e) {
    results.push(`CRASH | ${TAG} | ${e.message.split('\n')[0]}`)
  }
  await browser.close()
  console.log(results.join('\n'))
  console.log(`TOTAL ${TAG} ${PHASE}: ${results.filter(r => r.startsWith('PASS')).length}/${results.length} passed`)
})()
