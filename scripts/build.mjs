import * as esbuild from "esbuild";
import { deflateSync } from "node:zlib";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dist = join(root, "dist");
const watch = process.argv.includes("--watch");

mkdirSync(dist, { recursive: true });
mkdirSync(join(root, "icons"), { recursive: true });

const shared = {
  bundle: true,
  sourcemap: true,
  target: "chrome120",
  logLevel: "info",
};

const builds = [
  {
    ...shared,
    entryPoints: [join(root, "src/content/index.ts")],
    outfile: join(dist, "content.js"),
    format: "iife",
  },
  {
    ...shared,
    entryPoints: [join(root, "src/background/index.ts")],
    outfile: join(dist, "background.js"),
    format: "esm",
  },
  {
    ...shared,
    entryPoints: [join(root, "src/popup/popup.ts")],
    outfile: join(dist, "popup.js"),
    format: "iife",
  },
  {
    ...shared,
    entryPoints: [join(root, "src/onboarding/welcome.ts")],
    outfile: join(dist, "welcome.js"),
    format: "iife",
  },
];

function writeAssets() {
  writeFileSync(
    join(dist, "widget.css"),
    "/* Widget styles live in shadow DOM */\n"
  );

  for (const size of [16, 48, 128]) {
    const iconPath = join(root, "icons", `icon${size}.png`);
    if (!existsSync(iconPath)) {
      writeFileSync(iconPath, createPng(size));
    }
  }
}

function createPng(size) {
  const raw = [];
  for (let y = 0; y < size; y++) {
    raw.push(0);
    for (let x = 0; x < size; x++) {
      const edge = x < 1 || y < 1 || x >= size - 1 || y >= size - 1;
      raw.push(...(edge ? [26, 127, 55, 255] : [240, 250, 243, 255]));
    }
  }
  return encodePng(size, size, deflateSync(Buffer.from(raw)));
}

function encodePng(width, height, idat) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = createChunk(
    "IHDR",
    Buffer.from([
      (width >> 24) & 255, (width >> 16) & 255, (width >> 8) & 255, width & 255,
      (height >> 24) & 255, (height >> 16) & 255, (height >> 8) & 255, height & 255,
      8, 6, 0, 0, 0,
    ])
  );
  return Buffer.concat([
    signature,
    ihdr,
    createChunk("IDAT", idat),
    createChunk("IEND", Buffer.alloc(0)),
  ]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return crc ^ 0xffffffff;
}

async function run() {
  writeAssets();

  if (watch) {
    const contexts = await Promise.all(builds.map((config) => esbuild.context(config)));
    await Promise.all(contexts.map((ctx) => ctx.watch()));
    console.log("Watching for changes...");
    return;
  }

  await Promise.all(builds.map((config) => esbuild.build(config)));
  console.log("Build complete.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
