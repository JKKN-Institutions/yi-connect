/**
 * Haptic Feedback Utilities
 *
 * Provides haptic feedback (vibration) for mobile interactions.
 * Falls back gracefully on unsupported devices.
 */

import type { HapticFeedbackType } from '@/types/mobile'

// Vibration patterns for different feedback types (in milliseconds)
const hapticPatterns: Record<HapticFeedbackType, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 30,
  success: [10, 50, 20],
  warning: [20, 30, 20, 30, 20],
  error: [50, 50, 50],
  selection: 5
}

/**
 * Check if the Vibration API is supported
 */
export function isHapticSupported(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator
}

/**
 * Trigger haptic feedback
 *
 * @param type - The type of haptic feedback to trigger
 * @returns boolean indicating if the haptic was triggered
 */
export function triggerHaptic(type: HapticFeedbackType = 'light'): boolean {
  if (!isHapticSupported()) {
    return false
  }

  try {
    const pattern = hapticPatterns[type]
    return navigator.vibrate(pattern)
  } catch (error) {
    console.warn('Haptic feedback failed:', error)
    return false
  }
}

/**
 * Cancel any ongoing vibration
 */
export function cancelHaptic(): boolean {
  if (!isHapticSupported()) {
    return false
  }

  try {
    return navigator.vibrate(0)
  } catch (error) {
    console.warn('Cancel haptic failed:', error)
    return false
  }
}

/**
 * Trigger a custom vibration pattern
 *
 * @param pattern - Array of vibration/pause durations in milliseconds
 * @returns boolean indicating if the pattern was triggered
 */
export function triggerCustomPattern(pattern: number[]): boolean {
  if (!isHapticSupported()) {
    return false
  }

  try {
    return navigator.vibrate(pattern)
  } catch (error) {
    console.warn('Custom haptic pattern failed:', error)
    return false
  }
}
