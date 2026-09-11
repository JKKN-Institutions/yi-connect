import type { Metadata } from "next";
import { getVarnamAccess } from "@/lib/varnam/auth/access";
import { Forbidden403 } from "@/app/varnam-vizha/_components/Forbidden403";
import {
  getTaskBoard,
  getTaskEventOptions,
  diffDays,
  type TaskRow,
} from "@/lib/varnam/data/tasks";
import { AddTaskForm } from "./_components/AddTaskForm";
import {
  TaskToggle,
  TaskDeleteButton,
} from "./_components/TaskRowActions";

export const metadata: Metadata = { title: "Tasks" };

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        timeZone: "Asia/Kolkata",
      })
    : null;

function Chip({
  children,
  tone = "plum",
}: {
  children: React.ReactNode;
  tone?: "plum" | "teal" | "magenta" | "marigold";
}) {
  const tones = {
    plum: "bg-[#3B0A45]/8 text-[#3B0A45]/70",
    teal: "bg-[#0CA4A5]/10 text-[#0a8485]",
    magenta: "bg-[#D6336C]/10 text-[#b02a59]",
    marigold: "bg-[#F4A300]/15 text-[#8a5c00]",
  } as const;
  return (
    <span
      className={`inline-flex max-w-[14rem] items-center truncate rounded-full px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** One task row: toggle · title + chips · due date · delete. */
function TaskItem({
  task,
  today,
  canManage,
  tinted = false,
}: {
  task: TaskRow;
  today: string;
  canManage: boolean;
  tinted?: boolean;
}) {
  const isDone = task.status === "done";
  const daysLate =
    !isDone && task.due_date && task.due_date < today
      ? diffDays(task.due_date, today)
      : 0;

  return (
    <li
      className={`flex items-start gap-3 rounded-xl border p-3.5 ${
        tinted
          ? "border-[#D6336C]/25 bg-[#D6336C]/5"
          : "border-[#3B0A45]/8 bg-white"
      }`}
    >
      {canManage ? (
        <TaskToggle taskId={task.id} done={isDone} title={task.title} />
      ) : (
        <span
          className={`mt-0.5 inline-flex size-5 shrink-0 rounded-full border ${
            isDone ? "border-[#0CA4A5] bg-[#0CA4A5]" : "border-[#3B0A45]/20"
          }`}
        />
      )}

      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium ${
            isDone ? "text-[#2B0A33]/45 line-through" : "text-[#2B0A33]"
          }`}
        >
          {task.title}
        </p>
        {task.details && (
          <p className="mt-0.5 text-xs text-[#2B0A33]/55">{task.details}</p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {task.owner_name && <Chip>{task.owner_name}</Chip>}
          {task.event_title && <Chip tone="teal">{task.event_title}</Chip>}
          {task.due_date && (
            <Chip tone={daysLate > 0 ? "magenta" : "marigold"}>
              {daysLate > 0
                ? `${fmtDate(task.due_date)} · ${daysLate} day${daysLate === 1 ? "" : "s"} late`
                : `Due ${fmtDate(task.due_date)}`}
            </Chip>
          )}
        </div>
      </div>

      {canManage && <TaskDeleteButton taskId={task.id} title={task.title} />}
    </li>
  );
}

function SectionHeading({
  children,
  count,
  accent = false,
}: {
  children: React.ReactNode;
  count: number;
  accent?: boolean;
}) {
  return (
    <h2
      className={`mb-3 font-[family-name:var(--font-vv-display)] text-lg font-bold ${
        accent ? "text-[#b02a59]" : "text-[#3B0A45]"
      }`}
    >
      {children}{" "}
      <span className="text-sm font-semibold opacity-60">({count})</span>
    </h2>
  );
}

export default async function TasksPage() {
  const access = await getVarnamAccess();
  if (!access.canView) return <Forbidden403 reason={access.reason} />;

  const [board, eventOptions] = await Promise.all([
    getTaskBoard(),
    getTaskEventOptions(),
  ]);
  const { today } = board;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-vv-display)] text-3xl font-bold text-[#3B0A45]">
          Tasks &amp; follow-ups
        </h1>
        <p className="mt-1 text-sm text-[#2B0A33]/60">
          Every &quot;who&apos;s chasing what&quot; in one place — instead of a
          WhatsApp scroll at 1&nbsp;AM.
        </p>
      </div>

      {access.canManage && (
        <div className="mb-8">
          <AddTaskForm events={eventOptions} />
        </div>
      )}

      {/* ⚠ Overdue */}
      {board.overdue.length > 0 && (
        <section className="mb-8">
          <SectionHeading count={board.overdue.length} accent>
            ⚠ Overdue
          </SectionHeading>
          <ul className="space-y-2">
            {board.overdue.map((t) => (
              <TaskItem
                key={t.id}
                task={t}
                today={today}
                canManage={access.canManage}
                tinted
              />
            ))}
          </ul>
        </section>
      )}

      {/* This week */}
      <section className="mb-8">
        <SectionHeading count={board.dueThisWeek.length}>
          This week
        </SectionHeading>
        {board.dueThisWeek.length === 0 ? (
          <p className="text-sm text-[#2B0A33]/50">
            Nothing due in the next 7 days.
          </p>
        ) : (
          <ul className="space-y-2">
            {board.dueThisWeek.map((t) => (
              <TaskItem
                key={t.id}
                task={t}
                today={today}
                canManage={access.canManage}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Milestones timeline */}
      <section className="mb-8">
        <SectionHeading count={board.milestones.length}>
          Milestones
        </SectionHeading>
        {board.milestones.length === 0 ? (
          <p className="text-sm text-[#2B0A33]/50">
            No milestones on the master calendar yet.
          </p>
        ) : (
          <ol className="overflow-hidden rounded-2xl border border-[#3B0A45]/10 bg-white shadow-sm">
            {board.milestones.map((m) => {
              const isDone = m.status === "done";
              const isLate = !isDone && !!m.due_date && m.due_date < today;
              const daysToGo = m.due_date ? diffDays(today, m.due_date) : null;
              return (
                <li
                  key={m.id}
                  className="flex items-center gap-3 border-b border-[#3B0A45]/6 px-4 py-3 last:border-0"
                >
                  {access.canManage ? (
                    <TaskToggle taskId={m.id} done={isDone} title={m.title} />
                  ) : (
                    <span
                      className={`inline-flex size-5 shrink-0 rounded-full border ${
                        isDone
                          ? "border-[#0CA4A5] bg-[#0CA4A5]"
                          : "border-[#3B0A45]/20"
                      }`}
                    />
                  )}
                  <span className="w-16 shrink-0 text-xs font-semibold text-[#2B0A33]/55">
                    {fmtDate(m.due_date) ?? "—"}
                  </span>
                  <span
                    className={`min-w-0 flex-1 truncate text-sm font-medium ${
                      isDone
                        ? "text-[#2B0A33]/45 line-through"
                        : "text-[#2B0A33]"
                    }`}
                  >
                    {m.title}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {isDone ? (
                      <Chip tone="teal">Done</Chip>
                    ) : isLate ? (
                      <Chip tone="magenta">Late</Chip>
                    ) : (
                      <Chip tone="marigold">
                        {daysToGo === 0
                          ? "Today"
                          : daysToGo !== null
                            ? `In ${daysToGo} day${daysToGo === 1 ? "" : "s"}`
                            : "Upcoming"}
                      </Chip>
                    )}
                    {access.canManage && (
                      <TaskDeleteButton taskId={m.id} title={m.title} />
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* Later */}
      <section className="mb-8">
        <SectionHeading count={board.later.length}>Later</SectionHeading>
        {board.later.length === 0 ? (
          <p className="text-sm text-[#2B0A33]/50">
            No tasks beyond this week.
          </p>
        ) : (
          <ul className="space-y-2">
            {board.later.map((t) => (
              <TaskItem
                key={t.id}
                task={t}
                today={today}
                canManage={access.canManage}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Done (collapsed) */}
      <details className="group rounded-2xl border border-[#3B0A45]/10 bg-white p-4 shadow-sm">
        <summary className="cursor-pointer select-none font-[family-name:var(--font-vv-display)] text-base font-bold text-[#3B0A45]">
          Done{" "}
          <span className="text-sm font-semibold opacity-60">
            ({board.done.length})
          </span>
        </summary>
        {board.done.length === 0 ? (
          <p className="mt-3 text-sm text-[#2B0A33]/50">
            Nothing finished yet — it&apos;ll pile up here.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {board.done.map((t) => (
              <TaskItem
                key={t.id}
                task={t}
                today={today}
                canManage={access.canManage}
              />
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}
