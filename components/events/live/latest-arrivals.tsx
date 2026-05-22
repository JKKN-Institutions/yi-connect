'use client';

/**
 * LatestArrivals — live-updating list of the 5 most recent check-ins.
 * New rows slide in from the right; older rows slide out when displaced.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { UserRound, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { EnrichedArrival } from './live-dashboard';

interface LatestArrivalsProps {
  arrivals: EnrichedArrival[];
}

export function LatestArrivals({ arrivals }: LatestArrivalsProps) {
  return (
    <div className='flex h-full flex-col rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur md:p-8'>
      <div className='mb-4 flex items-center justify-between md:mb-6'>
        <div>
          <p className='text-xs font-semibold uppercase tracking-[0.3em] text-orange-300/80 md:text-sm'>
            Latest Arrivals
          </p>
          <p className='mt-1 text-sm text-slate-400 md:text-base'>
            Just checked in
          </p>
        </div>
        <Sparkles className='h-5 w-5 text-orange-300/80 md:h-6 md:w-6' />
      </div>

      <div className='relative flex-1 min-h-0 overflow-hidden'>
        <AnimatePresence initial={false}>
          {arrivals.length === 0 ? (
            <motion.div
              key='empty'
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className='flex h-full flex-col items-center justify-center text-center text-slate-500'
            >
              <UserRound className='mb-3 h-12 w-12 opacity-40' />
              <p className='text-sm md:text-base'>
                Waiting for first check-in...
              </p>
            </motion.div>
          ) : (
            <ul className='space-y-3 md:space-y-4'>
              <AnimatePresence initial={false}>
                {arrivals.map((arrival, idx) => (
                  <motion.li
                    key={arrival.id}
                    layout
                    initial={{ opacity: 0, x: 80 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -40 }}
                    transition={{
                      type: 'spring',
                      stiffness: 260,
                      damping: 22,
                    }}
                    className='flex items-center gap-4 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10 md:p-4'
                  >
                    <ArrivalAvatar arrival={arrival} highlight={idx === 0} />
                    <div className='min-w-0 flex-1'>
                      <p className='truncate text-base font-semibold text-white md:text-lg'>
                        {arrival.display_name}
                      </p>
                      {arrival.display_company && (
                        <p className='truncate text-xs text-slate-400 md:text-sm'>
                          {arrival.display_company}
                        </p>
                      )}
                    </div>
                    <time
                      className='shrink-0 text-[11px] font-medium uppercase tracking-wider text-slate-400 md:text-xs'
                      dateTime={arrival.checked_in_at}
                      title={new Date(arrival.checked_in_at).toLocaleString()}
                    >
                      {formatDistanceToNow(new Date(arrival.checked_in_at), {
                        addSuffix: true,
                      })}
                    </time>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ArrivalAvatar({
  arrival,
  highlight,
}: {
  arrival: EnrichedArrival;
  highlight: boolean;
}) {
  const initials = arrival.display_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

  return (
    <div
      className={`relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-white ring-2 md:h-14 md:w-14 md:text-lg ${
        highlight
          ? 'bg-gradient-to-br from-orange-500 to-amber-500 ring-orange-300'
          : 'bg-slate-700 ring-white/20'
      }`}
    >
      {arrival.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={arrival.avatar_url}
          alt=''
          className='h-full w-full object-cover'
        />
      ) : (
        <span>{initials || '•'}</span>
      )}
    </div>
  );
}
