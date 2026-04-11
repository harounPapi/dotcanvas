import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { Dirent } from "node:fs";
import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

import {
  CapabilityReadPluginBundleError,
  CapabilitySearchError,
  type CapabilityReadPluginBundleInput,
  type CapabilitySearchResult,
  type PluginBundleAppEntry as PluginBundleAppEntryType,
  type PluginBundleResult as PluginBundleResultType,
  type PluginCatalogEntry as PluginCatalogEntryType,
  type PluginBundleSkillEntry as PluginBundleSkillEntryType,
  type SkillCatalogEntry as SkillCatalogEntryType,
} from "@t3tools/contracts";
import { Effect, Layer, Ref, Schema, Stream } from "effect";

import {
  buildCodexInitializeParams,
  killCodexChildProcess,
} from "../../provider/codexAppServer.ts";
import { ServerSettingsService } from "../../serverSettings.ts";
import { CapabilityCatalog, type CapabilityCatalogShape } from "../Services/CapabilityCatalog.ts";

type JsonRpcId = string | number;

interface DiscoveryPendingRequest {
  readonly method: string;
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: Error) => void;
  readonly timeout: ReturnType<typeof setTimeout>;
}

interface DiscoveryContext {
  readonly binaryPath: string;
  readonly homePath: string;
  readonly child: ChildProcessWithoutNullStreams;
  readonly output: readline.Interface;
  readonly pending: Map<JsonRpcId, DiscoveryPendingRequest>;
  nextRequestId: number;
  stopping: boolean;
}

interface PluginManifestRecord {
  readonly pluginId: string;
  readonly pluginName: string;
  readonly marketplaceName: string;
  readonly marketplacePath: string;
  readonly description: string;
  readonly displayName: string;
  readonly rootPath: string;
  readonly bundleCounts: {
    readonly skills: number;
    readonly apps: number;
  };
}

interface AppManifestRecord {
  readonly name: string;
  readonly appId: string;
}

type CapabilityCacheState = {
  readonly skillsByCwd: Map<string, ReadonlyArray<SkillCatalogEntryType>>;
  readonly pluginsBySettings: Map<string, ReadonlyArray<PluginCatalogEntryType>>;
  readonly bundlesByPlugin: Map<string, PluginBundleResultType>;
};

const DISCOVERY_REQUEST_TIMEOUT_MS = 12_000;
const PLUGIN_SKILL_DIR = "skills";
const PLUGIN_MANIFEST_FILENAME = "plugin.json";
const PLUGIN_APPS_FILENAME = ".app.json";
const PLUGIN_MARKETPLACE_CACHE_SEGMENT = path.join("plugins", "cache");

function resolveCodexHomePath(configuredHomePath: string | null | undefined): string {
  const trimmed = configuredHomePath?.trim();
  if (trimmed && trimmed.length > 0) {
    return trimmed;
  }
  return path.join(os.homedir(), ".codex");
}

