"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/yip/ui/card";
import { Button } from "@/components/yip/ui/button";
import { Input } from "@/components/yip/ui/input";
import { Textarea } from "@/components/yip/ui/textarea";
import { Badge } from "@/components/yip/ui/badge";
import { ListTodo, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  createVolunteerTask,
  deleteVolunteerTask,
  listVolunteerTasks,
  type VolunteerTask,
} from "@/app/yip/actions/volunteer-station";

/**
 * Organiser-side management of the runner / organiser-helper task feed.
 * Posts short jobs that runner + organiser_helper volunteers see (and mark done)
 * in their kiosk. canManage is enforced server-side in every action.
 */
export function VolunteerTasksManager({
  eventId,
  initialTasks,
}: {
  eventId: string;
  initialTasks: VolunteerTask[];
}) {
  const [tasks, setTasks] = useState<VolunteerTask[]>(initialTasks);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [isPending, startTransition] = useTransition();

  async function refresh() {
    const r = await listVolunteerTasks(eventId);
    if (r.success) setTasks(r.data);
  }

  function add() {
    if (title.trim().length < 3) {
      toast.error("Task title must be at least 3 characters");
      return;
    }
    startTransition(async () => {
      const r = await createVolunteerTask(eventId, title, detail);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success("Task posted to the runner feed");
      setTitle("");
      setDetail("");
      await refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const r = await deleteVolunteerTask(eventId, id);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      await refresh();
    });
  }

  const open = tasks.filter((t) => t.status === "open");
  const done = tasks.filter((t) => t.status !== "open");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ListTodo className="size-5 text-emerald-600" />
          Runner Tasks
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
            {open.length} open
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Post short jobs for your Runner &amp; Organiser-Helper volunteers — they
          see these in their kiosk and tap Done when finished.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add task */}
        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task (e.g. Take water to the Speaker's table)"
          />
          <Textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Optional detail / where / who…"
            rows={2}
          />
          <Button
            onClick={add}
            disabled={isPending || title.trim().length < 3}
            className="bg-emerald-600 hover:bg-emerald-700"
            size="sm"
          >
            <Plus className="size-4 mr-1" />
            Post task
          </Button>
        </div>

        {/* Open tasks */}
        {open.length > 0 && (
          <div className="space-y-2">
            {open.map((t) => (
              <TaskRow key={t.id} task={t} onDelete={() => remove(t.id)} disabled={isPending} />
            ))}
          </div>
        )}

        {/* Done */}
        {done.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Completed ({done.length})
            </p>
            {done.slice(0, 10).map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-1.5 text-sm"
              >
                <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                <span className="line-through text-muted-foreground truncate flex-1">
                  {t.title}
                </span>
                <button
                  type="button"
                  onClick={() => remove(t.id)}
                  disabled={isPending}
                  className="text-muted-foreground/50 hover:text-red-600 disabled:opacity-40"
                  aria-label="Delete task"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {tasks.length === 0 && (
          <p className="py-2 text-center text-sm text-muted-foreground">
            No tasks yet. Post one above and it appears instantly in the runner
            volunteers&apos; kiosk.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function TaskRow({
  task,
  onDelete,
  disabled,
}: {
  task: VolunteerTask;
  onDelete: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-start gap-2 rounded-md border px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-800">{task.title}</p>
        {task.detail && (
          <p className="text-xs text-muted-foreground mt-0.5">{task.detail}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onDelete}
        disabled={disabled}
        className="text-muted-foreground/50 hover:text-red-600 disabled:opacity-40"
        aria-label="Delete task"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}
