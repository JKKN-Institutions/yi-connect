#!/usr/bin/env node
// Yi Erode EC 2027 EOI: set the admin password for username "Yierode".
//
// Run it yourself on the Mac, from the yi-connect folder:
//     node scripts/ec-eoi-set-admin-password.mjs
// It asks for the password twice (nothing shows while you type), stores only a
// scrambled hash in the database, and signs out every open admin session.
// The password itself is never saved, printed, or sent anywhere else.
import { readFileSync } from 'node:fs'
import { hashPassword } from '../lib/ec-eoi/server/password.ts'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => /^[A-Z0-9_]+=/.test(l))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')])
)
const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Could not find the database settings in .env.local.'); process.exit(1) }

function ask(prompt) {
  return new Promise(resolve => {
    process.stdout.write(prompt)
    const stdin = process.stdin
    stdin.setRawMode?.(true); stdin.resume(); stdin.setEncoding('utf8')
    let value = ''
    const onData = ch => {
      if (ch === '\r' || ch === '\n' || ch === '\u0004') { stdin.setRawMode?.(false); stdin.pause(); stdin.off('data', onData); process.stdout.write('\n'); resolve(value) }
      else if (ch === '\u0003') { process.stdout.write('\n'); process.exit(1) }
      else if (ch === '\u007f') value = value.slice(0, -1)
      else value += ch
    }
    stdin.on('data', onData)
  })
}

const first = await ask('New password for Yierode (at least 10 characters): ')
if (first.length < 10) { console.error('Too short. Nothing was changed.'); process.exit(1) }
const second = await ask('Type it again: ')
if (first !== second) { console.error('The two did not match. Nothing was changed.'); process.exit(1) }

const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Content-Profile': 'yi_connect', 'Accept-Profile': 'yi_connect' }
const save = await fetch(`${url}/rest/v1/ec_eoi_admin_credentials`, {
  method: 'POST',
  headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify({ username: 'Yierode', password_hash: hashPassword(first), updated_at: new Date().toISOString() }),
})
if (!save.ok) { console.error('Could not save the password (database said ' + save.status + '). Nothing was changed.'); process.exit(1) }
await fetch(`${url}/rest/v1/ec_eoi_admin_sessions?revoked_at=is.null`, {
  method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ revoked_at: new Date().toISOString() }),
})
console.log('Done. Sign in at /ec-2027/admin with username Yierode and the new password. Any older sign-ins were ended.')
