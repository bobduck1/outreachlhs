CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('build-professor-library') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'build-professor-library');
SELECT cron.unschedule('refresh-professor-library') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-professor-library');

SELECT cron.schedule(
  'build-professor-library',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--d21d60fe-2c0f-46bf-8a43-5fe8d36bda68.lovable.app/api/public/build-library',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_FCMw4bOx8cXO-35BI3a0zg_DdpZpX_u"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'refresh-professor-library',
  '0 3 1 * *',
  $$
  UPDATE public.library_jobs
  SET status = 'pending', attempts = 0, last_error = '', updated_at = now()
  WHERE status IN ('done', 'failed');
  $$
);