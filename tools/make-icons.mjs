import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "assets", "icons");
const SIZES = [16, 32, 48, 128];
const SCALE = 4;

const INK = [0x17, 0x15, 0x12, 0xff];
const ACCENT = [0xa5, 0x1f, 0x1f, 0xff];
const WARN = [0x7d, 0x52, 0x10, 0xff];
const CLEAN = [0x6b, 0x61, 0x52, 0xff];
const CLEAR = [0, 0, 0, 0];

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typed = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed), 0);
  return Buffer.concat([length, typed, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function pointInRotatedBar(x, y) {
  const cx = 0.5;
  const cy = 0.5;
  const angle = (18 * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  const rx = dx * Math.cos(angle) + dy * Math.sin(angle);
  const ry = -dx * Math.sin(angle) + dy * Math.cos(angle);
  return Math.abs(rx) <= 0.075 && Math.abs(ry) <= 0.36;
}

function draw(size, accent) {
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      let ink = 0;
      let accentCount = 0;
      for (let sy = 0; sy < SCALE; sy += 1) {
        for (let sx = 0; sx < SCALE; sx += 1) {
          const u = (x + (sx + 0.5) / SCALE) / size;
          const v = (y + (sy + 0.5) / SCALE) / size;
          if (u < 0.055 || u > 0.945 || v < 0.055 || v > 0.945) continue;
          if (pointInRotatedBar(u, v)) accentCount += 1;
          else ink += 1;
        }
      }
      const total = SCALE * SCALE;
      const color = accentCount > ink ? accent : INK;
      const coverage = (ink + accentCount) / total;
      if (coverage === 0) {
        CLEAR.forEach((value, index) => {
          pixels[offset + index] = value;
        });
        continue;
      }
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = Math.round(255 * Math.min(1, coverage));
    }
  }
  return encodePng(size, size, pixels);
}

const iconSets = [
  { dir: "icons", accent: ACCENT },
  { dir: "icons-warn", accent: WARN },
  { dir: "icons-clean", accent: CLEAN },
];
for (const set of iconSets) {
  const dir = join(OUT, "..", set.dir);
  await mkdir(dir, { recursive: true });
  for (const size of SIZES) {
    const file = join(dir, `icon-${size}.png`);
    await writeFile(file, draw(size, set.accent));
    process.stdout.write(`${file.replace(ROOT, ".")} ${size}x${size}\n`);
  }
}
