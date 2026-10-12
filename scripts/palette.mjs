// Generates and validates the palette: per group, fixed OKLCH lightness/chroma with evenly spaced hues.
// Run: node scripts/palette.mjs
const GROUPS = [
  {
    group: 'Deep', L: 0.5, C: 0.11, text: [1, 1, 1],
    names: ['Crimson', 'Amber', 'Olive', 'Forest', 'Teal', 'Ocean', 'Cobalt', 'Indigo', 'Violet', 'Berry'],
  },
  {
    group: 'Pastel', L: 0.86, C: 0.075, text: [0x1e / 255, 0x1e / 255, 0x1e / 255],
    names: ['Blush', 'Peach', 'Butter', 'Pistachio', 'Mint', 'Aqua', 'Sky', 'Periwinkle', 'Lavender', 'Orchid'],
  },
];

function oklchToRgb(l, c, h) {
  const a = c * Math.cos((h * Math.PI) / 180), b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  const inGamut = lin.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
  const srgb = lin.map((v) => { v = Math.min(1, Math.max(0, v)); return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055; });
  return { srgb, lin: lin.map((v) => Math.min(1, Math.max(0, v))), inGamut, lab: [l, a, b] };
}
const hex = (rgb) => '#' + rgb.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
const toLin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const lum = (lin) => 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
const contrast = (y1, y2) => (Math.max(y1, y2) + 0.05) / (Math.min(y1, y2) + 0.05);

const all = [];
for (const g of GROUPS) {
  const textLum = lum(g.text.map(toLin));
  console.log(`\n${g.group} (L=${g.L}, C<=${g.C})`);
  const out = g.names.map((name, i) => {
    const h = 25 + i * 36;
    let c = g.C, r = oklchToRgb(g.L, c, h);
    while (!r.inGamut) r = oklchToRgb(g.L, (c -= 0.002), h);
    return { name, group: g.group, hex: hex(r.srgb), c, contrast: contrast(lum(r.lin), textLum), lab: r.lab };
  });
  for (const p of out) console.log(' ', p.name.padEnd(10), p.hex, 'C', p.c.toFixed(3), 'text contrast', p.contrast.toFixed(2));
  let min = Infinity, pair;
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
    const d = Math.hypot(...out[i].lab.map((v, k) => v - out[j].lab[k]));
    if (d < min) { min = d; pair = [out[i].name, out[j].name]; }
  }
  console.log('  min pairwise dE(OK):', min.toFixed(3), pair);
  all.push(...out);
}
console.log('\n' + all.map((p) => `  { name: '${p.name}', hex: '${p.hex}', group: '${p.group}' },`).join('\n'));
