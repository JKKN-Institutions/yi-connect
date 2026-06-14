import { LogOut } from "lucide-react";
import { signOutStaff } from "@/app/youth-academy/actions/staff-auth";

/**
 * Sign-out control for the staff consoles (national / chapter / mentor). A plain
 * <form> posting to the signOutStaff server action — works with zero client JS.
 * Pass `className` to match each header's styling.
 */
export function StaffSignOut({ className }: { className?: string }) {
  return (
    <form action={signOutStaff}>
      <button
        type="submit"
        className={
          className ??
          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        }
      >
        <LogOut className="size-4" />
        Sign out
      </button>
    </form>
  );
}
