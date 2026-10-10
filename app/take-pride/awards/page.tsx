import type { Metadata } from "next";
import { getRevealFeed, type FeedItem } from "@/lib/take-pride/recognitions-bridge";
import { AwardsScreen } from "./screen";
import "./awards.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Awards Night" };

export default async function AwardsNightPage() {
  let initial: { eventName: string | null; items: FeedItem[] } = { eventName: null, items: [] };
  try {
    initial = await getRevealFeed();
  } catch {
    // The screen keeps polling; a first-load failure just starts empty.
  }
  return <AwardsScreen initial={initial} />;
}
