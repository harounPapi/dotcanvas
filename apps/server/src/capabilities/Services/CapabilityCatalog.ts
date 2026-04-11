import type {
  CapabilityReadPluginBundleError,
  CapabilityReadPluginBundleInput,
  CapabilitySearchError,
  CapabilitySearchInput,
  CapabilitySearchResult,
  PluginBundleResult,
} from "@t3tools/contracts";
import { ServiceMap } from "effect";
import type { Effect } from "effect";

export interface CapabilityCatalogShape {
  readonly search: (
    input: CapabilitySearchInput,
  ) => Effect.Effect<CapabilitySearchResult, CapabilitySearchError>;
  readonly readPluginBundle: (
    input: CapabilityReadPluginBundleInput,
  ) => Effect.Effect<PluginBundleResult, CapabilityReadPluginBundleError>;
}

export class CapabilityCatalog extends ServiceMap.Service<
  CapabilityCatalog,
  CapabilityCatalogShape
>()("t3/capabilities/Services/CapabilityCatalog") {}
