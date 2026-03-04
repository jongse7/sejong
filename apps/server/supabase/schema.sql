-- Portfolio CMS schema for Hono API
-- Run this in Supabase SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  headline text,
  bio text,
  avatar_url text,
  location text,
  email text,
  website_url text,
  socials jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  constraint tags_name_unique unique (name),
  constraint tags_slug_unique unique (slug)
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  excerpt text,
  markdown text not null,
  cover_image text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  featured boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_slug_unique unique (slug)
);

create table if not exists public.post_tags (
  post_id uuid not null references public.posts(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, tag_id)
);

create index if not exists idx_posts_status_published_at
  on public.posts(status, published_at desc);

create index if not exists idx_posts_slug on public.posts(slug);
create index if not exists idx_tags_slug on public.tags(slug);
create index if not exists idx_post_tags_tag_id on public.post_tags(tag_id);
create index if not exists idx_post_tags_post_id on public.post_tags(post_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_touch_updated_at on public.profiles;
create trigger trg_profiles_touch_updated_at
before update on public.profiles
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_posts_touch_updated_at on public.posts;
create trigger trg_posts_touch_updated_at
before update on public.posts
for each row
execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.tags enable row level security;
alter table public.posts enable row level security;
alter table public.post_tags enable row level security;

drop policy if exists "Public read profiles" on public.profiles;
create policy "Public read profiles"
on public.profiles
for select
to anon, authenticated
using (true);

drop policy if exists "Public read tags" on public.tags;
create policy "Public read tags"
on public.tags
for select
to anon, authenticated
using (true);

drop policy if exists "Public read published posts" on public.posts;
create policy "Public read published posts"
on public.posts
for select
to anon, authenticated
using (status = 'published');

drop policy if exists "Public read post_tags" on public.post_tags;
create policy "Public read post_tags"
on public.post_tags
for select
to anon, authenticated
using (true);
