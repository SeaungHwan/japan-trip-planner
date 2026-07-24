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

-- id는 uuid가 아니라 text입니다: 클라이언트가 생성한 uuid 문자열을 그대로 씁니다.
create table if not exists user_regions (
  id text primary key default gen_random_uuid()::text,
  kr text not null,
  jp text,
  icon text,
  lat double precision,
  lng double precision,
  note text,
  flight jsonb,
  spots jsonb not null default '[]'::jsonb,
  is_extra boolean not null default false,
  created_by text not null,
  created_at timestamptz not null default now()
);

-- 혹시 이 스키마의 이전 버전(id uuid)을 이미 실행했다면 text로 바꿔줍니다.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'user_regions' and column_name = 'id' and data_type = 'uuid'
  ) then
    alter table user_regions alter column id drop default;
    alter table user_regions alter column id type text using id::text;
    alter table user_regions alter column id set default gen_random_uuid()::text;
  end if;
end $$;

alter table user_regions add column if not exists icon text;
alter table user_regions add column if not exists flight jsonb;
alter table user_regions add column if not exists is_extra boolean not null default false;

-- 개인이 만든 지역은 그 사람 또는 마스터만 지울 수 있게 실제 계정을 기록합니다.
alter table user_regions add column if not exists user_id uuid references auth.users(id) on delete set null;

-- 지도가 실사 지도(Leaflet)로 바뀌면서 x/y(이미지 % 좌표) 대신 실제 위경도(lat/lng)를 씁니다.
-- 이미 x/y로 저장된 지역이 있다면 lat/lng를 다시 찍어 채워주세요.
alter table user_regions add column if not exists lat double precision;
alter table user_regions add column if not exists lng double precision;

-- x/y 컬럼이 아예 없는 테이블에서 이 줄이 에러를 내면 스크립트 전체가 롤백되므로,
-- 존재할 때만 not null을 해제하도록 방어적으로 처리합니다.
do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'user_regions' and column_name = 'x') then
    alter table user_regions alter column x drop not null;
  end if;
  if exists (select 1 from information_schema.columns where table_name = 'user_regions' and column_name = 'y') then
    alter table user_regions alter column y drop not null;
  end if;
end $$;

-- AI로 지역을 추가할 때 최소 5일치 일정(대중교통/렌트카 코스)도 함께 생성해 저장합니다.
alter table user_regions add column if not exists days jsonb not null default '[]'::jsonb;

-- 여러 개의 독립적인 여행을 만들고 전환할 수 있게 합니다(팀 전체 공유). 모든 지역은 반드시
-- 특정 트립(trips.id)에 속해야 하므로 기본값 없이 앱이 항상 명시적으로 넣습니다.
alter table user_regions add column if not exists trip_id text not null default 'japan-trip';
alter table user_regions alter column trip_id drop default;
create index if not exists user_regions_trip_idx on user_regions (trip_id);

-- id는 uuid가 아니라 text입니다: 클라이언트가 생성한 uuid 문자열을 그대로 씁니다.
create table if not exists trips (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  subtitle text,
  created_by text not null,
  created_at timestamptz not null default now()
);

-- 여행도 지역처럼 만든 사람 또는 마스터만 지울 수 있게 실제 계정을 기록합니다.
alter table trips add column if not exists user_id uuid references auth.users(id) on delete set null;

-- 여행은 기본적으로 "개인 전용"입니다. 공유하기를 눌러 is_shared를 true로 바꿔야만
-- 다른 사람(마스터 포함)에게 보입니다.
alter table trips add column if not exists is_shared boolean not null default false;

-- 공유를 "보기만" / "편집까지" 두 단계로 나눕니다. is_shared가 꺼져 있으면 이 값은 의미가 없고,
-- is_shared가 켜져 있을 때만 shared_editable로 편집 허용 여부를 추가로 판단합니다.
alter table trips add column if not exists shared_editable boolean not null default false;

-- 여행 기간의 실제 날짜(연도 포함). 예전에는 "9.18 — 9.22" 같은 표시용 문자열(subtitle)만
-- 있고 연도가 없어서 날씨 조회 등 실제 날짜 계산에는 쓸 수 없었습니다.
alter table trips add column if not exists start_date date;
alter table trips add column if not exists end_date date;

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
-- 원본 데이터(user_regions.days)는 건드리지 않고 위에 덧씌웁니다(add/edit/delete 모두 upsert 한 건).
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

-- 일정 항목에 자유롭게 메모/사진을 남기는 테이블. day_item_edits와 달리 unique 제약이 없어
-- 댓글처럼 한 항목에 여러 건이 계속 쌓일 수 있고(수정은 없이 추가/삭제만), 지역을 만든 사람
-- 또는 마스터만 남기고 지울 수 있습니다("가볼만한 곳"/spots과 같은 권한 규칙).
create table if not exists day_item_notes (
  id uuid primary key default gen_random_uuid(),
  region_id text not null,
  mode text not null check (mode in ('transit', 'car')),
  day_index int not null,
  item_key text not null,
  text text,
  photo_url text,
  created_at timestamptz not null default now()
);
create index if not exists day_item_notes_item_idx on day_item_notes (region_id, mode, day_index, item_key);

