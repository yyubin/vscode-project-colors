import * as vscode from 'vscode';
import { GROUPS, PALETTE, foregroundFor, isHex, mix, nameOf } from './palette';
import { PanelApi, refreshPanel, showPanel } from './panel';

const REGISTRY_KEY = 'projectColors.registry';
const NAMES_KEY = 'projectColors.names';
// Registry value for a project the user explicitly un-colored, so it isn't re-assigned on next open.
const NONE = 'none';

// Every colorCustomizations key this extension may write, so reset/element changes only touch our own keys.
const MANAGED_KEYS = [
  'titleBar.activeBackground',
  'titleBar.inactiveBackground',
  'titleBar.activeForeground',
  'titleBar.inactiveForeground',
  'titleBar.border',
  'activityBar.background',
  'activityBar.foreground',
  'activityBar.inactiveForeground',
  'activityBar.activeBorder',
  'activityBarBadge.background',
  'activityBarBadge.foreground',
  'statusBar.background',
  'statusBar.foreground',
  'statusBar.border',
  'statusBarItem.hoverBackground',
  'statusBarItem.remoteBackground',
  'statusBarItem.remoteForeground',
  'tab.activeBorderTop',
  'tab.unfocusedActiveBorderTop',
];

type Registry = Record<string, string>;

let context: vscode.ExtensionContext;
let statusItem: vscode.StatusBarItem;
let writeQueue = Promise.resolve();

export function activate(ctx: vscode.ExtensionContext) {
  context = ctx;
  statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, -1000);
  statusItem.command = 'projectColors.open';

  ctx.subscriptions.push(
    statusItem,
    vscode.commands.registerCommand('projectColors.open', () => showPanel(panelApi)),
    vscode.commands.registerCommand('projectColors.change', changeColor),
    vscode.commands.registerCommand('projectColors.next', nextColor),
    vscode.commands.registerCommand('projectColors.reset', reset),
    vscode.workspace.onDidChangeWorkspaceFolders(() => applyCurrent()),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('projectColors')) {
        applyCurrent();
      }
    }),
  );

  updateStatusItem(undefined);
  applyCurrent();
}

export function deactivate() {}

/** Identity of the open project: the .code-workspace file if any, otherwise the first folder. */
function projectKey(): string | undefined {
  const file = vscode.workspace.workspaceFile;
  const uri = file && file.scheme !== 'untitled' ? file : vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!uri) {
    return undefined;
  }
  const key = uri.toString();
  return process.platform === 'win32' || process.platform === 'darwin' ? key.toLowerCase() : key;
}

function registry(): Registry {
  return { ...context.globalState.get<Registry>(REGISTRY_KEY, {}) };
}

async function saveColor(key: string, hex: string) {
  const reg = registry();
  reg[key] = hex;
  await context.globalState.update(REGISTRY_KEY, reg);
}

function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  }
  return h >>> 0;
}

/** Least-used palette color (pastels win ties), so projects stay distinct until the palette runs out. */
function pickNewColor(key: string, reg: Registry): string {
  const usage = new Map(PALETTE.map((s) => [s.hex, 0]));
  for (const [k, hex] of Object.entries(reg)) {
    if (k !== key && usage.has(hex)) {
      usage.set(hex, usage.get(hex)! + 1);
    }
  }
  const min = Math.min(...usage.values());
  const candidates = PALETTE.filter((s) => usage.get(s.hex) === min);
  const pastels = candidates.filter((s) => s.group === 'Pastel');
  const pool = pastels.length ? pastels : candidates;
  return pool[hash(key) % pool.length].hex;
}

async function applyCurrent() {
  try {
    await applyCurrentInner();
  } finally {
    refreshPanel(panelApi);
  }
}

async function applyCurrentInner() {
  const key = projectKey();
  if (!key) {
    updateStatusItem(undefined);
    return;
  }
  await rememberName(key);
  let hex = registry()[key];
  if (!hex) {
    hex = pickNewColor(key, registry());
    await saveColor(key, hex);
  }
  if (hex === NONE) {
    await writeColors(undefined);
    updateStatusItem(undefined);
    return;
  }
  await writeColors(hex);
  updateStatusItem(hex);
}

