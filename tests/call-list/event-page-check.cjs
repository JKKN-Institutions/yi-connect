/* eslint-disable @typescript-eslint/no-require-imports -- plain Node test script */
// Event page entry points for the call list (run after e2e.cjs). node event-page-check.cjs <base> <proof-dir>
const { chromium } = require('playwright')
const fs = require('fs'), path = require('path')
const { testSessionCookies } = require('../ec-eoi/test-session.cjs')
const [, , BASE, PROOF] = process.argv
const EV = JSON.parse(fs.readFileSync(path.join(__dirname, '.created.json'), 'utf8')).event_id
;(async () => {
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {})
  const out = []
  for (const [email, expectCallList, expectMine] of [['demo-cochair@yi-demo.com', true, 'My calls (3)'], ['demo-member@yi-demo.com', false, 'My calls (1)']]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
    await ctx.addCookies((await testSessionCookies(email)).map(c => ({ ...c, domain: new URL(BASE).hostname, path: '/', httpOnly: false, sameSite: 'Lax' })))
    const p = await ctx.newPage(); p.setDefaultTimeout(120000)
    await p.goto(`${BASE}/events/${EV}`, { timeout: 300000 })
    await p.waitForLoadState('networkidle')
    const cl = await p.getByRole('link', { name: 'Call list', exact: true }).count()
    const mine = await p.getByRole('link', { name: expectMine }).count()
    out.push(`${(cl > 0) === expectCallList ? 'PASS' : 'FAIL'} | ${email}: Call list button ${cl > 0 ? 'shown' : 'hidden'} (expected ${expectCallList ? 'shown' : 'hidden'})`)
    out.push(`${mine > 0 ? 'PASS' : 'FAIL'} | ${email}: "${expectMine}" button shown | url ${p.url().replace(BASE, '')}`)
    await p.screenshot({ path: path.join(PROOF, `08-event-page-${email.split('@')[0]}.png`), fullPage: false })
    await ctx.close()
  }
  await browser.close()
  console.log(out.join('\n'))
  fs.appendFileSync(path.join(PROOF, 'results.txt'), out.join('\n') + '\n')
})().catch(e => { console.error(e); process.exit(1) })