create index if not exists comments_target_key_idx on comments (target_key);
create index if not exists reactions_target_key_idx on reactions (target_key);
create index if not exists day_item_edits_region_idx on day_item_edits (region_id);

alter table comments enable row level security;
alter table reactions enable row level security;
alter table user_regions enable row level security;
alter table day_item_edits enable row level security;
alter table day_item_notes enable row level security;
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

-- 일정 카드(day_item_edits)는 아무나 고치면 서로 지우고 덮어쓸 위험이 있어서
-- 마스터 계정만 추가/수정할 수 있게 잠급니다. 누가 마스터인지는 코드(git)에 이메일을
-- 박아두지 않고, 이 admins 테이블에만 저장합니다 — 값은 코드가 아니라 DB에만 존재합니다.
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table admins enable row level security;
-- 의도적으로 select/insert 정책을 하나도 만들지 않습니다: API로 이 목록을 직접 읽거나
-- 고칠 수 있는 사람은 아무도 없고, 아래 is_master_user() 함수(security definer)만 들여다볼 수 있습니다.

create or replace function is_master_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select is_allowed_user() and exists (select 1 from admins where user_id = auth.uid());
$$;
grant execute on function is_master_user() to authenticated, anon;

-- 트립 소유자가 "편집까지 공유"를 켜면(is_shared and shared_editable), 그 트립에 속한
-- 지역/spots/일정카드/메모를 마스터·소유자가 아닌 다른 허용된 사용자도 고칠 수 있게 합니다.
-- is_shared가 꺼져 있으면 shared_editable 값과 무관하게 항상 false입니다.
create or replace function trip_shared_editable(p_trip_id text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from trips t where t.id = p_trip_id and t.is_shared and t.shared_editable
  );
$$;
grant execute on function trip_shared_editable(text) to authenticated, anon;

-- 여행 공유 기능이 생기기 전에 만들어진 여행은 user_id가 비어있을 수 있는데, 그러면 본인조차
-- 그 여행을 수정/공유 전환할 방법이 없어집니다. 관리자(admins) 계정으로 소유권을 넘겨
-- 최소한 마스터는 계속 관리할 수 있게 안전망을 둡니다.
update trips set user_id = (select user_id from admins limit 1)
where user_id is null and exists (select 1 from admins);

-- "일본 여행"(id='japan-trip') 기본 트립은 더 이상 특별 취급하지 않기로 해서, 코드/정책뿐
-- 아니라 실제 데이터도 지웁니다. day_item_edits/day_item_notes는 region_id만으로 연결돼
-- 있어(FK 없음) region_id가 남기 전에 먼저 지워야 고아 행이 안 남습니다. 이미 지워졌으면
-- 조건에 걸리는 게 없어 그냥 0건 삭제라, 몇 번을 다시 실행해도 안전합니다.
delete from day_item_notes where region_id in (select id from user_regions where trip_id = 'japan-trip');
delete from day_item_edits where region_id in (select id from user_regions where trip_id = 'japan-trip');
delete from comments where target_key in (select 'region:' || id from user_regions where trip_id = 'japan-trip');
delete from reactions where target_key in (select 'region:' || id from user_regions where trip_id = 'japan-trip');
delete from user_regions where trip_id = 'japan-trip';
delete from trips where id = 'japan-trip';

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

-- 지역은 자기가 속한 여행이 공개(is_shared)이거나 내가 만든 여행일 때만 보입니다.
drop policy if exists "user_regions_select" on user_regions;
create policy "user_regions_select" on user_regions for select using (
  is_allowed_user()
  and exists (select 1 from trips t where t.id = user_regions.trip_id and (t.is_shared or t.user_id = auth.uid()))
);
-- 지역을 새로 넣으려면 그 트립의 주인이거나, 트립이 "편집까지 공유" 상태여야 합니다.
-- 예전에는 is_allowed_user()만 확인해서 트립 소유권과 무관하게 아무나 아무 trip_id에나
-- 지역을 꽂을 수 있었는데(UI에선 막혀 있었지만 API 직접 호출은 가능했음), 편집 권한을
-- 명시적으로 나누면서 이 구멍도 같이 막았습니다.
drop policy if exists "user_regions_insert" on user_regions;
create policy "user_regions_insert" on user_regions for insert with check (
  is_allowed_user() and (
    exists (select 1 from trips t where t.id = user_regions.trip_id and t.user_id = auth.uid())
    or trip_shared_editable(trip_id)
  )
);
drop policy if exists "user_regions_delete" on user_regions;
create policy "user_regions_delete" on user_regions for delete using (
  is_master_user() or auth.uid() = user_id or trip_shared_editable(trip_id)
);
-- "가볼만한 곳" 추가/삭제처럼 지역 자체를 고치는 것도 삭제와 같은 규칙(만든 사람·마스터·편집공유 대상)을 씁니다.
drop policy if exists "user_regions_update" on user_regions;
create policy "user_regions_update" on user_regions for update using (
  is_master_user() or auth.uid() = user_id or trip_shared_editable(trip_id)
);

