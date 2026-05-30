"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, CheckCircle2, Loader2, MapPin } from "lucide-react";
import { Badge } from "@/components/yip/ui/badge";
import { Button } from "@/components/yip/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/yip/ui/card";
import { YI_ZONES, type YiZone } from "@/lib/yip/hierarchy";
import { assignTopicsToEvent, type Topic } from "@/app/yip/actions/topics";

export function TopicsEventClient({
  eventId,
  eventLevel,
  eventZone,
  centralTopics,
  regionalTopics,
  assignedTopicIds,
}: {
  eventId: string;
  eventLevel: "chapter" | "regional" | "national";
  eventZone: YiZone | null;
  centralTopics: Topic[];
  regionalTopics: Topic[];
  assignedTopicIds: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  // Central topics are pre-populated nationally — default all checked.
  // (User can still uncheck if they want a custom subset for this event.)
  const initialCentralSelected = useMemo(() => {
    const assignedSet = new Set(assignedTopicIds);
    // If any central topic is already assigned, treat assignments as the
    // source of truth. Otherwise pre-select all central topics.
    const anyCentralAssigned = centralTopics.some((t) => assignedSet.has(t.id));
    if (anyCentralAssigned) {
      return new Set(
        centralTopics.filter((t) => assignedSet.has(t.id)).map((t) => t.id)
      );
    }
    return new Set(centralTopics.map((t) => t.id));
  }, [centralTopics, assignedTopicIds]);

  const initialRegionalSelected = useMemo(() => {
    const assignedSet = new Set(assignedTopicIds);
    return new Set(
      regionalTopics.filter((t) => assignedSet.has(t.id)).map((t) => t.id)
    );
  }, [regionalTopics, assignedTopicIds]);

  const [centralSelected, setCentralSelected] =
    useState<Set<string>>(initialCentralSelected);
  const [regionalSelected, setRegionalSelected] =
    useState<Set<string>>(initialRegionalSelected);

  const isChapter = eventLevel === "chapter";
  const regionalCount = regionalSelected.size;
  const enforceFive = isChapter;
  const exactlyFive = regionalCount === 5;
  const canSave = enforceFive ? exactlyFive : true;

  function toggleCentral(id: string) {
    setCentralSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleRegional(id: string) {
    setRegionalSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        // For chapter events, block selecting more than 5.
        if (enforceFive && next.size >= 5) return prev;
        next.add(id);
      }
      return next;
    });
  }

  function save() {
    setError(null);
    const allIds = [
      ...Array.from(centralSelected),
      ...Array.from(regionalSelected),
    ];
    startTransition(async () => {
      const res = await assignTopicsToEvent(eventId, allIds, false);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setFlash(`Saved ${res.data.assigned} topics`);
      setTimeout(() => setFlash(null), 2500);
      router.refresh();
    });
  }

  const zoneLabel =
    YI_ZONES.find((z) => z.code === eventZone)?.label ?? eventZone ?? "—";

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#1a1a3e] flex items-center gap-2">
            <BookOpen className="size-6 text-[#FF9933]" /> Committee Topics
          </h2>
          <p className="text-sm text-[#1a1a3e]/60 mt-1">
            {isChapter
              ? "Chapter events use 5 central topics + exactly 5 regional committee topics."
              : `${eventLevel.charAt(0).toUpperCase()}${eventLevel.slice(1)} event — pick any number of topics.`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {enforceFive && (
            <span
              className={`text-sm font-mono px-3 py-1.5 rounded-md ${
                exactlyFive
                  ? "bg-[#138808]/10 text-[#138808] border border-[#138808]/30"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {regionalCount} / 5 selected
            </span>
          )}
          <Button
            onClick={save}
            disabled={pending || !canSave}
            className="bg-[#FF9933] hover:bg-[#FF9933]/90 text-white"
          >
            {pending && <Loader2 className="size-4 mr-2 animate-spin" />}
            Save
          </Button>
        </div>
      </div>

      {flash && (
        <div className="rounded-lg bg-[#138808]/8 border border-[#138808]/15 px-4 py-2 text-sm text-[#138808] flex items-center gap-2">
          <CheckCircle2 className="size-4" />
          {flash}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Central topics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Badge className="bg-[#FF9933]/10 text-[#FF9933] border-[#FF9933]/20">
              Central
            </Badge>
            National agenda topics
            <span className="text-xs font-normal text-[#1a1a3e]/50 ml-auto">
              {centralSelected.size} of {centralTopics.length} selected
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {centralTopics.length === 0 ? (
            <p className="text-sm text-[#1a1a3e]/50">
              No active central topics in the library.
            </p>
          ) : (
            <ul className="space-y-2">
              {centralTopics.map((t) => (
                <TopicRow
                  key={t.id}
                  topic={t}
                  checked={centralSelected.has(t.id)}
                  onToggle={() => toggleCentral(t.id)}
                  disabled={pending}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Regional topics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Badge className="bg-[#138808]/10 text-[#138808] border-[#138808]/20">
              Regional
            </Badge>
            <span className="flex items-center gap-1">
              <MapPin className="size-4 text-[#1a1a3e]/40" />
              {zoneLabel}
            </span>
            <span className="text-xs font-normal text-[#1a1a3e]/50 ml-auto">
              {enforceFive ? "Pick exactly 5" : "Pick any"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!eventZone ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              This event has no zone set. Add a state on the event so the zone
              can be inferred, then return here.
            </p>
          ) : regionalTopics.length === 0 ? (
            <p className="text-sm text-[#1a1a3e]/50">
              No active regional topics for {zoneLabel}. Ask an admin to seed
              the topic library.
            </p>
          ) : (
            <ul className="space-y-2">
              {regionalTopics.map((t) => {
                const isChecked = regionalSelected.has(t.id);
                const blocked =
                  enforceFive && !isChecked && regionalSelected.size >= 5;
                return (
                  <TopicRow
                    key={t.id}
                    topic={t}
                    checked={isChecked}
                    onToggle={() => toggleRegional(t.id)}
                    disabled={pending || blocked}
                  />
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TopicRow({
  topic,
  checked,
  onToggle,
  disabled,
}: {
  topic: Topic;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <li>
      <label
        className={`flex items-start gap-3 rounded-md border p-3 transition-colors ${
          checked
            ? "bg-[#FF9933]/5 border-[#FF9933]/30"
            : "bg-white border-[#1a1a3e]/10 hover:border-[#1a1a3e]/25"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          disabled={disabled}
          className="mt-1 size-4 accent-[#FF9933]"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            {topic.topic_number != null && (
              <span className="font-mono text-xs text-[#1a1a3e]/50">
                #{topic.topic_number}
              </span>
            )}
            <span className="font-medium text-[#1a1a3e]">{topic.title}</span>
          </div>
          {topic.description && (
            <p className="text-xs text-[#1a1a3e]/60 mt-0.5 line-clamp-2">
              {topic.description}
            </p>
          )}
          {topic.sub_points.length > 0 && (
            <p className="text-xs text-[#138808] mt-1">
              <span className="text-[#1a1a3e]/40">Linked: </span>
              {topic.sub_points.join(" · ")}
            </p>
          )}
        </div>
      </label>
    </li>
  );
}
