// Yi Erode EC 2027 EOI: rule tests. Run: node --test tests/ec-eoi/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inflateRawSync } from 'node:zlib'
import { EOI_ROLES, EOI_ROLE_IDS, EOI_COMMITMENTS, EOI_ROLE_UPDATE_NOTE } from '../../lib/ec-eoi/catalog.ts'
import { countSentences, normalisePhone, validateSubmission, isValidName } from '../../lib/ec-eoi/validation.ts'
import { createWorkbook, createAreaZip, areaFilename } from '../../lib/ec-eoi/workbook.ts'
import { readRanking, withRanking } from '../../lib/ec-eoi/ranking.ts'

const IDS = EOI_ROLES.map(r => r.id)

test('role ids are pinned to role names (reordering must never move a proposal)', () => {
  const pinned = {
    'vertical-0': 'Membership', 'vertical-1': 'Thalir', 'vertical-2': 'Yuva', 'vertical-3': 'Rural Initiatives',
    'vertical-4': 'Health', 'vertical-5': 'Road Safety', 'vertical-6': 'Masoom', 'vertical-7': 'Sense', 'vertical-8': 'Climate Change',
    'vertical-9': 'Entrepreneurship', 'vertical-10': 'Innovation', 'vertical-11': 'Learning', 'vertical-12': 'Sports', 'vertical-13': 'Branding',
  }
  assert.equal(EOI_ROLES.length, 14)
  assert.equal(EOI_ROLE_IDS.size, 14)
  for (const r of EOI_ROLES) assert.equal(pinned[r.id], r.name, r.id)
  assert.deepEqual(EOI_ROLES.filter(r => r.category === 'Stakeholders').length, 4)
  assert.deepEqual(EOI_ROLES.filter(r => r.category === 'Projects').length, 5)
  assert.deepEqual(EOI_ROLES.filter(r => r.category === 'Initiatives').length, 5)
  for (const r of EOI_ROLES) assert.ok(r.responsibilities.length > 0, r.name + ' has responsibilities')
  assert.deepEqual(EOI_COMMITMENTS.map(c => c.title), ['Pathfinder', 'EC Leader Academy (EC LA)', 'Regional Council Meeting 2027 (RCM)', 'EC Meetings'])
  assert.match(EOI_ROLE_UPDATE_NOTE, /^Any new programmes or responsibilities introduced for 2027/)
})

test('sentence counter matches the design', () => {
  assert.equal(countSentences(''), 0)
  assert.equal(countSentences('   '), 0)
  assert.equal(countSentences('One idea.'), 1)
  assert.equal(countSentences('One idea. Two ideas.'), 2)
  assert.equal(countSentences('One idea. Then a second without a stop'), 2)
  assert.equal(countSentences('One line\nsecond line'), 1, 'line breaks alone are not sentences')
  assert.equal(countSentences('A. B. C. D. E. F.'), 6)
  assert.equal(countSentences('Wow!! Really?'), 2)
  assert.equal(countSentences('... !!!'), 0)
})

test('name and phone rules', () => {
  assert.ok(isValidName('Ab'))
  assert.ok(!isValidName(' A '))
  assert.ok(!isValidName('12'))
  assert.ok(!isValidName('x'.repeat(101)))
  assert.equal(normalisePhone('9876543210'), '9876543210')
  assert.equal(normalisePhone('+91 98765 43210'), '9876543210')
  assert.equal(normalisePhone('(987) 654-3210'), '9876543210')
  assert.equal(normalisePhone('+91-98765-43210'), '9876543210')
  assert.equal(normalisePhone('5876543210'), null)
  assert.equal(normalisePhone('919876543210'), null)
  assert.equal(normalisePhone('98765432'), null)
  assert.equal(normalisePhone('+1 9876543210'), null)
})

const key = '0f8fad5b-d9cb-469f-a165-70867728950e'
const two = 'Erode needs this. I will act.'
const base = (selections, extra = {}) => ({ requestKey: key, name: ' Test Member ', phone: '+91 98765 43210', ack: true, selections, ...extra })

