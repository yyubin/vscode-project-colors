# Project Colors

열린 경로(프로젝트)마다 고유한 색을 자동으로 배정해서 타이틀바, 액티비티바, 상태바, 활성 탭 테두리를 칠합니다.

- 같은 경로를 열면 항상 같은 색
- 새 경로를 열면 아직 가장 적게 쓰인 색을 배정, 파스텔 우선 (20개 프로젝트까지는 모두 다른 색)
- 상태바의 `🎨 색이름`을 클릭하면 색 선택 패널이 열림
  - 팔레트 색 칸에 마우스를 올리면 미리보기, 클릭하면 적용
  - 색상 선택기/HEX로 직접 지정
  - 칠할 영역 체크박스, 다른 프로젝트들의 색 목록

## 명령 (Ctrl+Shift+P)
- `Project Colors: Open Color Picker`: 색 선택 패널
- `Project Colors: Quick Pick Color`: 명령 팔레트 목록에서 선택 (방향키 미리보기)
- `Project Colors: Next Color`
- `Project Colors: Remove Color from This Project`

## 설정
- `projectColors.elements`: 칠할 영역 (`titleBar`, `activityBar`, `statusBar`, `activeTab`)
- `projectColors.showStatusBarItem`: 상태바 색 이름 표시 여부

## 팔레트
`scripts/palette.mjs`에서 생성합니다. 그룹마다 OKLCH 밝기와 채도를 고정하고 색상만 36° 간격으로 나눴습니다.

**Pastel** (L 0.86, C ≤ 0.075): 어두운 글자(#1e1e1e) 대비 10.5:1 이상, 가장 비슷한 두 색 ΔE(OK) 0.045

| Blush | Peach | Butter | Pistachio | Mint | Aqua | Sky | Periwinkle | Lavender | Orchid |
|---|---|---|---|---|---|---|---|---|---|
| #ffbfb8 | #f6c69f | #dfd299 | #bedcaa | #a0e1c9 | #95e0e8 | #a5d8fe | #c5ceff | #e2c3f5 | #f8bdd9 |

**Deep** (L 0.50, C ≤ 0.11): 흰 글자 대비 5.7:1 이상, 가장 비슷한 두 색 ΔE(OK) 0.059

| Crimson | Amber | Olive | Forest | Teal | Ocean | Cobalt | Indigo | Violet | Berry |
|---|---|---|---|---|---|---|---|---|---|
| #984742 | #8f520f | #746303 | #497029 | #007559 | #06717a | #126a9c | #545ca1 | #794f8f | #90466d |

## 참고
색은 VS Code 구조상 워크스페이스 설정(`.vscode/settings.json`의 `workbench.colorCustomizations`)에 기록됩니다.
팀 저장소라면 `.vscode/settings.json`을 커밋하지 않도록 주의하세요.

## 개발
```
npm install
npm run compile   # F5로 디버그 실행
npm run package   # .vsix 생성
```
