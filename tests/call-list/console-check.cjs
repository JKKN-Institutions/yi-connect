/* eslint-disable @typescript-eslint/no-require-imports -- plain Node test script */
// Prints browser console errors/warnings on the call-list pages. node console-check.cjs <base>
const { chromium } = require('playwright')
const fs = require('fs'), path = require('path')
const { testSessionCookies } = require('../ec-eoi/test-session.cjs')
const [, , BASE] = process.argv
const EV = JSON.parse(fs.readFileSync(path.join(__dirname, '.created.json'), 'utf8')).event_id
;(async () => {
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {})
  const ctx = await browser.newContext()
  await ctx.addCookies((await testSessionCookies('demo-cochair@yi-demo.com')).map(c => ({ ...c, domain: new URL(BASE).hostname, path: '/', httpOnly: false, sameSite: 'Lax' })))
  const p = await ctx.newPage()
  for (const sub of ['/calls', '/my-calls']) {
    const msgs = []
    const h = m => { if (['error', 'warning'].includes(m.type())) msgs.push(`${m.type()}: ${m.text().slice(0, 300)}`) }
    p.on('console', h); p.on('pageerror', e => msgs.push('pageerror: ' + e.message.slice(0, 300)))
    await p.goto(`${BASE}/events/${EV}${sub}`); await p.waitForLoadState('networkidle')
    console.log(`== ${sub}: ${msgs.length} message(s)`); msgs.forEach(m => console.log('  ' + m))
    p.removeAllListeners('console'); p.removeAllListeners('pageerror')
  }
  await browser.close()
})().catch(e => { console.error(e); process.exit(1) })
