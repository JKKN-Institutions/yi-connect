/**
 * Industrial Visit Marketplace Card
 * Displays IV information in a card format for marketplace browsing
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { IVMarketplaceItem } from '@/types/industrial-visit';
import { Building2, Calendar, Clock, MapPin, Users, Car, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import Image from 'next/image';

interface IVMarketplaceCardProps {
  iv: IVMarketplaceItem;
}

export function IVMarketplaceCard({ iv }: IVMarketplaceCardProps) {
  const startDate = new Date(iv.start_date);
  const endDate = new Date(iv.end_date);

  const capacityPercentage = iv.capacity_percentage;
  const spotsRemaining = iv.max_capacity
    ? iv.max_capacity - iv.current_registrations
    : null;

  const isAlmostFull = capacityPercentage >= 80;
  const isFull = !iv.has_capacity;
  const hasWaitlist = iv.waitlist_count > 0;

  return (
    <Card className="group hover:shadow-lg transition-shadow overflow-hidden">
      {/* Banner Image */}
      {iv.banner_image_url && (
        <div className="relative h-48 w-full overflow-hidden">
          <Image
            src={iv.banner_image_url}
            alt={iv.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {isFull && (
            <div className="absolute top-2 right-2">
              <Badge variant="destructive">Full</Badge>
            </div>
          )}
          {!isFull && isAlmostFull && (
            <div className="absolute top-2 right-2">
              <Badge variant="secondary">Almost Full</Badge>
            </div>
          )}
        </div>
      )}

      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-xl line-clamp-2 group-hover:text-primary transition-colors">
              {iv.title}
            </CardTitle>
            {iv.industry_name && (
              <CardDescription className="flex items-center gap-1 mt-2">
                <Building2 className="h-4 w-4" />
                {iv.industry_name}
                {iv.industry_sector && (
                  <span className="text-xs text-muted-foreground ml-1">
                    ({iv.industry_sector})
                  </span>
                )}
              </CardDescription>
            )}
          </div>
        </div>

        {/* Tags */}
        {iv.tags && iv.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {iv.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {iv.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{iv.tags.length - 3} more
              </Badge>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Date & Time */}
        <div className="flex items-start gap-2 text-sm">
          <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
          <div>
            <div className="font-medium">
              {format(startDate, 'EEEE, MMMM d, yyyy')}
            </div>
            <div className="text-muted-foreground text-xs">
              {format(startDate, 'h:mm a')} - {format(endDate, 'h:mm a')}
            </div>
          </div>
        </div>

        {/* Meeting Point */}
        {iv.logistics_meeting_point && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
            <span className="text-muted-foreground line-clamp-1">
              {iv.logistics_meeting_point}
            </span>
          </div>
        )}

        {/* Capacity */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {iv.current_registrations}
              {iv.max_capacity ? ` / ${iv.max_capacity}` : ''}
              {' '}registered
            </span>
          </div>
          {spotsRemaining !== null && spotsRemaining > 0 && (
            <span className="text-xs font-medium text-primary">
              {spotsRemaining} spots left
            </span>
          )}
        </div>

        {/* Capacity Bar */}
        {iv.max_capacity && (
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all ${
                capacityPercentage >= 100
                  ? 'bg-destructive'
                  : capacityPercentage >= 80
                  ? 'bg-orange-500'
                  : 'bg-primary'
              }`}
              style={{ width: `${Math.min(capacityPercentage, 100)}%` }}
            />
          </div>
        )}

        {/* Carpool Available */}
        {iv.carpool_drivers_count > 0 && (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <Car className="h-4 w-4" />
            <span>{iv.carpool_drivers_count} carpool option{iv.carpool_drivers_count > 1 ? 's' : ''} available</span>
          </div>
        )}

        {/* Waitlist Info */}
        {hasWaitlist && (
          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
            <Clock className="h-4 w-4" />
            <span>{iv.waitlist_count} on waitlist</span>
          </div>
        )}

        {/* Learning Outcomes Preview */}
        {iv.learning_outcomes && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground line-clamp-2">
              {iv.learning_outcomes}
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-2">
        {iv.has_capacity ? (
          <>
            <Button asChild className="flex-1">
              <Link href={`/industrial-visits/${iv.id}`}>
                Book Now
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/industrial-visits/${iv.id}`}>
                Details
              </Link>
            </Button>
          </>
        ) : (
          <>
            <Button asChild variant="secondary" className="flex-1">
              <Link href={`/industrial-visits/${iv.id}`}>
                Join Waitlist
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/industrial-visits/${iv.id}`}>
                Details
              </Link>
            </Button>
          </>
        )}
      </CardFooter>

      {/* Entry Method Badge */}
      <div className="absolute top-2 left-2">
        <Badge variant={iv.entry_method === 'self_service' ? 'default' : 'secondary'} className="text-xs">
          {iv.entry_method === 'self_service' ? 'Industry Hosted' : 'Chapter Organized'}
        </Badge>
      </div>
    </Card>
  );
}