function settingsSignature(input: {
  readonly binaryPath: string;
  readonly homePath: string;
}): string {
  return `${input.binaryPath}\u0000${input.homePath}`;
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toNonEmptyText(value: unknown, fallback: string): string {
  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : fallback;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function capitalizeWord(value: string): string {
  return value.length === 0 ? value : `${value[0]?.toUpperCase() ?? ""}${value.slice(1)}`;
}

function pluginDisplayNameFromName(name: string): string {
  return name
    .split(/[-_]+/)
    .filter((segment) => segment.length > 0)
    .map((segment) => capitalizeWord(segment))
    .join(" ");
}

function resolveScopeLabel(scope: SkillCatalogEntryType["scope"]): string {
  switch (scope) {
    case "project":
      return "project";
    case "plugin":
      return "plugin";
    default:
      return "global";
  }
}

function scoreMatch(haystack: string, query: string): number | null {
  if (query.length === 0) {
    return 0;
  }
  if (haystack === query) {
    return 0;
  }
  if (haystack.startsWith(query)) {
    return 1;
  }
  const index = haystack.indexOf(query);
  return index === -1 ? null : 5 + index;
}

function scoreSkill(skill: SkillCatalogEntryType, query: string): number | null {
  if (query.length === 0) {
    return 0;
  }
  const candidates = [
    skill.name.toLowerCase(),
    skill.description.toLowerCase(),
    skill.path.toLowerCase(),
    skill.pluginName?.toLowerCase() ?? "",
    resolveScopeLabel(skill.scope),
  ];
  const scores = candidates
    .map((candidate) => scoreMatch(candidate, query))
    .filter((score): score is number => score !== null);
  if (scores.length === 0) {
    return null;
  }
  const scopeWeight = skill.scope === "project" ? 0 : skill.scope === "user" ? 50 : 100;
  return scopeWeight + Math.min(...scores);
}

function scorePlugin(plugin: PluginCatalogEntryType, query: string): number | null {
  if (query.length === 0) {
    return 0;
  }
  const candidates = [
    plugin.name.toLowerCase(),
    plugin.description.toLowerCase(),
    plugin.pluginName.toLowerCase(),
    plugin.marketplacePath.toLowerCase(),
  ];
  const scores = candidates
    .map((candidate) => scoreMatch(candidate, query))
    .filter((score): score is number => score !== null);
  return scores.length === 0 ? null : Math.min(...scores);
}

function compareSkills(left: SkillCatalogEntryType, right: SkillCatalogEntryType): number {
  const leftScopeRank = left.scope === "project" ? 0 : left.scope === "user" ? 1 : 2;
  const rightScopeRank = right.scope === "project" ? 0 : right.scope === "user" ? 1 : 2;
  if (leftScopeRank !== rightScopeRank) {
    return leftScopeRank - rightScopeRank;
  }
  if (left.enabled !== right.enabled) {
    return left.enabled ? -1 : 1;
  }
  return left.name.localeCompare(right.name) || left.path.localeCompare(right.path);
}

function comparePlugins(left: PluginCatalogEntryType, right: PluginCatalogEntryType): number {
  return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}

function normalizePluginId(input: {
  readonly pluginName: string;
  readonly marketplaceName: string;
}): string {
  return `${input.pluginName}@${input.marketplaceName}`;
}

function parsePluginPathSegments(
  skillPath: string,
  codexHomePath: string,
): { pluginId: string; pluginName: string; marketplacePath: string } | null {
  const normalizedPath = path.normalize(skillPath);
  const cacheRoot = path.join(codexHomePath, PLUGIN_MARKETPLACE_CACHE_SEGMENT);
  const relativePath = path.relative(cacheRoot, normalizedPath);
  if (relativePath.startsWith("..")) {
    return null;
  }
  const segments = relativePath.split(path.sep).filter((segment) => segment.length > 0);
  if (segments.length < 4) {
    return null;
  }
  const [marketplaceName, pluginName] = segments;
  if (!marketplaceName || !pluginName) {
    return null;
  }
  return {
    pluginId: normalizePluginId({ pluginName, marketplaceName }),
    pluginName,
    marketplacePath: `${marketplaceName}/${pluginName}`,
  };
}

function normalizeSkillEntry(input: {
  readonly skill: Record<string, unknown>;
  readonly codexHomePath: string;
}): SkillCatalogEntryType | null {
  const name = normalizeText(input.skill.name);
  const description = typeof input.skill.description === "string" ? input.skill.description : "";
  const skillPath = normalizeText(input.skill.path);
  if (name.length === 0 || skillPath.length === 0) {
    return null;
  }

  const rawScope = normalizeText(input.skill.scope);
  const pluginPathInfo = parsePluginPathSegments(skillPath, input.codexHomePath);
  const scope: SkillCatalogEntryType["scope"] =
    rawScope === "repo" ? "project" : pluginPathInfo ? "plugin" : "user";

  return {
    id: `skill:${skillPath}`,
    name,
    description,
    path: skillPath,
    scope,
    enabled: input.skill.enabled !== false,
    ...(pluginPathInfo
      ? {
          pluginId: pluginPathInfo.pluginId,
          pluginName: pluginPathInfo.pluginName,
        }
      : {}),
  };
}

function extractSkillDescriptionFromMarkdown(contents: string): string {
  const lines = contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  for (const line of lines) {
    if (
      line.startsWith("#") ||
      line.startsWith("- ") ||
      line.startsWith("* ") ||
      line.startsWith("```") ||
      line.startsWith("<")
    ) {
      continue;
    }
    return line;
  }
  return "";
}

async function readJsonFile(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const contents = await fsPromises.readFile(filePath, "utf8");
    return readRecord(JSON.parse(contents));
  } catch {
    return null;
  }
}

async function resolvePluginManifestRecord(input: {
  readonly homePath: string;
  readonly pluginId: string;
}): Promise<PluginManifestRecord | null> {
  const [pluginName, marketplaceName] = input.pluginId.split("@");
  if (!pluginName || !marketplaceName) {
    return null;
  }
  const pluginParentDir = path.join(
    input.homePath,
    PLUGIN_MARKETPLACE_CACHE_SEGMENT,
    marketplaceName,
    pluginName,
  );
  let entries: Dirent[];
  try {
    entries = await fsPromises.readdir(pluginParentDir, { withFileTypes: true });
  } catch {
    return null;
  }

  const manifestCandidates = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const rootPath = path.join(pluginParentDir, entry.name);
        const manifestPath = path.join(rootPath, ".codex-plugin", PLUGIN_MANIFEST_FILENAME);
        try {
          const stats = await fsPromises.stat(manifestPath);
          return { manifestPath, rootPath, modifiedMs: stats.mtimeMs };
        } catch {
          return null;
        }
      }),
  );

  const manifestCandidate = manifestCandidates
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((left, right) => right.modifiedMs - left.modifiedMs)[0];
  if (!manifestCandidate) {
    return null;
  }

  const manifest = await readJsonFile(manifestCandidate.manifestPath);
  const pluginInterface = readRecord(manifest?.interface);
  const displayName = toNonEmptyText(
    pluginInterface?.displayName,
    pluginDisplayNameFromName(pluginName),
  );
  const description = toNonEmptyText(
    manifest?.description ?? pluginInterface?.shortDescription,
    "",
  );

  const skillsDir = path.join(manifestCandidate.rootPath, PLUGIN_SKILL_DIR);
  let skillEntries: Dirent[] = [];
  try {
    skillEntries = await fsPromises.readdir(skillsDir, { withFileTypes: true });
  } catch {
    // Ignore missing skills directory.
  }

  const appsManifest = await readJsonFile(
    path.join(manifestCandidate.rootPath, PLUGIN_APPS_FILENAME),
  );
  const appsRecord = readRecord(appsManifest?.apps) ?? {};

  return {
    pluginId: input.pluginId,
    pluginName,
    marketplaceName,
    marketplacePath: `${marketplaceName}/${pluginName}`,
    description,
    displayName,
    rootPath: manifestCandidate.rootPath,
    bundleCounts: {
      skills: skillEntries.filter((entry) => entry.isDirectory()).length,
      apps: Object.keys(appsRecord).length,
    },
  };
}

