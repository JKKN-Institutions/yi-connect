/**
 * Authentication Validation Schemas
 *
 * Zod schemas for authentication-related forms.
 */

import { z } from 'zod'
import { emailSchema, passwordSchema, phoneSchema } from './common'

// Login Schema
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
})

export type LoginInput = z.infer<typeof loginSchema>

// Signup Schema
export const signupSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    fullName: z.string().min(1, 'Full name is required').max(255, 'Name is too long'),
    phone: phoneSchema,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })

export type SignupInput = z.infer<typeof signupSchema>

// Forgot Password Schema
export const forgotPasswordSchema = z.object({
  email: emailSchema,
})

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

// Reset Password Schema
export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

// Update Profile Schema
export const updateProfileSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(255, 'Name is too long'),
  phone: phoneSchema,
  avatar_url: z.string().url().optional().or(z.literal('')),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
