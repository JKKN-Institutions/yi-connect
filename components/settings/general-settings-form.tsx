'use client'

import { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Moon, Sun, Monitor, Bell, Mail, Smartphone, Shield, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GeneralSettingsFormProps {
  section: 'appearance' | 'language' | 'notifications' | 'privacy'
}

type Theme = 'light' | 'dark' | 'system'

export function GeneralSettingsForm({ section }: GeneralSettingsFormProps) {
  // Appearance settings
  const [theme, setTheme] = useState<Theme>('system')
  const [compactMode, setCompactMode] = useState(false)

  // Language settings
  const [language, setLanguage] = useState('en')
  const [timezone, setTimezone] = useState('Asia/Kolkata')

  // Notification settings
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(true)
  const [smsNotifications, setSmsNotifications] = useState(false)
  const [eventReminders, setEventReminders] = useState(true)

  // Privacy settings
  const [showProfile, setShowProfile] = useState(true)
  const [showActivity, setShowActivity] = useState(true)

  // Load saved preferences from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('yi-theme') as Theme | null
    if (savedTheme) setTheme(savedTheme)

    const savedCompact = localStorage.getItem('yi-compact-mode')
    if (savedCompact) setCompactMode(savedCompact === 'true')

    const savedLanguage = localStorage.getItem('yi-language')
    if (savedLanguage) setLanguage(savedLanguage)

    const savedTimezone = localStorage.getItem('yi-timezone')
    if (savedTimezone) setTimezone(savedTimezone)

    const savedEmailNotif = localStorage.getItem('yi-email-notifications')
    if (savedEmailNotif) setEmailNotifications(savedEmailNotif === 'true')

    const savedPushNotif = localStorage.getItem('yi-push-notifications')
    if (savedPushNotif) setPushNotifications(savedPushNotif === 'true')

    const savedSmsNotif = localStorage.getItem('yi-sms-notifications')
    if (savedSmsNotif) setSmsNotifications(savedSmsNotif === 'true')

    const savedEventReminders = localStorage.getItem('yi-event-reminders')
    if (savedEventReminders) setEventReminders(savedEventReminders === 'true')

    const savedShowProfile = localStorage.getItem('yi-show-profile')
    if (savedShowProfile) setShowProfile(savedShowProfile === 'true')

    const savedShowActivity = localStorage.getItem('yi-show-activity')
    if (savedShowActivity) setShowActivity(savedShowActivity === 'true')
  }, [])

  // Save preferences to localStorage
  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme)
    localStorage.setItem('yi-theme', newTheme)

    // Apply theme to document
    const root = document.documentElement
    if (newTheme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      root.classList.toggle('dark', systemTheme === 'dark')
    } else {
      root.classList.toggle('dark', newTheme === 'dark')
    }
  }

  const handleCompactModeChange = (checked: boolean) => {
    setCompactMode(checked)
    localStorage.setItem('yi-compact-mode', String(checked))
  }

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage)
    localStorage.setItem('yi-language', newLanguage)
  }

  const handleTimezoneChange = (newTimezone: string) => {
    setTimezone(newTimezone)
    localStorage.setItem('yi-timezone', newTimezone)
  }

  const handleEmailNotificationsChange = (checked: boolean) => {
    setEmailNotifications(checked)
    localStorage.setItem('yi-email-notifications', String(checked))
  }

  const handlePushNotificationsChange = (checked: boolean) => {
    setPushNotifications(checked)
    localStorage.setItem('yi-push-notifications', String(checked))
  }

  const handleSmsNotificationsChange = (checked: boolean) => {
    setSmsNotifications(checked)
    localStorage.setItem('yi-sms-notifications', String(checked))
  }

  const handleEventRemindersChange = (checked: boolean) => {
    setEventReminders(checked)
    localStorage.setItem('yi-event-reminders', String(checked))
  }

  const handleShowProfileChange = (checked: boolean) => {
    setShowProfile(checked)
    localStorage.setItem('yi-show-profile', String(checked))
  }

  const handleShowActivityChange = (checked: boolean) => {
    setShowActivity(checked)
    localStorage.setItem('yi-show-activity', String(checked))
  }

  if (section === 'appearance') {
    return (
      <div className="space-y-6">
        {/* Theme Selection */}
        <div className="space-y-3">
          <Label>Theme</Label>
          <div className="flex gap-2">
            <Button
              variant={theme === 'light' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleThemeChange('light')}
              className="flex-1"
            >
              <Sun className="mr-2 h-4 w-4" />
              Light
            </Button>
            <Button
              variant={theme === 'dark' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleThemeChange('dark')}
              className="flex-1"
            >
              <Moon className="mr-2 h-4 w-4" />
              Dark
            </Button>
            <Button
              variant={theme === 'system' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleThemeChange('system')}
              className="flex-1"
            >
              <Monitor className="mr-2 h-4 w-4" />
              System
            </Button>
          </div>
        </div>

        {/* Compact Mode */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="compact-mode">Compact Mode</Label>
            <p className="text-sm text-muted-foreground">
              Reduce spacing and make the interface more dense
            </p>
          </div>
          <Switch
            id="compact-mode"
            checked={compactMode}
            onCheckedChange={handleCompactModeChange}
          />
        </div>
      </div>
    )
  }

  if (section === 'language') {
    return (
      <div className="space-y-6">
        {/* Language Selection */}
        <div className="space-y-2">
          <Label htmlFor="language">Language</Label>
          <Select value={language} onValueChange={handleLanguageChange}>
            <SelectTrigger id="language">
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="hi">Hindi</SelectItem>
              <SelectItem value="ta">Tamil</SelectItem>
              <SelectItem value="te">Telugu</SelectItem>
              <SelectItem value="kn">Kannada</SelectItem>
              <SelectItem value="ml">Malayalam</SelectItem>
              <SelectItem value="mr">Marathi</SelectItem>
              <SelectItem value="gu">Gujarati</SelectItem>
              <SelectItem value="bn">Bengali</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            Currently only English is fully supported. Other languages coming soon.
          </p>
        </div>

        {/* Timezone Selection */}
        <div className="space-y-2">
          <Label htmlFor="timezone">Timezone</Label>
          <Select value={timezone} onValueChange={handleTimezoneChange}>
            <SelectTrigger id="timezone">
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Asia/Kolkata">India Standard Time (IST)</SelectItem>
              <SelectItem value="Asia/Dubai">Gulf Standard Time (GST)</SelectItem>
              <SelectItem value="Asia/Singapore">Singapore Time (SGT)</SelectItem>
              <SelectItem value="Europe/London">Greenwich Mean Time (GMT)</SelectItem>
              <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
              <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    )
  }

  if (section === 'notifications') {
    return (
      <div className="space-y-4">
        {/* Email Notifications */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <Mail className="h-4 w-4 text-blue-600" />
            </div>
            <div className="space-y-0.5">
              <Label htmlFor="email-notifications">Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive updates via email
              </p>
            </div>
          </div>
          <Switch
            id="email-notifications"
            checked={emailNotifications}
            onCheckedChange={handleEmailNotificationsChange}
          />
        </div>

        {/* Push Notifications */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2">
              <Bell className="h-4 w-4 text-green-600" />
            </div>
            <div className="space-y-0.5">
              <Label htmlFor="push-notifications">Push Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive browser push notifications
              </p>
            </div>
          </div>
          <Switch
            id="push-notifications"
            checked={pushNotifications}
            onCheckedChange={handlePushNotificationsChange}
          />
        </div>

        {/* SMS Notifications */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2">
              <Smartphone className="h-4 w-4 text-purple-600" />
            </div>
            <div className="space-y-0.5">
              <Label htmlFor="sms-notifications">SMS Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive important alerts via SMS
              </p>
            </div>
          </div>
          <Switch
            id="sms-notifications"
            checked={smsNotifications}
            onCheckedChange={handleSmsNotificationsChange}
          />
        </div>

        {/* Event Reminders */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-100 p-2">
              <Bell className="h-4 w-4 text-orange-600" />
            </div>
            <div className="space-y-0.5">
              <Label htmlFor="event-reminders">Event Reminders</Label>
              <p className="text-sm text-muted-foreground">
                Get reminded about upcoming events
              </p>
            </div>
          </div>
          <Switch
            id="event-reminders"
            checked={eventReminders}
            onCheckedChange={handleEventRemindersChange}
          />
        </div>
      </div>
    )
  }

  if (section === 'privacy') {
    return (
      <div className="space-y-4">
        {/* Show Profile */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <Eye className="h-4 w-4 text-blue-600" />
            </div>
            <div className="space-y-0.5">
              <Label htmlFor="show-profile">Public Profile</Label>
              <p className="text-sm text-muted-foreground">
                Make your profile visible to other members
              </p>
            </div>
          </div>
          <Switch
            id="show-profile"
            checked={showProfile}
            onCheckedChange={handleShowProfileChange}
          />
        </div>

        {/* Show Activity */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2">
              <Shield className="h-4 w-4 text-green-600" />
            </div>
            <div className="space-y-0.5">
              <Label htmlFor="show-activity">Activity Status</Label>
              <p className="text-sm text-muted-foreground">
                Show your activity status to other members
              </p>
            </div>
          </div>
          <Switch
            id="show-activity"
            checked={showActivity}
            onCheckedChange={handleShowActivityChange}
          />
        </div>

        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            Your data is stored securely and we never share your personal information
            with third parties without your consent.
          </p>
        </div>
      </div>
    )
  }

  return null
}
