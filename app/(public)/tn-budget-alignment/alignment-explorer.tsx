'use client'

import { useMemo, useState } from 'react'
import {
  ChevronDown,
  Search,
  Target,
  User,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
  ALIGNMENT_ROWS,
  BAND_META,
  CHAPTER_ROWS,
  DEPT_CASES,
  EFFORT_META,
  GAP_ROWS,
  LEAD_ROWS,
  POSITIONING,
  RUBRIC,
  type AlignmentRow,
  type Band,
  type Effort,
} from '@/lib/policy-alignment/tn-budget-2026'

const BAND_STYLES: Record<Band, string> = {
  'Act now':
    'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  'Open a door':
    'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  'Re-scope first':
    'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  'Not this year': 'bg-muted text-muted-foreground',
}

const BAND_TONE: Record<Band, string> = {
  'Act now': 'text-emerald-600 dark:text-emerald-400',
  'Open a door': 'text-sky-600 dark:text-sky-400',
  'Re-scope first': 'text-amber-600 dark:text-amber-400',
  'Not this year': 'text-muted-foreground',
}

const BANDS: Band[] = ['Act now', 'Open a door', 'Re-scope first', 'Not this year']

/** Four sub-scores as segmented bars — the number is auditable at a glance. */
function ScoreMeter({ row, size = 'sm' }: { row: AlignmentRow; size?: 'sm' | 'lg' }) {
  return (
    <div className='flex items-center gap-2'>
      <div className='flex gap-[3px]' aria-hidden='true'>
        {RUBRIC.map(r => {
          const v = row.scores[r.key]
          return (
            <span
              key={r.key}
              title={`${r.label}: ${v}/2 — ${v === 2 ? r.two : v === 1 ? r.one : r.zero}`}
              className={cn(
                'flex flex-col-reverse gap-[2px]',
                size === 'lg' ? 'w-2.5' : 'w-1.5'
              )}
            >
              {[0, 1].map(i => (
                <span
                  key={i}
                  className={cn(
                    'block rounded-[1px]',
                    size === 'lg' ? 'h-2' : 'h-1.5',
                    i < v ? 'bg-current opacity-90' : 'bg-current opacity-15'
                  )}
                />
              ))}
            </span>
          )
        })}
      </div>
      <span
        className={cn(
          'font-mono font-semibold tabular-nums',
          size === 'lg' ? 'text-sm' : 'text-xs'
        )}
      >
        {row.score}/8
      </span>
    </div>
  )
}

/** How much work the first step actually is — so 35 "Act now" items can be triaged. */
function EffortChip({ effort }: { effort: Effort }) {
  const blurb = EFFORT_META.find(e => e.effort === effort)?.blurb ?? ''
  return (
    <span
      title={blurb}
      className='border-border text-muted-foreground inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap'
    >
      <Clock className='size-3' />
      {effort}
    </span>
  )
}

function Para({ value }: { value: string }) {
  if (!value || value === '—')
    return <span className='text-muted-foreground text-xs'>—</span>
  return (
    <span className='bg-primary/10 text-primary rounded px-1.5 py-0.5 font-mono text-[11px] whitespace-nowrap'>
      ¶{value}
    </span>
  )
}

