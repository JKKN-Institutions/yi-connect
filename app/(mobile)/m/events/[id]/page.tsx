/**
 * Mobile Event Detail — redirects to dashboard event detail
 *
 * The full event detail page (with RSVP) lives at /events/[id].
 * This route exists so /m/events/[id] links don't 404.
 */

import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MobileEventDetailPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/events/${id}`);
}
