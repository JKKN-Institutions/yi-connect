'use client';

/**
 * EngagementMetrics — footer row of 3 stat tiles: Total RSVPs, Checked In,
 * Check-in Rate %.
 */

import { Users, UserCheck, Percent } from 'lucide-react';

interface EngagementMetricsProps {
  rsvpTotal: number;
  checkedIn: number;
  checkInRate: number;
}

export function EngagementMetrics({
  rsvpTotal,
  checkedIn,
  checkInRate,
}: EngagementMetricsProps) {
  const items = [
    {
      label: 'Total RSVPs',
      value: rsvpTotal.toLocaleString('en-IN'),
      icon: Users,
      tint: 'from-blue-500/30 to-cyan-500/10',
      iconTint: 'text-blue-300',
    },
    {
      label: 'Checked In',
      value: checkedIn.toLocaleString('en-IN'),
      icon: UserCheck,
      tint: 'from-emerald-500/30 to-teal-500/10',
      iconTint: 'text-emerald-300',
    },
    {
      label: 'Check-in Rate',
      value: `${checkInRate}%`,
      icon: Percent,
      tint: 'from-orange-500/30 to-amber-500/10',
      iconTint: 'text-orange-300',
    },
  ];

  return (
    <div className='grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4'>
      {items.map(({ label, value, icon: Icon, tint, iconTint }) => (
        <div
          key={label}
          className={`flex items-center gap-4 rounded-2xl border border-white/10 bg-gradient-to-br ${tint} p-4 backdrop-blur md:p-5`}
        >
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 ${iconTint}`}
          >
            <Icon className='h-6 w-6' />
          </div>
          <div className='min-w-0'>
            <p className='text-xs font-semibold uppercase tracking-wider text-slate-300/70'>
              {label}
            </p>
            <p
              className='text-2xl font-bold text-white md:text-3xl'
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
