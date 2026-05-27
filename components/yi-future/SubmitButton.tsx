"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingText,
  className = "",
  disabled = false,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={`relative transition-all ${
        pending ? "opacity-70 cursor-wait" : ""
      } ${disabled ? "opacity-40 cursor-not-allowed" : ""} ${className}`}
    >
      {pending ? (
        <span className="flex items-center justify-center gap-2">
          <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          {pendingText ?? children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
