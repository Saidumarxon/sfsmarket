-- Customer profiles for admin "Клиенты" list + avatars bucket
-- Run once in Supabase SQL Editor

-- ===== Avatars storage =====
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars public read"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

create policy "avatars user upload own"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars user update own"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars user delete own"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ===== Customer profiles (Google / site users) =====
create table if not exists public.customer_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  phone text,
  avatar_url text,
  provider text not null default 'google',
  passport text,
  birthday text,
  gender text,
  address text,
  work_address text,
  orders_count int not null default 0,
  orders_total bigint not null default 0,
  registered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_profiles_last_seen_idx
  on public.customer_profiles (last_seen_at desc);

create index if not exists customer_profiles_email_idx
  on public.customer_profiles (email);

alter table public.customer_profiles enable row level security;

create policy "customer_profiles upsert self"
  on public.customer_profiles for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "customer_profiles update self"
  on public.customer_profiles for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "customer_profiles read self"
  on public.customer_profiles for select
  to authenticated
  using (auth.uid() = user_id);

create policy "customer_profiles admin read all"
  on public.customer_profiles for select
  to authenticated
  using (exists (select 1 from public.admin_users u where u.user_id = auth.uid()));

create or replace function public.customer_profiles_preserve_registered()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    new.registered_at := old.registered_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists customer_profiles_preserve_registered_trg on public.customer_profiles;
create trigger customer_profiles_preserve_registered_trg
  before update on public.customer_profiles
  for each row execute function public.customer_profiles_preserve_registered();