test('server validation: roles, sentences, acknowledgement', () => {
  const ok = validateSubmission(base([{ roleId: 'vertical-11', answer: two }, { roleId: 'vertical-4', answer: two }]), IDS)
  assert.equal(ok.ok, true)
  assert.equal(ok.value.name, 'Test Member')
  assert.equal(ok.value.phone, '9876543210')
  assert.deepEqual(ok.value.selections.map(s => s.roleId), ['vertical-11', 'vertical-4'], 'member order kept (1st choice first)')
  assert.equal(ok.value.ranked, false, 'no ranked flag from an old form')
  assert.equal(validateSubmission(base([{ roleId: 'vertical-11', answer: two }, { roleId: 'vertical-4', answer: two }], { ranked: true }), IDS).value.ranked, true, 'ranked form')

  assert.equal(validateSubmission(base([]), IDS).ok, false, '0 roles fails')
  assert.equal(validateSubmission(base([{ roleId: 'vertical-1', answer: two }]), IDS).ok, false, '1 role fails (Director 23 Nov: minimum 2)')
  assert.equal(validateSubmission(base(['vertical-1', 'vertical-2'].map(roleId => ({ roleId, answer: two }))), IDS).ok, true, '2 roles ok')
  assert.equal(validateSubmission(base(['vertical-1', 'vertical-2', 'vertical-3'].map(roleId => ({ roleId, answer: two }))), IDS).ok, true, '3 roles ok')
  assert.equal(validateSubmission(base(['vertical-1', 'vertical-2', 'vertical-3', 'vertical-4'].map(roleId => ({ roleId, answer: two }))), IDS).ok, false, '4 roles fails')
  assert.equal(validateSubmission(base([{ roleId: 'vertical-1', answer: two }, { roleId: 'vertical-1', answer: two }]), IDS).ok, false, 'duplicate role fails')
  assert.equal(validateSubmission(base([{ roleId: 'vertical-99', answer: two }]), IDS).ok, false, 'unknown role fails')
  assert.equal(validateSubmission(base([{ roleId: 'vertical-1', answer: 'Just one sentence.' }]), IDS).ok, false, '1 sentence fails')
  assert.equal(validateSubmission(base([{ roleId: 'vertical-1', answer: 'A. B. C. D. E. F. G.' }, { roleId: 'vertical-2', answer: two }]), IDS).ok, true, 'more than 5 accepted')
  assert.equal(validateSubmission(base([{ roleId: 'vertical-1', answer: 'A. B. ' + 'x'.repeat(3000) }]), IDS).ok, false, 'over 3000 chars fails')
  assert.equal(validateSubmission(base([{ roleId: 'vertical-1', answer: two }], { ack: false }), IDS).ok, false, 'ack required')
  assert.equal(validateSubmission(base([{ roleId: 'vertical-1', answer: two }], { ack: 'true' }), IDS).ok, false, 'ack must be a real true')
  assert.equal(validateSubmission(base([{ roleId: 'vertical-1', answer: two }], { phone: '12345' }), IDS).ok, false)
  assert.equal(validateSubmission(base([{ roleId: 'vertical-1', answer: two }], { requestKey: 'x' }), IDS).ok, false)
  assert.equal(validateSubmission(null, IDS).ok, false)
  assert.equal(validateSubmission(base([{ roleId: 'vertical-1', answer: 42 }]), IDS).ok, false)
})

// tiny unzip for checking our own output
function unzip(buf) {
  const files = {}
  let p = 0
  while (buf.readUInt32LE(p) === 0x04034b50) {
    const method = buf.readUInt16LE(p + 8), size = buf.readUInt32LE(p + 18), nameLen = buf.readUInt16LE(p + 26), extra = buf.readUInt16LE(p + 28)
    const name = buf.subarray(p + 30, p + 30 + nameLen).toString('utf8')
    const data = buf.subarray(p + 30 + nameLen + extra, p + 30 + nameLen + extra + size)
    files[name] = method === 8 ? inflateRawSync(data) : data
    p += 30 + nameLen + extra + size
  }
  return files
}
const rows = (xml) => [...xml.matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g)].map(m => [...m[1].matchAll(/<t xml:space="preserve">([\s\S]*?)<\/t>/g)].map(c => c[1]))

const sel = (id, answer) => { const r = EOI_ROLES.find(r => r.id === id); return { id, name: r.name, category: r.category, answer, choice: null } }
const A = { id: 'a-1', submittedAt: '2026-11-19T08:30:00.000Z', name: 'Member A', phone: '9876543210', recordType: 'Submitted', ranked: false, selections: [sel('vertical-4', 'A health idea.'), sel('vertical-11', 'A learning idea.')] }
const B = { id: 'b-2', submittedAt: '2026-11-19T09:00:00.000Z', name: 'Member B', phone: '9123456780', recordType: 'Submitted', ranked: false, selections: [sel('vertical-11', '=HYPERLINK("http://x","click") & <b>"quotes"</b>')] }