-- 일정 카드(제목/항목 추가·수정·삭제·순서변경)는 원래 마스터 전용이었지만, 지역 소유자가
-- 자기 트립의 "편집까지 공유"를 켰을 때는 다른 허용된 사용자도 고칠 수 있어야 하므로
-- 지역 소유자 본인과 trip_shared_editable() 대상도 함께 허용합니다.
drop policy if exists "day_item_edits_select" on day_item_edits;
create policy "day_item_edits_select" on day_item_edits for select using (is_allowed_user());
drop policy if exists "day_item_edits_insert" on day_item_edits;
create policy "day_item_edits_insert" on day_item_edits for insert with check (
  is_master_user()
  or exists (select 1 from user_regions r where r.id = day_item_edits.region_id and (r.user_id = auth.uid() or trip_shared_editable(r.trip_id)))
);
drop policy if exists "day_item_edits_update" on day_item_edits;
create policy "day_item_edits_update" on day_item_edits for update using (
  is_master_user()
  or exists (select 1 from user_regions r where r.id = day_item_edits.region_id and (r.user_id = auth.uid() or trip_shared_editable(r.trip_id)))
);

drop policy if exists "day_item_notes_select" on day_item_notes;
create policy "day_item_notes_select" on day_item_notes for select using (is_allowed_user());
drop policy if exists "day_item_notes_insert" on day_item_notes;
create policy "day_item_notes_insert" on day_item_notes for insert with check (
  is_master_user()
  or exists (select 1 from user_regions r where r.id = day_item_notes.region_id and (r.user_id = auth.uid() or trip_shared_editable(r.trip_id)))
);
drop policy if exists "day_item_notes_delete" on day_item_notes;
create policy "day_item_notes_delete" on day_item_notes for delete using (
  is_master_user()
  or exists (select 1 from user_regions r where r.id = day_item_notes.region_id and (r.user_id = auth.uid() or trip_shared_editable(r.trip_id)))
);

-- 메모에 붙일 사진을 저장하는 버킷: 공개 읽기, 업로드/삭제는 허용된 사용자 전체로 제한합니다.
-- 실제로 버튼이 보이는 건 지역 소유자·마스터뿐이라(canManageRegion), 이 정도로 충분합니다.
insert into storage.buckets (id, name, public)
values ('day-item-photos', 'day-item-photos', true)
on conflict (id) do nothing;

drop policy if exists "day_item_photos_read" on storage.objects;
create policy "day_item_photos_read" on storage.objects for select
  using (bucket_id = 'day-item-photos');
drop policy if exists "day_item_photos_insert" on storage.objects;
create policy "day_item_photos_insert" on storage.objects for insert
  with check (bucket_id = 'day-item-photos' and is_allowed_user());
drop policy if exists "day_item_photos_delete" on storage.objects;
create policy "day_item_photos_delete" on storage.objects for delete
  using (bucket_id = 'day-item-photos' and is_allowed_user());

-- 여행은 기본적으로 개인 전용입니다. 공유(is_shared)한 여행이거나 내가 만든 여행만 보이고,
-- 마스터라고 해서 다른 사람의 비공개 여행을 볼 수 있는 예외는 없습니다.
drop policy if exists "trips_select" on trips;
create policy "trips_select" on trips for select using (
  is_allowed_user() and (is_shared or auth.uid() = user_id)
);
drop policy if exists "trips_insert" on trips;
create policy "trips_insert" on trips for insert with check (is_allowed_user());
-- 여행 정보/공유 여부를 바꾸는 건 만든 사람만 할 수 있습니다(마스터도 예외 없음).
drop policy if exists "trips_update" on trips;
create policy "trips_update" on trips for update using (
  is_allowed_user() and auth.uid() = user_id
);
drop policy if exists "trips_delete" on trips;
create policy "trips_delete" on trips for delete using (is_master_user() or auth.uid() = user_id);

-- 실시간 구독 활성화 (이미 등록된 테이블이면 건너뜁니다)
do $$
declare
  t text;
begin
  foreach t in array array['comments', 'reactions', 'user_regions', 'day_item_edits', 'day_item_notes', 'trips']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;


insert into admins (user_id)
select id from auth.users where email = 'hanan0912@klic.co.kr'
on conflict do nothing;  