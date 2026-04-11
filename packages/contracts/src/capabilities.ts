import { Schema } from "effect";
import { PositiveInt, TrimmedNonEmptyString } from "./baseSchemas";

const CAPABILITY_QUERY_MAX_LENGTH = 256;
const CAPABILITY_LIMIT_MAX = 100;

export const CapabilityScope = Schema.Literals(["project", "user", "plugin"]);
export type CapabilityScope = typeof CapabilityScope.Type;

export const SkillCatalogEntry = Schema.Struct({
  id: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  description: Schema.String,
  path: TrimmedNonEmptyString,
  scope: CapabilityScope,
  enabled: Schema.Boolean,
  pluginId: Schema.optionalKey(TrimmedNonEmptyString),
  pluginName: Schema.optionalKey(TrimmedNonEmptyString),
});
export type SkillCatalogEntry = typeof SkillCatalogEntry.Type;

export const PluginBundleCounts = Schema.Struct({
  skills: Schema.Number,
  apps: Schema.Number,
});
export type PluginBundleCounts = typeof PluginBundleCounts.Type;

export const PluginCatalogEntry = Schema.Struct({
  id: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  description: Schema.String,
  marketplacePath: TrimmedNonEmptyString,
  pluginName: TrimmedNonEmptyString,
  installed: Schema.Boolean,
  bundleCounts: PluginBundleCounts,
});
export type PluginCatalogEntry = typeof PluginCatalogEntry.Type;

export const PluginBundleSkillEntry = Schema.Struct({
  id: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  description: Schema.String,
  path: TrimmedNonEmptyString,
  pluginId: TrimmedNonEmptyString,
  pluginName: TrimmedNonEmptyString,
  enabled: Schema.Boolean,
});
export type PluginBundleSkillEntry = typeof PluginBundleSkillEntry.Type;

export const PluginBundleAppEntry = Schema.Struct({
  id: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  description: Schema.String,
  appId: TrimmedNonEmptyString,
  pluginId: TrimmedNonEmptyString,
  pluginName: TrimmedNonEmptyString,
});
export type PluginBundleAppEntry = typeof PluginBundleAppEntry.Type;

const PluginBundleSkillCatalogEntry = Schema.Struct({
  type: Schema.Literal("skill"),
  id: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  description: Schema.String,
  path: TrimmedNonEmptyString,
  pluginId: TrimmedNonEmptyString,
  pluginName: TrimmedNonEmptyString,
  enabled: Schema.Boolean,
});

const PluginBundleAppCatalogEntry = Schema.Struct({
  type: Schema.Literal("app"),
  id: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  description: Schema.String,
  appId: TrimmedNonEmptyString,
  pluginId: TrimmedNonEmptyString,
  pluginName: TrimmedNonEmptyString,
});

export const PluginBundleEntry = Schema.Union([
  PluginBundleSkillCatalogEntry,
  PluginBundleAppCatalogEntry,
]);
export type PluginBundleEntry = typeof PluginBundleEntry.Type;

const SkillCapabilityCatalogEntry = Schema.Struct({
  type: Schema.Literal("skill"),
  id: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  description: Schema.String,
  path: TrimmedNonEmptyString,
  scope: CapabilityScope,
  enabled: Schema.Boolean,
  pluginId: Schema.optionalKey(TrimmedNonEmptyString),
  pluginName: Schema.optionalKey(TrimmedNonEmptyString),
});

const PluginCapabilityCatalogEntry = Schema.Struct({
  type: Schema.Literal("plugin"),
  id: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  description: Schema.String,
  marketplacePath: TrimmedNonEmptyString,
  pluginName: TrimmedNonEmptyString,
  installed: Schema.Boolean,
  bundleCounts: PluginBundleCounts,
});

export const CapabilityCatalogEntry = Schema.Union([
  SkillCapabilityCatalogEntry,
  PluginCapabilityCatalogEntry,
  PluginBundleEntry,
]);
export type CapabilityCatalogEntry = typeof CapabilityCatalogEntry.Type;

export const CapabilitySearchInput = Schema.Struct({
  cwd: Schema.optionalKey(Schema.NullOr(TrimmedNonEmptyString)),
  query: Schema.String.check(Schema.isMaxLength(CAPABILITY_QUERY_MAX_LENGTH)),
  limit: PositiveInt.check(Schema.isLessThanOrEqualTo(CAPABILITY_LIMIT_MAX)),
  forceReload: Schema.optionalKey(Schema.Boolean),
});
export type CapabilitySearchInput = typeof CapabilitySearchInput.Type;

export const CapabilitySearchResult = Schema.Struct({
  skills: Schema.Array(SkillCatalogEntry),
  plugins: Schema.Array(PluginCatalogEntry),
});
export type CapabilitySearchResult = typeof CapabilitySearchResult.Type;

export const CapabilityReadPluginBundleInput = Schema.Struct({
  pluginId: TrimmedNonEmptyString,
  cwd: Schema.optionalKey(Schema.NullOr(TrimmedNonEmptyString)),
  forceReload: Schema.optionalKey(Schema.Boolean),
});
export type CapabilityReadPluginBundleInput = typeof CapabilityReadPluginBundleInput.Type;

export const PluginBundleResult = Schema.Struct({
  plugin: PluginCatalogEntry,
  skills: Schema.Array(PluginBundleSkillEntry),
  apps: Schema.Array(PluginBundleAppEntry),
});
export type PluginBundleResult = typeof PluginBundleResult.Type;

export const ComposerCapabilityMention = Schema.Union([
  Schema.Struct({
    token: TrimmedNonEmptyString,
    label: TrimmedNonEmptyString,
    pluginId: Schema.optionalKey(TrimmedNonEmptyString),
    kind: Schema.Literal("skill"),
    name: TrimmedNonEmptyString,
    path: TrimmedNonEmptyString,
  }),
  Schema.Struct({
    token: TrimmedNonEmptyString,
    label: TrimmedNonEmptyString,
    pluginId: Schema.optionalKey(TrimmedNonEmptyString),
    kind: Schema.Literal("app"),
    name: TrimmedNonEmptyString,
    appId: TrimmedNonEmptyString,
  }),
]);
export type ComposerCapabilityMention = typeof ComposerCapabilityMention.Type;

export class CapabilitySearchError extends Schema.TaggedErrorClass<CapabilitySearchError>()(
  "CapabilitySearchError",
  {
    message: TrimmedNonEmptyString,
    cause: Schema.optionalKey(Schema.Defect),
  },
) {}

export class CapabilityReadPluginBundleError extends Schema.TaggedErrorClass<CapabilityReadPluginBundleError>()(
  "CapabilityReadPluginBundleError",
  {
    message: TrimmedNonEmptyString,
    cause: Schema.optionalKey(Schema.Defect),
  },
) {}