test('PDF page 7 example: all, per-area and ZIP separation', () => {
  const all = unzip(createWorkbook([A, B]))
  const m = rows(all['xl/worksheets/sheet1.xml'].toString()), pr = rows(all['xl/worksheets/sheet2.xml'].toString())
  assert.equal(m.length - 1, 2, 'two member rows')
  assert.equal(pr.length - 1, 3, 'three proposal rows')
  assert.equal(m[1][3], '+91 9876543210')
  assert.equal(m[1][4], 'Health\nLearning')
  assert.equal(m[1][6], 'Not ranked (sent before ranking was added)')
  assert.equal(pr[1][4], 'Not ranked')

  const health = unzip(createWorkbook([A, B], 'vertical-4'))
  const hm = rows(health['xl/worksheets/sheet1.xml'].toString()), hp = rows(health['xl/worksheets/sheet2.xml'].toString())
  assert.deepEqual(hm.slice(1).map(r => r[2]), ['Member A'])
  assert.equal(hm[1][5], '1', 'count describes the exported subset')
  assert.deepEqual(hp.slice(1).map(r => r[6]), ['Health'])

  const learning = unzip(createWorkbook([A, B], 'vertical-11'))
  const lp = rows(learning['xl/worksheets/sheet2.xml'].toString())
  assert.deepEqual(lp.slice(1).map(r => r[2] + ':' + r[6]), ['Member A:Learning', 'Member B:Learning'])

  const zip = unzip(createAreaZip([A, B], EOI_ROLES))
  assert.deepEqual(Object.keys(zip).sort(), [areaFilename('Health'), areaFilename('Learning')].sort(), 'empty areas left out')
})

test('member text is stored as plain text, never a formula', () => {
  const sheet2 = unzip(createWorkbook([B]))['xl/worksheets/sheet2.xml'].toString()
  assert.ok(!sheet2.includes('<f>'), 'no formula cells')
  assert.ok(sheet2.includes('t="inlineStr"'))
  assert.ok(sheet2.includes('=HYPERLINK(&quot;http://x&quot;,&quot;click&quot;) &amp; &lt;b&gt;'), 'escaped literally')
})

test('zip checksum matches the table fallback', async () => {
  const zlib = await import('node:zlib')
  let c = 0xffffffff
  const table = Array.from({ length: 256 }, (_, n) => { let x = n; for (let k = 0; k < 8; k++) x = x & 1 ? 0xedb88320 ^ (x >>> 1) : x >>> 1; return x >>> 0 })
  const data = Buffer.from('Yi Erode EC 2027 தமிழ்')
  for (const b of data) c = table[(c ^ b) & 0xff] ^ (c >>> 8)
  assert.equal((c ^ 0xffffffff) >>> 0, zlib.crc32(data) >>> 0)
})

test('desk access rule (Yi Connect roles)', async () => {
  const { eoiAccessAllowed } = await import('../../lib/ec-eoi/access-rule.ts')
  const r = (app, role, yi_chapter, is_active = true) => ({ app, role, yi_chapter, is_active })
  assert.ok(eoiAccessAllowed([r('yi', 'chapter_chair', 'Erode')]), 'Erode chair')
  assert.ok(eoiAccessAllowed([r('yi', 'chapter_co_chair', 'Erode')]), 'Erode co-chair')
  assert.ok(eoiAccessAllowed([r('ec_eoi', 'reviewer', 'Erode')]), 'added reviewer')
  assert.ok(eoiAccessAllowed([r('yi', 'platform_super_admin', null)]), 'platform super')
  assert.ok(!eoiAccessAllowed([]), 'no roles')
  assert.ok(!eoiAccessAllowed([r('yi', 'chapter_chair', 'Salem')]), 'other chapter chair')
  assert.ok(!eoiAccessAllowed([r('yi', 'chapter_chair', 'Erode', false)]), 'inactive')
  assert.ok(!eoiAccessAllowed([r('ec_eoi', 'reviewer', null)]), 'blank chapter fails closed')
  assert.ok(!eoiAccessAllowed([r('ec_eoi', 'reviewer', ' ')]), 'blank chapter fails closed')
  assert.ok(!eoiAccessAllowed([r('yip', 'chapter_admin', 'Erode')]), 'YIP organiser is not enough')
})

test('ranked entries: Excel shows 1st / 2nd choice in member order (Director 23 Nov)', () => {
  const C = { ...A, id: 'c-3', ranked: true, selections: [{ ...sel('vertical-11', 'L.'), choice: 1 }, { ...sel('vertical-4', 'H.'), choice: 2 }] }
  const wb = unzip(createWorkbook([C]))
  const m = rows(wb['xl/worksheets/sheet1.xml'].toString()), pr = rows(wb['xl/worksheets/sheet2.xml'].toString())
  assert.equal(m[1][4], '1. Learning\n2. Health')
  assert.equal(m[1][6], 'Ranked by member')
  assert.deepEqual(pr.slice(1).map(r => r[4] + ':' + r[6]), ['1st choice:Learning', '2nd choice:Health'])
})

