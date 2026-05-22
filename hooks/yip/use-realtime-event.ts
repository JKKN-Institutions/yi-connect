"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/yip/supabase/client";
import type { Tables } from "@/types/yip/database";

type Event = Tables<"events">;
type AgendaItem = Tables<"agenda_items">;

interface RealtimeEventState {
  event: Event | null;
  agendaItems: AgendaItem[];
  currentAgendaItem: AgendaItem | null;
  loading: boolean;
}

/**
 * useRealtimeEvent — Subscribes to Supabase Realtime for live event updates.
 *
 * When the moderator advances agenda or starts timer, all connected clients
 * see the change immediately via Postgres CDC (Change Data Capture).
 */
export function useRealtimeEvent(
  eventId: string,
  initialEvent?: Event | null,
  initialAgendaItems?: AgendaItem[]
): RealtimeEventState {
  const supabase = createClient();
  const [event, setEvent] = useState<Event | null>(initialEvent ?? null);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>(
    initialAgendaItems ?? []
  );
  const [loading, setLoading] = useState(!initialEvent);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch initial data if not provided
  const fetchData = useCallback(async () => {
    const [eventRes, agendaRes] = await Promise.all([
      supabase.from("events").select("*").eq("id", eventId).single(),
      supabase
        .from("agenda_items")
        .select("*")
        .eq("event_id", eventId)
        .order("day")
        .order("sequence_order"),
    ]);

    if (eventRes.data) setEvent(eventRes.data);
    if (agendaRes.data) setAgendaItems(agendaRes.data);
    setLoading(false);
  }, [eventId, supabase]);

  useEffect(() => {
    if (!initialEvent) {
      fetchData();
    }
  }, [initialEvent, fetchData]);

  // Set up Realtime subscription
  useEffect(() => {
    // Clean up any existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`event-live-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "events",
          filter: `id=eq.${eventId}`,
        },
        (payload) => {
          if (payload.eventType === "UPDATE" && payload.new) {
            setEvent(payload.new as Event);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agenda_items",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          if (payload.eventType === "UPDATE" && payload.new) {
            const updated = payload.new as AgendaItem;
            setAgendaItems((prev) =>
              prev.map((item) => (item.id === updated.id ? updated : item))
            );
          } else if (payload.eventType === "INSERT" && payload.new) {
            const newItem = payload.new as AgendaItem;
            setAgendaItems((prev) =>
              [...prev, newItem].sort((a, b) => {
                if (a.day !== b.day) return a.day - b.day;
                return a.sequence_order - b.sequence_order;
              })
            );
          } else if (payload.eventType === "DELETE" && payload.old) {
            const deleted = payload.old as Partial<AgendaItem>;
            setAgendaItems((prev) =>
              prev.filter((item) => item.id !== deleted.id)
            );
          }
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          // Reconnect after a brief delay
          setTimeout(() => {
            fetchData();
          }, 2000);
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // Derive current agenda item from event + items
  const currentAgendaItem =
    event?.current_agenda_item_id
      ? agendaItems.find((i) => i.id === event.current_agenda_item_id) ?? null
      : null;

  return { event, agendaItems, currentAgendaItem, loading };
}
