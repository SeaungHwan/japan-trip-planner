/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      // 20개 넘는 파일이 각자 const SKY = "#0EA5E9" 같은 색상 상수를 따로 선언하던 걸
      // 여기 한 곳으로 모읍니다. lib/theme.js가 이 값들을 그대로 JS 상수로도 내보내서,
      // 조건부(동적) 인라인 스타일에서도 같은 소스를 참조할 수 있습니다.
      colors: {
        sky: {
          DEFAULT: "#0EA5E9",
          border: "#BAE6FD",
          bg: "#F0F9FF",
        },
        ink: "#0F2A3D",
        muted: "#5B7A90",
        faint: "#94A9B8",
        danger: "#EF4444",
        amber: "#F59E0B",
        slate: {
          bg: "#F8FAFC",
          border: "#E2E8F0",
        },
      },
      // 데스크톱 2단 레이아웃(md:) 전환 지점을 태블릿 일반 기준(768px) 대신
      // 갤럭시 Z 폴드7을 펼쳤을 때의 CSS 뷰포트 너비(984px, 세로 모드 기준)로 맞춥니다.
      screens: {
        md: "984px",
      },
    },
  },
  plugins: [],
};
