/**
 * Member Bulk Actions Component
 *
 * Floating action bar for bulk operations on selected members
 */

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X, UserCheck, UserX, Award, Briefcase, Tag } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  bulkUpdateMemberStatus,
  bulkAssignSkills,
  bulkUpdateCategory
} from '@/app/actions/member-bulk';
import type { MemberListItem } from '@/types/member';

interface MemberBulkActionsProps {
  selectedMembers: MemberListItem[];
  skills?: Array<{ id: string; name: string; category: string }>;
  onClearSelection: () => void;
  onSuccess: () => void;
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'alumni', label: 'Alumni' },
];

const CATEGORY_OPTIONS = [
  { value: 'star', label: 'Star' },
  { value: 'enthusiast', label: 'Enthusiast' },
  { value: 'cynic', label: 'Cynic' },
  { value: 'dead_wood', label: 'Needs Attention' },
];

export function MemberBulkActions({
  selectedMembers,
  skills = [],
  onClearSelection,
  onSuccess
}: MemberBulkActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Dialog states
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [skillsDialogOpen, setSkillsDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);

  // Form states
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [skillSearch, setSkillSearch] = useState('');

  const selectedMemberIds = selectedMembers.map((m) => m.id);
  const selectedCount = selectedMembers.length;

  // Filter skills based on search
  const filteredSkills = skills.filter(skill =>
    skill.name.toLowerCase().includes(skillSearch.toLowerCase()) ||
    skill.category.toLowerCase().includes(skillSearch.toLowerCase())
  );

  // Group skills by category
  const skillsByCategory = filteredSkills.reduce((acc, skill) => {
    if (!acc[skill.category]) {
      acc[skill.category] = [];
    }
    acc[skill.category].push(skill);
    return acc;
  }, {} as Record<string, typeof skills>);

  // Handle bulk status update
  const handleStatusUpdate = async () => {
    if (!selectedStatus) {
      toast.error('Please select a status');
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append('member_ids', JSON.stringify(selectedMemberIds));
      formData.append('status', selectedStatus);

      const result = await bulkUpdateMemberStatus({ message: '' }, formData);

      if (result.success) {
        toast.success(result.message);
        setStatusDialogOpen(false);
        setSelectedStatus('');
        onSuccess();
      } else {
        toast.error(result.message);
      }
    });
  };

  // Handle bulk skills assignment
  const handleSkillsAssign = async () => {
    if (selectedSkillIds.length === 0) {
      toast.error('Please select at least one skill');
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append('member_ids', JSON.stringify(selectedMemberIds));
      formData.append('skill_ids', JSON.stringify(selectedSkillIds));

      const result = await bulkAssignSkills({ message: '' }, formData);

      if (result.success) {
        toast.success(result.message);
        setSkillsDialogOpen(false);
        setSelectedSkillIds([]);
        onSuccess();
      } else {
        toast.error(result.message);
      }
    });
  };

  // Handle bulk category update
  const handleCategoryUpdate = async () => {
    if (!selectedCategory) {
      toast.error('Please select a category');
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append('member_ids', JSON.stringify(selectedMemberIds));
      formData.append('category', selectedCategory);

      const result = await bulkUpdateCategory({ message: '' }, formData);

      if (result.success) {
        toast.success(result.message);
        setCategoryDialogOpen(false);
        setSelectedCategory('');
        onSuccess();
      } else {
        toast.error(result.message);
      }
    });
  };

  // Toggle skill selection
  const toggleSkill = (skillId: string) => {
    setSelectedSkillIds(prev =>
      prev.includes(skillId)
        ? prev.filter(id => id !== skillId)
        : [...prev, skillId]
    );
  };

  if (selectedCount === 0) return null;

  return (
    <>
      {/* Floating Action Bar */}
      <div className='fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border bg-background p-4 shadow-lg'>
        <div className='flex items-center gap-2'>
          <span className='text-sm font-medium'>
            {selectedCount} member{selectedCount !== 1 ? 's' : ''} selected
          </span>
        </div>

        <div className='h-6 w-px bg-border' />

        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setStatusDialogOpen(true)}
            disabled={isPending}
          >
            <UserCheck className='mr-2 h-4 w-4' />
            Change Status
          </Button>

          <Button
            variant='outline'
            size='sm'
            onClick={() => setSkillsDialogOpen(true)}
            disabled={isPending}
          >
            <Briefcase className='mr-2 h-4 w-4' />
            Assign Skills
          </Button>

          <Button
            variant='outline'
            size='sm'
            onClick={() => setCategoryDialogOpen(true)}
            disabled={isPending}
          >
            <Tag className='mr-2 h-4 w-4' />
            Set Category
          </Button>
        </div>

        <div className='h-6 w-px bg-border' />

        <Button
          variant='ghost'
          size='sm'
          onClick={onClearSelection}
          disabled={isPending}
        >
          <X className='mr-2 h-4 w-4' />
          Clear
        </Button>
      </div>

      {/* Change Status Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Status for {selectedCount} Members</DialogTitle>
            <DialogDescription>
              Select a new status to apply to all selected members.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label htmlFor='status'>New Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger id='status'>
                  <SelectValue placeholder='Select a status' />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='rounded-lg bg-muted p-3'>
              <p className='text-sm text-muted-foreground'>
                This will update the membership status for all {selectedCount} selected members.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setStatusDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleStatusUpdate}
              disabled={isPending || !selectedStatus}
            >
              {isPending ? 'Updating...' : 'Update Status'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Skills Dialog */}
      <Dialog open={skillsDialogOpen} onOpenChange={setSkillsDialogOpen}>
        <DialogContent className='max-w-2xl max-h-[80vh] overflow-hidden flex flex-col'>
          <DialogHeader>
            <DialogTitle>Assign Skills to {selectedCount} Members</DialogTitle>
            <DialogDescription>
              Select skills to assign to all selected members. Members who already have these skills will be skipped.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-4 flex-1 overflow-hidden flex flex-col'>
            {/* Search */}
            <Input
              placeholder='Search skills...'
              value={skillSearch}
              onChange={(e) => setSkillSearch(e.target.value)}
            />

            {/* Selected skills */}
            {selectedSkillIds.length > 0 && (
              <div className='flex flex-wrap gap-1'>
                {selectedSkillIds.map(skillId => {
                  const skill = skills.find(s => s.id === skillId);
                  return skill ? (
                    <Badge key={skillId} variant='secondary' className='gap-1'>
                      {skill.name}
                      <button onClick={() => toggleSkill(skillId)}>
                        <X className='h-3 w-3' />
                      </button>
                    </Badge>
                  ) : null;
                })}
              </div>
            )}

            {/* Skills list */}
            <div className='flex-1 overflow-y-auto space-y-4 pr-2'>
              {Object.entries(skillsByCategory).map(([category, categorySkills]) => (
                <div key={category}>
                  <p className='text-sm font-medium text-muted-foreground mb-2'>{category}</p>
                  <div className='grid grid-cols-2 gap-2'>
                    {categorySkills.map(skill => (
                      <div key={skill.id} className='flex items-center space-x-2'>
                        <Checkbox
                          id={skill.id}
                          checked={selectedSkillIds.includes(skill.id)}
                          onCheckedChange={() => toggleSkill(skill.id)}
                          disabled={isPending}
                        />
                        <Label htmlFor={skill.id} className='font-normal cursor-pointer text-sm'>
                          {skill.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {Object.keys(skillsByCategory).length === 0 && (
                <p className='text-center text-muted-foreground py-4'>
                  {skillSearch ? 'No skills match your search' : 'No skills available'}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setSkillsDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSkillsAssign}
              disabled={isPending || selectedSkillIds.length === 0}
            >
              {isPending ? 'Assigning...' : `Assign ${selectedSkillIds.length} Skill(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Category for {selectedCount} Members</DialogTitle>
            <DialogDescription>
              Update the skill-will category for all selected members.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label htmlFor='category'>Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger id='category'>
                  <SelectValue placeholder='Select a category' />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='rounded-lg bg-muted p-3'>
              <p className='text-sm text-muted-foreground'>
                This will update the skill-will matrix category for all {selectedCount} selected members.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setCategoryDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCategoryUpdate}
              disabled={isPending || !selectedCategory}
            >
              {isPending ? 'Updating...' : 'Update Category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