async function readPluginAppsFromManifest(input: {
  readonly rootPath: string;
}): Promise<ReadonlyArray<AppManifestRecord>> {
  const appsManifest = await readJsonFile(path.join(input.rootPath, PLUGIN_APPS_FILENAME));
  const appsRecord = readRecord(appsManifest?.apps) ?? {};
  return Object.entries(appsRecord).flatMap(([name, value]) => {
    const appRecord = readRecord(value);
    const appId = normalizeText(appRecord?.id);
    if (appId.length === 0 || name.trim().length === 0) {
      return [];
    }
    return [{ name: name.trim(), appId }] satisfies ReadonlyArray<AppManifestRecord>;
  });
}

async function readPluginSkillsFromManifest(input: {
  readonly manifest: PluginManifestRecord;
}): Promise<ReadonlyArray<PluginBundleSkillEntryType>> {
  const skillsDir = path.join(input.manifest.rootPath, PLUGIN_SKILL_DIR);
  let entries: Dirent[] = [];
  try {
    entries = await fsPromises.readdir(skillsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const skillEntries = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const skillPath = path.join(skillsDir, entry.name, "SKILL.md");
        try {
          const contents = await fsPromises.readFile(skillPath, "utf8");
          const description = extractSkillDescriptionFromMarkdown(contents);
          const skillName = `${input.manifest.pluginName}:${entry.name}`;
          return {
            id: `skill:${skillPath}`,
            name: skillName,
            description:
              description.length > 0 ? description : `${input.manifest.displayName} plugin skill`,
            path: skillPath,
            pluginId: input.manifest.pluginId,
            pluginName: input.manifest.pluginName,
            enabled: true,
          } satisfies PluginBundleSkillEntryType;
        } catch {
          return null;
        }
      }),
  );

  return skillEntries
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((left, right) => left.name.localeCompare(right.name));
}

