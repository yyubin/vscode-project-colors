// Generates and validates the palette: fixed OKLCH lightness/chroma, evenly spaced hues.
// Run: node scripts/palette.mjs
const L = 0.5, C = 0.11;
const names = ['Crimson', 'Amber', 'Olive', 'Forest', 'Teal', 'Ocean', 'Cobalt', 'Indigo', 'Violet', 'Berry'];
const HUES = names.map((_, i) => 25 + i * 36);

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
const lum = (lin) => 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];

const out = HUES.map((h, i) => { let c = C, r = oklchToRgb(L, c, h); while (!r.inGamut) r = oklchToRgb(L, (c -= 0.002), h); return { name: names[i], h, hex: hex(r.srgb), inGamut: r.inGamut, contrast: 1.05 / (lum(r.lin) + 0.05), lab: r.lab }; });
for (const p of out) console.log(p.name.padEnd(8), p.hex, 'gamut', p.inGamut, 'white contrast', p.contrast.toFixed(2));
let min = Infinity, pair;
for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
  const d = Math.hypot(...out[i].lab.map((v, k) => v - out[j].lab[k]));
  if (d < min) { min = d; pair = [out[i].name, out[j].name]; }
}
console.log('min pairwise dE(OK):', min.toFixed(3), pair);
