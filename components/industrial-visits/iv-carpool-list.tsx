/**
 * Industrial Visit Carpool List
 * Display available carpool options for an IV
 */

import { Suspense } from 'react';
import { Car, MapPin, Users, Mail, Phone } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getCarpoolMatches } from '@/lib/data/industrial-visits';

interface IVCarpoolListProps {
  eventId: string;
}

async function CarpoolListContent({ eventId }: IVCarpoolListProps) {
  const carpoolMatches = await getCarpoolMatches(eventId);

  if (carpoolMatches.length === 0) {
    return (
      <Alert>
        <Car className="h-4 w-4" />
        <AlertDescription>
          No carpool options available yet. Be the first to offer a ride!
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {carpoolMatches.length} carpool option{carpoolMatches.length > 1 ? 's' : ''} available
      </p>

      <div className="grid gap-4">
        {carpoolMatches.map((match) => (
          <Card key={match.driver_id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{match.driver_name}</CardTitle>
                  <CardDescription>{match.driver_email}</CardDescription>
                </div>
                <Badge variant="secondary">
                  <Users className="mr-1 h-3 w-3" />
                  {match.seats_available} seat{match.seats_available > 1 ? 's' : ''}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {match.pickup_location && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{match.pickup_location}</span>
                </div>
              )}

              {match.riders_count > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>
                    {match.riders_count} {match.riders_count === 1 ? 'rider' : 'riders'} already matched
                  </span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                {match.driver_phone && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={`tel:${match.driver_phone}`}>
                      <Phone className="mr-2 h-4 w-4" />
                      Call
                    </a>
                  </Button>
                )}
                <Button variant="outline" size="sm" asChild>
                  <a href={`mailto:${match.driver_email}`}>
                    <Mail className="mr-2 h-4 w-4" />
                    Email
                  </a>
                </Button>
              </div>

              {match.matched_riders && match.matched_riders.length > 0 && (
                <div className="pt-3 border-t">
                  <p className="text-xs font-medium mb-2">Riders:</p>
                  <div className="space-y-1">
                    {match.matched_riders.map((rider) => (
                      <div
                        key={rider.id}
                        className="text-xs text-muted-foreground flex items-center gap-2"
                      >
                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                        {rider.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function CarpoolListLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-48" />
      <div className="grid gap-4">
        {[...Array(2)].map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function IVCarpoolList({ eventId }: IVCarpoolListProps) {
  return (
    <Suspense fallback={<CarpoolListLoading />}>
      <CarpoolListContent eventId={eventId} />
    </Suspense>
  );
}
