'use client'

/**
 * Activity Planner Provider Component
 *
 * Provides context for the Activity Planner chatbot and renders
 * a floating button to open the guided wizard.
 *
 * Features:
 * - Floating button (bottom-left to avoid conflict with bug reporter)
 * - Sheet-based wizard for guided activity planning
 * - Context for managing wizard state
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { CalendarPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ActivityPlannerWizard } from './activity-planner-wizard'

interface ActivityPlannerContextType {
  isOpen: boolean
  openWizard: () => void
  closeWizard: () => void
}

const ActivityPlannerContext = createContext<ActivityPlannerContextType | undefined>(undefined)

export function useActivityPlanner() {
  const context = useContext(ActivityPlannerContext)
  if (!context) {
    throw new Error('useActivityPlanner must be used within ActivityPlannerProvider')
  }
  return context
}

interface ActivityPlannerProviderProps {
  children?: ReactNode
}

export function ActivityPlannerProvider({ children }: ActivityPlannerProviderProps) {
  const [isOpen, setIsOpen] = useState(false)

  const openWizard = () => setIsOpen(true)
  const closeWizard = () => setIsOpen(false)

  // Adjust floating button position on mobile
  useEffect(() => {
    const adjustButtonPosition = () => {
      const button = document.querySelector('[data-activity-planner-button]') as HTMLElement
      if (button) {
        // On mobile (< 1024px), move button up to avoid bottom navbar
        if (window.innerWidth < 1024) {
          button.style.bottom = '80px'
          button.style.zIndex = '70'
        } else {
          button.style.bottom = '16px'
          button.style.zIndex = '50'
        }
      }
    }

    const timer = setTimeout(adjustButtonPosition, 100)
    window.addEventListener('resize', adjustButtonPosition)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', adjustButtonPosition)
    }
  }, [])

  return (
    <ActivityPlannerContext.Provider value={{ isOpen, openWizard, closeWizard }}>
      {children}

      {/* Floating Button - Bottom Left */}
      <Button
        data-activity-planner-button
        onClick={openWizard}
        className="fixed bottom-4 left-4 z-50 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow"
        size="icon"
        aria-label="Plan an Activity"
      >
        <CalendarPlus className="h-6 w-6" />
      </Button>

      {/* Wizard Sheet */}
      <ActivityPlannerWizard isOpen={isOpen} onClose={closeWizard} />
    </ActivityPlannerContext.Provider>
  )
}
