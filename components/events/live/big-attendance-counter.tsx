'use client';

/**
 * BigAttendanceCounter — hero tile.
 * Animates the check-in number as it climbs; shows progress bar underneath.
 */

import { useEffect } from 'react';
import {
  animate,
  motion,
  useMotionValue,
  useTransform,
  AnimatePresence,
} from 'framer-motion';

interface BigAttendanceCounterProps {
  checkedIn: number;
  rsvpTotal: number;
}

export function BigAttendanceCounter({
  checkedIn,
  rsvpTotal,
}: BigAttendanceCounterProps) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest));

  useEffect(() => {
    const controls = animate(count, checkedIn, {
      duration: 0.8,
      ease: 'easeOut',
    });
    return controls.stop;
  }, [checkedIn, count]);

  const progressPct = rsvpTotal > 0 ? (checkedIn / rsvpTotal) * 100 : 0;

  return (
    <div className='flex h-full flex-col justify-between rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur md:p-10'>
      <div>
        <p className='text-xs font-semibold uppercase tracking-[0.3em] text-orange-300/80 md:text-sm'>
          Attendance
        </p>
        <p className='mt-1 text-sm text-slate-400 md:text-base'>
          Checked in right now
        </p>
      </div>

      <div className='flex flex-col items-start'>
        <div className='flex items-baseline gap-3'>
          <motion.span
            className='text-8xl font-black leading-none tracking-tight text-white md:text-[12rem]'
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            <motion.span>{rounded}</motion.span>
          </motion.span>
          <span className='text-3xl font-semibold text-slate-400 md:text-5xl'>
            / {rsvpTotal}
          </span>
        </div>

        <AnimatePresence>
          {checkedIn > 0 && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className='mt-2 text-sm font-medium text-orange-300 md:text-base'
            >
              {Math.round(progressPct)}% of expected attendees
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Progress bar */}
      <div
        className='relative h-3 w-full overflow-hidden rounded-full bg-white/10 md:h-4'
        role='progressbar'
        aria-valuenow={Math.round(progressPct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label='Attendance progress'
      >
        <motion.div
          className='h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300'
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
