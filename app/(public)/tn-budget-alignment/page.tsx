/**
 * Yi SRTN × Tamil Nadu Budget 2026-27 — public alignment explorer.
 *
 * Public by design: the main yi-connect surface protects an allowlist of
 * prefixes in lib/supabase/middleware.ts, and this route is not one of them,
 * so no middleware change is needed for it to be reachable without a session.
 */

import type { Metadata } from 'next'
import { AlignmentExplorer } from './alignment-explorer'
import { AUTHOR, SOURCE_NOTE } from '@/lib/policy-alignment/tn-budget-2026'

export const metadata: Metadata = {
  title: 'Tamil Nadu Budget 2026-27 Alignment',
  description:
    'How Yi Pathfinder 2026 verticals map to named schemes in the Tamil Nadu Revised Budget 2026-27, across the 15 SRTN chapters.',
}

export default function TnBudgetAlignmentPage() {
  return (
    <div className='mx-auto w-full max-w-7xl'>
      <header className='mb-8 border-b pb-6'>
        <p className='text-primary mb-3 text-xs font-semibold tracking-[0.18em] uppercase'>
          Policy Alignment · Yi SRTN
        </p>
        <h1 className='text-3xl leading-tight font-bold text-balance sm:text-4xl'>
          Fifteen Chapters, One Budget
        </h1>
        <p className='text-muted-foreground mt-3 max-w-3xl text-base leading-relaxed'>
          Fifteen departments, what this budget obliges each of them to deliver,
          what they are short of, and what Yi can hand over &mdash; written from
          the department&rsquo;s side of the table, not Yi&rsquo;s.
        </p>
        <p className='text-muted-foreground mt-3 max-w-3xl text-base leading-relaxed'>
          Every Yi Pathfinder 2026 programme mapped to the scheme in the Tamil
          Nadu Revised Budget 2026-27 that funds the same outcome — scored out of
          8 against a fixed rubric, with the reasoning shown, the budget
          paragraph cited, and a first move that names an owner, a window and a
          test of whether it worked.
        </p>
        <dl className='text-muted-foreground mt-5 flex flex-wrap gap-x-8 gap-y-2 text-xs'>
          <div className='flex gap-2'>
            <dt className='font-semibold'>Prepared by</dt>
            <dd>{AUTHOR}</dd>
          </div>
          <div className='flex gap-2'>
            <dt className='font-semibold'>Dated</dt>
            <dd>14 August 2026</dd>
          </div>
        </dl>
      </header>

      <AlignmentExplorer />

      <footer className='text-muted-foreground mt-12 space-y-2 border-t pt-6 text-xs leading-relaxed'>
        <p>{SOURCE_NOTE}</p>
        <p>
          Allocations are Revised Budget Estimate figures in ₹ crore for the
          named scheme. They describe the size of the policy area and are{' '}
          <strong className='text-foreground'>not</strong> funding available to
          Yi. Alignment grades are judgements, not measurements.
        </p>
        <p>
          Yi is a non-political body. Engagement is with departments and named
          schemes only.
        </p>
      </footer>
    </div>
  )
}
