-- ============================================================================
-- Part 3: Cron Job Setup for Scheduled Reports
-- Created: 2025-11-28
-- Description: Sets up pg_cron jobs for scheduled report generation
-- ============================================================================

-- NOTE: pg_cron and pg_net extensions must be enabled in your Supabase project
-- This can be done via the Supabase Dashboard under Database > Extensions

-- ============================================================================
-- Scheduled Reports Cron Job
-- Runs every hour to check for and generate pending reports
-- ============================================================================

-- Enable required extensions (run in Dashboard if not enabled)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create the cron job to trigger the Edge Function
-- This job runs at the start of every hour
DO $$
BEGIN
  -- Check if cron extension is available
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove existing job if any
    PERFORM cron.unschedule('scheduled-reports-generator');

    -- Schedule the job to run every hour
    -- The Edge Function URL should be your Supabase project URL + /functions/v1/scheduled-reports
    PERFORM cron.schedule(
      'scheduled-reports-generator',
      '0 * * * *', -- Every hour at minute 0
      $$
      SELECT
        net.http_post(
          url := (SELECT vault.decrypted_secrets('project_url') || '/functions/v1/scheduled-reports'),
          headers := json_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (SELECT vault.decrypted_secrets('service_role_key'))
          )::jsonb,
          body := '{}'::jsonb
        ) as request_id;
      $$
    );

    RAISE NOTICE 'Scheduled reports cron job created successfully';
  ELSE
    RAISE NOTICE 'pg_cron extension not installed - skipping cron job creation';
  END IF;
END $$;

-- ============================================================================
-- Alternative: Direct SQL-based report generation (if Edge Functions not available)
-- ============================================================================

-- This function can be called by pg_cron directly without using Edge Functions
CREATE OR REPLACE FUNCTION process_scheduled_reports()
RETURNS void AS $$
DECLARE
  v_config RECORD;
  v_report_id UUID;
  v_start_time TIMESTAMPTZ;
  v_data_count INTEGER;
BEGIN
  -- Get pending scheduled reports
  FOR v_config IN
    SELECT
      rc.id AS config_id,
      rc.name AS report_name,
      rc.report_type,
      rc.chapter_id,
      rc.config,
      rc.date_range_type,
      rc.email_recipients,
      rc.schedule
    FROM report_configurations rc
    WHERE rc.is_active = TRUE
    AND rc.schedule != 'on_demand'
    AND rc.next_run_at <= now()
  LOOP
    v_start_time := clock_timestamp();

    BEGIN
      -- Create report record
      INSERT INTO generated_reports (
        configuration_id,
        name,
        report_type,
        format,
        chapter_id,
        parameters,
        date_from,
        date_to,
        generation_status
      ) VALUES (
        v_config.config_id,
        v_config.report_name,
        v_config.report_type,
        'json', -- Default to JSON for SQL-based generation
        v_config.chapter_id,
        v_config.config,
        CASE v_config.date_range_type
          WHEN 'last_7_days' THEN CURRENT_DATE - 7
          WHEN 'last_30_days' THEN CURRENT_DATE - 30
          WHEN 'last_90_days' THEN CURRENT_DATE - 90
          WHEN 'this_month' THEN DATE_TRUNC('month', CURRENT_DATE)::DATE
          WHEN 'this_year' THEN DATE_TRUNC('year', CURRENT_DATE)::DATE
          ELSE CURRENT_DATE - 30
        END,
        CURRENT_DATE,
        'generating'
      )
      RETURNING id INTO v_report_id;

      -- Get row count based on report type
      EXECUTE format(
        'SELECT COUNT(*) FROM %I WHERE ($1 IS NULL OR chapter_id = $1)',
        v_config.report_type || '_data'
      ) INTO v_data_count USING v_config.chapter_id;

      -- Update report as completed
      UPDATE generated_reports
      SET
        generation_status = 'completed',
        row_count = v_data_count,
        data_snapshot = jsonb_build_object(
          'summary', jsonb_build_object(
            'total_rows', v_data_count,
            'generated_at', now()
          )
        ),
        generation_time_ms = EXTRACT(MILLISECOND FROM clock_timestamp() - v_start_time)::INTEGER
      WHERE id = v_report_id;

      RAISE NOTICE 'Generated report % for config %', v_report_id, v_config.config_id;

    EXCEPTION WHEN OTHERS THEN
      -- Log error and update report as failed
      IF v_report_id IS NOT NULL THEN
        UPDATE generated_reports
        SET
          generation_status = 'failed',
          error_message = SQLERRM,
          generation_time_ms = EXTRACT(MILLISECOND FROM clock_timestamp() - v_start_time)::INTEGER
        WHERE id = v_report_id;
      END IF;

      RAISE WARNING 'Failed to generate report for config %: %', v_config.config_id, SQLERRM;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION process_scheduled_reports IS 'Processes pending scheduled reports (alternative to Edge Function)';

-- ============================================================================
-- Cron job for SQL-based approach (if Edge Functions not available)
-- ============================================================================

-- Uncomment this if using SQL-based approach instead of Edge Functions:
-- DO $$
-- BEGIN
--   IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
--     PERFORM cron.unschedule('scheduled-reports-sql');
--     PERFORM cron.schedule(
--       'scheduled-reports-sql',
--       '0 * * * *',
--       'SELECT process_scheduled_reports()'
--     );
--   END IF;
-- END $$;

-- ============================================================================
-- Daily cleanup job - archive old reports
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_reports()
RETURNS void AS $$
BEGIN
  -- Archive reports older than 90 days
  UPDATE generated_reports
  SET is_archived = TRUE
  WHERE expires_at < now()
  AND is_archived = FALSE;

  -- Delete archived reports older than 180 days
  DELETE FROM generated_reports
  WHERE is_archived = TRUE
  AND expires_at < now() - INTERVAL '90 days';

  RAISE NOTICE 'Report cleanup completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule daily cleanup at 3 AM
-- DO $$
-- BEGIN
--   IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
--     PERFORM cron.unschedule('report-cleanup');
--     PERFORM cron.schedule(
--       'report-cleanup',
--       '0 3 * * *',
--       'SELECT cleanup_old_reports()'
--     );
--   END IF;
-- END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
