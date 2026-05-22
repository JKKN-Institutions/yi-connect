'use client';

import { useState, useActionState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Plus, Trash2, Star, UserCircle, Mail, Phone } from 'lucide-react';
import toast from 'react-hot-toast';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  addCoordinator,
  removeCoordinator,
  setPrimaryCoordinator,
  type ActionResponse,
} from '@/app/actions/industry-portal';

interface Coordinator {
  id: string;
  contact_name: string;
  designation?: string | null;
  email?: string | null;
  phone_primary?: string | null;
  is_primary_contact: boolean;
  is_decision_maker: boolean;
  created_at: string;
}

interface UsersManagementProps {
  coordinators: Coordinator[];
}

const formSchema = z.object({
  contact_name: z.string().min(2, 'Name must be at least 2 characters'),
  designation: z.string().optional(),
  email: z.string().email('Please enter a valid email'),
  phone_primary: z.string().optional(),
  is_primary_contact: z.boolean().default(false),
  is_decision_maker: z.boolean().default(false),
});

type FormValues = z.infer<typeof formSchema>;

const initialState: ActionResponse = {
  success: false,
  message: '',
};

export function UsersManagement({ coordinators }: UsersManagementProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);
  const [isSettingPrimary, setIsSettingPrimary] = useState<string | null>(null);
  const [state, formAction, isPending] = useActionState(addCoordinator, initialState);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      contact_name: '',
      designation: '',
      email: '',
      phone_primary: '',
      is_primary_contact: false,
      is_decision_maker: false,
    },
  });

  useEffect(() => {
    if (state.success) {
      toast.success(state.message || 'Coordinator added successfully');
      setIsDialogOpen(false);
      form.reset();
    } else if (state.message && !state.success) {
      toast.error(state.message);
    }
  }, [state, form]);

  const handleRemove = async (id: string) => {
    setIsRemoving(id);
    try {
      const result = await removeCoordinator(id);
      if (result.success) {
        toast.success(result.message || 'Coordinator removed');
      } else {
        toast.error(result.message || 'Failed to remove coordinator');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsRemoving(null);
    }
  };

  const handleSetPrimary = async (id: string) => {
    setIsSettingPrimary(id);
    try {
      const result = await setPrimaryCoordinator(id);
      if (result.success) {
        toast.success(result.message || 'Primary coordinator updated');
      } else {
        toast.error(result.message || 'Failed to update');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsSettingPrimary(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Coordinators List */}
      <div className="space-y-4">
        {coordinators.length === 0 ? (
          <div className="text-center py-8 border rounded-lg bg-muted/50">
            <UserCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-2">No coordinators added yet</p>
            <p className="text-sm text-muted-foreground">
              Add coordinators who can access and manage this portal
            </p>
          </div>
        ) : (
          coordinators.map((coordinator) => (
            <div
              key={coordinator.id}
              className="flex items-center justify-between p-4 border rounded-lg bg-card"
            >
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <UserCircle className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{coordinator.contact_name}</span>
                    {coordinator.is_primary_contact && (
                      <Badge variant="default" className="text-xs">
                        <Star className="h-3 w-3 mr-1" />
                        Primary
                      </Badge>
                    )}
                    {coordinator.is_decision_maker && (
                      <Badge variant="secondary" className="text-xs">
                        Decision Maker
                      </Badge>
                    )}
                  </div>
                  {coordinator.designation && (
                    <p className="text-sm text-muted-foreground">{coordinator.designation}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {coordinator.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {coordinator.email}
                      </span>
                    )}
                    {coordinator.phone_primary && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {coordinator.phone_primary}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!coordinator.is_primary_contact && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSetPrimary(coordinator.id)}
                    disabled={isSettingPrimary === coordinator.id}
                  >
                    {isSettingPrimary === coordinator.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Star className="h-4 w-4" />
                    )}
                    <span className="ml-1">Set Primary</span>
                  </Button>
                )}

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove Coordinator</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to remove {coordinator.contact_name}? They will no
                        longer have access to this portal.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleRemove(coordinator.id)}
                        disabled={isRemoving === coordinator.id}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isRemoving === coordinator.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Coordinator Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Coordinator
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Coordinator</DialogTitle>
            <DialogDescription>
              Add a new user who can access and manage the industry portal.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form action={formAction} className="space-y-4">
              <FormField
                control={form.control}
                name="contact_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="designation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Designation</FormLabel>
                    <FormControl>
                      <Input placeholder="HR Manager" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="john@company.com" {...field} />
                    </FormControl>
                    <FormDescription>
                      This email will be used to sign in to the portal
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone_primary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="+91 98765 43210" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="is_primary_contact"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          name="is_primary_contact"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Primary Contact</FormLabel>
                        <FormDescription>
                          Yi members will see this person as the main contact
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_decision_maker"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          name="is_decision_maker"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Decision Maker</FormLabel>
                        <FormDescription>
                          Can approve visit requests and make final decisions
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              <input
                type="hidden"
                name="is_primary_contact"
                value={form.watch('is_primary_contact') ? 'true' : 'false'}
              />
              <input
                type="hidden"
                name="is_decision_maker"
                value={form.watch('is_decision_maker') ? 'true' : 'false'}
              />

              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Coordinator
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
