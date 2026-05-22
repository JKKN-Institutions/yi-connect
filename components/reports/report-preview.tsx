import type { ReportDataSnapshot } from '@/types/report';

interface ReportPreviewProps {
  snapshot: ReportDataSnapshot;
}

/**
 * Server-rendered compact preview of a report snapshot. Used on the
 * /reports/history detail view to show key numbers without downloading
 * the full HTML.
 */
export function ReportPreview({ snapshot }: ReportPreviewProps) {
  return (
    <div className='space-y-6'>
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
        <div className='p-4 rounded-lg bg-muted/30'>
          <div className='text-xs text-muted-foreground uppercase tracking-wide'>Events</div>
          <div className='text-2xl font-semibold mt-1'>{snapshot.events.total_count}</div>
        </div>
        <div className='p-4 rounded-lg bg-muted/30'>
          <div className='text-xs text-muted-foreground uppercase tracking-wide'>Attendance</div>
          <div className='text-2xl font-semibold mt-1'>{snapshot.events.total_attendance}</div>
        </div>
        <div className='p-4 rounded-lg bg-muted/30'>
          <div className='text-xs text-muted-foreground uppercase tracking-wide'>Verticals On Track</div>
          <div className='text-2xl font-semibold mt-1'>
            {snapshot.verticals.on_track_count} / {snapshot.verticals.list.length}
          </div>
        </div>
        <div className='p-4 rounded-lg bg-muted/30'>
          <div className='text-xs text-muted-foreground uppercase tracking-wide'>Top Members</div>
          <div className='text-2xl font-semibold mt-1'>{snapshot.top_members.length}</div>
        </div>
      </div>

      {snapshot.events.list.length > 0 && (
        <div>
          <h3 className='text-sm font-semibold mb-2'>Events</h3>
          <div className='border rounded-lg overflow-hidden'>
            <table className='w-full text-sm'>
              <thead className='bg-muted/40'>
                <tr>
                  <th className='text-left p-2'>Title</th>
                  <th className='text-right p-2'>Attended</th>
                  <th className='text-right p-2'>Rating</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.events.list.slice(0, 10).map((e) => (
                  <tr key={e.id} className='border-t'>
                    <td className='p-2 truncate max-w-xs'>{e.title}</td>
                    <td className='p-2 text-right'>
                      {e.attended_count} ({Math.round(e.attendance_rate)}%)
                    </td>
                    <td className='p-2 text-right'>
                      {e.feedback_rating !== null ? e.feedback_rating.toFixed(1) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
