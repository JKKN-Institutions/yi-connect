/**
 * Fix Members Table RLS Policies
 *
 * Add INSERT policy to allow:
 * 1. Users to create their own member record
 * 2. Admins (Chapter Admin and above) to create member records
 */

-- Drop the existing "Admins can manage all members" policy and recreate it more specifically
DROP POLICY IF EXISTS "Admins can manage all members in their chapter" ON public.members;

-- Allow users to insert their own member record
CREATE POLICY "Users can create their own member record"
  ON public.members FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Allow admins to insert new member records
CREATE POLICY "Admins can insert members"
  ON public.members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.hierarchy_level >= 3 -- Co-Chair and above
    )
  );

-- Recreate the admin update/delete policy
CREATE POLICY "Admins can update and delete members in their chapter"
  ON public.members FOR UPDATE
  TO authenticated
  USING (
    chapter_id IN (
      SELECT m.chapter_id FROM public.members m
      WHERE m.id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.hierarchy_level >= 3 -- Co-Chair and above
    )
  )
  WITH CHECK (
    chapter_id IN (
      SELECT m.chapter_id FROM public.members m
      WHERE m.id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.hierarchy_level >= 3 -- Co-Chair and above
    )
  );

CREATE POLICY "Admins can delete members in their chapter"
  ON public.members FOR DELETE
  TO authenticated
  USING (
    chapter_id IN (
      SELECT m.chapter_id FROM public.members m
      WHERE m.id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.hierarchy_level >= 3 -- Co-Chair and above
    )
  );
