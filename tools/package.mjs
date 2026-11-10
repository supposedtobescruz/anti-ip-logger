import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf8"));
const version = manifest.version;

const EXCLUDE = [
  /^\.git/,
  /^\.github\//,
  /^\.gitignore$/,
  /^\.gitattributes$/,
  /^\.opencode\//,
  /^tests\//,
  /^tools\//,
  /^graphify-out\//,
  /^verify-output\//,
  /^_metadata\//,
  /^antislop\.md$/,
  /^AGENTS\.md$/,
  /^package\.json$/,
  /^readme\/assets\//,
  /^dist\//,
  /^docs\//,
  /^store\//,
  /^PRIVACY\.md$/,
  /^DESIGN\.md$/,
];

const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const files = tracked.filter((file) => !EXCLUDE.some((pattern) => pattern.test(file)));

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  const time = ((date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)) & 0xffff;
  const day = (((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xffff;
  return { time, day };
}

const chunks = [];
const central = [];
let offset = 0;
let totalUncompressed = 0;

for (const file of files.sort()) {
  const fullPath = join(ROOT, file);
  const data = readFileSync(fullPath);
  const compressed = deflateRawSync(data, { level: 9 });
  const crc = crc32(data);
  const { time, day } = dosDateTime(statSync(fullPath).mtime);
  const name = Buffer.from(file.replaceAll("\\", "/"), "utf8");

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6);
  local.writeUInt16LE(8, 8);
  local.writeUInt16LE(time, 10);
  local.writeUInt16LE(day, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);
  chunks.push(local, name, compressed);

  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50, 0);
  entry.writeUInt16LE(20, 4);
  entry.writeUInt16LE(20, 6);
  entry.writeUInt16LE(0x0800, 8);
  entry.writeUInt16LE(8, 10);
  entry.writeUInt16LE(time, 12);
  entry.writeUInt16LE(day, 14);
  entry.writeUInt32LE(crc, 16);
  entry.writeUInt32LE(compressed.length, 20);
  entry.writeUInt32LE(data.length, 24);
  entry.writeUInt16LE(name.length, 28);
  entry.writeUInt16LE(0, 30);
  entry.writeUInt16LE(0, 32);
  entry.writeUInt16LE(0, 34);
  entry.writeUInt16LE(0, 36);
  entry.writeUInt32LE(0, 38);
  entry.writeUInt32LE(offset, 42);
  central.push(Buffer.concat([entry, name]));

  offset += local.length + name.length + compressed.length;
  totalUncompressed += data.length;
}

const centralBuffer = Buffer.concat(central);
const chunksBuffer = Buffer.concat(chunks);
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);
eocd.writeUInt16LE(0, 4);
eocd.writeUInt16LE(0, 6);
eocd.writeUInt16LE(files.length, 8);
eocd.writeUInt16LE(files.length, 10);
eocd.writeUInt32LE(centralBuffer.length, 12);
eocd.writeUInt32LE(chunksBuffer.length, 16);
eocd.writeUInt16LE(0, 20);

const zip = Buffer.concat([chunksBuffer, centralBuffer, eocd]);
const outDir = join(ROOT, "dist");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, `anti-ip-logger-${version}-cws.zip`);
writeFileSync(outPath, zip);

const hash = createHash("sha256").update(zip).digest("hex");
console.log(`Packaged ${files.length} files (${(zip.length / 1024).toFixed(0)} KB zip, ${(totalUncompressed / 1024 / 1024).toFixed(2)} MB raw)`);
console.log(`Wrote ${outPath}`);
console.log(`SHA256 ${hash}`);
