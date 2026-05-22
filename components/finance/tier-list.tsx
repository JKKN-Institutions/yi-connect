'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { TierForm } from '@/components/finance/tier-form';
import { deleteSponsorshipTier } from '@/app/actions/finance';
import { formatCurrency, SPONSORSHIP_TIER_LEVELS } from '@/types/finance';
import type { SponsorshipTier, SponsorshipTierLevel } from '@/types/finance';

interface TierListProps {
  tiers: SponsorshipTier[];
  chapterId: string;
  canEdit: boolean;
}

export function TierList({ tiers, chapterId, canEdit }: TierListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [editingTier, setEditingTier] = useState<SponsorshipTier | null>(null);
  const [deletingTier, setDeletingTier] = useState<SponsorshipTier | null>(null);

  const handleDelete = () => {
    if (!deletingTier) return;
    startTransition(async () => {
      const result = await deleteSponsorshipTier(deletingTier.id);
      if (result.success) {
        toast.success('Tier deleted');
        setDeletingTier(null);
        router.refresh();
      } else {
        toast.error(result.message || 'Failed to delete tier');
      }
    });
  };

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-end'>
        {canEdit && (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className='mr-2 h-4 w-4' />
            Add Tier
          </Button>
        )}
      </div>

      {tiers.length === 0 ? (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-16'>
            <div className='text-center space-y-2'>
              <p className='text-lg font-medium'>No tiers configured yet</p>
              <p className='text-sm text-muted-foreground max-w-md'>
                Create sponsorship tiers to give structure to your fundraising
                packages. Each tier can include a benefits checklist,
                minimum / maximum amounts and a color.
              </p>
              {canEdit && (
                <Button className='mt-3' onClick={() => setShowCreate(true)}>
                  <Plus className='mr-2 h-4 w-4' />
                  Create Your First Tier
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
          {tiers.map((tier) => {
            const benefits =
              (tier.benefits as Array<{ label: string; included: boolean }> | null) ??
              [];
            const tierLevel = tier.tier_level as SponsorshipTierLevel;
            const badge = SPONSORSHIP_TIER_LEVELS[tierLevel];

            return (
              <Card key={tier.id} className='flex flex-col'>
                <CardHeader>
                  <div className='flex items-start justify-between gap-3'>
                    <div className='space-y-1'>
                      <CardTitle className='flex items-center gap-2 text-lg'>
                        {tier.color && (
                          <span
                            className='inline-block h-3 w-3 rounded-full ring-1 ring-black/5'
                            style={{ backgroundColor: tier.color }}
                            aria-hidden
                          />
                        )}
                        {tier.name}
                      </CardTitle>
                      {badge && (
                        <Badge variant='secondary' className='text-xs'>
                          {badge.label}
                        </Badge>
                      )}
                    </div>
                    {canEdit && (
                      <div className='flex gap-1'>
                        <Button
                          size='icon'
                          variant='ghost'
                          onClick={() => setEditingTier(tier)}
                          aria-label='Edit tier'
                        >
                          <Pencil className='h-4 w-4' />
                        </Button>
                        <Button
                          size='icon'
                          variant='ghost'
                          onClick={() => setDeletingTier(tier)}
                          aria-label='Delete tier'
                        >
                          <Trash2 className='h-4 w-4 text-destructive' />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className='flex-1 space-y-4'>
                  <div>
                    <p className='text-xs uppercase text-muted-foreground'>
                      Amount Range
                    </p>
                    <p className='text-sm font-medium'>
                      {formatCurrency(Number(tier.min_amount))}
                      {tier.max_amount
                        ? ` – ${formatCurrency(Number(tier.max_amount))}`
                        : '+'}
                    </p>
                  </div>

                  {tier.description && (
                    <p className='text-sm text-muted-foreground'>
                      {tier.description}
                    </p>
                  )}

                  <div>
                    <p className='mb-2 text-xs uppercase text-muted-foreground'>
                      Benefits
                    </p>
                    {benefits.length === 0 ? (
                      <p className='text-xs italic text-muted-foreground'>
                        No benefits configured.
                      </p>
                    ) : (
                      <ul className='space-y-1.5'>
                        {benefits.map((b, i) => (
                          <li
                            key={i}
                            className='flex items-start gap-2 text-sm'
                          >
                            {b.included ? (
                              <Check className='mt-0.5 h-4 w-4 flex-shrink-0 text-green-600' />
                            ) : (
                              <X className='mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground' />
                            )}
                            <span
                              className={
                                b.included
                                  ? ''
                                  : 'text-muted-foreground line-through'
                              }
                            >
                              {b.label}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create */}
      {canEdit && (
        <TierForm
          open={showCreate}
          onOpenChange={setShowCreate}
          chapterId={chapterId}
        />
      )}

      {/* Edit */}
      {canEdit && editingTier && (
        <TierForm
          open={Boolean(editingTier)}
          onOpenChange={(o) => !o && setEditingTier(null)}
          chapterId={chapterId}
          tier={editingTier}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog
        open={Boolean(deletingTier)}
        onOpenChange={(o) => !o && setDeletingTier(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this tier?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingTier ? (
                <>
                  You&apos;re about to delete <b>{deletingTier.name}</b>. This action
                  cannot be undone. Tiers linked to existing deals cannot be
                  deleted.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isPending}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              Delete Tier
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
