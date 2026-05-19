const REPO = "harounPapi/dotcanvas";

export const CURRENT_RELEASE_TAG = "v0.0.15";

export const RELEASES_URL = `https://github.com/${REPO}/releases`;
export const CURRENT_RELEASE_URL = `${RELEASES_URL}/tag/${CURRENT_RELEASE_TAG}`;

const API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const CACHE_KEY = "dotcanvas-latest-release";

export const RELEASE_DOWNLOADS = {
  macArm64Dmg: `${RELEASES_URL}/download/${CURRENT_RELEASE_TAG}/T3-Code-0.0.15-arm64.dmg`,
  macArm64Zip: `${RELEASES_URL}/download/${CURRENT_RELEASE_TAG}/T3-Code-0.0.15-arm64.zip`,
  macX64Dmg: `${RELEASES_URL}/download/${CURRENT_RELEASE_TAG}/T3-Code-0.0.15-x64.dmg`,
  macX64Zip: `${RELEASES_URL}/download/${CURRENT_RELEASE_TAG}/T3-Code-0.0.15-x64.zip`,
  winX64Exe: `${RELEASES_URL}/download/${CURRENT_RELEASE_TAG}/T3-Code-0.0.15-x64.exe`,
} as const;

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

export interface Release {
  tag_name: string;
  html_url: string;
  assets: ReleaseAsset[];
}

export async function fetchLatestRelease(): Promise<Release> {
  const cached = sessionStorage.getItem(CACHE_KEY);
  if (cached) return JSON.parse(cached);

  const data = await fetch(API_URL).then((r) => r.json());

  if (data?.assets) {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
  }

  return data;
}
