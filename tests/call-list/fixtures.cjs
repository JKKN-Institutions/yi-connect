/* eslint-disable @typescript-eslint/no-require-imports -- plain Node test script */
// Test data for the event call-list walk-through. Never touches Erode.
//   node tests/call-list/fixtures.cjs setup    -> creates a TEMP inactive test chapter, a DRAFT test
//                                                  event in it (organizer = demo-cochair), and one
//                                                  pending RSVP for demo-member. Writes ids to .created.json
//   NO_ORGANIZER=1 ... setup                    -> same, but the event has no organizer (like real chapter events)
//   node tests/call-list/fixtures.cjs assign-member-caller <guestName>
//                                               -> gives one test guest to demo-member as caller
//   node tests/call-list/fixtures.cjs cleanup  -> deletes exactly the rows it created (and the
//                                                  guests / call rows hanging off the test event)
// Shared live database: run by hand only.
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const env = Object.fromEntries(
  fs.readFileSync(path.join(__dirname, '../../.env.local'), 'utf8').split('\n')
    .filter(l => /^[A-Z0-9_]+=/.test(l))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')])
)
const FILE = path.join(__dirname, '.created.json')
const ERODE = 'fe71c429-2647-4262-b35b-e356c960903d'
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const yc = () => admin.schema('yi_connect')

async function userId(email) {
  const { data, error } = await yc().from('profiles').select('id').eq('email', email).single()
  if (error) throw error
  return data.id
}

async function setup() {
  if (fs.existsSync(FILE)) throw new Error('.created.json exists: run cleanup first')
  const cochair = await userId('demo-cochair@yi-demo.com')
  const member = await userId('demo-member@yi-demo.com')
  const stamp = new Date().toISOString().slice(0, 16)

  const { data: ch, error: e1 } = await admin.schema('yi').from('chapters')
    .insert({ name: `ZZ TEST call list ${stamp} (delete me)`, city: 'ZZ Test', is_active: false })
    .select('id').single()
  if (e1) throw e1
  if (ch.id === ERODE) throw new Error('refusing: Erode')

  const { data: ev, error: e2 } = await yc().from('events').insert({
    chapter_id: ch.id,
    title: `TEST call list check ${stamp} (delete me)`,
    category: 'other',
    status: 'draft',
    start_date: '2026-12-05T11:30:00Z',
    end_date: '2026-12-05T16:30:00Z',
    organizer_id: process.env.NO_ORGANIZER ? null : cochair,
    allow_guests: true,
    send_reminders: false
  }).select('id').single()
  if (e2) throw e2

  const { data: rsvp, error: e3 } = await yc().from('event_rsvps')
    .insert({ event_id: ev.id, member_id: member, status: 'pending' })
    .select('id').single()
  if (e3) throw e3

  const created = { chapter_id: ch.id, event_id: ev.id, rsvp_id: rsvp.id, organizer: cochair, member }
  fs.writeFileSync(FILE, JSON.stringify(created, null, 2))
  console.log(JSON.stringify(created))
}

async function assignMemberCaller(guestName) {
  const c = JSON.parse(fs.readFileSync(FILE, 'utf8'))
  const { data: g, error } = await yc().from('guest_rsvps').select('id').eq('event_id', c.event_id).eq('full_name', guestName).single()
  if (error) throw error
  const { error: e2 } = await yc().from('event_call_list')
    .upsert({ event_id: c.event_id, guest_rsvp_id: g.id, assigned_caller_member_id: c.member }, { onConflict: 'guest_rsvp_id' })
  if (e2) throw e2
  console.log('assigned', guestName, 'to demo-member')
}

async function cleanup() {
  const c = JSON.parse(fs.readFileSync(FILE, 'utf8'))
  if (c.chapter_id === ERODE) throw new Error('refusing: Erode')
  const { data: ev } = await yc().from('events').select('id, chapter_id, title').eq('id', c.event_id).single()
  if (!ev || ev.chapter_id !== c.chapter_id || !/^TEST call list check/.test(ev.title)) throw new Error('event does not look like the test event')

  const list = async (t) => ((await yc().from(t).select('id').eq('event_id', c.event_id)).data || []).map(r => r.id)
  const deleted = {
    event_call_list: await list('event_call_list'),
    guest_rsvps: await list('guest_rsvps'),
    event_rsvps: await list('event_rsvps'),
    events: [c.event_id],
    chapters: [c.chapter_id]
  }
  for (const t of ['event_call_list', 'guest_rsvps', 'event_rsvps']) {
    if (deleted[t].length) { const { error } = await yc().from(t).delete().in('id', deleted[t]); if (error) throw error }
  }
  { const { error } = await yc().from('events').delete().eq('id', c.event_id); if (error) throw error }
  { const { error } = await admin.schema('yi').from('chapters').delete().eq('id', c.chapter_id); if (error) throw error }
  fs.renameSync(FILE, FILE.replace('.json', `.deleted-${Date.now()}.json`))
  console.log(JSON.stringify(deleted, null, 2))
}

const [, , cmd, arg] = process.argv
;({ setup, cleanup, 'assign-member-caller': () => assignMemberCaller(arg) })[cmd]()
  .catch(e => { console.error(e); process.exit(1) })
