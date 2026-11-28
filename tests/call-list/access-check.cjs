/* eslint-disable @typescript-eslint/no-require-imports -- plain Node test script */
// Read-only access check (GET only, clicks nothing): who can open /events/<id>/calls.
// node access-check.cjs <base> <event-id> <email> <expect: manage|denied>
const { testSessionCookies } = require('../ec-eoi/test-session.cjs')
;(async () => {
  const [, , BASE, EV, email, expect] = process.argv
  const jar = await testSessionCookies(email)
  const res = await fetch(`${BASE}/events/${EV}/calls`, { headers: { cookie: jar.map(c => `${c.name}=${c.value}`).join('; ') }, redirect: 'manual' })
  const html = await res.text()
  const manage = html.includes('Invite all active chapter members')
  const denied = /don(&#x27;|')t have access to this call list/.test(html)
  const invited = (html.match(/data-testid="total-invited"[^>]*>(\d+)</) || [])[1]
  const got = manage ? 'manage' : denied ? 'denied' : `other(${res.status})`
  console.log(`${got === expect ? 'PASS' : 'FAIL'} | ${email} on ${EV.slice(0, 8)}: ${got}${invited !== undefined ? ', invited=' + invited : ''} (expected ${expect})`)
})().catch(e => { console.error(e); process.exit(1) })
