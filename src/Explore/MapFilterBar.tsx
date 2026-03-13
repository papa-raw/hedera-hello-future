import { useMemo, useState } from "react";
import clsx from "clsx";
import { X, Leaf, Users, Cube } from "@phosphor-icons/react";
import {
  useNewFiltersDispatch,
  useNewFiltersState,
} from "../context/filters";
import type { EntityTypeKey, ActorTypeKey } from "../context/filters/filtersContext";
import { ENTITY_COLORS } from "../shared/components/CompositeClusterLayer";
import FiltersDropdown from "./components/FiltersDropdown";
import { ProtocolIcon } from "../modules/chains/components/ProtocolIcon";

const ENTITY_TOGGLES: { key: EntityTypeKey; label: string }[] = [
  { key: "asset", label: "Assets" },
  { key: "actor", label: "Actors" },
  { key: "action", label: "Actions" },
];

const ACTOR_TOGGLES: { key: ActorTypeKey; label: string }[] = [
  { key: "orgs", label: "Orgs" },
  { key: "agents", label: "Agents" },
];

const ALL_SDGS: { code: string; title: string }[] = [
  { code: "1", title: "No Poverty" },
  { code: "2", title: "Zero Hunger" },
  { code: "3", title: "Good Health and Well-being" },
  { code: "4", title: "Quality Education" },
  { code: "5", title: "Gender Equality" },
  { code: "6", title: "Clean Water and Sanitation" },
  { code: "7", title: "Affordable and Clean Energy" },
  { code: "8", title: "Decent Work and Economic Growth" },
  { code: "9", title: "Industry, Innovation and Infrastructure" },
  { code: "10", title: "Reduced Inequalities" },
  { code: "11", title: "Sustainable Cities and Communities" },
  { code: "12", title: "Responsible Consumption and Production" },
  { code: "13", title: "Climate Action" },
  { code: "14", title: "Life Below Water" },
  { code: "15", title: "Life on Land" },
  { code: "16", title: "Peace, Justice and Strong Institutions" },
  { code: "17", title: "Partnerships for the Goals" },
];

interface BioregionStats {
  id: string;
  name: string;
  eii: number;
  eiiDelta: number;
  assetCount: number;
  actorCount: number;
}

export interface ActionFilters {
  protocols: Set<string>;
  sdgs: Set<string>;
  /** Time range as { from: "YYYY-MM", to: "YYYY-MM" }, or null for no filter */
  timeRange: { from: string; to: string } | null;
}

interface MapFilterBarProps {
  itemCount: number;
  selectedBioregion?: BioregionStats | null;
  actionFilters?: ActionFilters;
  onActionFiltersChange?: (filters: ActionFilters) => void;
}

