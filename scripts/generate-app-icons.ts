#!/usr/bin/env node

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  BRAND_ICON_FOREGROUND_HEX,
  BRAND_MARK_PATHS,
  BRAND_MARK_VIEW_BOX_SIZE,
  BRAND_PRIMARY_BACKGROUND_HEX,
} from "@t3tools/shared/branding";

const execFileAsync = promisify(execFile);

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type LayoutName = "apple" | "desktop" | "standard";

interface LayoutSpec {
  readonly backgroundInsetRatio: number;
  readonly backgroundRadiusRatio: number;
  readonly markSizeRatio: number;
}

interface PngOutput {
  readonly destinationRelativePath: string;
  readonly size: number;
  readonly layout: LayoutName;
}

const STANDARD_LAYOUT: LayoutSpec = {
  backgroundInsetRatio: 0,
  backgroundRadiusRatio: 72 / 1024,
  markSizeRatio: 0.62,
};

const APPLE_LAYOUT: LayoutSpec = {
  backgroundInsetRatio: 0,
  backgroundRadiusRatio: 0.22,
  markSizeRatio: 0.58,
};

const DESKTOP_LAYOUT: LayoutSpec = {
  backgroundInsetRatio: 68 / 1024,
  backgroundRadiusRatio: 224 / 1024,
  markSizeRatio: 0.5,
};

const LAYOUTS: Record<LayoutName, LayoutSpec> = {
  apple: APPLE_LAYOUT,
  desktop: DESKTOP_LAYOUT,
  standard: STANDARD_LAYOUT,
};

const PNG_OUTPUTS: ReadonlyArray<PngOutput> = [
  {
    destinationRelativePath: "assets/prod/black-macos-1024.png",
    size: 1024,
    layout: "desktop",
  },
  {
    destinationRelativePath: "assets/prod/black-ios-1024.png",
    size: 1024,
    layout: "apple",
  },
  {
    destinationRelativePath: "assets/prod/black-universal-1024.png",
    size: 1024,
    layout: "standard",
  },
  {
    destinationRelativePath: "assets/prod/t3-black-web-favicon-16x16.png",
    size: 16,
    layout: "standard",
  },
  {
    destinationRelativePath: "assets/prod/t3-black-web-favicon-32x32.png",
    size: 32,
    layout: "standard",
  },
  {
    destinationRelativePath: "assets/prod/t3-black-web-apple-touch-180.png",
    size: 180,
    layout: "apple",
  },
  {
    destinationRelativePath: "apps/desktop/resources/icon.png",
    size: 512,
    layout: "desktop",
  },
];

const COPY_OUTPUTS = [
  {
    sourceRelativePath: "assets/prod/t3-black-web-favicon-16x16.png",
    destinationRelativePath: "apps/web/public/favicon-16x16.png",
  },
  {
    sourceRelativePath: "assets/prod/t3-black-web-favicon-16x16.png",
    destinationRelativePath: "apps/marketing/public/favicon-16x16.png",
  },
  {
    sourceRelativePath: "assets/prod/t3-black-web-favicon-32x32.png",
    destinationRelativePath: "apps/web/public/favicon-32x32.png",
  },
  {
    sourceRelativePath: "assets/prod/t3-black-web-favicon-32x32.png",
    destinationRelativePath: "apps/marketing/public/favicon-32x32.png",
  },
  {
    sourceRelativePath: "assets/prod/t3-black-web-apple-touch-180.png",
    destinationRelativePath: "apps/web/public/apple-touch-icon.png",
  },
  {
    sourceRelativePath: "assets/prod/t3-black-web-apple-touch-180.png",
    destinationRelativePath: "apps/marketing/public/apple-touch-icon.png",
  },
  {
    sourceRelativePath: "assets/prod/black-macos-1024.png",
    destinationRelativePath: "apps/marketing/public/icon.png",
  },
] as const;

const WEB_ICO_PNG_SIZES = [16, 24, 32, 48, 64, 128, 256] as const;

const ICNS_ICONSET_DEFINITIONS = [
  { filename: "icon_16x16.png", size: 16 },
  { filename: "icon_16x16@2x.png", size: 32 },
  { filename: "icon_32x32.png", size: 32 },
  { filename: "icon_32x32@2x.png", size: 64 },
  { filename: "icon_128x128.png", size: 128 },
  { filename: "icon_128x128@2x.png", size: 256 },
  { filename: "icon_256x256.png", size: 256 },
  { filename: "icon_256x256@2x.png", size: 512 },
  { filename: "icon_512x512.png", size: 512 },
  { filename: "icon_512x512@2x.png", size: 1024 },
] as const;

function resolveRepoPath(relativePath: string): string {
  return path.join(repoRoot, relativePath);
}

function getLayout(layoutName: LayoutName): LayoutSpec {
  return LAYOUTS[layoutName];
}

