-- 일본 여행 플래너: 댓글/투표/팀원 추가 지역 스키마
-- Supabase 대시보드 > SQL Editor에 붙여넣고 실행하세요.
-- 이 파일은 몇 번을 다시 실행해도 안전하도록 작성되어 있습니다 (idempotent).

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
  lat double precision,
  lng double precision,
  note text,
  spots jsonb not null default '[]'::jsonb,
  created_by text not null,
  created_at timestamptz not null default now()
);

-- 지도가 실사 지도(Leaflet)로 바뀌면서 x/y(이미지 % 좌표) 대신 실제 위경도(lat/lng)를 씁니다.
-- 이미 x/y로 저장된 지역이 있다면 lat/lng를 다시 찍어 채워주세요.
alter table user_regions add column if not exists lat double precision;
alter table user_regions add column if not exists lng double precision;
alter table user_regions alter column x drop not null;
alter table user_regions alter column y drop not null;

-- AI로 지역을 추가할 때 최소 5일치 일정(대중교통/렌트카 코스)도 함께 생성해 저장합니다.
-- 형식은 REGIONS/REGIONS_MORE(data/regions.js)의 days와 동일합니다.
alter table user_regions add column if not exists days jsonb not null default '[]'::jsonb;

-- 여러 개의 독립적인 여행을 만들고 전환할 수 있게 합니다(팀 전체 공유). 기본 제공되는
-- "일본 여행"(data/regions.js)은 DB에 없는 고정 트립이라 id로 문자열 'japan-trip'을 씁니다.
alter table user_regions add column if not exists trip_id text not null default 'japan-trip';
create index if not exists user_regions_trip_idx on user_regions (trip_id);

-- id는 uuid가 아니라 text입니다: 새로 만든 여행은 클라이언트가 생성한 uuid 문자열을 쓰고,
-- 기본 제공 "일본 여행"의 제목/날짜를 수정하면 고정 id 'japan-trip'으로 이 테이블에 upsert됩니다.
create table if not exists trips (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  subtitle text,
  created_by text not null,
  created_at timestamptz not null default now()
);

-- 혹시 이 스키마의 이전 버전(id uuid)을 이미 실행했다면 text로 바꿔줍니다.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'trips' and column_name = 'id' and data_type = 'uuid'
  ) then
    alter table trips alter column id drop default;
    alter table trips alter column id type text using id::text;
    alter table trips alter column id set default gen_random_uuid()::text;
  end if;
end $$;

-- 구글 로그인 도입: 닉네임은 더 이상 자유 입력이 아니라 구글 계정 이름을 그대로 씁니다.
-- reactions는 "한 사람당 한 표"를 검증해야 하므로 nickname(중복 가능) 대신 실제 계정(user_id)으로 유일성을 잡습니다.
alter table reactions add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table reactions drop constraint if exists reactions_target_key_nickname_key;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reactions_target_key_user_id_key'
  ) then
    alter table reactions add constraint reactions_target_key_user_id_key unique (target_key, user_id);
  end if;
end $$;

-- 일정(DayCards) 항목을 트리플처럼 자유롭게 추가/수정/삭제하기 위한 테이블.
-- 원본 항목은 base:{index} 키로, 새로 추가한 항목은 custom:{uuid} 키로 구분해
-- 원본 데이터(data/regions.js)는 건드리지 않고 위에 덧씌웁니다(add/edit/delete 모두 upsert 한 건).
create table if not exists day_item_edits (
  id uuid primary key default gen_random_uuid(),
  region_id text not null,
  mode text not null check (mode in ('transit', 'car')),
  day_index int not null,
  item_key text not null,
  text text,
  deleted boolean not null default false,
  sort_order double precision not null default 0,
  updated_at timestamptz not null default now(),
  unique (region_id, mode, day_index, item_key)
);

-- 일정 항목(또는 새로 추가한 "카드")에 위치를 지정해 지도와 연동할 수 있게 합니다.
-- item_key="__custom_day__"는 기본 데이터에 없는 새 일정 카드가 존재함을 표시하는 마커이고,
-- item_key="__order__"의 sort_order는 카드/항목의 표시 순서(드래그 재정렬)에 씁니다.
alter table day_item_edits add column if not exists lat double precision;
alter table day_item_edits add column if not exists lng double precision;

create index if not exists comments_target_key_idx on comments (target_key);
create index if not exists reactions_target_key_idx on reactions (target_key);
create index if not exists day_item_edits_region_idx on day_item_edits (region_id);

alter table comments enable row level security;
alter table reactions enable row level security;
alter table user_regions enable row level security;
alter table day_item_edits enable row level security;
alter table trips enable row level security;

-- 구글 로그인 + klic.co.kr 도메인 계정만 허용. 프론트(AuthGate)에서도 이메일 도메인을
-- 확인해 튕겨내지만, API를 직접 두드리는 우회를 막으려면 DB 단에서도 같은 규칙이 필요합니다.
create or replace function is_allowed_user()
returns boolean
language sql
stable
as $$
  select auth.role() = 'authenticated' and (auth.jwt() ->> 'email') like '%@klic.co.kr';
$$;

-- drop 후 create라서 이미 존재하는 정책도 다시 실행 가능합니다.
drop policy if exists "comments_select" on comments;
create policy "comments_select" on comments for select using (is_allowed_user());
drop policy if exists "comments_insert" on comments;
create policy "comments_insert" on comments for insert with check (is_allowed_user());

drop policy if exists "reactions_select" on reactions;
create policy "reactions_select" on reactions for select using (is_allowed_user());
drop policy if exists "reactions_insert" on reactions;
create policy "reactions_insert" on reactions for insert with check (is_allowed_user());
drop policy if exists "reactions_update" on reactions;
create policy "reactions_update" on reactions for update using (is_allowed_user());
drop policy if exists "reactions_delete" on reactions;
create policy "reactions_delete" on reactions for delete using (is_allowed_user());

drop policy if exists "user_regions_select" on user_regions;
create policy "user_regions_select" on user_regions for select using (is_allowed_user());
drop policy if exists "user_regions_insert" on user_regions;
create policy "user_regions_insert" on user_regions for insert with check (is_allowed_user());
drop policy if exists "user_regions_delete" on user_regions;
create policy "user_regions_delete" on user_regions for delete using (is_allowed_user());

drop policy if exists "day_item_edits_select" on day_item_edits;
create policy "day_item_edits_select" on day_item_edits for select using (is_allowed_user());
drop policy if exists "day_item_edits_insert" on day_item_edits;
create policy "day_item_edits_insert" on day_item_edits for insert with check (is_allowed_user());
drop policy if exists "day_item_edits_update" on day_item_edits;
create policy "day_item_edits_update" on day_item_edits for update using (is_allowed_user());

drop policy if exists "trips_select" on trips;
create policy "trips_select" on trips for select using (is_allowed_user());
drop policy if exists "trips_insert" on trips;
create policy "trips_insert" on trips for insert with check (is_allowed_user());
drop policy if exists "trips_update" on trips;
create policy "trips_update" on trips for update using (is_allowed_user());

-- 실시간 구독 활성화 (이미 등록된 테이블이면 건너뜁니다)
do $$
declare
  t text;
begin
  foreach t in array array['comments', 'reactions', 'user_regions', 'day_item_edits', 'trips']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
