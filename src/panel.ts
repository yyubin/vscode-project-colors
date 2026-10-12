import * as vscode from 'vscode';
import { PALETTE } from './palette';

export interface PanelState {
  projectName: string;
  /** Current hex, or undefined when the project is un-colored. */
  current: string | undefined;
  elements: string[];
  others: { name: string; hex: string }[];
}

export interface PanelApi {
  getState(): PanelState | undefined;
  preview(hex: string): void;
  endPreview(): void;
  apply(hex: string): Promise<void>;
  setElements(elements: string[]): Promise<void>;
  reset(): Promise<void>;
}

const ELEMENTS: [string, string][] = [
  ['titleBar', '타이틀바'],
  ['activityBar', '액티비티바'],
  ['statusBar', '상태바'],
  ['activeTab', '활성 탭'],
];

let panel: vscode.WebviewPanel | undefined;

export function showPanel(api: PanelApi) {
  if (panel) {
    panel.reveal();
    refreshPanel(api);
    return;
  }
  panel = vscode.window.createWebviewPanel('projectColors.picker', 'Project Colors', vscode.ViewColumn.Active, {
    enableScripts: true,
    localResourceRoots: [],
  });
  panel.iconPath = new vscode.ThemeIcon('symbol-color');
  panel.webview.html = html(panel.webview);
  panel.webview.onDidReceiveMessage(async (msg) => {
    switch (msg.type) {
      case 'ready':
        break;
      case 'preview':
        api.preview(msg.hex);
        return;
      case 'endPreview':
        api.endPreview();
        return;
      case 'apply':
        await api.apply(msg.hex);
        break;
      case 'elements':
        await api.setElements(msg.elements);
        break;
      case 'reset':
        await api.reset();
        break;
    }
    refreshPanel(api);
  });
  panel.onDidDispose(() => {
    api.endPreview();
    panel = undefined;
  });
}

export function refreshPanel(api: PanelApi) {
  panel?.webview.postMessage({ type: 'state', state: api.getState() });
}

