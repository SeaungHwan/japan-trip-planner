# 일본 소도시 여행 플래너

Next.js(App Router) + Tailwind CSS + lucide-react로 만든 여행 플래너입니다.

## 로컬 실행

```bash
npm install
npm run dev
```

http://localhost:3000 에서 확인합니다.

## Vercel 배포

1. 이 폴더를 GitHub 저장소로 올립니다.
2. https://vercel.com 에서 "Add New Project" → 해당 저장소 선택 → Framework Preset은 자동으로 Next.js가 잡힙니다 → Deploy.

또는 Vercel CLI로 바로 배포:

```bash
npm i -g vercel
vercel
```

## 구조

```
app/
  layout.jsx        # 루트 레이아웃 (폰트/메타데이터)
  page.jsx          # 홈 페이지 (Planner 렌더링)
  globals.css        # Tailwind + 커스텀 애니메이션
components/
  Planner.jsx        # 전체 상태(선택 지역/모드/체크/줌 등)를 들고 있는 메인 컴포넌트
  MapView.jsx         # 지도 이미지 + 지역 핀 + 명소 핀 + 확대(zoom) 트랜지션
  RegionChips.jsx     # 지역 선택 칩 목록 + "더보기"
  RegionHeader.jsx    # 선택된 지역 이름 표시
  FlightCard.jsx      # 인천/청주 항공편 정보 카드
  SpotsPanel.jsx      # "이 지역 더 가볼만한 곳" 접이식 패널
  ModeToggle.jsx      # 대중교통 / 렌트카 토글
  DayCards.jsx        # 일자별 코스 카드 + 완료 체크
data/
  regions.js          # 10+5개 지역의 항공편/명소/일정 데이터, 위경도 → 지도 좌표 변환 함수(geo)
  icons.js            # 지역 아이콘 문자열 → lucide-react 컴포넌트 매핑
lib/
  storage.js          # 체크 상태 localStorage 저장/불러오기
```

## 참고

- 지도 이미지는 Wikimedia Commons의 "Japan location map with side map of the Ryukyu Islands.svg"
  (NordNordWest, CC BY-SA 3.0)를 사용합니다. `next.config.mjs`의 `images.remotePatterns`에
  `commons.wikimedia.org`를 허용해 두었습니다.
- 지역/명소 핀 좌표는 실제 위도·경도를 NordNordWest가 공개한 변환식으로 계산한 값입니다
  (`data/regions.js`의 `geo()` 함수 참고). 일부 명소는 지리 지식 기반 추정치라 시내 한 블록
  정도의 오차가 있을 수 있습니다.
- 체크 상태는 브라우저 `localStorage`에 저장되며 기기/브라우저별로 별도 저장됩니다.
- 항공 노선 정보는 2026년 7월 기준이며, 변경될 수 있으니 예약 전 항공사 홈페이지에서 재확인하세요.
