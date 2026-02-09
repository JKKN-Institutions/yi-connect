/**
 * Role Manager Dialog Component
 *
 * Dialog for managing individual user roles with add/remove functionality
 */

'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Shield, Plus, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { assignRole, removeRole } from '@/app/actions/users'
import type { UserListItem, Role, RoleInfo } from '@/types/user'

interface RoleManagerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: UserListItem | null
  roles: Role[]
  onSuccess: () => void
}

// Helper function to get role badge variant
function getRoleBadgeVariant(hierarchyLevel: number) {
  if (hierarchyLevel >= 7) return 'destructive' // Super Admin
  if (hierarchyLevel >= 6) return 'default' // National Admin
  if (hierarchyLevel >= 5) return 'secondary' // Executive
  if (hierarchyLevel >= 3) return 'outline' // Co-Chair, Chair
  return 'outline' // Regular members
}

export function RoleManagerDialog({
  open,
  onOpenChange,
  user,
  roles,
  onSuccess
}: RoleManagerDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [selectedRoleId, setSelectedRoleId] = useState<string>('')
  const [notes, setNotes] = useState('')

  // Track optimistically added/removed roles
  const [optimisticRoles, setOptimisticRoles] = useState<RoleInfo[]>([])

  // Reset optimistic roles when dialog opens
  useEffect(() => {
    if (open) {
      setOptimisticRoles([])
    }
  }, [open])

  if (!user) return null

  // Combine actual roles with optimistic updates
  const displayRoles = [...user.roles, ...optimisticRoles]
  const userRoleIds = new Set(displayRoles.map((r) => r.role_id))
  const availableRoles = roles.filter((r) => !userRoleIds.has(r.id))

  // Show add form by default if there are available roles
  const [isAdding, setIsAdding] = useState(availableRoles.length > 0)

  // Handle assign role
  const handleAssignRole = async () => {
    if (!selectedRoleId) {
      toast.error('Please select a role')
      return
    }

    // Get the selected role details
    const selectedRole = roles.find((r) => r.id === selectedRoleId)
    if (!selectedRole) return

    // Optimistically add the role to the UI
    const optimisticRole: RoleInfo = {
      id: `temp-${Date.now()}`,
      role_id: selectedRole.id,
      role_name: selectedRole.name,
      hierarchy_level: selectedRole.hierarchy_level,
      permissions: selectedRole.permissions,
      assigned_at: new Date().toISOString(),
      assigned_by: null
    }

    setOptimisticRoles((prev) => [...prev, optimisticRole])
    setIsAdding(false)
    setSelectedRoleId('')
    setNotes('')

    startTransition(async () => {
      const formData = new FormData()
      formData.append('user_id', user.id)
      formData.append('role_id', selectedRoleId)
      if (notes) formData.append('notes', notes)

      const result = await assignRole({ message: '' }, formData)

      if (result.success) {
        toast.success(result.message)
        onSuccess()
        // Remove the optimistic role and let real data from refresh take over
        setOptimisticRoles((prev) => prev.filter((r) => r.id !== optimisticRole.id))
      } else {
        toast.error(result.message)
        // Remove the optimistic role on error
        setOptimisticRoles((prev) => prev.filter((r) => r.id !== optimisticRole.id))
      }
    })
  }

  // Handle remove role
  const handleRemoveRole = async (userRoleId: string, roleName: string) => {
    // Optimistically remove from optimistic list (if it's a temp role)
    if (userRoleId.startsWith('temp-')) {
      setOptimisticRoles((prev) => prev.filter((r) => r.id !== userRoleId))
      return
    }

    // Store the removed role for potential rollback
    const removedRole = displayRoles.find((r) => r.id === userRoleId)

    startTransition(async () => {
      const formData = new FormData()
      formData.append('user_role_id', userRoleId)

      const result = await removeRole({ message: '' }, formData)

      if (result.success) {
        toast.success(result.message)
        onSuccess()
      } else {
        toast.error(result.message)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-3xl max-h-[90vh] flex flex-col'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Shield className='h-5 w-5' />
            Manage Roles for {user.full_name}
          </DialogTitle>
          <DialogDescription>
            Add or remove roles for this user. Changes take effect immediately.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className='flex-1 -mx-6 px-6'>
          <div className='space-y-6 py-4'>
          {/* Current Roles */}
          <div className='space-y-3'>
            <div className='flex items-center justify-between'>
              <Label className='text-base font-semibold'>Current Roles</Label>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setIsAdding(true)}
                disabled={isPending || isAdding || availableRoles.length === 0}
              >
                <Plus className='mr-2 h-4 w-4' />
                Add Role
              </Button>
            </div>

            {user.roles.length === 0 ? (
              <div className='rounded-lg border border-dashed p-8 text-center'>
                <Shield className='mx-auto h-12 w-12 text-muted-foreground' />
                <p className='mt-2 text-sm text-muted-foreground'>
                  No roles assigned yet
                </p>
              </div>
            ) : (
              <ScrollArea className='max-h-[300px] rounded-md border p-4'>
                <div className='space-y-3'>
                  {user.roles.map((role) => (
                    <div
                      key={role.id}
                      className='flex items-start justify-between rounded-lg border p-3'
                    >
                      <div className='flex-1 space-y-1'>
                        <div className='flex items-center gap-2'>
                          <Badge variant={getRoleBadgeVariant(role.hierarchy_level)}>
                            {role.role_name}
                          </Badge>
                          <span className='text-xs text-muted-foreground'>
                            Level {role.hierarchy_level}
                          </span>
                        </div>
                        <p className='text-xs text-muted-foreground'>
                          Assigned {format(new Date(role.assigned_at), 'MMM dd, yyyy')}
                          {role.assigned_by && ` by ${role.assigned_by}`}
                        </p>
                      </div>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => handleRemoveRole(role.id, role.role_name)}
                        disabled={isPending}
                      >
                        <X className='h-4 w-4' />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Add Role Form */}
          {isAdding && (
            <>
              <Separator />
              <div className='space-y-4 rounded-lg border p-4'>
                <div className='flex items-center justify-between'>
                  <Label className='text-base font-semibold'>Add New Role</Label>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => {
                      setIsAdding(false)
                      setSelectedRoleId('')
                      setNotes('')
                    }}
                  >
                    Cancel
                  </Button>
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='new-role'>Role</Label>
                  <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                    <SelectTrigger id='new-role'>
                      <SelectValue placeholder='Select a role to assign' />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          <div className='flex items-center gap-2'>
                            <span>{role.name}</span>
                            <span className='text-xs text-muted-foreground'>
                              (Level {role.hierarchy_level})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='role-notes'>Notes (Optional)</Label>
                  <Textarea
                    id='role-notes'
                    placeholder='Add notes about this role assignment...'
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                <Button
                  className='w-full'
                  onClick={handleAssignRole}
                  disabled={isPending || !selectedRoleId}
                >
                  {isPending ? 'Assigning...' : 'Assign Role'}
                </Button>
              </div>
            </>
          )}

          {/* User Info */}
          <div className='rounded-lg bg-muted p-4'>
            <div className='grid grid-cols-2 gap-4 text-sm'>
              <div>
                <p className='text-muted-foreground'>Email</p>
                <p className='font-medium'>{user.email}</p>
              </div>
              <div>
                <p className='text-muted-foreground'>Chapter</p>
                <p className='font-medium'>
                  {user.chapter?.name || 'No Chapter'}
                </p>
              </div>
              <div>
                <p className='text-muted-foreground'>Status</p>
                <Badge variant={user.is_active ? 'default' : 'secondary'}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div>
                <p className='text-muted-foreground'>Member Record</p>
                <Badge variant={user.has_member_record ? 'outline' : 'secondary'}>
                  {user.has_member_record ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>
          </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Role Manager Dialog Trigger
 *
 * Self-contained trigger for the Role Manager Dialog with dropdown/button variants.
 * Follows the same pattern as UserDeactivateDialog and UserDeleteDialog.
 */
interface RoleManagerDialogTriggerProps {
  user: UserListItem
  roles: Role[]
  trigger?: 'button' | 'dropdown'
}

export function RoleManagerDialogTrigger({
  user,
  roles,
  trigger = 'dropdown'
}: RoleManagerDialogTriggerProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const handleSuccess = () => {
    // Refresh the page data in the background to sync with database
    router.refresh()
    // Keep dialog open - user can close manually when done
  }

  return (
    <>
      {trigger === 'dropdown' ? (
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            setOpen(true)
          }}
        >
          <Shield className='mr-2 h-4 w-4' />
          Manage Roles
        </DropdownMenuItem>
      ) : (
        <Button
          variant='outline'
          size='sm'
          onClick={() => setOpen(true)}
          className='w-full justify-start'
        >
          <Shield className='mr-2 h-4 w-4' />
          Manage Roles
        </Button>
      )}

      <RoleManagerDialog
        open={open}
        onOpenChange={setOpen}
        user={user}
        roles={roles}
        onSuccess={handleSuccess}
      />
    </>
  )
}