function buildIconSvg(size: number, layoutName: LayoutName): string {
  const layout = getLayout(layoutName);
  const inset = size * layout.backgroundInsetRatio;
  const backgroundSize = size - inset * 2;
  const backgroundRadius = size * layout.backgroundRadiusRatio;
  const markSize = size * layout.markSizeRatio;
  const markOffset = (size - markSize) / 2;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none">`,
    `  <rect x="${inset}" y="${inset}" width="${backgroundSize}" height="${backgroundSize}" rx="${backgroundRadius}" fill="${BRAND_PRIMARY_BACKGROUND_HEX}" />`,
    `  <g transform="translate(${markOffset} ${markOffset}) scale(${markSize / BRAND_MARK_VIEW_BOX_SIZE})">`,
    ...BRAND_MARK_PATHS.map((d) => `    <path d="${d}" fill="${BRAND_ICON_FOREGROUND_HEX}" />`),
    "  </g>",
    "</svg>",
  ].join("\n");
}

async function ensureParentDirectory(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function renderSvgToPng(
  svgContents: string,
  outputPath: string,
  tempDir: string,
): Promise<void> {
  const svgPath = path.join(tempDir, `${path.basename(outputPath, path.extname(outputPath))}.svg`);
  await fs.writeFile(svgPath, `${svgContents}\n`, "utf8");
  await ensureParentDirectory(outputPath);
  await execFileAsync("sips", ["-s", "format", "png", svgPath, "--out", outputPath]);
}

async function renderPng(relativePath: string, size: number, layout: LayoutName, tempDir: string) {
  const destinationPath = resolveRepoPath(relativePath);
  const svgContents = buildIconSvg(size, layout);
  await renderSvgToPng(svgContents, destinationPath, tempDir);
}

async function buildIco(
  outputRelativePath: string,
  sizes: ReadonlyArray<number>,
  layout: LayoutName,
  tempDir: string,
): Promise<void> {
  const pngPaths: string[] = [];

  for (const size of sizes) {
    const pngPath = path.join(tempDir, `${layout}-${size}.png`);
    const svgContents = buildIconSvg(size, layout);
    await renderSvgToPng(svgContents, pngPath, tempDir);
    pngPaths.push(pngPath);
  }

  const outputPath = resolveRepoPath(outputRelativePath);
  await ensureParentDirectory(outputPath);

  const pythonScript = [
    "from PIL import Image",
    "import sys",
    "output_path = sys.argv[1]",
    "png_paths = sys.argv[2:]",
    "images = [Image.open(png_path).convert('RGBA') for png_path in png_paths]",
    "base = images[-1]",
    "sizes = [(image.width, image.height) for image in images]",
    "base.save(output_path, format='ICO', sizes=sizes)",
  ].join("\n");

  await execFileAsync("python3", ["-c", pythonScript, outputPath, ...pngPaths]);
}

async function buildIcns(outputRelativePath: string, tempDir: string): Promise<void> {
  const iconsetPath = path.join(tempDir, "desktop.iconset");
  await fs.mkdir(iconsetPath, { recursive: true });

  for (const definition of ICNS_ICONSET_DEFINITIONS) {
    const outputPath = path.join(iconsetPath, definition.filename);
    const svgContents = buildIconSvg(definition.size, "desktop");
    await renderSvgToPng(svgContents, outputPath, tempDir);
  }

  const outputPath = resolveRepoPath(outputRelativePath);
  await ensureParentDirectory(outputPath);
  await execFileAsync("iconutil", ["-c", "icns", iconsetPath, "-o", outputPath]);
}

async function copyGeneratedAsset(sourceRelativePath: string, destinationRelativePath: string) {
  const sourcePath = resolveRepoPath(sourceRelativePath);
  const destinationPath = resolveRepoPath(destinationRelativePath);
  await ensureParentDirectory(destinationPath);
  await fs.copyFile(sourcePath, destinationPath);
}

async function main() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "dotcanvas-icons-"));

  try {
    for (const output of PNG_OUTPUTS) {
      await renderPng(output.destinationRelativePath, output.size, output.layout, tempDir);
    }

    await buildIco("assets/prod/t3-black-web-favicon.ico", WEB_ICO_PNG_SIZES, "standard", tempDir);
    await buildIco("assets/prod/t3-black-windows.ico", WEB_ICO_PNG_SIZES, "standard", tempDir);
    await buildIco("apps/web/public/favicon.ico", WEB_ICO_PNG_SIZES, "standard", tempDir);
    await buildIco("apps/marketing/public/favicon.ico", WEB_ICO_PNG_SIZES, "standard", tempDir);
    await buildIco("apps/desktop/resources/icon.ico", WEB_ICO_PNG_SIZES, "standard", tempDir);
    await buildIcns("apps/desktop/resources/icon.icns", tempDir);

    for (const output of COPY_OUTPUTS) {
      await copyGeneratedAsset(output.sourceRelativePath, output.destinationRelativePath);
    }

    process.stdout.write("Generated DotCanvas icon assets.\n");
  } finally {
    await fs.rm(tempDir, { force: true, recursive: true });
  }
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exitCode = 1;
});
