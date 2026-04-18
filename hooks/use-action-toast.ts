'use client';

/**
 * useActionToast — wire Server Action state to toast notifications in one line.
 *
 * Usage in any form that calls a Server Action via useActionState / useFormState:
 *
 *   const [state, formAction] = useActionState(createMemberAction, null);
 *   useActionToast(state, { successMessage: 'Member created successfully' });
 *
 * The hook reads `state` on every render cycle.  When state transitions to an
 * error result it fires toast.error(); when it transitions to a success result
 * and a successMessage was provided it fires toast.success().
 *
 * Expected Server Action return shape (either field is optional):
 *   { success: boolean; error?: string; message?: string }
 */

import { useEffect } from 'react';
import toast from 'react-hot-toast';

interface ActionState {
  success?: boolean;
  error?: string;
  message?: string;
}

interface UseActionToastOptions {
  /** Shown via toast.success() when state.success === true */
  successMessage?: string;
}

export function useActionToast<T extends ActionState>(
  state: T | null | undefined,
  opts?: UseActionToastOptions
): void {
  useEffect(() => {
    if (!state) return;

    if (state.error || state.success === false) {
      toast.error(state.error || state.message || 'Something went wrong');
    } else if (state.success === true && opts?.successMessage) {
      toast.success(opts.successMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}
