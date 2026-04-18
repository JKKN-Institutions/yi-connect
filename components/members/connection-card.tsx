'use client';

/**
 * ConnectionCard — single connection tile in the address book.
 * Supports inline note edit + delete.
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Building2, Linkedin, MapPin, Pencil, Trash2, Users, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import type { ConnectionWithMember } from '@/types/connection';
import {
  deleteConnection,
  updateConnectionNote,
} from '@/app/actions/connections';

interface Props {
  connection: ConnectionWithMember;
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function ConnectionCard({ connection }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [note, setNote] = useState(connection.note ?? '');
  const [currentNote, setCurrentNote] = useState(connection.note ?? '');
  const [isPending, startTransition] = useTransition();

  const tm = connection.to_member;

  const handleSave = () => {
    startTransition(async () => {
      const res = await updateConnectionNote({
        connectionId: connection.id,
        note: note.trim().length > 0 ? note.trim() : null,
      });
      if (!res.success) {
        toast.error(res.error ?? 'Could not save note');
        return;
      }
      setCurrentNote(note.trim());
      setIsEditing(false);
      toast.success('Note saved');
    });
  };

  const handleDelete = () => {
    if (!confirm('Remove this connection?')) return;
    startTransition(async () => {
      const res = await deleteConnection(connection.id);
      if (!res.success) {
        toast.error(res.error ?? 'Could not remove');
        return;
      }
      toast.success('Removed');
    });
  };

  return (
    <Card>
      <CardContent className='p-4'>
        <div className='flex items-start gap-3'>
          <Avatar className='h-12 w-12'>
            <AvatarImage src={tm.avatar_url ?? undefined} alt={tm.full_name} />
            <AvatarFallback className='bg-primary/10 text-primary'>
              {initials(tm.full_name)}
            </AvatarFallback>
          </Avatar>

          <div className='min-w-0 flex-1 space-y-1'>
            <div className='flex items-start justify-between gap-2'>
              <div className='min-w-0'>
                <Link
                  href={`/members/${tm.id}`}
                  className='font-semibold hover:underline truncate block'
                >
                  {tm.full_name}
                </Link>
                {(tm.designation || tm.company) && (
                  <p className='text-xs text-muted-foreground truncate'>
                    {[tm.designation, tm.company].filter(Boolean).join(' at ')}
                  </p>
                )}
              </div>
              {connection.is_mutual && (
                <Badge variant='secondary' className='shrink-0'>
                  <Users className='mr-1 h-3 w-3' />
                  Mutual
                </Badge>
              )}
            </div>

            <div className='flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground'>
              {tm.chapter_name && (
                <span className='inline-flex items-center gap-1'>
                  <MapPin className='h-3 w-3' />
                  {tm.chapter_name}
                </span>
              )}
              {tm.company && (
                <span className='inline-flex items-center gap-1'>
                  <Building2 className='h-3 w-3' />
                  {tm.company}
                </span>
              )}
              {tm.linkedin_url && (
                <a
                  href={tm.linkedin_url}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='inline-flex items-center gap-1 text-primary hover:underline'
                >
                  <Linkedin className='h-3 w-3' />
                  LinkedIn
                </a>
              )}
            </div>

            {isEditing ? (
              <div className='space-y-2 pt-1'>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder='Where you met, what you talked about…'
                  rows={2}
                  maxLength={500}
                  className='text-sm'
                />
                <div className='flex gap-2'>
                  <Button
                    size='sm'
                    onClick={handleSave}
                    disabled={isPending}
                  >
                    <Check className='mr-1 h-3 w-3' />
                    Save
                  </Button>
                  <Button
                    size='sm'
                    variant='ghost'
                    onClick={() => {
                      setNote(currentNote);
                      setIsEditing(false);
                    }}
                    disabled={isPending}
                  >
                    <X className='mr-1 h-3 w-3' />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : currentNote ? (
              <p className='rounded bg-muted/40 p-2 text-xs italic text-muted-foreground'>
                &ldquo;{currentNote}&rdquo;
              </p>
            ) : null}

            <div className='flex items-center justify-between pt-1 text-xs text-muted-foreground'>
              <span>
                Added {new Date(connection.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
              <div className='flex items-center gap-1'>
                {!isEditing && (
                  <Button
                    variant='ghost'
                    size='sm'
                    className='h-7 px-2'
                    onClick={() => setIsEditing(true)}
                  >
                    <Pencil className='h-3 w-3' />
                  </Button>
                )}
                <Button
                  variant='ghost'
                  size='sm'
                  className='h-7 px-2 text-destructive hover:text-destructive'
                  onClick={handleDelete}
                  disabled={isPending}
                >
                  <Trash2 className='h-3 w-3' />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
