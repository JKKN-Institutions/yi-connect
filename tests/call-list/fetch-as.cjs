/* eslint-disable @typescript-eslint/no-require-imports -- plain Node test script */
// Fetch a page as a TEST account (prints status + a text excerpt). Usage: node fetch-as.cjs <email> <url>
const { testSessionCookies } = require('../ec-eoi/test-session.cjs')
;(async () => {
  const [, , email, url] = process.argv
  const jar = await testSessionCookies(email)
  const res = await fetch(url, { headers: { cookie: jar.map(c => `${c.name}=${c.value}`).join('; ') }, redirect: 'manual' })
  const body = await res.text()
  console.log(res.status, res.headers.get('location') || '', body.length)
  const m = body.match(/(Call list|My calls \(\d+\)|Application error|This page couldn|digest)/g)
  console.log([...new Set(m || [])].join(' | '))
})().catch(e => { console.error(e); process.exit(1) })
