# Project Colors

열린 경로(프로젝트)마다 고유한 색을 자동으로 배정해서 타이틀바, 액티비티바, 상태바, 활성 탭 테두리를 칠합니다.

- 같은 경로를 열면 항상 같은 색
- 새 경로를 열면 아직 가장 적게 쓰인 색을 배정 (10개 프로젝트까지는 모두 다른 색)
- 상태바의 `🎨 색이름`을 클릭하면 색 변경 (방향키로 미리보기, Enter 확정, Esc 취소)

## 명령 (Ctrl+Shift+P)
- `Project Colors: 색 변경`: 팔레트에서 고르거나 HEX 직접 입력
- `Project Colors: 다음 색으로`
- `Project Colors: 이 프로젝트 색 제거`

## 설정
- `projectColors.elements`: 칠할 영역 (`titleBar`, `activityBar`, `statusBar`, `activeTab`)
- `projectColors.showStatusBarItem`: 상태바 색 이름 표시 여부

## 팔레트
`scripts/palette.mjs`에서 생성합니다. OKLCH 밝기 0.50, 채도 최대 0.11로 고정하고 색상만 36° 간격으로 나눴습니다.
흰 글자 대비는 모두 5.7:1 이상(WCAG AA)이고, 가장 비슷한 두 색의 차이도 ΔE(OK) 0.059입니다.

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