function buildPluginAppEntries(input: {
  readonly manifest: PluginManifestRecord;
  readonly apps: ReadonlyArray<AppManifestRecord>;
}): ReadonlyArray<PluginBundleAppEntryType> {
  return input.apps
    .map(
      (app) =>
        ({
          id: `app:${input.manifest.pluginId}:${app.name}`,
          name: app.name,
          description: `${input.manifest.displayName} connector app`,
          appId: app.appId,
          pluginId: input.manifest.pluginId,
          pluginName: input.manifest.pluginName,
        }) satisfies PluginBundleAppEntryType,
    )
    .sort((left, right) => left.name.localeCompare(right.name));
}

function dedupeSkills(
  skills: ReadonlyArray<SkillCatalogEntryType>,
): ReadonlyArray<SkillCatalogEntryType> {
  const seen = new Set<string>();
  const deduped: SkillCatalogEntryType[] = [];
  for (const skill of skills) {
    if (seen.has(skill.id)) {
      continue;
    }
    seen.add(skill.id);
    deduped.push(skill);
  }
  return deduped;
}

function toSearchError(operation: string, cause: unknown): CapabilitySearchError {
  const message =
    cause instanceof Error ? cause.message : `Capability discovery failed during ${operation}.`;
  return new CapabilitySearchError({
    message: message.trim().length > 0 ? message : "Capability discovery failed.",
    cause,
  });
}

function toBundleError(operation: string, cause: unknown): CapabilityReadPluginBundleError {
  const message =
    cause instanceof Error ? cause.message : `Plugin bundle discovery failed during ${operation}.`;
  return new CapabilityReadPluginBundleError({
    message: message.trim().length > 0 ? message : "Plugin bundle discovery failed.",
    cause,
  });
}

function forceRestartOption(
  forceRestart: boolean | undefined,
): { readonly forceRestart?: boolean } {
  return forceRestart === undefined ? {} : { forceRestart };
}

function forceReloadOption(
  forceReload: boolean | undefined,
): { readonly forceReload?: boolean } {
  return forceReload === undefined ? {} : { forceReload };
}

async function startDiscoveryContext(input: {
  readonly binaryPath: string;
  readonly homePath: string;
}): Promise<DiscoveryContext> {
  const child = spawn(input.binaryPath, ["app-server"], {
    env: {
      ...process.env,
      CODEX_HOME: input.homePath,
    },
    stdio: ["pipe", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
  const output = readline.createInterface({ input: child.stdout });
  const pending = new Map<JsonRpcId, DiscoveryPendingRequest>();
  let nextRequestId = 1;
  let stopping = false;

  const rejectAll = (error: Error) => {
    for (const request of pending.values()) {
      clearTimeout(request.timeout);
      request.reject(error);
    }
    pending.clear();
  };

  output.on("line", (line) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      rejectAll(new Error("Received invalid JSON from codex app-server."));
      return;
    }
    const message = readRecord(parsed);
    const id = message?.id;
    if ((typeof id !== "string" && typeof id !== "number") || !pending.has(id)) {
      return;
    }
    const request = pending.get(id);
    if (!request) {
      return;
    }
    pending.delete(id);
    clearTimeout(request.timeout);
    const errorRecord = readRecord(message?.error);
    if (errorRecord) {
      const errorMessage = toNonEmptyText(errorRecord.message, `${request.method} failed.`);
      request.reject(new Error(errorMessage));
      return;
    }
    request.resolve(message?.result);
  });

  child.once("error", (error) => {
    if (!stopping) {
      rejectAll(error instanceof Error ? error : new Error(String(error)));
    }
  });
  child.once("exit", (code, signal) => {
    if (!stopping) {
      rejectAll(
        new Error(
          `codex app-server exited unexpectedly (code=${code ?? "null"}, signal=${signal ?? "null"}).`,
        ),
      );
    }
  });

  const sendRequest = (method: string, params: unknown) =>
    new Promise<unknown>((resolve, reject) => {
      const id = nextRequestId++;
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`${method} timed out.`));
      }, DISCOVERY_REQUEST_TIMEOUT_MS);
      pending.set(id, { method, resolve, reject, timeout });
      if (!child.stdin.writable) {
        clearTimeout(timeout);
        pending.delete(id);
        reject(new Error("Cannot write to codex app-server stdin."));
        return;
      }
      child.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
    });

  await sendRequest("initialize", buildCodexInitializeParams());
  if (!child.stdin.writable) {
    throw new Error("Cannot finalize codex app-server initialization.");
  }
  child.stdin.write(`${JSON.stringify({ method: "initialized" })}\n`);

  return {
    binaryPath: input.binaryPath,
    homePath: input.homePath,
    child,
    output,
    pending,
    nextRequestId,
    get stopping() {
      return stopping;
    },
    set stopping(value: boolean) {
      stopping = value;
    },
  };
}