export function MapFilterBar({
  itemCount,
  selectedBioregion,
  actionFilters,
  onActionFiltersChange,
}: MapFilterBarProps) {
  const { activeEntityTypes, activeActorTypes, filters, allActions } = useNewFiltersState();
  const dispatch = useNewFiltersDispatch();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<
    "assetType" | "issuers" | "platforms"
  >("assetType");

  // Action-specific dropdown
  const [actionDropdown, setActionDropdown] = useState<"protocol" | "sdg" | "time" | null>(null);

  const showAssetFilters = activeEntityTypes.has("asset");
  const showActorSubfilter = activeEntityTypes.has("actor");
  const showActionFilters = activeEntityTypes.has("action");

  const accumulateSubtypes = () => {
    const subtypes: number[] = [];
    for (const assetType of Object.values(filters.assetTypes)) {
      subtypes.push(...assetType.subtypes);
    }
    return subtypes;
  };

  const hasTypeFilter = accumulateSubtypes().length > 0;
  const hasIssuerFilter = filters.providers.length > 0;
  const hasChainFilter = filters.platforms.length > 0;

  // Derive available protocols and SDGs from actions
  const availableProtocols = useMemo(() => {
    const map = new Map<string, { name: string; color: string | null; logo: string | null }>();
    for (const action of allActions) {
      for (const proof of action.proofs) {
        if (!map.has(proof.protocol.id)) {
          map.set(proof.protocol.id, {
            name: proof.protocol.name,
            color: proof.protocol.color,
            logo: proof.protocol.logo,
          });
        }
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [allActions]);

  const availableSdgs = useMemo(() => {
    const map = new Map<string, string>();
    for (const action of allActions) {
      for (const sdg of action.sdg_outcomes) {
        if (!map.has(sdg.code)) {
          map.set(sdg.code, sdg.title);
        }
      }
    }
    return Array.from(map.entries()).sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10));
  }, [allActions]);

  // Compute available months from action dates
  const timeRange = useMemo(() => {
    const months = new Set<string>();
    for (const action of allActions) {
      const d = action.action_start_date || action.created_at;
      if (!d) continue;
      const date = new Date(d);
      months.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
    }
    const sorted = Array.from(months).sort();
    return sorted;
  }, [allActions]);

  const formatMonth = (ym: string) => {
    const [y, m] = ym.split("-");
    const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${names[parseInt(m, 10) - 1]} ${y}`;
  };

  const toggleProtocol = (id: string) => {
    if (!actionFilters || !onActionFiltersChange) return;
    const next = new Set(actionFilters.protocols);
    if (next.has(id)) next.delete(id); else next.add(id);
    onActionFiltersChange({ ...actionFilters, protocols: next });
  };

  const toggleSdg = (code: string) => {
    if (!actionFilters || !onActionFiltersChange) return;
    const next = new Set(actionFilters.sdgs);
    if (next.has(code)) next.delete(code); else next.add(code);
    onActionFiltersChange({ ...actionFilters, sdgs: next });
  };

  return (
    <div className="hidden md:block absolute top-0 left-0 right-0 z-10">
      <div className="bg-gray-900/90 backdrop-blur-sm flex items-center px-3 h-8">
        {/* Entity toggles */}
        <div className="flex items-center h-full">
          {ENTITY_TOGGLES.map((toggle, i) => {
            const active = activeEntityTypes.has(toggle.key);
            const color = ENTITY_COLORS[toggle.key];
            return (
              <div key={toggle.key} className="flex items-center h-full">
                {i > 0 && (
                  <div className="w-px h-1/3 bg-white/20 mx-0.5" />
                )}
                <button
                  onClick={() =>
                    dispatch({ type: "TOGGLE_ENTITY_TYPE", payload: toggle.key })
                  }
                  className={clsx(
                    "h-full flex items-center px-2 text-[11px] font-medium transition-colors cursor-pointer",
                    active
                      ? "text-white"
                      : "text-white/35 hover:text-white/60"
                  )}
                  style={active ? { borderBottom: `2px solid ${color.primary}` } : undefined}
                >
                  {toggle.label}
                </button>
              </div>
            );
          })}
        </div>

        {/* Actor type toggles: Orgs | Agents (additive) */}
        {showActorSubfilter && (
          <>
            <div className="w-px h-1/2 bg-white/15 mx-2" />
            <div className="flex items-center h-full bg-white/5 rounded px-1">
              {ACTOR_TOGGLES.map((toggle) => {
                const active = activeActorTypes.has(toggle.key);
                return (
                  <button
                    key={toggle.key}
                    onClick={() =>
                      dispatch({ type: "TOGGLE_ACTOR_TYPE", payload: toggle.key })
                    }
                    className={clsx(
                      "h-5 flex items-center px-2 text-[10px] font-medium rounded transition-colors cursor-pointer",
                      active
                        ? "bg-white/20 text-white"
                        : "text-white/40 hover:text-white/70"
                    )}
                  >
                    {toggle.label}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Asset filters: Type | Issuer | Chain */}
        {showAssetFilters && (
          <>
            <div className="w-px h-1/2 bg-white/15 mx-2" />
            <div className="flex items-center h-full">
              <button
                onClick={() => {
                  setActionDropdown(null);
                  setSelectedFilter("assetType");
                  setIsDropdownOpen(selectedFilter === "assetType" ? !isDropdownOpen : true);
                }}
                className={clsx(
                  "h-full flex items-center gap-1 px-2 text-[11px] transition-colors cursor-pointer",
                  isDropdownOpen && selectedFilter === "assetType"
                    ? "text-white"
                    : "text-white/40 hover:text-white/70"
                )}
              >
                <span>{hasTypeFilter ? `Type (${accumulateSubtypes().length})` : "Type"}</span>
                {hasTypeFilter && (
                  <span
                    className="w-3 h-3 rounded-full bg-white/20 flex items-center justify-center hover:bg-red-500 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch({ type: "RESET_TYPE_FILTERS" });
                    }}
                  >
                    <X size={7} className="text-white" />
                  </span>
                )}
              </button>

              <div className="w-px h-1/3 bg-white/20" />

              <button
                onClick={() => {
                  setActionDropdown(null);
                  setSelectedFilter("issuers");
                  setIsDropdownOpen(selectedFilter === "issuers" ? !isDropdownOpen : true);
                }}
                className={clsx(
                  "h-full flex items-center gap-1 px-2 text-[11px] transition-colors cursor-pointer",
                  isDropdownOpen && selectedFilter === "issuers"
                    ? "text-white"
                    : "text-white/40 hover:text-white/70"
                )}
              >
                <span>{hasIssuerFilter ? `Issuer (${filters.providers.length})` : "Issuer"}</span>
                {hasIssuerFilter && (
                  <span
                    className="w-3 h-3 rounded-full bg-white/20 flex items-center justify-center hover:bg-red-500 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch({ type: "RESET_PROVIDER_FILTER" });
                    }}
                  >
                    <X size={7} className="text-white" />
                  </span>
                )}
              </button>

              <div className="w-px h-1/3 bg-white/20" />

              <button
                onClick={() => {
                  setActionDropdown(null);
                  setSelectedFilter("platforms");
                  setIsDropdownOpen(selectedFilter === "platforms" ? !isDropdownOpen : true);
                }}
                className={clsx(
                  "h-full flex items-center gap-1 px-2 text-[11px] transition-colors cursor-pointer",
                  isDropdownOpen && selectedFilter === "platforms"
                    ? "text-white"
                    : "text-white/40 hover:text-white/70"
                )}
              >
                <span>{hasChainFilter ? `Chain (${filters.platforms.length})` : "Chain"}</span>
                {hasChainFilter && (
                  <span
                    className="w-3 h-3 rounded-full bg-white/20 flex items-center justify-center hover:bg-red-500 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch({ type: "RESET_PLATFORM_FILTER" });
                    }}
                  >
                    <X size={7} className="text-white" />
                  </span>
                )}
              </button>
            </div>
          </>
        )}

        {/* Action filters: Protocol | SDG */}
        {showActionFilters && actionFilters && (
          <>
            <div className="w-px h-1/2 bg-white/15 mx-2" />
            <div className="flex items-center h-full">
              {/* Protocol */}
              <button
                onClick={() => {
                  setIsDropdownOpen(false);
                  setActionDropdown(actionDropdown === "protocol" ? null : "protocol");
                }}
                className={clsx(
                  "h-full flex items-center gap-1 px-2 text-[11px] transition-colors cursor-pointer",
                  actionDropdown === "protocol" ? "text-white" : "text-white/40 hover:text-white/70"
                )}
              >
                <span>
                  {actionFilters.protocols.size > 0
                    ? `Protocol (${actionFilters.protocols.size})`
                    : "Protocol"}
                </span>
                {actionFilters.protocols.size > 0 && (
                  <span
                    className="w-3 h-3 rounded-full bg-white/20 flex items-center justify-center hover:bg-red-500 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      onActionFiltersChange?.({ ...actionFilters, protocols: new Set() });
                    }}
                  >
                    <X size={7} className="text-white" />
                  </span>
                )}
              </button>

              <div className="w-px h-1/3 bg-white/20" />

              {/* SDG */}
              <button
                onClick={() => {
                  setIsDropdownOpen(false);
                  setActionDropdown(actionDropdown === "sdg" ? null : "sdg");
                }}
                className={clsx(
                  "h-full flex items-center gap-1 px-2 text-[11px] transition-colors cursor-pointer",
                  actionDropdown === "sdg" ? "text-white" : "text-white/40 hover:text-white/70"
                )}
              >
                <span>
                  {actionFilters.sdgs.size > 0
                    ? `SDG (${actionFilters.sdgs.size})`
                    : "SDG"}
                </span>
                {actionFilters.sdgs.size > 0 && (
                  <span
                    className="w-3 h-3 rounded-full bg-white/20 flex items-center justify-center hover:bg-red-500 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      onActionFiltersChange?.({ ...actionFilters, sdgs: new Set() });
                    }}
                  >
                    <X size={7} className="text-white" />
                  </span>
                )}
              </button>

              <div className="w-px h-1/3 bg-white/20" />

              {/* Time */}
              <button
                onClick={() => {
                  setIsDropdownOpen(false);
                  setActionDropdown(actionDropdown === "time" ? null : "time");
                }}
                className={clsx(
                  "h-full flex items-center gap-1 px-2 text-[11px] transition-colors cursor-pointer",
                  actionDropdown === "time" ? "text-white" : "text-white/40 hover:text-white/70"
                )}
              >
                <span>
                  {actionFilters.timeRange
                    ? `${formatMonth(actionFilters.timeRange.from)} – ${formatMonth(actionFilters.timeRange.to)}`
                    : "Time"}
                </span>
                {actionFilters.timeRange && (
                  <span
                    className="w-3 h-3 rounded-full bg-white/20 flex items-center justify-center hover:bg-red-500 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      onActionFiltersChange?.({ ...actionFilters, timeRange: null });
                    }}
                  >
                    <X size={7} className="text-white" />
                  </span>
                )}
              </button>
            </div>
          </>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bioregion stats */}
        {selectedBioregion && (
          <div className="flex items-center gap-2 mr-4 px-3 py-1 bg-white/5 rounded">
            <div className="flex items-center gap-1" title="Ecosystem Integrity Index">
              <Leaf size={12} className="text-emerald-400" />
              <span className={clsx(
                "text-[11px] font-medium",
                selectedBioregion.eii >= 0.7 ? "text-emerald-400" :
                selectedBioregion.eii >= 0.5 ? "text-yellow-400" : "text-red-400"
              )}>
                {(selectedBioregion.eii * 100).toFixed(0)}%
              </span>
              {selectedBioregion.eiiDelta !== 0 && (
                <span className={clsx(
                  "text-[9px]",
                  selectedBioregion.eiiDelta > 0 ? "text-emerald-400" : "text-red-400"
                )}>
                  {selectedBioregion.eiiDelta > 0 ? "+" : ""}{(selectedBioregion.eiiDelta * 100).toFixed(1)}%
                </span>
              )}
            </div>
            <div className="w-px h-3 bg-white/20" />
            <div className="flex items-center gap-1" title="Assets">
              <Cube size={12} className="text-blue-400" />
              <span className="text-[11px] text-white/70">{selectedBioregion.assetCount}</span>
            </div>
            <div className="w-px h-3 bg-white/20" />
            <div className="flex items-center gap-1" title="Actors (Orgs + Agents)">
              <Users size={12} className="text-purple-400" />
              <span className="text-[11px] text-white/70">{selectedBioregion.actorCount}</span>
            </div>
          </div>
        )}

        {/* Item count */}
        <span className="text-white/50 text-[11px] whitespace-nowrap">
          {itemCount} items
        </span>
      </div>

      {/* Asset filters dropdown */}
      {isDropdownOpen && (
        <FiltersDropdown
          onClose={() => setIsDropdownOpen(false)}
          openFilter={selectedFilter}
        />
      )}

      {/* Action Protocol dropdown — grid layout matching Chain dropdown */}
      {actionDropdown === "protocol" && (
        <div className="absolute top-8 left-0 bg-white rounded-b-lg shadow-lg max-h-64 overflow-y-auto min-w-[220px] z-20 p-2">
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            {availableProtocols.map(([id, proto]) => {
              const active = actionFilters?.protocols.has(id);
              return (
                <div
                  key={id}
                  onClick={() => toggleProtocol(id)}
                  className={clsx(
                    "flex items-center gap-2 py-1.5 px-1.5 rounded",
                    "cursor-pointer hover:bg-gray-50 transition-colors",
                    active && "bg-emerald-50"
                  )}
                >
                  <ProtocolIcon protocolId={id} protocolName={proto.name} size={14} />
                  <span className={clsx(
                    "text-xs truncate",
                    active ? "text-emerald-700 font-medium" : "text-gray-700"
                  )}>
                    {proto.name}
                  </span>
                  {active && <span className="text-emerald-500 text-[10px] ml-auto shrink-0">✓</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action SDG dropdown — all 17 SDGs with checkboxes */}
      {actionDropdown === "sdg" && (
        <div className="absolute top-8 left-0 bg-white rounded-b-lg shadow-lg max-h-72 overflow-y-auto min-w-[320px] z-20 p-1">
          {ALL_SDGS.map(({ code, title }) => {
            const active = actionFilters?.sdgs.has(code);
            const hasActions = availableSdgs.some(([c]) => c === code);
            return (
              <button
                key={code}
                onClick={() => toggleSdg(code)}
                className={clsx(
                  "w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left transition-colors",
                  active ? "bg-emerald-50" : "hover:bg-gray-50",
                  !hasActions && "opacity-40"
                )}
              >
                <span
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: SDG_COLORS[code] || "#6B7280" }}
                >
                  {code}
                </span>
                <span className={clsx("flex-1 text-xs truncate", active && "font-semibold text-emerald-700")}>
                  {title}
                </span>
                <div className={clsx(
                  "w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0",
                  active ? "bg-emerald-500 border-emerald-500" : "border-gray-300"
                )}>
                  {active && <span className="text-white text-[8px] font-bold">✓</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Action Time range — single bar with two draggable edges */}
      {actionDropdown === "time" && timeRange.length > 0 && (() => {
        const fromIdx = actionFilters?.timeRange ? Math.max(0, timeRange.indexOf(actionFilters.timeRange.from)) : 0;
        const toIdx = actionFilters?.timeRange ? Math.max(0, timeRange.indexOf(actionFilters.timeRange.to)) : timeRange.length - 1;
        const pctLeft = (fromIdx / (timeRange.length - 1)) * 100;
        const pctRight = (toIdx / (timeRange.length - 1)) * 100;

        return (
          <div className="absolute top-8 left-0 right-0 bg-gray-900/95 backdrop-blur-sm shadow-lg z-20 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-white/50">{formatMonth(timeRange[0])}</span>
              <span className="text-[11px] font-medium text-white">
                {formatMonth(timeRange[fromIdx])} – {formatMonth(timeRange[toIdx])}
              </span>
              <span className="text-[10px] text-white/50">{formatMonth(timeRange[timeRange.length - 1])}</span>
            </div>
            {/* Visual bar track */}
            <div className="relative h-2 bg-white/10 rounded-full">
              {/* Active range highlight */}
              <div
                className="absolute h-full bg-emerald-500 rounded-full"
                style={{ left: `${pctLeft}%`, width: `${pctRight - pctLeft}%` }}
              />
            </div>
            {/* Invisible dual range inputs stacked on top */}
            <div className="relative h-0">
              <input
                type="range"
                min={0}
                max={timeRange.length - 1}
                value={fromIdx}
                onChange={(e) => {
                  const idx = Math.min(parseInt(e.target.value, 10), toIdx);
                  onActionFiltersChange?.({
                    ...actionFilters!,
                    timeRange: { from: timeRange[idx], to: timeRange[toIdx] },
                  });
                }}
                className="absolute -top-2 left-0 w-full h-4 opacity-0 cursor-pointer z-10"
                style={{ pointerEvents: 'auto' }}
              />
              <input
                type="range"
                min={0}
                max={timeRange.length - 1}
                value={toIdx}
                onChange={(e) => {
                  const idx = Math.max(parseInt(e.target.value, 10), fromIdx);
                  onActionFiltersChange?.({
                    ...actionFilters!,
                    timeRange: { from: timeRange[fromIdx], to: timeRange[idx] },
                  });
                }}
                className="absolute -top-2 left-0 w-full h-4 opacity-0 cursor-pointer z-20"
                style={{ pointerEvents: 'auto' }}
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// UN SDG colors (shared with ExploreCards)
const SDG_COLORS: Record<string, string> = {
  "1": "#E5243B", "2": "#DDA63A", "3": "#4C9F38", "4": "#C5192D",
  "5": "#FF3A21", "6": "#26BDE2", "7": "#FCC30B", "8": "#A21942",
  "9": "#FD6925", "10": "#DD1367", "11": "#FD9D24", "12": "#BF8B2E",
  "13": "#3F7E44", "14": "#0A97D9", "15": "#56C02B", "16": "#00689D",
  "17": "#19486A",
};
