'use client';

import { Suspense, useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Calendar,
  Search,
  Filter,
  MapPin,
  Users,
  Globe
} from 'lucide-react';
import { NationalEventsList } from '@/components/national/national-events-list';
import { SampleDataNotice } from '@/components/national/sample-data-notice';
import type { NationalEventListItem } from '@/types/national-integration';

// Sample data for demonstration - Connect Yi National API for real data
const mockEvents: NationalEventListItem[] = [
  {
    id: '1',
    national_event_id: 'nat-1',
    title: 'Yi National Summit 2025 - Building India @100',
    event_type: 'summit',
    start_date: new Date(Date.now() + 68 * 24 * 60 * 60 * 1000).toISOString(),
    end_date: new Date(Date.now() + 70 * 24 * 60 * 60 * 1000).toISOString(),
    city: 'Udaipur',
    status: 'registration_open',
    registration_deadline: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString(),
    max_participants: 600,
    current_registrations: 423,
    is_featured: true,
    is_virtual: false
  },
  {
    id: '2',
    national_event_id: 'nat-2',
    title: 'South Zone RCM - Q1 2025',
    event_type: 'rcm',
    start_date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
    end_date: new Date(Date.now() + 22 * 24 * 60 * 60 * 1000).toISOString(),
    city: 'Bengaluru',
    status: 'registration_open',
    registration_deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    max_participants: 300,
    current_registrations: 198,
    is_featured: false,
    is_virtual: false
  },
  {
    id: '3',
    national_event_id: 'nat-3',
    title: 'West Zone RCM - Q1 2025',
    event_type: 'rcm',
    start_date: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(),
    end_date: new Date(Date.now() + 29 * 24 * 60 * 60 * 1000).toISOString(),
    city: 'Ahmedabad',
    status: 'registration_open',
    registration_deadline: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
    max_participants: 250,
    current_registrations: 112,
    is_featured: false,
    is_virtual: false
  },
  {
    id: '4',
    national_event_id: 'nat-4',
    title: 'Yuva Conclave 2025 - Igniting Young Minds',
    event_type: 'yuva_conclave',
    start_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    end_date: new Date(Date.now() + 92 * 24 * 60 * 60 * 1000).toISOString(),
    city: 'Hyderabad',
    status: 'upcoming',
    registration_deadline: new Date(Date.now() + 75 * 24 * 60 * 60 * 1000).toISOString(),
    max_participants: 1500,
    current_registrations: 0,
    is_featured: true,
    is_virtual: false
  },
  {
    id: '5',
    national_event_id: 'nat-5',
    title: 'Chapter Chair Leadership Bootcamp',
    event_type: 'training',
    start_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    end_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    city: null,
    status: 'registration_open',
    registration_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    max_participants: 150,
    current_registrations: 124,
    is_featured: false,
    is_virtual: true
  },
  {
    id: '6',
    national_event_id: 'nat-6',
    title: 'Yi Startup Ecosystem Summit',
    event_type: 'conference',
    start_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
    end_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
    city: 'Pune',
    status: 'registration_open',
    registration_deadline: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString(),
    max_participants: 400,
    current_registrations: 156,
    is_featured: true,
    is_virtual: false
  },
  {
    id: '7',
    national_event_id: 'nat-7',
    title: 'NIMHANS Mental Health ToT Program',
    event_type: 'training',
    start_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    end_date: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000).toISOString(),
    city: 'Bengaluru',
    status: 'registration_open',
    registration_deadline: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
    max_participants: 50,
    current_registrations: 42,
    is_featured: false,
    is_virtual: false
  },
  {
    id: '8',
    national_event_id: 'nat-8',
    title: 'North Zone RCM - Q1 2025',
    event_type: 'rcm',
    start_date: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString(),
    end_date: new Date(Date.now() + 36 * 24 * 60 * 60 * 1000).toISOString(),
    city: 'Jaipur',
    status: 'upcoming',
    registration_deadline: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(),
    max_participants: 280,
    current_registrations: 0,
    is_featured: false,
    is_virtual: false
  }
];

export default function NationalEventsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Note: This is a client component. Role-based access control is enforced
  // at the layout level for the /national route segment.
  // If additional protection is needed, implement server-side checks in the data fetching layer.

  // Filter events based on search and filters
  const filteredEvents = mockEvents.filter((event) => {
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = eventTypeFilter === 'all' || event.event_type === eventTypeFilter;
    const matchesStatus = statusFilter === 'all' || event.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const upcomingCount = mockEvents.filter(
    (e) => e.status === 'upcoming' || e.status === 'registration_open'
  ).length;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">National Events</h1>
          <p className="text-muted-foreground">
            Register for RCMs, Summits, Conclaves, and Training Programs
          </p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          <Calendar className="h-4 w-4 mr-2" />
          {upcomingCount} Upcoming
        </Badge>
      </div>

      {/* Sample Data Notice */}
      <SampleDataNotice module="National Events" />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockEvents.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Registration Open</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockEvents.filter((e) => e.status === 'registration_open').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In-Person</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockEvents.filter((e) => !e.is_virtual).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Virtual</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockEvents.filter((e) => e.is_virtual).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Event Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="rcm">Regional Chapter Meet</SelectItem>
                <SelectItem value="summit">Yi Summit</SelectItem>
                <SelectItem value="yuva_conclave">Yuva Conclave</SelectItem>
                <SelectItem value="national_meet">National Meeting</SelectItem>
                <SelectItem value="training">Training Program</SelectItem>
                <SelectItem value="workshop">Workshop</SelectItem>
                <SelectItem value="conference">Conference</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="registration_open">Registration Open</SelectItem>
                <SelectItem value="registration_closed">Registration Closed</SelectItem>
                <SelectItem value="ongoing">Ongoing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Events List */}
      <NationalEventsList events={filteredEvents} showActions={true} />
    </div>
  );
}