async function stopDiscoveryContext(context: DiscoveryContext | null): Promise<void> {
  if (!context) {
    return;
  }
  context.stopping = true;
  context.output.removeAllListeners();
  context.output.close();
  for (const request of context.pending.values()) {
    clearTimeout(request.timeout);
    request.reject(new Error("Codex capability discovery stopped."));
  }
  context.pending.clear();
  if (!context.child.killed) {
    killCodexChildProcess(context.child);
  }
}

export const CapabilityCatalogLive = Layer.effect(
  CapabilityCatalog,
  Effect.gen(function* () {
    const serverSettings = yield* ServerSettingsService;
    const cacheStateRef = yield* Ref.make<CapabilityCacheState>({
      skillsByCwd: new Map(),
      pluginsBySettings: new Map(),
      bundlesByPlugin: new Map(),
    });
    const discoveryContextRef = yield* Ref.make<DiscoveryContext | null>(null);

    yield* Stream.runForEach(serverSettings.streamChanges, () =>
      Effect.gen(function* () {
        const current = yield* Ref.get(discoveryContextRef);
        yield* Ref.set(cacheStateRef, {
          skillsByCwd: new Map(),
          pluginsBySettings: new Map(),
          bundlesByPlugin: new Map(),
        });
        yield* Effect.promise(() => stopDiscoveryContext(current));
        yield* Ref.set(discoveryContextRef, null);
      }),
    ).pipe(Effect.forkScoped);

    const resolveCodexSettings = Effect.fn("resolveCodexSettings")(function* () {
      const settings = yield* serverSettings.getSettings;
      return {
        binaryPath: settings.providers.codex.binaryPath,
        homePath: resolveCodexHomePath(settings.providers.codex.homePath),
      };
    });

    const ensureDiscoveryContext = Effect.fn("ensureDiscoveryContext")(function* (options?: {
      readonly forceRestart?: boolean;
    }) {
      const codexSettings = yield* resolveCodexSettings();
      const current = yield* Ref.get(discoveryContextRef);
      const shouldRestart =
        options?.forceRestart === true ||
        !current ||
        current.binaryPath !== codexSettings.binaryPath ||
        current.homePath !== codexSettings.homePath;

      if (!shouldRestart && current) {
        return { context: current, codexSettings };
      }

      yield* Effect.promise(() => stopDiscoveryContext(current));
      const nextContext = yield* Effect.tryPromise({
        try: () => startDiscoveryContext(codexSettings),
        catch: (cause) => toSearchError("initialize-discovery", cause),
      });
      yield* Ref.set(discoveryContextRef, nextContext);
      return {
        context: nextContext,
        codexSettings,
      };
    });

    const sendDiscoveryRequest = Effect.fn("sendDiscoveryRequest")(function* (
      method: string,
      params: unknown,
      options?: {
        readonly forceRestart?: boolean;
      },
    ) {
      const { context } = yield* ensureDiscoveryContext({
        ...forceRestartOption(options?.forceRestart),
      });
      return yield* Effect.tryPromise({
        try: async () => {
          const id = context.nextRequestId++;
          return await new Promise<unknown>((resolve, reject) => {
            const timeout = setTimeout(() => {
              context.pending.delete(id);
              reject(new Error(`${method} timed out.`));
            }, DISCOVERY_REQUEST_TIMEOUT_MS);
            context.pending.set(id, { method, resolve, reject, timeout });
            if (!context.child.stdin.writable) {
              clearTimeout(timeout);
              context.pending.delete(id);
              reject(new Error("Cannot write to codex app-server stdin."));
              return;
            }
            context.child.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
          });
        },
        catch: (cause) => toSearchError(method, cause),
      });
    });

    const listSkillsForCwd = Effect.fn("listSkillsForCwd")(function* (input: {
      readonly cwd: string | null;
      readonly forceReload?: boolean;
    }) {
      const codexSettings = yield* resolveCodexSettings();
      const cwdKey = input.cwd ?? `home:${codexSettings.homePath}`;
      const cacheKey = `${settingsSignature(codexSettings)}\u0000${cwdKey}`;
      if (!input.forceReload) {
        const cached = (yield* Ref.get(cacheStateRef)).skillsByCwd.get(cacheKey);
        if (cached) {
          return cached;
        }
      }

      const skillResult = yield* sendDiscoveryRequest(
        "skills/list",
        {
          cwds: [input.cwd ?? codexSettings.homePath],
        },
        forceRestartOption(input.forceReload),
      ).pipe(Effect.mapError((cause) => toSearchError("skills/list", cause)));

      const records = readArray(readRecord(skillResult)?.data);
      const normalized = dedupeSkills(
        records.flatMap((record) => {
          const entry = readRecord(record);
          const skills = readArray(entry?.skills);
          return skills.flatMap((skill) => {
            const normalizedSkill = normalizeSkillEntry({
              skill: readRecord(skill) ?? {},
              codexHomePath: codexSettings.homePath,
            });
            return normalizedSkill ? [normalizedSkill] : [];
          });
        }),
      );
      const sortedNormalized = [...normalized].sort(compareSkills);

      yield* Ref.update(cacheStateRef, (state) => {
        const nextSkillsByCwd = new Map(state.skillsByCwd);
        nextSkillsByCwd.set(cacheKey, sortedNormalized);
        return {
          ...state,
          skillsByCwd: nextSkillsByCwd,
        };
      });

      return sortedNormalized;
    });

    const listApps = Effect.fn("listApps")(function* (options?: {
      readonly forceReload?: boolean;
    }) {
      const result = yield* sendDiscoveryRequest(
        "app/list",
        {},
        forceRestartOption(options?.forceReload),
      ).pipe(Effect.mapError((cause) => toSearchError("app/list", cause)));
      return readArray(readRecord(result)?.data)
        .map((entry) => readRecord(entry))
        .filter((entry): entry is Record<string, unknown> => entry !== null);
    });

    const listConfiguredPlugins = Effect.fn("listConfiguredPlugins")(function* (options?: {
      readonly forceReload?: boolean;
    }) {
      const codexSettings = yield* resolveCodexSettings();
      const signature = settingsSignature(codexSettings);
      if (!options?.forceReload) {
        const cached = (yield* Ref.get(cacheStateRef)).pluginsBySettings.get(signature);
        if (cached) {
          return cached;
        }
      }

      const configResult = yield* sendDiscoveryRequest(
        "config/read",
        {},
        forceRestartOption(options?.forceReload),
      ).pipe(Effect.mapError((cause) => toSearchError("config/read", cause)));
      const config = readRecord(readRecord(configResult)?.config);
      const pluginsRecord = readRecord(config?.plugins) ?? {};

      const manifests = yield* Effect.tryPromise({
        try: async () => {
          const configuredPluginIds = Object.entries(pluginsRecord)
            .flatMap(([pluginId, pluginConfig]) => {
              const record = readRecord(pluginConfig);
              return record?.enabled === false ? [] : [pluginId];
            })
            .sort((left, right) => left.localeCompare(right));

          const resolvedManifests = await Promise.all(
            configuredPluginIds.map((pluginId) =>
              resolvePluginManifestRecord({
                homePath: codexSettings.homePath,
                pluginId,
              }),
            ),
          );

          return configuredPluginIds.map((pluginId, index) => {
            const manifest = resolvedManifests[index];
            if (!manifest) {
              const [pluginName, marketplaceName] = pluginId.split("@");
              const fallbackName = pluginDisplayNameFromName(pluginName ?? pluginId);
              return {
                id: pluginId,
                name: fallbackName,
                description: "",
                marketplacePath:
                  pluginName && marketplaceName ? `${marketplaceName}/${pluginName}` : pluginId,
                pluginName: pluginName ?? pluginId,
                installed: true,
                bundleCounts: {
                  skills: 0,
                  apps: 0,
                },
              } satisfies PluginCatalogEntryType;
            }
            return {
              id: manifest.pluginId,
              name: manifest.displayName,
              description: manifest.description,
              marketplacePath: manifest.marketplacePath,
              pluginName: manifest.pluginName,
              installed: true,
              bundleCounts: manifest.bundleCounts,
            } satisfies PluginCatalogEntryType;
          });
        },
        catch: (cause) => toSearchError("plugin-manifest-read", cause),
      });

      const normalizedPlugins = [...manifests].sort(comparePlugins);
      yield* Ref.update(cacheStateRef, (state) => {
        const nextPluginsBySettings = new Map(state.pluginsBySettings);
        nextPluginsBySettings.set(signature, normalizedPlugins);
        return {
          ...state,
          pluginsBySettings: nextPluginsBySettings,
        };
      });
      return normalizedPlugins;
    });

    const readPluginBundle = Effect.fn("readPluginBundle")(function* (
      input: CapabilityReadPluginBundleInput,
    ) {
      const codexSettings = yield* resolveCodexSettings();
      const cacheKey = `${settingsSignature(codexSettings)}\u0000${input.pluginId}`;
      if (!input.forceReload) {
        const cached = (yield* Ref.get(cacheStateRef)).bundlesByPlugin.get(cacheKey);
        if (cached) {
          return cached;
        }
      }

      const pluginCatalog = yield* listConfiguredPlugins({
        ...forceReloadOption(input.forceReload),
      }).pipe(Effect.mapError((cause) => toBundleError("plugin-catalog", cause)));
      const plugin = pluginCatalog.find((entry) => entry.id === input.pluginId);
      if (!plugin) {
        return yield* new CapabilityReadPluginBundleError({
          message: `Plugin '${input.pluginId}' is not installed.`,
        });
      }

      const manifest = yield* Effect.tryPromise({
        try: () =>
          resolvePluginManifestRecord({
            homePath: codexSettings.homePath,
            pluginId: input.pluginId,
          }),
        catch: (cause) => toBundleError("plugin-manifest", cause),
      });
      if (!manifest) {
        return yield* new CapabilityReadPluginBundleError({
          message: `Plugin '${input.pluginId}' does not have a readable local manifest.`,
        });
      }

      const { bundleSkills, bundleAppsManifest } = yield* Effect.all({
        bundleSkills: Effect.tryPromise({
          try: () => readPluginSkillsFromManifest({ manifest }),
          catch: (cause) => toBundleError("plugin-skills", cause),
        }),
        bundleAppsManifest: Effect.tryPromise({
          try: () => readPluginAppsFromManifest({ rootPath: manifest.rootPath }),
          catch: (cause) => toBundleError("plugin-apps", cause),
        }),
      });

      const accessibleApps = yield* listApps(forceReloadOption(input.forceReload)).pipe(
        Effect.match({
          onFailure: () => [],
          onSuccess: (apps) => apps,
        }),
      );
      const accessibleAppMetadataById = new Map(
        accessibleApps.flatMap((entry) => {
          const appId = normalizeText(entry.id);
          if (appId.length === 0) {
            return [];
          }
          return [[appId, entry] as const];
        }),
      );

      const bundleApps = buildPluginAppEntries({
        manifest,
        apps: bundleAppsManifest,
      }).map((app) => {
        const appMetadata = accessibleAppMetadataById.get(app.appId);
        const appName = toNonEmptyText(appMetadata?.name, app.name);
        const appDescription = toNonEmptyText(appMetadata?.description, app.description);
        return {
          ...app,
          name: appName,
          description: appDescription,
        } satisfies PluginBundleAppEntryType;
      });

      const result = {
        plugin,
        skills: bundleSkills,
        apps: bundleApps,
      } satisfies PluginBundleResultType;

      yield* Ref.update(cacheStateRef, (state) => {
        const nextBundlesByPlugin = new Map(state.bundlesByPlugin);
        nextBundlesByPlugin.set(cacheKey, result);
        return {
          ...state,
          bundlesByPlugin: nextBundlesByPlugin,
        };
      });

      return result;
    });

    const search: CapabilityCatalogShape["search"] = (input) =>
      Effect.gen(function* () {
        const query = input.query.trim().toLowerCase();
        const plugins = yield* listConfiguredPlugins({
          ...forceReloadOption(input.forceReload),
        });
        const baseSkills = yield* listSkillsForCwd({
          cwd: input.cwd ?? null,
          ...forceReloadOption(input.forceReload),
        });

        const hasPluginSkills = baseSkills.some((skill) => skill.scope === "plugin");
        const fallbackPluginSkills =
          hasPluginSkills || plugins.length === 0
            ? []
            : yield* Effect.forEach(
                plugins,
                (plugin) =>
                  readPluginBundle({
                    pluginId: plugin.id,
                    cwd: input.cwd ?? null,
                    ...forceReloadOption(input.forceReload),
                  }).pipe(
                    Effect.map((bundle) =>
                      bundle.skills.map(
                        (skill): SkillCatalogEntryType => ({
                          id: skill.id,
                          name: skill.name,
                          description: skill.description,
                          path: skill.path,
                          scope: "plugin",
                          enabled: skill.enabled,
                          pluginId: skill.pluginId,
                          pluginName: skill.pluginName,
                        }),
                      ),
                    ),
                    Effect.match({
                      onFailure: () => [],
                      onSuccess: (skills) => skills,
                    }),
                  ),
                { concurrency: 1 },
              ).pipe(Effect.map((entries) => entries.flat()));

        const allSkills = [...dedupeSkills([...baseSkills, ...fallbackPluginSkills])].sort(
          compareSkills,
        );

        const filteredSkills = allSkills
          .map((skill) => ({
            skill,
            score: scoreSkill(skill, query),
          }))
          .filter(
            (entry): entry is { skill: SkillCatalogEntryType; score: number } =>
              entry.score !== null,
          )
          .sort((left, right) => left.score - right.score || compareSkills(left.skill, right.skill))
          .map((entry) => entry.skill);

        const filteredPlugins = plugins
          .map((plugin) => ({
            plugin,
            score: scorePlugin(plugin, query),
          }))
          .filter(
            (entry): entry is { plugin: PluginCatalogEntryType; score: number } =>
              entry.score !== null,
          )
          .sort(
            (left, right) => left.score - right.score || comparePlugins(left.plugin, right.plugin),
          )
          .map((entry) => entry.plugin);

        const orderedResults: Array<
          | { type: "skill"; value: SkillCatalogEntryType }
          | { type: "plugin"; value: PluginCatalogEntryType }
        > = [];
        for (const skill of filteredSkills) {
          orderedResults.push({ type: "skill", value: skill });
        }
        for (const plugin of filteredPlugins) {
          orderedResults.push({ type: "plugin", value: plugin });
        }

        const limited = orderedResults.slice(0, input.limit);
        return {
          skills: limited.flatMap((entry) => (entry.type === "skill" ? [entry.value] : [])),
          plugins: limited.flatMap((entry) => (entry.type === "plugin" ? [entry.value] : [])),
        } satisfies CapabilitySearchResult;
      }).pipe(
        Effect.mapError((cause) =>
          Schema.is(CapabilitySearchError)(cause) ? cause : toSearchError("search", cause),
        ),
      );

    const readPluginBundleApi: CapabilityCatalogShape["readPluginBundle"] = (input) =>
      readPluginBundle(input).pipe(
        Effect.mapError((cause) =>
          Schema.is(CapabilityReadPluginBundleError)(cause)
            ? cause
            : toBundleError("readPluginBundle", cause),
        ),
      );

    return {
      search,
      readPluginBundle: readPluginBundleApi,
    } satisfies CapabilityCatalogShape;
  }),
);
