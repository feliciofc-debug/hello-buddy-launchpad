-- Campanhas oficiais da IA Marketing (Meta WhatsApp Cloud API).
-- NÃO aplicar automaticamente: executar somente após backup.

create table if not exists public.whatsapp_marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  destination_type text not null check (destination_type in ('list', 'individual')),
  list_id uuid null references public.pj_listas_categoria(id) on delete set null,
  message text not null,
  image_url text null,
  template_id uuid null references public.whatsapp_templates(id) on delete set null,
  template_variables jsonb not null default '[]'::jsonb,
  scheduled_at timestamptz not null default now(),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'processing', 'completed', 'paused', 'cancelled', 'failed')),
  stop_reason text null,
  total_recipients integer not null default 0,
  total_sent integer not null default 0,
  total_delivered integer not null default 0,
  total_read integer not null default 0,
  total_failed integer not null default 0,
  total_skipped integer not null default 0,
  total_ignored_without_opt_in integer not null default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz null,
  completed_at timestamptz null,
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_marketing_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.whatsapp_marketing_campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  phone text not null,
  contact_name text null,
  send_mode text not null check (send_mode in ('session', 'template')),
  status text not null default 'queued'
    check (status in ('queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'skipped', 'cancelled')),
  attempts integer not null default 0,
  message_id text null,
  failure_reason text null,
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz null,
  delivered_at timestamptz null,
  read_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, phone)
);

create index if not exists whatsapp_marketing_campaigns_due_idx
  on public.whatsapp_marketing_campaigns (status, scheduled_at);
create index if not exists whatsapp_marketing_campaigns_user_idx
  on public.whatsapp_marketing_campaigns (user_id, created_at desc);
create index if not exists whatsapp_marketing_recipients_queue_idx
  on public.whatsapp_marketing_campaign_recipients (campaign_id, status, next_attempt_at);
create unique index if not exists whatsapp_marketing_recipients_message_idx
  on public.whatsapp_marketing_campaign_recipients (message_id)
  where message_id is not null;

alter table public.whatsapp_marketing_campaigns enable row level security;
alter table public.whatsapp_marketing_campaign_recipients enable row level security;

drop policy if exists "campaign owner reads campaigns" on public.whatsapp_marketing_campaigns;
create policy "campaign owner reads campaigns"
  on public.whatsapp_marketing_campaigns for select
  using (auth.uid() = user_id);

drop policy if exists "campaign owner reads recipients" on public.whatsapp_marketing_campaign_recipients;
create policy "campaign owner reads recipients"
  on public.whatsapp_marketing_campaign_recipients for select
  using (auth.uid() = user_id);

alter table public.historico_envios
  add column if not exists delivery_status text null,
  add column if not exists delivery_updated_at timestamptz null,
  add column if not exists delivery_error text null;

create index if not exists historico_envios_message_id_idx
  on public.historico_envios (message_id)
  where message_id is not null;
