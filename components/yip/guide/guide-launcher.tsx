"use client"

import * as React from "react"
import { HelpCircleIcon, BookOpenIcon } from "lucide-react"

import { cn } from "@/lib/yip/utils"
import { type PersonaGuide } from "@/lib/yip/guide/types"
import { GuideDrawer } from "@/components/yip/guide/guide-drawer"

/**
 * GuideLauncher — owns the drawer open-state and renders the trigger.
 *
 * variant "fab": a floating round Help button. Pinned BOTTOM-LEFT
 *   (`fixed bottom-4 left-4 z-40`) on purpose — the app's bug-reporter FAB
 *   lives at the bottom-right, so this avoids overlap.
 * variant "navlink": an inline button styled like a neutral menu item, for
 *   embedding in a sidebar/menu. Accepts `className` so the layout can match
 *   its own nav styling.
 */

interface GuideLauncherProps {
  guide: PersonaGuide
  eventId?: string | null
  variant: "fab" | "navlink"
  /** Extra classes for the trigger — used to match nav styling on "navlink". */
  className?: string
}

export function GuideLauncher({
  guide,
  eventId,
  variant,
  className,
}: GuideLauncherProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      {variant === "fab" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open guide"
          className={cn(
            "group fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full bg-[#FF9933] px-3.5 py-3 text-white shadow-lg shadow-[#FF9933]/30",
            "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#FF9933]/40",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9933]/60 focus-visible:ring-offset-2",
            className
          )}
        >
          <HelpCircleIcon className="size-5 shrink-0" />
          <span className="hidden text-sm font-semibold sm:inline">Help</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9933]/50",
            className
          )}
        >
          <BookOpenIcon className="size-4 shrink-0" />
          <span>Guide</span>
        </button>
      )}

      <GuideDrawer
        guide={guide}
        eventId={eventId}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
