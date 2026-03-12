-- Migration: Add get_user_roles_detailed function for SSO integration
-- This function is required by Yi Creative SSO to fetch user role information

-- Create the get_user_roles_detailed function
CREATE OR REPLACE FUNCTION public.get_user_roles_detailed(p_user_id UUID)
RETURNS TABLE (
  role_id UUID,
  role_name TEXT,
  hierarchy_level INTEGER,
  permissions TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id AS role_id,
    r.name AS role_name,
    r.hierarchy_level,
    r.permissions
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  WHERE ur.user_id = p_user_id
  ORDER BY r.hierarchy_level DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_roles_detailed(UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_user_roles_detailed IS 'Returns detailed role information for a user, used by SSO integrations (Yi Creative, etc.)';
