/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        sky: {
          DEFAULT: "#0EA5E9",
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
