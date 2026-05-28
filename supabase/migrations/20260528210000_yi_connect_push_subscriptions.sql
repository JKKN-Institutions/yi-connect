-- yi_connect push notification tables
-- Creates push_subscriptions, notification_preferences, and push_notification_logs
-- in the yi_connect schema, matching the column shape expected by:
--   lib/push-notification.ts
--   app/actions/push.ts

-- ============================================================================
-- push_subscriptions
-- ============================================================================

create table if not exists yi_connect.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references yi_connect.members(id) on delete cascade,
  endpoint     text not null,
  p256dh       text not null,
  auth         text not null,
  device_info  jsonb not null default '{}',
  is_active    boolean not null default true,
  last_used    timestamp with time zone,
  created_at   timestamp with time zone not null default now(),
  updated_at   timestamp with time zone not null default now(),
  unique (user_id, endpoint)
);

create index if not exists push_subscriptions_user_id_idx
  on yi_connect.push_subscriptions (user_id);

create index if not exists push_subscriptions_is_active_idx
  on yi_connect.push_subscriptions (is_active)
  where is_active = true;

alter table yi_connect.push_subscriptions enable row level security;

-- Members can read/manage their own subscriptions
create policy "members_select_own_push_subscriptions"
  on yi_connect.push_subscriptions for select
  using (auth.uid() = user_id);

create policy "members_insert_own_push_subscriptions"
  on yi_connect.push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "members_update_own_push_subscriptions"
  on yi_connect.push_subscriptions for update
  using (auth.uid() = user_id);

create policy "members_delete_own_push_subscriptions"
  on yi_connect.push_subscriptions for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- notification_preferences
-- ============================================================================

create table if not exists yi_connect.notification_preferences (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null unique references yi_connect.members(id) on delete cascade,
  events_enabled        boolean not null default true,
  announcements_enabled boolean not null default true,
  approvals_enabled     boolean not null default true,
  reminders_enabled     boolean not null default true,
  awards_enabled        boolean not null default true,
  tasks_enabled         boolean not null default true,
  quiet_hours_enabled   boolean not null default false,
  quiet_hours_start     text not null default '22:00',
  quiet_hours_end       text not null default '08:00',
  updated_at            timestamp with time zone not null default now()
);

alter table yi_connect.notification_preferences enable row level security;

create policy "members_select_own_notification_preferences"
  on yi_connect.notification_preferences for select
  using (auth.uid() = user_id);

create policy "members_insert_own_notification_preferences"
  on yi_connect.notification_preferences for insert
  with check (auth.uid() = user_id);

create policy "members_update_own_notification_preferences"
  on yi_connect.notification_preferences for update
  using (auth.uid() = user_id);

-- ============================================================================
-- push_notification_logs
-- ============================================================================

create table if not exists yi_connect.push_notification_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references yi_connect.members(id) on delete cascade,
  subscription_id uuid references yi_connect.push_subscriptions(id) on delete set null,
  title           text not null,
  body            text not null,
  category        text not null,
  action_url      text,
  payload         jsonb not null default '{}',
  status          text not null default 'pending'
                    check (status in ('pending', 'sent', 'delivered', 'clicked', 'failed')),
  sent_at         timestamp with time zone,
  delivered_at    timestamp with time zone,
  clicked_at      timestamp with time zone,
  error_message   text,
  created_at      timestamp with time zone not null default now()
);

create index if not exists push_notification_logs_user_id_idx
  on yi_connect.push_notification_logs (user_id);

create index if not exists push_notification_logs_status_idx
  on yi_connect.push_notification_logs (status);

alter table yi_connect.push_notification_logs enable row level security;

-- Members can read their own logs; server-side actions (service role) write them
create policy "members_select_own_push_notification_logs"
  on yi_connect.push_notification_logs for select
  using (auth.uid() = user_id);