test('ranking round-trip; old entries read as not ranked', () => {
  const v = withRanking('2026-11-17', ['vertical-9', 'vertical-1', 'vertical-6'])
  assert.equal(v, '2026-11-17;ranked=vertical-9,vertical-1,vertical-6')
  assert.deepEqual(readRanking(v, new Set(['vertical-1', 'vertical-6', 'vertical-9'])), ['vertical-9', 'vertical-1', 'vertical-6'])
  assert.equal(readRanking('2026-11-17', new Set(['vertical-1'])), null, 'old entry: not ranked')
  assert.equal(readRanking(null, new Set(['vertical-1'])), null)
  assert.equal(readRanking(v, new Set(['vertical-1', 'vertical-6'])), null, 'mismatch with answers: not ranked')
  assert.equal(readRanking('2026-11-17;ranked=vertical-1,vertical-1', new Set(['vertical-1'])), null, 'duplicate ids rejected')
})

test('spread: needs-people tags and shuffle (Director 24 Nov)', async () => {
  const { needsPeople, shuffled } = await import('../../lib/ec-eoi/spread.ts')
  const ids = ['a', 'b', 'c', 'd']
  assert.deepEqual(needsPeople(ids, []), [], 'no entries: no tags')
  assert.deepEqual(needsPeople(ids, [['a', 'b'], ['a'], ['a', 'c']]), ['d'], 'small numbers: only zero-pick areas')
  const many = Array.from({ length: 20 }, () => ['a']).concat([['b'], ['b'], ['c'], ['c'], ['c'], ['c'], ['c']])
  assert.deepEqual(needsPeople(ids, many), ['b', 'd'], 'under a quarter of the top area')
  assert.deepEqual(needsPeople(ids, [['a', 'a', 'x']]), ['b', 'c', 'd'], 'duplicates and unknown ids ignored')
  const s = shuffled(ids, () => 0)
  assert.deepEqual([...s].sort(), ids, 'same items')
  assert.deepEqual(ids, ['a', 'b', 'c', 'd'], 'input untouched')
})

test('extra questions for crowded areas (Director 24 Nov)', async () => {
  const { EOI_EXTRA_QUESTIONS } = await import('../../lib/ec-eoi/catalog.ts')
  const { extrasText } = await import('../../lib/ec-eoi/workbook.ts')
  assert.deepEqual(Object.keys(EOI_EXTRA_QUESTIONS).map(id => EOI_ROLES.find(r => r.id === id).name), ['Thalir', 'Yuva', 'Rural Initiatives', 'Entrepreneurship'])
  const thalir = (extras) => base([{ roleId: 'vertical-1', answer: two, extras }, { roleId: 'vertical-4', answer: two }], { extrasAsked: true })
  assert.equal(validateSubmission(thalir(undefined), IDS, EOI_EXTRA_QUESTIONS).ok, false, 'missing extras fail on the new form')
  assert.equal(validateSubmission(thalir([{ key: 'schools', answer: 'GHS Erode' }]), IDS, EOI_EXTRA_QUESTIONS).ok, false, 'one of two fails')
  assert.equal(validateSubmission(thalir([{ key: 'schools', answer: 'GHS' }, { key: 'visits', answer: '   ' }]), IDS, EOI_EXTRA_QUESTIONS).ok, false, 'blank fails')
  assert.equal(validateSubmission(thalir([{ key: 'schools', answer: 'GHS' }, { key: 'visits', answer: 'x'.repeat(501) }]), IDS, EOI_EXTRA_QUESTIONS).ok, false, 'over 500 fails')
  const ok = validateSubmission(thalir([{ key: 'visits', answer: ' 2 ' }, { key: 'schools', answer: 'GHS', }, { key: 'junk', answer: 'x' }]), IDS, EOI_EXTRA_QUESTIONS)
  assert.equal(ok.ok, true)
  assert.deepEqual(ok.value.selections[0].extras, [{ key: 'schools', answer: 'GHS' }, { key: 'visits', answer: '2' }], 'only known keys, in question order, trimmed')
  assert.deepEqual(ok.value.selections[1].extras, [], 'other areas have none')
  const old = validateSubmission(base([{ roleId: 'vertical-1', answer: two }, { roleId: 'vertical-4', answer: two }]), IDS, EOI_EXTRA_QUESTIONS)
  assert.equal(old.ok, true, 'a page loaded before 24 Nov is not blocked')
  assert.deepEqual(old.value.selections[0].extras, [])
  assert.equal(extrasText({ extrasNotAsked: true }), 'Not asked (sent before they were added)')
  assert.equal(extrasText({ extras: [{ question: 'Q1?', answer: 'A1' }, { question: 'Q2?', answer: 'A2' }] }), 'Q1?\nA1\n\nQ2?\nA2')
  const wb = unzip(createWorkbook([{ ...A, selections: [{ ...sel('vertical-1', 'T.'), extras: [{ question: 'Q?', answer: '=1+1' }] }] }]))
  const pr = rows(wb['xl/worksheets/sheet2.xml'].toString())
  assert.equal(pr[0][8], 'Extra answers')
  assert.equal(pr[1][8], 'Q?\n=1+1', 'stored as text')
})
