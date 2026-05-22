-- ================================================
-- MIGRATION: Atomic Payment Method Default Toggle
-- ================================================
-- Creates a database function that atomically sets a payment method as default
-- by unsetting all other defaults in the chapter in a single transaction.
-- Prevents race condition where two requests could leave a chapter with no default.
-- ================================================

CREATE OR REPLACE FUNCTION set_default_payment_method(
  p_method_id UUID,
  p_chapter_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Atomic: unset all defaults and set the new one in a single transaction
  UPDATE payment_methods
  SET is_default = (id = p_method_id)
  WHERE chapter_id = p_chapter_id
    AND is_active = true;
END;
$$;

COMMENT ON FUNCTION set_default_payment_method IS 'Atomically sets a payment method as the default for a chapter, unsetting all others in one operation.';

-- ================================================
-- END OF MIGRATION
-- ================================================