function html(webview: vscode.Webview): string {
  const nonce = Array.from({ length: 32 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
  const csp = `default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';`;
  return /* html */ `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { --radius: 8px; --gap: 12px; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 24px 28px 40px;
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    font-family: var(--vscode-font-family); font-size: 13px; line-height: 1.5;
  }
  main { max-width: 640px; }
  header { display: flex; align-items: center; gap: 14px; margin-bottom: 28px; }
  .chip { width: 40px; height: 40px; border-radius: var(--radius); flex: none;
    border: 1px solid var(--vscode-widget-border, transparent); }
  .chip.none { background: repeating-linear-gradient(45deg, transparent 0 6px, var(--vscode-widget-border, #8884) 6px 7px); }
  h1 { margin: 0; font-size: 16px; font-weight: 600; }
  .sub { color: var(--vscode-descriptionForeground); font-size: 12px; }
  h2 { margin: 28px 0 10px; font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase;
    color: var(--vscode-descriptionForeground); }
  .grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: var(--gap); }
  .swatch { all: unset; cursor: pointer; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .swatch .fill { position: relative; height: 52px; border-radius: var(--radius);
    outline: 2px solid transparent; outline-offset: 2px; transition: transform .12s ease, outline-color .12s ease; }
  .swatch:hover .fill { transform: translateY(-2px); }
  .swatch:focus-visible .fill { outline-color: var(--vscode-focusBorder); }
  .swatch.current .fill { outline-color: var(--vscode-foreground); }
  .swatch .check { position: absolute; inset: 0; display: none; place-items: center; color: #fff; font-size: 18px; }
  .swatch.current .check { display: grid; }
  .swatch .used { position: absolute; top: 6px; right: 6px; min-width: 18px; height: 18px; padding: 0 5px;
    border-radius: 9px; background: #0006; color: #fff; font-size: 10px; display: grid; place-items: center; }
  .swatch .label { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .swatch .hex { font-size: 11px; color: var(--vscode-descriptionForeground); font-family: var(--vscode-editor-font-family); }
  .custom { display: flex; align-items: center; gap: 10px; }
  input[type=color] { width: 44px; height: 32px; padding: 0; border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 6px; background: none; cursor: pointer; }
  input[type=text] { width: 110px; height: 32px; padding: 0 10px; border-radius: 6px;
    color: var(--vscode-input-foreground); background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border, transparent); font-family: var(--vscode-editor-font-family); }
  input[type=text]:focus { outline: 1px solid var(--vscode-focusBorder); }
  button.primary { height: 32px; padding: 0 14px; border: 0; border-radius: 6px; cursor: pointer;
    color: var(--vscode-button-foreground); background: var(--vscode-button-background); }
  button.primary:hover { background: var(--vscode-button-hoverBackground); }
  button.link { all: unset; cursor: pointer; color: var(--vscode-textLink-foreground); font-size: 12px; }
  button.link:hover { text-decoration: underline; }
  .toggles { display: flex; flex-wrap: wrap; gap: 8px 20px; }
  .toggles label { display: flex; align-items: center; gap: 6px; cursor: pointer; }
  .toggles input { accent-color: var(--vscode-button-background); }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  li { display: flex; align-items: center; gap: 10px; }
  li .dot { width: 12px; height: 12px; border-radius: 3px; flex: none; }
  li .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .empty { color: var(--vscode-descriptionForeground); }
  footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--vscode-widget-border, #8883); }
  @media (max-width: 420px) { .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } body { padding: 16px; } }
</style>
</head>
<body>
<main>
  <header>
    <div class="chip" id="chip"></div>
    <div>
      <h1 id="project">Project Colors</h1>
      <div class="sub" id="currentLabel"></div>
    </div>
  </header>

  <h2>팔레트</h2>
  <div class="grid" id="grid"></div>

  <h2>직접 고르기</h2>
  <div class="custom">
    <input type="color" id="picker" aria-label="색 선택">
    <input type="text" id="hexInput" maxlength="7" spellcheck="false" aria-label="HEX">
    <button class="primary" id="applyCustom">적용</button>
  </div>

  <h2>칠할 영역</h2>
  <div class="toggles" id="toggles"></div>

  <h2>다른 프로젝트</h2>
  <ul id="others"></ul>

  <footer><button class="link" id="reset">이 프로젝트 색 제거</button></footer>
</main>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const PALETTE = ${JSON.stringify(PALETTE)};
  const ELEMENTS = ${JSON.stringify(ELEMENTS)};
  const $ = (id) => document.getElementById(id);
  const isHex = (v) => /^#[0-9a-f]{6}$/i.test(v);
  let state;
  let previewTimer;

  function schedulePreview(hex) {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => vscode.postMessage({ type: 'preview', hex }), 180);
  }
  function endPreview() {
    clearTimeout(previewTimer);
    vscode.postMessage({ type: 'endPreview' });
  }

  const grid = $('grid');
  for (const s of PALETTE) {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.dataset.hex = s.hex;
    b.title = s.name + ' ' + s.hex;
    b.innerHTML = '<div class="fill" style="background:' + s.hex + '"><span class="check">✓</span></div>' +
      '<span class="label">' + s.name + '</span><span class="hex">' + s.hex + '</span>';
    b.addEventListener('mouseenter', () => schedulePreview(s.hex));
    b.addEventListener('click', () => { clearTimeout(previewTimer); vscode.postMessage({ type: 'apply', hex: s.hex }); });
    grid.appendChild(b);
  }
  grid.addEventListener('mouseleave', endPreview);

  const picker = $('picker'), hexInput = $('hexInput');
  picker.addEventListener('input', () => { hexInput.value = picker.value; schedulePreview(picker.value); });
  picker.addEventListener('change', () => vscode.postMessage({ type: 'apply', hex: picker.value }));
  hexInput.addEventListener('input', () => {
    const v = hexInput.value.trim();
    if (isHex(v)) { picker.value = v; schedulePreview(v.toLowerCase()); }
  });
  const applyCustom = () => {
    const v = hexInput.value.trim().toLowerCase();
    if (isHex(v)) vscode.postMessage({ type: 'apply', hex: v });
    else hexInput.focus();
  };
  $('applyCustom').addEventListener('click', applyCustom);
  hexInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyCustom(); if (e.key === 'Escape') endPreview(); });

  const toggles = $('toggles');
  for (const [id, label] of ELEMENTS) {
    const l = document.createElement('label');
    l.innerHTML = '<input type="checkbox" value="' + id + '"> ' + label;
    l.querySelector('input').addEventListener('change', () => {
      const elements = [...toggles.querySelectorAll('input:checked')].map((i) => i.value);
      vscode.postMessage({ type: 'elements', elements });
    });
    toggles.appendChild(l);
  }

  $('reset').addEventListener('click', () => vscode.postMessage({ type: 'reset' }));

  function render() {
    if (!state) {
      $('project').textContent = '열린 폴더가 없습니다';
      return;
    }
    const cur = state.current;
    const sw = PALETTE.find((s) => s.hex === cur);
    $('project').textContent = state.projectName;
    $('currentLabel').textContent = cur ? (sw ? sw.name + ' · ' + cur : '직접 지정 · ' + cur) : '색 없음';
    $('chip').className = 'chip' + (cur ? '' : ' none');
    $('chip').style.background = cur || '';
    if (cur && document.activeElement !== hexInput) { picker.value = cur; hexInput.value = cur; }

    const counts = {};
    for (const o of state.others) counts[o.hex] = (counts[o.hex] || 0) + 1;
    for (const b of grid.children) {
      b.classList.toggle('current', b.dataset.hex === cur);
      b.querySelector('.used')?.remove();
      const n = counts[b.dataset.hex];
      if (n) {
        const u = document.createElement('span');
        u.className = 'used';
        u.textContent = n;
        u.title = '다른 프로젝트 ' + n + '개에서 사용 중';
        b.querySelector('.fill').appendChild(u);
      }
    }
    for (const i of toggles.querySelectorAll('input')) i.checked = state.elements.includes(i.value);

    const ul = $('others');
    ul.innerHTML = '';
    if (!state.others.length) ul.innerHTML = '<li class="empty">아직 없습니다</li>';
    for (const o of state.others) {
      const li = document.createElement('li');
      li.innerHTML = '<span class="dot"></span><span class="name"></span>';
      li.querySelector('.dot').style.background = o.hex;
      li.querySelector('.name').textContent = o.name;
      li.title = o.hex;
      ul.appendChild(li);
    }
  }

  window.addEventListener('message', (e) => {
    if (e.data.type === 'state') { state = e.data.state; render(); }
  });
  vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`;
}
