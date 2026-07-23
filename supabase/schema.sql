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

-- id는 uuid가 아니라 text입니다: 새로 추가하는 지역은 클라이언트가 생성한 uuid 문자열을 쓰고,
-- 원래 하드코딩돼 있던 15개 기본 지역(data/regions.js)을 이전할 때는 slug(sapporo 등)를 그대로 씁니다.
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

-- 하드코딩돼 있던 15개 기본 지역(data/regions.js)을 user_regions로 이전하는 1회성 시드.
-- id를 기존 슬러그(sapporo 등)로 그대로 유지해 day_item_edits/comments/reactions의 region_id 참조가 끊기지 않게 합니다.
insert into user_regions (id, kr, jp, icon, lat, lng, flight, spots, days, is_extra, trip_id, created_by)
values
  ('sapporo', '삿포로', '札幌', 'snowflake', 43.06, 141.35, '{"incheon":"대한항공·아시아나항공·진에어·제주항공·티웨이항공 등 다수 (약 2시간30분)","cheongju":"에어로케이항공 데일리 (1일 2회)"}'::jsonb, '[{"name":"삿포로 시계탑","lat":43.0621,"lng":141.3544},{"name":"아카렌가(구본청사)","lat":43.0618,"lng":141.3467},{"name":"조잔케이 온천","lat":42.9989,"lng":141.1758},{"name":"삿포로 팩토리","lat":43.0644,"lng":141.3597},{"name":"마루야마 동물원","lat":43.0575,"lng":141.3121}]'::jsonb, '[{"transit":{"title":"삿포로 시내","items":["지하철 오도리역","오도리공원","TV타워","스스키노 라멘"]},"car":{"title":"삿포로 시내 & 픽업","items":["신치토세공항 렌터카 픽업","오도리공원 주차 관람"]}},{"transit":{"title":"오타루 (JR)","items":["JR하코다테선 약 30분","오타루 운하","유리공예 거리"]},"car":{"title":"니세코 방향 드라이브","items":["시코츠호 드라이브","온천 족욕","오타루 해안도로"]}},{"transit":{"title":"맥주 & 시장 (지하철)","items":["삿포로맥주박물관","니조시장"]},"car":{"title":"노보리베츠 온천 드라이브","items":["노보리베츠 지옥계곡","온천 족욕"]}},{"transit":{"title":"홋카이도신궁 (지하철)","items":["마루야마코엔역","홋카이도신궁","모에레누마공원"]},"car":{"title":"비에이·후라노 드라이브","items":["비에이 패치워크로드","시로가네 청의 호수"]}},{"transit":{"title":"쇼핑 & 귀국","items":["다누키코지","지하철+쾌속열차로 공항"]},"car":{"title":"쇼핑 & 귀국","items":["렌터카 반납","공항 이동"]}}]'::jsonb, false, 'japan-trip', 'seed'),
  ('hanamaki', '하나마키', '花巻', 'book-open', 39.38, 141.13, '{"incheon":"정기 직항 없음","cheongju":"에어로케이 도호쿠 부정기 전세편 이력(2026년 상반기~) — 정기편 아님, 운항일 확인 필수","note":"정기편이 없는 시즌엔 도쿄(하네다/나리타) 또는 센다이 경유 후 신칸센(모리오카역) 이용 권장"}'::jsonb, '[{"name":"도노(遠野) 민화마을","lat":39.3383,"lng":141.6142},{"name":"하야치네산","lat":39.5253,"lng":141.4817},{"name":"오하사마 유메밧파쿠","lat":39.45,"lng":141.05},{"name":"겐지 청년회관","lat":39.3931,"lng":141.1256}]'::jsonb, '[{"transit":{"title":"모리오카 (신칸센)","items":["신칸센 모리오카역","모리오카하치만구","성터공원","이시와리자카"]},"car":{"title":"모리오카 & 픽업","items":["렌터카 픽업(모리오카)","성터공원 주차 관람"]}},{"transit":{"title":"미야자와 켄지 (JR+버스)","items":["신하나마키역+버스","켄지기념관","켄지동화마을"]},"car":{"title":"켄지 & 목장지대 드라이브","items":["켄지기념관","오하사마 목장지대 드라이브"]}},{"transit":{"title":"하나마키온천 (버스)","items":["하나마키역 온천행 버스","신도토 계곡·폭포"]},"car":{"title":"하치만타이 드라이브","items":["하치만타이 아스피테라인","산간 온천지대"]}},{"transit":{"title":"은하철도 SL (JR)","items":["가마이시선 SL(운행일 확인)","하나마키 문화촌"]},"car":{"title":"산리쿠 해안 드라이브","items":["산리쿠 해안도로","가마이시 항구마을"]}},{"transit":{"title":"자유일정 & 귀국","items":["모리오카역/하나마키공항 이동"]},"car":{"title":"자유일정 & 귀국","items":["렌터카 반납","공항 이동"]}}]'::jsonb, false, 'japan-trip', 'seed'),
  ('niigata', '니가타', '新潟', 'wine', 37.9, 139.05, '{"incheon":"대한항공 (주3회, 약 2시간)","cheongju":"정기 직항 없음"}'::jsonb, '[{"name":"산조 카지야마을","lat":37.6333,"lng":138.9667},{"name":"무라카미 성터","lat":38.2258,"lng":139.4844},{"name":"니가타현립 근대미술관","lat":37.4167,"lng":138.85},{"name":"야히코신사","lat":37.7014,"lng":138.8189}]'::jsonb, '[{"transit":{"title":"니가타 시내 (JR)","items":["JR니가타역","반다이 지역","사케 시음"]},"car":{"title":"니가타 시내 & 픽업","items":["공항/역 렌터카 픽업","해안도로 드라이브"]}},{"transit":{"title":"사도섬 (페리, 도보승선)","items":["니가타항 페리","사도킨잔 금광 인근만"]},"car":{"title":"사도섬 일주 드라이브","items":["차량 페리 도항","사도섬 해안 일주"]}},{"transit":{"title":"에치고유자와 (신칸센)","items":["조에츠신칸센 약 40분","온천마을 산책"]},"car":{"title":"협곡 온천 드라이브","items":["에치고유자와 인근 협곡","료칸 온천"]}},{"transit":{"title":"니가타 복귀 (JR)","items":["후루마치 지역","마린피아 수족관"]},"car":{"title":"무라카미 방향 드라이브","items":["무라카미 사케·연어마을","북부 해안도로"]}},{"transit":{"title":"자유일정 & 귀국","items":["사케뮤지엄","JR니가타역/공항"]},"car":{"title":"자유일정 & 귀국","items":["렌터카 반납","공항 이동"]}}]'::jsonb, false, 'japan-trip', 'seed'),
  ('omitama', '오미타마', '小美玉', 'plane', 36.18, 140.42, '{"incheon":"2025년 에어로케이 취항 이력 있으나 2026.8.3부터 단항 예정 — 9월 여행 시 운항 여부 재확인 필수","cheongju":"에어로케이 2026.6.2 단항 — 현재 정기편 없음","note":"정기편이 불확실하므로 도쿄(나리타/하네다) 경유 + 고속버스 대안도 함께 확인"}'::jsonb, '[{"name":"우시쿠 대불","lat":35.9686,"lng":140.1486},{"name":"카사마 도자기마을","lat":36.3486,"lng":140.2544},{"name":"나메가타시 고구마스위츠","lat":35.9833,"lng":140.5},{"name":"츠쿠바산","lat":36.2128,"lng":140.1064}]'::jsonb, '[{"transit":{"title":"공항 주변 (공항버스)","items":["이바라키공항 공항버스(배차 적음)","히타치해변공원"]},"car":{"title":"공항 픽업 & 드라이브","items":["공항 렌터카 픽업","히타치해변공원 드라이브"]}},{"transit":{"title":"미토 중심 (JR)","items":["JR미토역","카이라쿠엔","미토성"]},"car":{"title":"가스미가우라 드라이브","items":["가스미가우라 호수 일주","겐잔테이 카페"]}},{"transit":{"title":"카사마 (JR)","items":["JR미토선","카사마이나리신사","카사마 도자기마을"]},"car":{"title":"오아라이 해안 드라이브","items":["오아라이 해안도로","아쿠아월드 수족관"]}},{"transit":{"title":"츠쿠바 당일 (고속버스)","items":["츠쿠바行 고속버스","츠쿠바산","우주센터"]},"car":{"title":"햐쿠리 전망 드라이브","items":["햐쿠리 공군기지 전망","시골길 드라이브"]}},{"transit":{"title":"자유일정 & 귀국","items":["공항버스로 복귀"]},"car":{"title":"자유일정 & 귀국","items":["렌터카 반납","공항 이동"]}}]'::jsonb, false, 'japan-trip', 'seed'),
  ('shizuoka', '시즈오카', '静岡', 'mountain', 34.98, 138.38, '{"incheon":"제주항공 (주7회, 약 1시간55분)","cheongju":"정기 직항 없음"}'::jsonb, '[{"name":"니혼다이라 로프웨이","lat":34.9686,"lng":138.4653},{"name":"쿠노잔 도쇼구","lat":34.9611,"lng":138.4636},{"name":"우나기파이 팩토리","lat":34.7108,"lng":137.7269},{"name":"사쿠라에비 미치노에키","lat":35.15,"lng":138.4667}]'::jsonb, '[{"transit":{"title":"시즈오카 시내 (JR)","items":["JR시즈오카역","스루가만 산책"]},"car":{"title":"니혼다이라 드라이브","items":["공항 렌터카 픽업","니혼다이라 전망대"]}},{"transit":{"title":"미호노마츠바라 (버스)","items":["JR+버스","미호노마츠바라","후지산 세계유산센터"]},"car":{"title":"후지산 스카이라인 드라이브","items":["후지산 스카이라인","다카텐보 전망대"]}},{"transit":{"title":"온천 이동 (JR)","items":["JR도카이도선 이토/아타미"]},"car":{"title":"이즈반도 일주 드라이브","items":["이즈스카이라인","조가사키 해안 절벽길"]}},{"transit":{"title":"슈젠지 (버스)","items":["이즈하코네철도+버스","슈젠지 온천마을"]},"car":{"title":"차밭 드라이브","items":["마키노하라 차밭","다이코쿠텐 전망대"]}},{"transit":{"title":"자유일정 & 귀국","items":["참치덮밥","JR로 공항"]},"car":{"title":"자유일정 & 귀국","items":["렌터카 반납","공항 이동"]}}]'::jsonb, false, 'japan-trip', 'seed'),
  ('nagoya', '나고야', '名古屋', 'landmark', 35.18, 136.9, '{"incheon":"대한항공·아시아나항공·진에어·제주항공·JAL·피치항공 등 다수 (약 1시간50분~2시간)","cheongju":"에어로케이항공 정기 운항 (청주발 일본 5대 도시 노선 중 하나)"}'::jsonb, '[{"name":"도쿠가와엔","lat":35.1811,"lng":136.9314},{"name":"오스칸논","lat":35.1567,"lng":136.9},{"name":"히사야오도리공원","lat":35.1747,"lng":136.9058},{"name":"시로토리정원","lat":35.1394,"lng":136.9022}]'::jsonb, '[{"transit":{"title":"나고야성 (지하철)","items":["시야쿠쇼역","나고야성","사카에 상점가"]},"car":{"title":"나고야성 & 픽업","items":["공항 렌터카 픽업","나고야성 주차 관람"]}},{"transit":{"title":"아츠타신궁 (메이테츠)","items":["진구마에역","아츠타신궁","노리타케의 숲"]},"car":{"title":"이누야마 당일 드라이브","items":["이누야마성 드라이브","이누야마 조카마치"]}},{"transit":{"title":"근교 당일치기 (메이테츠 특급)","items":["이누야마성 or 도요타기념관"]},"car":{"title":"세토·이나바산 드라이브","items":["세토시 도자기거리","이나바산 전망대"]}},{"transit":{"title":"나고야항 수족관 (지하철)","items":["나고야코역","수족관","히츠마부시 저녁"]},"car":{"title":"수족관 & 레고랜드","items":["주차 후 수족관","레고랜드 재팬"]}},{"transit":{"title":"자유일정 & 귀국","items":["지하철+공항특급 뮤스카이"]},"car":{"title":"자유일정 & 귀국","items":["렌터카 반납","공항 이동"]}}]'::jsonb, false, 'japan-trip', 'seed'),
  ('yonago', '요나고', '米子', 'ghost', 35.43, 133.33, '{"incheon":"에어서울 (유일 노선, 1일 1회, 약 1시간25분)","cheongju":"정기 직항 없음"}'::jsonb, '[{"name":"요나고성터","lat":35.4319,"lng":133.3308},{"name":"나카우미","lat":35.45,"lng":133.25},{"name":"다이센지","lat":35.3722,"lng":133.5486},{"name":"게게게 요괴신사","lat":35.5386,"lng":133.2306}]'::jsonb, '[{"transit":{"title":"가이케온천 (버스)","items":["요나고역 버스","가이케온천 산책"]},"car":{"title":"가이케온천 & 픽업","items":["공항 렌터카 픽업","온천 해안 드라이브"]}},{"transit":{"title":"사카이미나토 (요괴열차)","items":["JR사카이선 요괴열차","미즈키시게루로드"]},"car":{"title":"사카이미나토 & 미호만 드라이브","items":["미즈키시게루로드","미호만 해안도로"]}},{"transit":{"title":"요나고 시내 대체 코스","items":["요나고성터","*다이센행 대중교통 매우 제한적"]},"car":{"title":"다이센산 드라이브","items":["다이센 스카이라인","다이센마키바 전망대"]}},{"transit":{"title":"돗토리 당일 (JR+버스)","items":["사구행 버스(편수 적음)","돗토리사구"]},"car":{"title":"돗토리사구 & 우유고원","items":["돗토리사구","우유고원 드라이브"]}},{"transit":{"title":"자유일정 & 귀국","items":["요나고역/공항 이동"]},"car":{"title":"자유일정 & 귀국","items":["렌터카 반납","공항 이동"]}}]'::jsonb, false, 'japan-trip', 'seed'),
  ('hiroshima', '히로시마', '広島', 'feather', 34.4, 132.46, '{"incheon":"제주항공 (주14회, 약 1시간45분)","cheongju":"제주항공 운항 (에어로케이 노선은 아직 미확정)"}'::jsonb, '[{"name":"센테이엔 정원","lat":34.3953,"lng":132.4589},{"name":"미타키데라","lat":34.4128,"lng":132.4267},{"name":"오코노미무라","lat":34.3953,"lng":132.4597},{"name":"야마토뮤지엄(구레)","lat":34.2394,"lng":132.5661}]'::jsonb, '[{"transit":{"title":"평화기념공원 (노면전차)","items":["히로시마역 노면전차","원폭돔","평화기념자료관"]},"car":{"title":"평화기념공원 & 픽업","items":["공항 렌터카 픽업","평화기념공원 주차 관람"]}},{"transit":{"title":"미야지마 (JR+페리)","items":["JR미야지마구치","페리 도항","이츠쿠시마신사"]},"car":{"title":"미야지마 & 해안도로","items":["미야지마구치 주차 후 페리","세토내해 해안도로"]}},{"transit":{"title":"히로시마성 (노면전차)","items":["히로시마성","슛케이엔 정원"]},"car":{"title":"미요시 산간 드라이브","items":["미요시 분지 뷰포인트","산간 와이너리"]}},{"transit":{"title":"오노미치 당일 (JR)","items":["JR로 오노미치","골목길·고양이의 길"]},"car":{"title":"도모노우라 & 시마나미 드라이브","items":["도모노우라 포구마을","시마나미카이도 전망대"]}},{"transit":{"title":"자유일정 & 이동","items":["신칸센 히로시마역"]},"car":{"title":"자유일정 & 이동","items":["렌터카 반납","신칸센/공항 이동"]}}]'::jsonb, false, 'japan-trip', 'seed'),
  ('matsuyama', '마츠야마', '松山', 'droplets', 33.84, 132.77, '{"incheon":"제주항공 (1일 1회, 약 1시간50분)","cheongju":"에어로케이항공 정기·부정기 확대 중 (시즌별 변동 — 확인 필요)"}'::jsonb, '[{"name":"로프웨이 상점가","lat":33.8422,"lng":132.7658},{"name":"시키도(정자규 기념관)","lat":33.8489,"lng":132.7728},{"name":"사다미사키 등대","lat":33.3572,"lng":132.0064},{"name":"다이코쿠자키","lat":33.35,"lng":132}]'::jsonb, '[{"transit":{"title":"마츠야마성 (노면전차)","items":["伊予鉄道 노면전차","마츠야마성 로프웨이","오카이도 상점가"]},"car":{"title":"마츠야마성 & 픽업","items":["공항 렌터카 픽업","숙소 근처 코인주차장"]}},{"transit":{"title":"도고온천 (봇짱열차)","items":["봇짱열차 or 노면전차","도고온천 본관"]},"car":{"title":"도고온천 & 근교","items":["도고온천 방문","인근 전망대 드라이브"]}},{"transit":{"title":"시마나미카이도 (버스+자전거)","items":["고속버스로 이마바리","자전거 대여 라이딩"]},"car":{"title":"구마코겐 산간 드라이브","items":["구마코겐 고원지대","오모고계곡","산간 온천"]}},{"transit":{"title":"이시테지 & 역사 (노면전차)","items":["이시테지 사찰","역사박물관"]},"car":{"title":"사다미사키반도 드라이브","items":["사다미사키반도 해안도로","전망대"]}},{"transit":{"title":"쇼핑 & 귀국","items":["노면전차로 공항 이동"]},"car":{"title":"쇼핑 & 귀국","items":["렌터카 반납","공항 이동"]}}]'::jsonb, false, 'japan-trip', 'seed'),
  ('okinawa', '오키나와', '沖縄', 'waves', 26.2, 127.68, '{"incheon":"제주항공·티웨이항공·진에어·이스타항공·대한항공·ANA 등 다수, 매일 다수 (약 2시간30분)","cheongju":"에어로케이항공 데일리 운항 (2025.10.1 신규취항, 2026 하계 스케줄도 매일 운항 확정)"}'::jsonb, '[{"name":"킨조초 돌다다미길","lat":26.2144,"lng":127.7189},{"name":"비오스노 언덕","lat":26.4594,"lng":127.9089},{"name":"얀바루 국립공원","lat":26.75,"lng":128.2},{"name":"세소코섬","lat":26.6386,"lng":127.8667},{"name":"마키시 어시장 카츄야","lat":26.2136,"lng":127.6792}]'::jsonb, '[{"transit":{"title":"나하 도착 & 시내 (모노레일)","items":["유이모노레일","국제거리·마키시시장","나미노우에비치"]},"car":{"title":"나하 도착 & 픽업","items":["공항 렌터카 픽업","국제거리 산책"]}},{"transit":{"title":"모노레일 라인 관광","items":["슈리성(슈리역)","세나가지마 우미카지테라스"]},"car":{"title":"슈리 & 오키나와월드","items":["슈리성","오키나와월드 교차동굴","신구스쿠성터"]}},{"transit":{"title":"중남부 버스 투어","items":["나카구스쿠성터","차탄 아메리칸빌리지","선셋비치"]},"car":{"title":"북부 드라이브, 츄라우미","items":["오키나와자동차도 북상","츄라우미 수족관","만좌모"]}},{"transit":{"title":"국제거리 주변 마무리","items":["츠보야 야치문거리","시내 카페"]},"car":{"title":"북부 해변 & 고우리섬","items":["고우리대교 드라이브","해변 카페"]}},{"transit":{"title":"차탄 & 귀국","items":["버스로 차탄","유이레일로 공항"]},"car":{"title":"쇼핑 & 귀국","items":["렌터카 반납","공항 근처 아울렛"]}}]'::jsonb, false, 'japan-trip', 'seed'),
  ('aomori', '아오모리', '青森', 'trees', 40.82, 140.74, '{"incheon":"대한항공 (주3회, 계절 운항 — 확인 필요)","cheongju":"정기 직항 없음"}'::jsonb, '[{"name":"히로사키성 & 벚꽃공원","lat":40.6083,"lng":140.4675},{"name":"오소레잔","lat":41.325,"lng":141.1697},{"name":"오와니온천","lat":40.6167,"lng":140.5667},{"name":"고쇼가와라 다치네부타관","lat":40.8083,"lng":140.4525}]'::jsonb, '[{"transit":{"title":"아오모리 시내 (도보)","items":["아오모리역 주변","네부타노 이에 와랏세"]},"car":{"title":"아오모리 시내 & 픽업","items":["공항 렌터카 픽업","시내 드라이브"]}},{"transit":{"title":"네부타 박물관 (도보)","items":["네부타노 이에 와랏세","아스팜"]},"car":{"title":"핫코다산 드라이브","items":["핫코다 로프웨이","산악 드라이브"]}},{"transit":{"title":"산나이마루야마 유적 (버스)","items":["조몬 유적 버스"]},"car":{"title":"도와다코 드라이브","items":["도와다호","오이라세 계류 드라이브"]}},{"transit":{"title":"히로사키성 (JR)","items":["JR히로사키역","히로사키성"]},"car":{"title":"오이라세 계류 드라이브","items":["오이라세 계류","도와다호 전망"]}},{"transit":{"title":"자유일정 & 귀국","items":["아오모리역/공항 이동"]},"car":{"title":"자유일정 & 귀국","items":["렌터카 반납","공항 이동"]}}]'::jsonb, true, 'japan-trip', 'seed'),
  ('kanazawa', '가나자와', '金沢', 'landmark', 36.56, 136.65, '{"incheon":"대한항공 (고마츠공항, 주3회)","cheongju":"정기 직항 없음","note":"고마츠 노선이 가나자와행 유일한 직항 — 배차가 적어 일정 확인 필수"}'::jsonb, '[{"name":"오야마신사","lat":36.5658,"lng":136.6511},{"name":"니시차야거리","lat":36.5525,"lng":136.65},{"name":"오미초시장","lat":36.5697,"lng":136.6533},{"name":"유와쿠온천","lat":36.5058,"lng":136.6994}]'::jsonb, '[{"transit":{"title":"고마츠공항 → 가나자와 (버스)","items":["공항버스로 가나자와역 이동"]},"car":{"title":"공항 픽업 & 이동","items":["공항 렌터카 픽업","가나자와 시내 이동"]}},{"transit":{"title":"겐로쿠엔 & 가나자와성 (버스)","items":["겐로쿠엔","가나자와성공원"]},"car":{"title":"겐로쿠엔 & 성 드라이브","items":["겐로쿠엔 주차 관람","가나자와성"]}},{"transit":{"title":"히가시차야거리 (도보)","items":["히가시차야거리","오미초시장"]},"car":{"title":"시라카와고 드라이브","items":["갓쇼즈쿠리 합장촌","전망대"]}},{"transit":{"title":"21세기미술관 (도보)","items":["21세기미술관","나가마치 무가저택"]},"car":{"title":"노토반도 드라이브","items":["노토반도 해안도로","전통 어촌마을"]}},{"transit":{"title":"자유일정 & 귀국","items":["고마츠공항 버스"]},"car":{"title":"자유일정 & 귀국","items":["렌터카 반납","공항 이동"]}}]'::jsonb, true, 'japan-trip', 'seed'),
  ('takamatsu', '다카마츠', '高松', 'palmtree', 34.34, 134.05, '{"incheon":"정기 직항 없음","cheongju":"정기 직항 없음","note":"오카야마 또는 마츠야마 공항 경유 후 열차·버스 이용 권장"}'::jsonb, '[{"name":"야시마 전망대","lat":34.3611,"lng":134.0983},{"name":"메기지마(도깨비섬)","lat":34.3742,"lng":134.0489},{"name":"쇼도시마 올리브공원","lat":34.4844,"lng":134.2394},{"name":"나카노우동학교","lat":34.3167,"lng":134.0333}]'::jsonb, '[{"transit":{"title":"다카마츠 시내 (도보)","items":["다카마츠역 주변","우동 투어"]},"car":{"title":"다카마츠 시내 & 픽업","items":["경유 공항 렌터카 픽업","다카마츠 이동"]}},{"transit":{"title":"리츠린공원 (버스)","items":["리츠린공원"]},"car":{"title":"리츠린공원 드라이브","items":["리츠린공원 주차 관람"]}},{"transit":{"title":"나오시마 (페리)","items":["나오시마행 페리","베네세하우스 예술섬"]},"car":{"title":"나오시마 (페리+도보)","items":["선착장까지 드라이브","페리 도항 후 도보"]}},{"transit":{"title":"고토히라구 (JR)","items":["JR고토히라역","고토히라궁 계단"]},"car":{"title":"시코쿠무라 드라이브","items":["시코쿠무라 민가마을"]}},{"transit":{"title":"자유일정 & 귀국","items":["경유편으로 귀국"]},"car":{"title":"자유일정 & 귀국","items":["렌터카 반납","경유 공항 이동"]}}]'::jsonb, true, 'japan-trip', 'seed'),
  ('nagasaki', '나가사키', '長崎', 'church', 32.75, 129.88, '{"incheon":"대한항공 (약 1시간30분)","cheongju":"정기 직항 없음"}'::jsonb, '[{"name":"군칸지마(하시마)","lat":32.6272,"lng":129.7386},{"name":"메가네바시","lat":32.7444,"lng":129.8747},{"name":"시마바라성","lat":32.7856,"lng":130.3739},{"name":"소토메 오소노숲","lat":32.8333,"lng":129.75}]'::jsonb, '[{"transit":{"title":"데지마 (노면전차)","items":["나가사키역 노면전차","데지마","오란다자카"]},"car":{"title":"나가사키 시내 & 픽업","items":["공항 렌터카 픽업","시내 드라이브"]}},{"transit":{"title":"글로버엔 (노면전차)","items":["글로버엔","오우라성당"]},"car":{"title":"이나사야마 전망대 드라이브","items":["이나사야마 야경 전망대"]}},{"transit":{"title":"하우스텐보스 (JR특급)","items":["JR특급 하우스텐보스","테마파크"]},"car":{"title":"하우스텐보스 드라이브","items":["하우스텐보스 주차 관람"]}},{"transit":{"title":"평화공원 (노면전차)","items":["평화공원","원폭자료관"]},"car":{"title":"운젠온천 드라이브","items":["운젠 지옥온천","화산 전망"]}},{"transit":{"title":"자유일정 & 귀국","items":["노면전차로 공항 이동"]},"car":{"title":"자유일정 & 귀국","items":["렌터카 반납","공항 이동"]}}]'::jsonb, true, 'japan-trip', 'seed'),
  ('kumamoto', '구마모토', '熊本', 'mountain-snow', 32.79, 130.71, '{"incheon":"대한항공·티웨이항공 (약 1시간40분)","cheongju":"정기 직항 없음"}'::jsonb, '[{"name":"야마가온천 토우로마츠리","lat":33.0128,"lng":130.6883},{"name":"아소 화산박물관","lat":32.8842,"lng":131.1042},{"name":"우토시 미카사 벚꽃길","lat":32.6858,"lng":130.6547},{"name":"미스미시 렌카쿠지","lat":32.6167,"lng":130.4333}]'::jsonb, '[{"transit":{"title":"구마모토성 (노면전차)","items":["구마모토성","조사이엔"]},"car":{"title":"구마모토성 & 픽업","items":["공항 렌터카 픽업","구마모토성 주차 관람"]}},{"transit":{"title":"스이젠지조주엔 (노면전차)","items":["스이젠지조주엔"]},"car":{"title":"아소산 드라이브","items":["아소산 분화구","쿠사센리 초원"]}},{"transit":{"title":"아소산 (버스, 편수 제한)","items":["아소역+버스"]},"car":{"title":"구사센리 초원 드라이브","items":["초원 드라이브","목장 카페"]}},{"transit":{"title":"구로카와온천 (버스)","items":["구로카와온천 마을"]},"car":{"title":"구로카와온천 드라이브","items":["온천마을 드라이브","족욕"]}},{"transit":{"title":"자유일정 & 귀국","items":["노면전차로 공항 이동"]},"car":{"title":"자유일정 & 귀국","items":["렌터카 반납","공항 이동"]}}]'::jsonb, true, 'japan-trip', 'seed')
on conflict (id) do nothing;

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
create policy "day_item_edits_insert" on day_item_edits for insert with check (is_master_user());
drop policy if exists "day_item_edits_update" on day_item_edits;
create policy "day_item_edits_update" on day_item_edits for update using (is_master_user());

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