function buildColors(hex: string): Record<string, string> {
  const elements = vscode.workspace.getConfiguration('projectColors').get<string[]>('elements', []);
  const fg = foregroundFor(hex);
  const colors: Record<string, string> = {};

  if (elements.includes('titleBar')) {
    Object.assign(colors, {
      'titleBar.activeBackground': hex,
      'titleBar.inactiveBackground': hex + 'b3',
      'titleBar.activeForeground': fg,
      'titleBar.inactiveForeground': fg + 'b3',
      'titleBar.border': hex,
    });
  }
  if (elements.includes('activityBar')) {
    Object.assign(colors, {
      'activityBar.background': hex,
      'activityBar.foreground': fg,
      'activityBar.inactiveForeground': fg + '99',
      'activityBar.activeBorder': fg,
      'activityBarBadge.background': fg,
      'activityBarBadge.foreground': hex,
    });
  }
  if (elements.includes('statusBar')) {
    Object.assign(colors, {
      'statusBar.background': hex,
      'statusBar.foreground': fg,
      'statusBar.border': hex,
      'statusBarItem.hoverBackground': mix(hex, fg, 0.15),
      'statusBarItem.remoteBackground': mix(hex, '#000000', 0.2),
      'statusBarItem.remoteForeground': fg,
    });
  }
  if (elements.includes('activeTab')) {
    Object.assign(colors, {
      'tab.activeBorderTop': hex,
      'tab.unfocusedActiveBorderTop': hex + '80',
    });
  }
  return colors;
}

/** Serialized so rapid QuickPick previews can't land out of order. */
function writeColors(hex: string | undefined): Promise<void> {
  writeQueue = writeQueue.then(() => doWriteColors(hex)).catch((e) => {
    vscode.window.showErrorMessage(`Project Colors: failed to save settings - ${e}`);
  });
  return writeQueue;
}

/** Replaces only our keys in workspace colorCustomizations, leaving the user's own entries intact. */
async function doWriteColors(hex: string | undefined) {
  const config = vscode.workspace.getConfiguration('workbench');
  const current = config.inspect<Record<string, string>>('colorCustomizations')?.workspaceValue ?? {};
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries(current)) {
    if (!MANAGED_KEYS.includes(k)) {
      next[k] = v;
    }
  }
  if (hex) {
    Object.assign(next, buildColors(hex));
  }
  if (JSON.stringify(next) === JSON.stringify(current)) {
    return;
  }
  await config.update(
    'colorCustomizations',
    Object.keys(next).length ? next : undefined,
    vscode.ConfigurationTarget.Workspace,
  );
}

/** Always visible (unless disabled), so the picker is reachable even before a color is set. */
function updateStatusItem(hex: string | undefined) {
  if (!vscode.workspace.getConfiguration('projectColors').get('showStatusBarItem', true)) {
    statusItem.hide();
    return;
  }
  if (hex) {
    statusItem.text = `$(symbol-color) ${nameOf(hex)}`;
    statusItem.tooltip = `Project Colors: ${nameOf(hex)} (${hex})\nClick to open the color picker`;
  } else {
    statusItem.text = '$(symbol-color) No color';
    statusItem.tooltip = projectKey()
      ? 'Project Colors: no color set\nClick to open the color picker'
      : 'Project Colors: open a folder to assign a color';
  }
  statusItem.show();
}

