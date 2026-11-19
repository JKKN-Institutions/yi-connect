// Test helper: makes Yi Connect login cookies for a TEST account (demo-*@yi-demo.com only),
// using a one-time sign-in link made with the service key. Never use for a real person.
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')
const { createServerClient } = require('@supabase/ssr')

const env = Object.fromEntries(
  fs.readFileSync(path.join(__dirname, '../../.env.local'), 'utf8').split('\n')
    .filter(l => /^[A-Z0-9_]+=/.test(l))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')])
)

async function testSessionCookies(email) {
  if (!/^demo-[a-z]+@yi-demo\.com$/.test(email)) throw new Error('test accounts only')
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) throw error
  const jar = []
  const sb = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: { getAll: () => jar.map(c => ({ name: c.name, value: c.value })), setAll: list => { for (const c of list) { const i = jar.findIndex(x => x.name === c.name); if (i >= 0) jar.splice(i, 1); if (c.value) jar.push(c) } } },
  })
  const v = await sb.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' })
  if (v.error) throw v.error
  return jar.map(c => ({ name: c.name, value: c.value }))
}
module.exports = { testSessionCookies }
