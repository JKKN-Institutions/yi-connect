'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
  ALIGNMENT_ROWS,
  CHAPTER_ROWS,
  GAP_ROWS,
  LEAD_ROWS,
  type Alignment,
} from '@/lib/policy-alignment/tn-budget-2026'

const ALIGN_STYLES: Record<Alignment, string> = {
  Direct:
    'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  Partial: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  None: 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200',
  Internal: 'bg-muted text-muted-foreground',
}

const ALIGN_ORDER: Alignment[] = ['Direct', 'Partial', 'None', 'Internal']

function AlignBadge({ value }: { value: Alignment }) {
  return (
    <span
      className={cn(
        'inline-block rounded px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        ALIGN_STYLES[value]
      )}
    >
      {value}
    </span>
  )
}

/** Small monospace chip carrying the budget paragraph number. */
function Para({ value }: { value: string }) {
  if (!value || value === '—') {
    return <span className='text-muted-foreground text-xs'>—</span>
  }
  return (
    <span className='bg-primary/10 text-primary rounded px-1.5 py-0.5 font-mono text-[11px] whitespace-nowrap'>
      ¶{value}
    </span>
  )
}

function Stat({
  n,
  label,
  active,
  onClick,
  tone,
}: {
  n: number
  label: string
  active?: boolean
  onClick?: () => void
  tone?: string
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={onClick ? !!active : undefined}
      className={cn(
        'bg-card rounded-lg border p-4 text-left transition-colors',
        onClick && 'hover:border-primary/60 cursor-pointer',
        active && 'border-primary ring-primary/30 ring-2'
      )}
    >
      <span
        className={cn(
          'block font-mono text-2xl leading-none font-semibold tabular-nums',
          tone
        )}
      >
        {n}
      </span>
      <span className='text-muted-foreground mt-1.5 block text-xs leading-snug'>
        {label}
      </span>
    </Tag>
  )
}

export function AlignmentExplorer() {
  const [q, setQ] = useState('')
  const [pillar, setPillar] = useState<string | null>(null)
  const [vertical, setVertical] = useState<string | null>(null)
  const [align, setAlign] = useState<Alignment | null>(null)
  const [open, setOpen] = useState<Set<number>>(new Set())

  const pillars = useMemo(
    () => [...new Set(ALIGNMENT_ROWS.map(r => r.pillar))],
    []
  )
  const verticals = useMemo(
    () => [...new Set(ALIGNMENT_ROWS.map(r => r.vertical))].sort(),
    []
  )

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return ALIGNMENT_ROWS.filter(r => {
      if (pillar && r.pillar !== pillar) return false
      if (vertical && r.vertical !== vertical) return false
      if (align && r.align !== align) return false
      if (!needle) return true
      return [
        r.vertical,
        r.programme,
        r.target,
        r.scheme,
        r.dept,
        r.action,
        r.para,
      ]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
  }, [q, pillar, vertical, align])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const r of rows) c[r.align] = (c[r.align] ?? 0) + 1
    return c
  }, [rows])

  const filtered = !!(q || pillar || vertical || align)

  function reset() {
    setQ('')
    setPillar(null)
    setVertical(null)
    setAlign(null)
  }

  function toggleRow(i: number) {
    setOpen(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  return (
    <Tabs defaultValue='matrix' className='w-full'>
      <TabsList className='mb-6 flex h-auto flex-wrap justify-start gap-1'>
        <TabsTrigger value='matrix'>Alignment Matrix</TabsTrigger>
        <TabsTrigger value='chapters'>Chapters</TabsTrigger>
        <TabsTrigger value='gaps'>Gaps &amp; Cautions</TabsTrigger>
        <TabsTrigger value='leads'>SRTN Leads</TabsTrigger>
      </TabsList>

      {/* ─────────────── Alignment matrix ─────────────── */}
      <TabsContent value='matrix' className='space-y-5'>
        <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
          {ALIGN_ORDER.map(a => (
            <Stat
              key={a}
              n={counts[a] ?? 0}
              label={
                a === 'Direct'
                  ? 'Same outcome, same year'
                  : a === 'Partial'
                    ? 'Needs re-scoping to fit'
                    : a === 'None'
                      ? 'No scheme in this budget'
                      : 'Yi-facing, no policy surface'
              }
              active={align === a}
              onClick={() => setAlign(align === a ? null : a)}
              tone={
                a === 'Direct'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : a === 'Partial'
                    ? 'text-amber-600 dark:text-amber-400'
                    : a === 'None'
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-muted-foreground'
              }
            />
          ))}
        </div>

        {/* Controls */}
        <div className='space-y-3'>
          <div className='relative'>
            <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2' />
            <Input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder='Search programmes, schemes, departments…'
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

        {/* Rows */}
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
                    <div className='mb-1 flex flex-wrap items-center gap-2'>
                      <Badge variant='outline' className='text-[10px]'>
                        {r.vertical}
                      </Badge>
                      <AlignBadge value={r.align} />
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
                      {r.scheme}
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
                  <dl className='bg-muted/40 grid gap-3 px-4 pb-4 text-sm sm:grid-cols-3'>
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
                        What SRTN does
                      </dt>
                      <dd className='leading-snug font-medium'>{r.action}</dd>
                    </div>
                  </dl>
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
                      ? ALIGN_STYLES.Partial
                      : g.type === 'Do not chase'
                        ? ALIGN_STYLES.None
                        : ALIGN_STYLES.Internal
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
              <p className='mt-2 text-sm leading-snug font-medium'>
                {g.recommendation}
              </p>
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