/** QuickPick icons need a file, so each swatch is written once as a tiny SVG. */
async function swatchIcon(hex: string): Promise<vscode.Uri> {
  const dir = vscode.Uri.joinPath(context.globalStorageUri, 'swatches');
  const uri = vscode.Uri.joinPath(dir, hex.slice(1) + '.svg');
  try {
    await vscode.workspace.fs.stat(uri);
  } catch {
    await vscode.workspace.fs.createDirectory(dir);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect x="1" y="1" width="14" height="14" rx="3" fill="${hex}"/></svg>`;
    await vscode.workspace.fs.writeFile(uri, Buffer.from(svg));
  }
  return uri;
}

interface ColorItem extends vscode.QuickPickItem {
  hex?: string;
  custom?: boolean;
}

async function changeColor() {
  const key = projectKey();
  if (!key) {
    vscode.window.showWarningMessage('Project Colors: no folder is open.');
    return;
  }
  const original = registry()[key];
  const reg = registry();
  const usedBy = (hex: string) => Object.entries(reg).filter(([k, v]) => k !== key && v === hex).length;

  const swatches: ColorItem[] = await Promise.all(
    PALETTE.map(async (s) => ({
      label: s.name,
      description: s.hex === original ? 'current' : s.hex,
      detail: usedBy(s.hex) ? `Used by ${usedBy(s.hex)} other project(s)` : undefined,
      iconPath: await swatchIcon(s.hex),
      hex: s.hex,
    })),
  );
  const items: ColorItem[] = GROUPS.flatMap((g) => [
    { label: g, kind: vscode.QuickPickItemKind.Separator },
    ...swatches.filter((_, i) => PALETTE[i].group === g),
  ]);
  items.push(
    { label: '', kind: vscode.QuickPickItemKind.Separator },
    { label: '$(edit) Enter HEX...', custom: true },
  );

  const pick = vscode.window.createQuickPick<ColorItem>();
  pick.title = 'Project Colors: color for this project';
  pick.placeholder = 'Arrow keys to preview, Enter to apply, Esc to cancel';
  pick.items = items;
  pick.activeItems = items.filter((i) => i.hex === original);

  let accepted = false;
  pick.onDidChangeActive(([item]) => {
    if (item?.hex) {
      writeColors(item.hex);
    }
  });
  pick.onDidAccept(async () => {
    const item = pick.selectedItems[0];
    accepted = true;
    pick.hide();
    let hex = item?.hex;
    if (item?.custom) {
      const input = await vscode.window.showInputBox({
        prompt: 'HEX color (e.g. #2f6f8f)',
        value: original,
        validateInput: (v) => (isHex(v.trim()) ? undefined : 'Use the #RRGGBB format'),
      });
      hex = input?.trim().toLowerCase();
    }
    if (hex) {
      await saveColor(key, hex);
    }
    await applyCurrent();
  });
  pick.onDidHide(() => {
    if (!accepted) {
      applyCurrent();
    }
    pick.dispose();
  });
  pick.show();
}

async function nextColor() {
  const key = projectKey();
  if (!key) {
    return;
  }
  const index = PALETTE.findIndex((s) => s.hex === registry()[key]);
  await saveColor(key, PALETTE[(index + 1) % PALETTE.length].hex);
  await applyCurrent();
}

async function reset() {
  const key = projectKey();
  if (!key) {
    return;
  }
  await saveColor(key, NONE);
  await applyCurrent();
  vscode.window.showInformationMessage(
    'Project Colors: color removed. Run "Project Colors: Open Color Picker" to color it again.',
  );
}

function projectName(): string {
  const file = vscode.workspace.workspaceFile;
  if (file && file.scheme !== 'untitled') {
    return file.path.split('/').pop()!.replace(/.code-workspace$/, '');
  }
  return vscode.workspace.workspaceFolders?.[0]?.name ?? '';
}

/** Keys are lower-cased on Windows/macOS, so keep the original folder name for display. */
async function rememberName(key: string) {
  const names = context.globalState.get<Record<string, string>>(NAMES_KEY, {});
  const name = projectName();
  if (names[key] !== name) {
    await context.globalState.update(NAMES_KEY, { ...names, [key]: name });
  }
}

const panelApi: PanelApi = {
  getState() {
    const key = projectKey();
    if (!key) {
      return undefined;
    }
    const names = context.globalState.get<Record<string, string>>(NAMES_KEY, {});
    const reg = registry();
    const current = reg[key];
    return {
      projectName: projectName(),
      current: current && current !== NONE ? current : undefined,
      elements: vscode.workspace.getConfiguration('projectColors').get<string[]>('elements', []),
      others: Object.entries(reg)
        .filter(([k, hex]) => k !== key && hex !== NONE)
        .map(([k, hex]) => ({ name: names[k] ?? decodeURIComponent(k.split('/').pop() ?? k), hex }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  },
  preview(hex) {
    if (isHex(hex)) {
      writeColors(hex.toLowerCase());
    }
  },
  endPreview() {
    applyCurrent();
  },
  async apply(hex) {
    const key = projectKey();
    if (key && isHex(hex)) {
      await saveColor(key, hex.toLowerCase());
      await applyCurrent();
    }
  },
  async setElements(elements) {
    // onDidChangeConfiguration re-applies the colors.
    await vscode.workspace
      .getConfiguration('projectColors')
      .update('elements', elements, vscode.ConfigurationTarget.Global);
  },
  async reset() {
    const key = projectKey();
    if (key) {
      await saveColor(key, NONE);
      await applyCurrent();
    }
  },
};
