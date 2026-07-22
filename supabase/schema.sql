-- 일본 여행 플래너: 댓글/투표/팀원 추가 지역 스키마
-- Supabase 대시보드 > SQL Editor에 붙여넣고 실행하세요.

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  target_key text not null,
  nickname text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists reactions (
  id uuid primary key default gen_random_uuid(),
  target_key text not null,
  nickname text not null,
  value smallint not null check (value in (1, -1)),
  created_at timestamptz not null default now(),
  unique (target_key, nickname)
);

create table if not exists user_regions (
  id uuid primary key default gen_random_uuid(),
  kr text not null,
  jp text,
  x double precision not null,
  y double precision not null,
  note text,
  spots jsonb not null default '[]'::jsonb,
  created_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists comments_target_key_idx on comments (target_key);
create index if not exists reactions_target_key_idx on reactions (target_key);

alter table comments enable row level security;
alter table reactions enable row level security;
alter table user_regions enable row level security;

-- 인증 없이 닉네임만으로 쓰는 소규모 팀 앱이라 anon 역할에 읽기/쓰기를 모두 허용합니다.
create policy "comments_select" on comments for select using (true);
create policy "comments_insert" on comments for insert with check (true);

create policy "reactions_select" on reactions for select using (true);
create policy "reactions_insert" on reactions for insert with check (true);
create policy "reactions_update" on reactions for update using (true);
create policy "reactions_delete" on reactions for delete using (true);

create policy "user_regions_select" on user_regions for select using (true);
create policy "user_regions_insert" on user_regions for insert with check (true);

-- 실시간 구독 활성화
alter publication supabase_realtime add table comments;
alter publication supabase_realtime add table reactions;
alter publication supabase_realtime add table user_regions;