/** The action point — the thing someone actually does on Monday. */
function ActionPoint({ row }: { row: AlignmentRow }) {
  const dead = row.band === 'Not this year'
  return (
    <div
      className={cn(
        'rounded-md border p-4',
        dead ? 'bg-muted/40' : 'bg-primary/[0.04] border-primary/25'
      )}
    >
      <div className='mb-2 flex flex-wrap items-center gap-2'>
        <Target
          className={cn('size-4', dead ? 'text-muted-foreground' : 'text-primary')}
        />
        <span
          className={cn(
            'text-[10px] font-bold tracking-wider uppercase',
            dead ? 'text-muted-foreground' : 'text-primary'
          )}
        >
          {dead ? 'No action this year' : 'Do this first'}
        </span>
        <EffortChip effort={row.effort} />
        {row.ownerScope === 'region' && (
          <span className='text-muted-foreground text-[10px] font-semibold'>
            Once for the region
          </span>
        )}
        {row.ownerScope === 'named' && (
          <span className='text-muted-foreground text-[10px] font-semibold'>
            {row.namedChapters.join(' & ')} only
          </span>
        )}
      </div>
      <p className='text-sm leading-snug font-medium'>{row.firstStep}</p>
      {!dead && (
        <p className='mt-2.5 text-sm leading-snug'>
          <span className='text-[10px] font-bold tracking-wider text-emerald-700 uppercase dark:text-emerald-400'>
            Department gains ·{' '}
          </span>
          {row.govGain}
        </p>
      )}
      <dl className='mt-3 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-3'>
        <div className='flex gap-2'>
          <dt className='sr-only'>Owner</dt>
          <User className='text-muted-foreground mt-0.5 size-3.5 shrink-0' />
          <dd className='leading-snug'>{row.owner}</dd>
        </div>
        <div className='flex gap-2'>
          <dt className='sr-only'>Window</dt>
          <Calendar className='text-muted-foreground mt-0.5 size-3.5 shrink-0' />
          <dd className='leading-snug'>{row.window}</dd>
        </div>
        <div className='flex gap-2'>
          <dt className='sr-only'>Proof it worked</dt>
          <CheckCircle2 className='text-muted-foreground mt-0.5 size-3.5 shrink-0' />
          <dd className='leading-snug'>{row.proof}</dd>
        </div>
      </dl>
    </div>
  )
}

