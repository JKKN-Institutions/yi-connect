/**
 * Member Row Actions Component
 *
 * Role-based action menu for member table rows.
 * - Super Admin & National Admin: View, Edit, Deactivate/Reactivate, Delete
 * - Chair & Co-Chair: View, Edit, Deactivate/Reactivate
 * - Other roles: View, Edit only
 */

'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Eye, Edit } from 'lucide-react';
import { MemberDeactivateDialog, MemberReactivateDialog, MemberDeleteDialog } from './member-actions-dialog';

interface MemberRowActionsProps {
  memberId: string;
  memberName: string;
  memberStatus: string;
  userRoles: string[];
}

export function MemberRowActions({
  memberId,
  memberName,
  memberStatus,
  userRoles
}: MemberRowActionsProps) {
  // Check permissions based on roles
  const canToggleStatus = userRoles.some((role) =>
    ['Super Admin', 'National Admin', 'Chair', 'Co-Chair'].includes(role)
  );

  const canDelete = userRoles.some((role) =>
    ['Super Admin', 'National Admin'].includes(role)
  );

  const showDangerActions = canToggleStatus || canDelete;

  // Check if member is currently inactive (needs reactivation)
  const isInactive = memberStatus === 'inactive' || memberStatus === 'suspended';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex h-8 w-8 p-0 data-[state=open]:bg-muted"
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[180px]">
        <DropdownMenuItem asChild>
          <Link href={`/members/${memberId}`}>
            <Eye className="mr-2 h-4 w-4" />
            View
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/members/${memberId}/edit`}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Link>
        </DropdownMenuItem>

        {showDangerActions && <DropdownMenuSeparator />}

        {canToggleStatus && (
          isInactive ? (
            <MemberReactivateDialog
              memberId={memberId}
              memberName={memberName}
              trigger="dropdown"
            />
          ) : (
            <MemberDeactivateDialog
              memberId={memberId}
              memberName={memberName}
              trigger="dropdown"
            />
          )
        )}

        {canDelete && (
          <MemberDeleteDialog
            memberId={memberId}
            memberName={memberName}
            trigger="dropdown"
          />
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
