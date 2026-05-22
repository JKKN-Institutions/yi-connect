'use client';

/**
 * LiveClock — wall clock in IST (Asia/Kolkata), updates every second.
 * SSR-safe: renders placeholder on server, hydrates to live time on client.
 */

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

const TZ = 'Asia/Kolkata';

function formatIST(d: Date) {
  const time = new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: TZ,
  }).format(d);
  const date = new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    timeZone: TZ,
  }).format(d);
  return { time, date };
}

export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    return (
      <div className='flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-300'>
        <Clock className='h-4 w-4' />
        <span className='tabular-nums'>--:--:--</span>
      </div>
    );
  }

  const { time, date } = formatIST(now);

  return (
    <div className='flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-right md:px-5 md:py-3'>
      <Clock className='h-4 w-4 text-orange-300 md:h-5 md:w-5' />
      <div>
        <p
          className='text-base font-bold leading-tight text-white md:text-xl'
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {time}
        </p>
        <p className='text-[10px] uppercase tracking-wider text-slate-400 md:text-xs'>
          {date} IST
        </p>
      </div>
    </div>
  );
}