export function AlignmentExplorer() {
  const [q, setQ] = useState('')
  const [pillar, setPillar] = useState<string | null>(null)
  const [vertical, setVertical] = useState<string | null>(null)
  const [bandF, setBandF] = useState<Band | null>(null)
  const [open, setOpen] = useState<Set<number>>(new Set())
  const [showRubric, setShowRubric] = useState(false)

  const pillars = useMemo(() => [...new Set(ALIGNMENT_ROWS.map(r => r.pillar))], [])
  const verticals = useMemo(
    () => [...new Set(ALIGNMENT_ROWS.map(r => r.vertical))].sort(),
    []
  )

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return ALIGNMENT_ROWS.filter(r => {
      if (pillar && r.pillar !== pillar) return false
      if (vertical && r.vertical !== vertical) return false
      if (bandF && r.band !== bandF) return false
      if (!needle) return true
      return [r.vertical, r.programme, r.scheme, r.dept, r.why, r.firstStep, r.owner, r.para]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
  }, [q, pillar, vertical, bandF])

  const counts = useMemo(() => {
    const c = {} as Record<Band, number>
    for (const r of rows) c[r.band] = (c[r.band] ?? 0) + 1
    return c
  }, [rows])

  const filtered = !!(q || pillar || vertical || bandF)

  const reset = () => {
    setQ('')
    setPillar(null)
    setVertical(null)
    setBandF(null)
  }

  const toggleRow = (i: number) =>
    setOpen(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })

  /* Action plan groups — highest-scoring work first. */
  const groups = useMemo(
    () => [
      {
        title: 'Start here',
        note: 'Perfect score. Same outcome, same people, same year, and the budget text explicitly invites an outside partner.',
        rows: ALIGNMENT_ROWS.filter(r => r.score === 8),
      },
      {
        title: 'Act now',
        note: 'Strong on every dimension. These need a first move this year.',
        rows: ALIGNMENT_ROWS.filter(r => r.score === 7),
      },
      {
        title: 'Open a door',
        note: 'The match is real but there is no route in yet. Find the counterpart before promising anything.',
        rows: ALIGNMENT_ROWS.filter(r => r.score >= 5 && r.score <= 6),
      },
    ],
    []
  )

  /* By owner — every role sees only the actions it carries. */
  const byOwner = useMemo(() => {
    const map = new Map<string, AlignmentRow[]>()
    for (const r of ALIGNMENT_ROWS) {
      if (r.band === 'Not this year') continue
      const list = map.get(r.ownerRole) ?? []
      list.push(r)
      map.set(r.ownerRole, list)
    }
    return [...map.entries()]
      .map(([role, list]) => ({
        role,
        rows: list.sort((a, b) => b.score - a.score),
        scope: list[0].ownerScope,
      }))
      .sort((a, b) => b.rows.length - a.rows.length || a.role.localeCompare(b.role))
  }, [])

  /* By chapter — the anchor the budget names, plus the actions that chapter owns. */
  const byChapter = useMemo(
    () =>
      CHAPTER_ROWS.map(c => {
        const mine = ALIGNMENT_ROWS.filter(
          r =>
            r.band !== 'Not this year' &&
            (r.namedChapters.includes(c.chapter) ||
              (r.vertical === c.vertical && r.ownerScope === 'chapter'))
        ).sort((a, b) => b.score - a.score)
        const shared = ALIGNMENT_ROWS.filter(
          r =>
            r.band !== 'Not this year' &&
            r.ownerScope === 'chapter' &&
            !mine.includes(r)
        ).length
        return { ...c, mine, shared }
      }),
    []
  )

  return (
    <Tabs defaultValue='govt' className='w-full'>
      <TabsList className='mb-6 flex h-auto flex-wrap justify-start gap-1'>
        <TabsTrigger value='govt'>What the Government Gains</TabsTrigger>
        <TabsTrigger value='positioning'>Positioning</TabsTrigger>
        <TabsTrigger value='actions'>Action Plan</TabsTrigger>
        <TabsTrigger value='owners'>By Owner</TabsTrigger>
        <TabsTrigger value='mychapter'>By Chapter</TabsTrigger>
        <TabsTrigger value='matrix'>Scored Matrix</TabsTrigger>
        <TabsTrigger value='chapters'>Chapters</TabsTrigger>
        <TabsTrigger value='gaps'>Gaps &amp; Cautions</TabsTrigger>
        <TabsTrigger value='leads'>SRTN Leads</TabsTrigger>
      </TabsList>

      {/* ─────────────── What the government gains ─────────────── */}
      <TabsContent value='govt' className='space-y-8'>
        <div className='border-primary/25 bg-primary/[0.04] rounded-lg border p-5'>
          <p className='text-sm leading-relaxed'>
            Read from the department&rsquo;s side of the table. Each entry states
            what this budget obliges a department to deliver, what it is short
            of, and what Yi can hand over &mdash;{' '}
            <strong>
              never what Yi gains. A Yi growth target is not a government
              benefit.
            </strong>{' '}
            The cost column is what the department must give up, and it is never
            money.
          </p>
        </div>

        {DEPT_CASES.map(d => (
          <section key={d.dept}>
            <div className='mb-3 border-b pb-3'>
              <div className='mb-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1'>
                <h2 className='text-lg font-bold'>{d.dept}</h2>
                <span className='text-muted-foreground font-mono text-xs'>
                  {d.budget}
                </span>
                <Para value={d.para} />
              </div>
              <p className='text-muted-foreground text-sm leading-snug'>
                <b className='text-foreground'>Obliged to deliver:</b>{' '}
                {d.mandate}
              </p>
              <p className='mt-2 text-sm leading-snug'>
                <b className='text-amber-700 dark:text-amber-400'>
                  What they are short of:
                </b>{' '}
                {d.constraint}
              </p>
            </div>

            <div className='space-y-2.5'>
              {d.offers.map((o, i) => (
                <div key={i} className='bg-card rounded-lg border p-4'>
                  <p className='text-sm leading-snug font-semibold'>{o.work}</p>
                  <dl className='mt-3 grid gap-3 text-sm sm:grid-cols-3'>
                    <div className='sm:col-span-2'>
                      <dt className='mb-1 text-[10px] font-bold tracking-wider text-emerald-700 uppercase dark:text-emerald-400'>
                        What the department gains
                      </dt>
                      <dd className='leading-snug font-medium'>{o.gains}</dd>
                    </div>
                    <div>
                      <dt className='text-muted-foreground mb-1 text-[10px] font-bold tracking-wider uppercase'>
                        What it costs them
                      </dt>
                      <dd className='leading-snug'>{o.costs}</dd>
                      {o.scale && (
                        <dd className='text-muted-foreground mt-1.5 text-xs leading-snug'>
                          Scale: {o.scale}
                        </dd>
                      )}
                    </div>
                  </dl>
                </div>
              ))}
            </div>

            <p className='text-muted-foreground mt-3 text-xs leading-snug'>
              <b className='text-foreground'>Evidence handed back:</b>{' '}
              {d.evidence}
            </p>
          </section>
        ))}
      </TabsContent>

      {/* ─────────────── Positioning ─────────────── */}
      <TabsContent value='positioning' className='space-y-8'>
        <div>
          <h2 className='text-2xl leading-tight font-bold text-balance'>
            {POSITIONING.headline}
          </h2>
          <p className='text-muted-foreground mt-3 max-w-3xl text-base leading-relaxed'>
            {POSITIONING.sub}
          </p>
        </div>

        <div className='grid gap-3 md:grid-cols-3'>
          {POSITIONING.assets.map(a => (
            <div key={a.title} className='bg-card rounded-lg border p-4'>
              <h3 className='mb-2 text-sm font-bold'>{a.title}</h3>
              <p className='text-muted-foreground text-sm leading-snug'>
                {a.body}
              </p>
            </div>
          ))}
        </div>

        <div className='grid gap-4 md:grid-cols-2'>
          <div className='rounded-lg border border-emerald-600/30 bg-emerald-50/50 p-4 dark:bg-emerald-950/20'>
            <h3 className='mb-3 text-sm font-bold text-emerald-800 dark:text-emerald-300'>
              Say this
            </h3>
            <ul className='space-y-2.5'>
              {POSITIONING.say.map((s, i) => (
                <li key={i} className='text-sm leading-snug'>
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div className='rounded-lg border border-rose-600/30 bg-rose-50/50 p-4 dark:bg-rose-950/20'>
            <h3 className='mb-3 text-sm font-bold text-rose-800 dark:text-rose-300'>
              Never say this
            </h3>
            <ul className='space-y-2.5'>
              {POSITIONING.neverSay.map((s, i) => (
                <li key={i} className='text-sm leading-snug'>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className='bg-card rounded-lg border p-4'>
          <h3 className='mb-2 text-sm font-bold'>
            The only things Yi ever asks for
          </h3>
          <ul className='grid gap-2 sm:grid-cols-2'>
            {POSITIONING.ask.map((s, i) => (
              <li key={i} className='text-sm leading-snug'>
                &middot; {s}
              </li>
            ))}
          </ul>
        </div>
      </TabsContent>

      {/* ─────────────── Action plan ─────────────── */}
      <TabsContent value='actions' className='space-y-8'>
        <p className='text-muted-foreground max-w-2xl text-sm'>
          Every programme scoring 5 or more, as a first move with an owner, a
          window and a test of whether it worked. Ordered by how well the two
          sides actually match — not by how appealing the idea sounds.
        </p>

        {groups.map(g => (
          <section key={g.title}>
            <div className='mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b pb-2'>
              <h2 className='text-lg font-bold'>{g.title}</h2>
              <span className='text-muted-foreground font-mono text-sm tabular-nums'>
                {g.rows.length}
              </span>
              <p className='text-muted-foreground w-full text-xs sm:w-auto sm:flex-1'>
                {g.note}
              </p>
            </div>
            <ol className='space-y-3'>
              {g.rows.map(r => (
                <li
                  key={r.programme}
                  className='bg-card rounded-lg border p-4'
                >
                  <div className='mb-2 flex flex-wrap items-center gap-2'>
                    <Badge variant='outline' className='text-[10px]'>
                      {r.vertical}
                    </Badge>
                    <span className={BAND_TONE[r.band]}>
                      <ScoreMeter row={r} />
                    </span>
                    <Para value={r.para} />
                  </div>
                  <h3 className='text-sm leading-snug font-bold'>
                    {r.programme}
                  </h3>
                  <p className='text-muted-foreground mt-0.5 mb-3 text-sm leading-snug'>
                    → {r.scheme}
                  </p>
                  <ActionPoint row={r} />
                </li>
              ))}
            </ol>
          </section>
        ))}
      </TabsContent>

      {/* ─────────────── By owner ─────────────── */}
      <TabsContent value='owners' className='space-y-6'>
        <p className='text-muted-foreground max-w-2xl text-sm'>
          The same actions, addressed to whoever carries them. A convener should
          be able to find their own list and nothing else.{' '}
          <b className='text-foreground'>Chapter</b> roles are repeated in every
          chapter; <b className='text-foreground'>region</b> roles do it once for
          all of SRTN.
        </p>
        <div className='space-y-4'>
          {byOwner.map(g => (
            <div key={g.role} className='bg-card rounded-lg border p-4'>
              <div className='mb-3 flex flex-wrap items-center gap-2 border-b pb-2'>
                <h3 className='text-sm font-bold'>{g.role}</h3>
                <Badge
                  variant={g.scope === 'chapter' ? 'secondary' : 'default'}
                  className='text-[10px]'
                >
                  {g.scope === 'chapter' ? 'Every chapter' : 'Once for SRTN'}
                </Badge>
                <span className='text-muted-foreground font-mono text-xs tabular-nums'>
                  {g.rows.length} action{g.rows.length === 1 ? '' : 's'}
                </span>
                <span className='text-muted-foreground ml-auto flex gap-1.5'>
                  {(['Afternoon', 'A week', 'A quarter'] as Effort[]).map(e => {
                    const n = g.rows.filter(r => r.effort === e).length
                    return n ? (
                      <span key={e} className='text-[10px] font-semibold'>
                        {n}&times;&nbsp;{e}
                      </span>
                    ) : null
                  })}
                </span>
              </div>
              <ol className='space-y-2.5'>
                {g.rows.map(r => (
                  <li key={r.programme} className='flex gap-3'>
                    <span
                      className={cn(
                        'mt-0.5 font-mono text-xs font-semibold tabular-nums',
                        BAND_TONE[r.band]
                      )}
                    >
                      {r.score}/8
                    </span>
                    <div className='min-w-0 flex-1'>
                      <p className='text-sm leading-snug font-medium'>
                        {r.firstStep}
                      </p>
                      <p className='text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs'>
                        <span>{r.programme}</span>
                        <Para value={r.para} />
                        <EffortChip effort={r.effort} />
                        <span>· {r.window}</span>
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </TabsContent>

      {/* ─────────────── By chapter ─────────────── */}
      <TabsContent value='mychapter' className='space-y-6'>
        <p className='text-muted-foreground max-w-2xl text-sm'>
          What each chapter owns: the scheme the budget names in its district,
          and the actions its lead vertical carries. Actions every chapter shares
          are counted, not repeated.
        </p>
        <div className='space-y-4'>
          {byChapter.map(c => (
            <div key={c.chapter} className='bg-card rounded-lg border p-4'>
              <div className='mb-3 border-b pb-3'>
                <div className='mb-1.5 flex flex-wrap items-center gap-2'>
                  <MapPin className='text-primary size-4' />
                  <h3 className='text-base font-bold'>{c.chapter}</h3>
                  <Para value={c.para} />
                  <Badge variant='secondary' className='text-[10px]'>
                    Lead: {c.vertical}
                  </Badge>
                </div>
                <p className='text-muted-foreground text-xs leading-snug'>
                  <b className='text-foreground'>Named in the budget:</b>{' '}
                  {c.named} — {c.scheme}
                </p>
                <p className='mt-1.5 text-sm leading-snug font-medium'>
                  {c.move}
                </p>
              </div>
              {c.mine.length > 0 && (
                <ol className='space-y-2.5'>
                  {c.mine.map(r => (
                    <li key={r.programme} className='flex gap-3'>
                      <span
                        className={cn(
                          'mt-0.5 font-mono text-xs font-semibold tabular-nums',
                          BAND_TONE[r.band]
                        )}
                      >
                        {r.score}/8
                      </span>
                      <div className='min-w-0 flex-1'>
                        <p className='text-sm leading-snug font-medium'>
                          {r.firstStep}
                        </p>
                        <p className='text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs'>
                          <span>{r.owner}</span>
                          <EffortChip effort={r.effort} />
                          <span>· {r.window}</span>
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              <p className='text-muted-foreground mt-3 border-t pt-2 text-xs'>
                Plus{' '}
                <b className='text-foreground tabular-nums'>{c.shared}</b> further
                actions every SRTN chapter carries — see{' '}
                <b className='text-foreground'>By Owner</b>.
              </p>
            </div>
          ))}
        </div>
      </TabsContent>

      {/* ─────────────── Scored matrix ─────────────── */}
      <TabsContent value='matrix' className='space-y-5'>
        <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
          {BANDS.map(b => {
            const meta = BAND_META.find(m => m.band === b)!
            return (
              <button
                key={b}
                type='button'
                onClick={() => setBandF(bandF === b ? null : b)}
                aria-pressed={bandF === b}
                className={cn(
                  'bg-card hover:border-primary/60 cursor-pointer rounded-lg border p-4 text-left transition-colors',
                  bandF === b && 'border-primary ring-primary/30 ring-2'
                )}
              >
                <span
                  className={cn(
                    'block font-mono text-2xl leading-none font-semibold tabular-nums',
                    BAND_TONE[b]
                  )}
                >
                  {counts[b] ?? 0}
                </span>
                <span className='mt-1.5 block text-xs font-semibold'>{b}</span>
                <span className='text-muted-foreground mt-1 block text-[11px] leading-snug'>
                  {meta.min > 0 ? `${meta.min}+ / 8` : '0–2 / 8'}
                </span>
              </button>
            )
          })}
        </div>

        <div>
          <Button
            size='sm'
            variant='ghost'
            onClick={() => setShowRubric(v => !v)}
            aria-expanded={showRubric}
            className='h-7 px-2 text-xs'
          >
            How the score works
            <ChevronDown
              className={cn('ml-1 size-3.5 transition-transform', showRubric && 'rotate-180')}
            />
          </Button>
          {showRubric && (
            <div className='bg-muted/40 mt-2 rounded-md border p-4'>
              <p className='text-muted-foreground mb-3 text-xs'>
                Four dimensions, 0–2 each, totalling 8. A judgement against a
                fixed rubric — not a measurement.
              </p>
              <dl className='grid gap-3 sm:grid-cols-2'>
                {RUBRIC.map(r => (
                  <div key={r.key}>
                    <dt className='text-xs font-bold'>{r.label}</dt>
                    <dd className='text-muted-foreground text-xs leading-snug'>
                      <b className='text-foreground'>2</b> {r.two} ·{' '}
                      <b className='text-foreground'>1</b> {r.one} ·{' '}
                      <b className='text-foreground'>0</b> {r.zero}
                    </dd>
                  </div>
                ))}
              </dl>
              <ul className='mt-3 space-y-1 border-t pt-3'>
                {BAND_META.map(m => (
                  <li key={m.band} className='text-xs leading-snug'>
                    <span
                      className={cn(
                        'mr-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold',
                        BAND_STYLES[m.band]
                      )}
                    >
                      {m.band}
                    </span>
                    <span className='text-muted-foreground'>{m.blurb}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className='space-y-3'>
          <div className='relative'>
            <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2' />
            <Input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder='Search programmes, schemes, departments, owners…'
              className='pl-9'
              aria-label='Search the alignment matrix'
            />
          </div>
          <div className='flex flex-wrap gap-1.5'>
            {pillars.map(p => (
              <Button
                key={p}
                size='sm'
                variant={pillar === p ? 'default' : 'outline'}
                onClick={() => setPillar(pillar === p ? null : p)}
              >
                {p}
              </Button>
            ))}
          </div>
          <div className='flex flex-wrap gap-1.5'>
            {verticals.map(v => (
              <Button
                key={v}
                size='sm'
                variant={vertical === v ? 'secondary' : 'ghost'}
                className='h-7 px-2.5 text-xs'
                onClick={() => setVertical(vertical === v ? null : v)}
              >
                {v}
              </Button>
            ))}
          </div>
          <div className='flex items-center justify-between gap-3'>
            <p className='text-muted-foreground text-xs'>
              Showing{' '}
              <span className='text-foreground font-semibold tabular-nums'>
                {rows.length}
              </span>{' '}
              of {ALIGNMENT_ROWS.length} mapped programmes
            </p>
            {filtered && (
              <Button size='sm' variant='ghost' onClick={reset}>
                <X className='mr-1 size-3.5' />
                Clear filters
              </Button>
            )}
          </div>
        </div>

        <div className='divide-y rounded-lg border'>
          {rows.length === 0 && (
            <p className='text-muted-foreground p-8 text-center text-sm'>
              Nothing matches those filters.
            </p>
          )}
          {rows.map(r => {
            const key = ALIGNMENT_ROWS.indexOf(r)
            const isOpen = open.has(key)
            return (
              <div key={key}>
                <button
                  type='button'
                  onClick={() => toggleRow(key)}
                  aria-expanded={isOpen}
                  className='hover:bg-muted/50 flex w-full items-start gap-3 p-4 text-left transition-colors'
                >
                  <div className='min-w-0 flex-1'>
                    <div className='mb-1.5 flex flex-wrap items-center gap-2'>
                      <Badge variant='outline' className='text-[10px]'>
                        {r.vertical}
                      </Badge>
                      <span
                        className={cn(
                          'rounded px-2 py-0.5 text-[11px] font-semibold',
                          BAND_STYLES[r.band]
                        )}
                      >
                        {r.band}
                      </span>
                      <span className={BAND_TONE[r.band]}>
                        <ScoreMeter row={r} />
                      </span>
                      <Para value={r.para} />
                      {r.crore != null && (
                        <span className='text-muted-foreground font-mono text-[11px] tabular-nums'>
                          ₹{r.crore.toLocaleString('en-IN')} cr
                        </span>
                      )}
                    </div>
                    <p className='text-sm leading-snug font-semibold'>
                      {r.programme}
                    </p>
                    <p className='text-muted-foreground mt-0.5 text-sm leading-snug'>
                      → {r.scheme}
                    </p>
                  </div>
                  <ChevronDown
                    className={cn(
                      'text-muted-foreground mt-1 size-4 shrink-0 transition-transform',
                      isOpen && 'rotate-180'
                    )}
                  />
                </button>

                {isOpen && (
                  <div className='space-y-4 px-4 pb-4'>
                    <div className='bg-muted/40 rounded-md border p-4'>
                      <p className='text-muted-foreground mb-1.5 text-[10px] font-bold tracking-wider uppercase'>
                        Why {r.score}/8
                      </p>
                      <p className='text-sm leading-snug'>{r.why}</p>
                      <dl className='mt-3 flex flex-wrap gap-x-5 gap-y-1.5 border-t pt-3'>
                        {RUBRIC.map(rb => (
                          <div key={rb.key} className='flex items-baseline gap-1.5'>
                            <dt className='text-muted-foreground text-[11px]'>
                              {rb.label}
                            </dt>
                            <dd className='font-mono text-[11px] font-semibold tabular-nums'>
                              {r.scores[rb.key]}/2
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>

                    <ActionPoint row={r} />

                    <dl className='grid gap-3 text-sm sm:grid-cols-3'>
                      <div>
                        <dt className='text-muted-foreground mb-1 text-[10px] font-semibold tracking-wider uppercase'>
                          Yi target 2026
                        </dt>
                        <dd className='leading-snug'>{r.target}</dd>
                      </div>
                      <div>
                        <dt className='text-muted-foreground mb-1 text-[10px] font-semibold tracking-wider uppercase'>
                          TN department
                        </dt>
                        <dd className='leading-snug'>{r.dept}</dd>
                      </div>
                      <div>
                        <dt className='text-muted-foreground mb-1 text-[10px] font-semibold tracking-wider uppercase'>
                          Strategic note
                        </dt>
                        <dd className='leading-snug'>{r.action}</dd>
                      </div>
                    </dl>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </TabsContent>

      {/* ─────────────── Chapters ─────────────── */}
      <TabsContent value='chapters'>
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {CHAPTER_ROWS.map(c => (
            <div key={c.chapter} className='bg-card rounded-lg border p-4'>
              <div className='mb-2 flex items-center justify-between gap-2'>
                <h3 className='text-base font-bold'>{c.chapter}</h3>
                <Para value={c.para} />
              </div>
              <p className='text-muted-foreground mb-3 text-xs leading-snug'>
                {c.named}
              </p>
              <p className='mb-3 text-sm leading-snug'>{c.scheme}</p>
              <Badge variant='secondary' className='mb-2 text-[10px]'>
                Lead: {c.vertical}
              </Badge>
              <p className='text-sm leading-snug font-medium'>{c.move}</p>
            </div>
          ))}
        </div>
      </TabsContent>

      {/* ─────────────── Gaps & cautions ─────────────── */}
      <TabsContent value='gaps'>
        <div className='space-y-3'>
          {GAP_ROWS.map((g, i) => (
            <div key={i} className='bg-card rounded-lg border p-4'>
              <div className='mb-2 flex flex-wrap items-center gap-2'>
                <span
                  className={cn(
                    'rounded px-2 py-0.5 text-[11px] font-semibold',
                    g.type.startsWith('Gap')
                      ? BAND_STYLES['Re-scope first']
                      : g.type === 'Do not chase'
                        ? 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200'
                        : BAND_STYLES['Not this year']
                  )}
                >
                  {g.type}
                </span>
                <Para value={g.para} />
                {g.crore != null && (
                  <span className='text-muted-foreground font-mono text-[11px] tabular-nums'>
                    ₹{g.crore.toLocaleString('en-IN')} cr
                  </span>
                )}
              </div>
              <h3 className='text-sm font-bold'>{g.item}</h3>
              <p className='text-muted-foreground mt-0.5 text-sm leading-snug'>
                {g.detail}
              </p>
              <p className='mt-2 mb-3 text-sm leading-snug font-medium'>
                {g.recommendation}
              </p>
              <div
                className={cn(
                  'rounded-md border p-3',
                  g.type === 'Do not chase'
                    ? 'bg-muted/40'
                    : 'bg-primary/[0.04] border-primary/25'
                )}
              >
                <div className='mb-1.5 flex flex-wrap items-center gap-2'>
                  <Target
                    className={cn(
                      'size-3.5',
                      g.type === 'Do not chase'
                        ? 'text-muted-foreground'
                        : 'text-primary'
                    )}
                  />
                  <span
                    className={cn(
                      'text-[10px] font-bold tracking-wider uppercase',
                      g.type === 'Do not chase'
                        ? 'text-muted-foreground'
                        : 'text-primary'
                    )}
                  >
                    {g.type === 'Do not chase' ? 'Hold the line' : 'Do this first'}
                  </span>
                  <EffortChip effort={g.effort} />
                </div>
                <p className='text-sm leading-snug font-medium'>{g.firstStep}</p>
                <p className='text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs'>
                  <span className='flex items-center gap-1.5'>
                    <User className='size-3.5' />
                    {g.owner}
                  </span>
                  <span className='flex items-center gap-1.5'>
                    <Calendar className='size-3.5' />
                    {g.window}
                  </span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </TabsContent>

      {/* ─────────────── SRTN leads ─────────────── */}
      <TabsContent value='leads'>
        <p className='text-muted-foreground mb-4 text-xs'>
          From the Pathfinder 2026 vertical one-pagers. Contact numbers are
          deliberately omitted — this page is public.
        </p>
        <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-3'>
          {LEAD_ROWS.map((l, i) => (
            <div
              key={i}
              className='bg-card flex items-center justify-between gap-3 rounded-lg border p-3'
            >
              <div className='min-w-0'>
                <p className='truncate text-sm font-semibold'>{l.name}</p>
                <p className='text-muted-foreground truncate text-xs'>
                  {l.vertical} · {l.chapter}
                </p>
              </div>
              <Badge
                variant={l.role.includes('National') ? 'default' : 'outline'}
                className='shrink-0 text-[10px]'
              >
                {l.role}
              </Badge>
            </div>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  )
}
