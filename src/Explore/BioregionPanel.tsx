import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  X,
  TreeStructure,
  Buildings,
  Globe,
  ArrowRight,
  Users,
  Lightning,
  MagnifyingGlass,
  Leaf,
  TrendUp,
  TrendDown,
  Robot,
  Vault,
  CaretDown,
  MapPin,
  LinkSimple,
} from "@phosphor-icons/react";

// Official UN SDG colors
const SDG_COLORS: Record<string, string> = {
  "1": "#E5243B", "2": "#DDA63A", "3": "#4C9F38", "4": "#C5192D",
  "5": "#FF3A21", "6": "#26BDE2", "7": "#FCC30B", "8": "#A21942",
  "9": "#FD6925", "10": "#DD1367", "11": "#FD9D24", "12": "#BF8B2E",
  "13": "#3F7E44", "14": "#0A97D9", "15": "#56C02B", "16": "#00689D",
  "17": "#19486A",
};
import type { Asset } from "../modules/assets";
import type { Org, Action } from "../shared/types";
import type { BioregionStats } from "../modules/intelligence/bioregionIntelligence";
import {
  getBioregionStats,
  getOrgsBioregion,
  getActionsBioregion,
  loadBioregionGeoJSON,
} from "../modules/intelligence/bioregionIntelligence";
import { useEII } from "../modules/ecospatial/eii";
import { useAgentsByBioregion } from "../modules/ecospatial/a2a";
import { AGENT_TYPE_LABELS } from "../modules/ecospatial/a2a/types";
import { AgentAvatarCompact } from "../modules/ecospatial/a2a/components/AgentAvatar";
import { ProtocolIcon } from "../modules/chains/components/ProtocolIcon";

// Asset type color mapping (matches ClusteredAssetLayer)
const TYPE_COLORS: Record<number, string> = {
  5: "#F4D35E",
  1: "#4CAF50",
  6: "#00ACC1",
  7: "#BA68C8",
  4: "#FF8A65",
  8: "#90A4AE",
};

interface BioregionPanelProps {
  bioregionCode: string;
  bioregionName: string;
  bioregionColor: string;
  bioregionRealmName: string;
  allAssets: Asset[];
  allOrgs: Org[];
  allActions: Action[];
  onClose: () => void;
  onAssetSelect: (asset: Asset) => void;
  onAgentClick?: (address: string) => void;
  defaultTab?: 'overview' | 'assets' | 'actors' | 'actions';
}

export function BioregionPanel({
  bioregionCode,
  bioregionName,
  bioregionColor,
  bioregionRealmName,
  allAssets,
  allOrgs,
  allActions,
  onClose,
  onAssetSelect,
  onAgentClick,
  defaultTab = 'overview',
}: BioregionPanelProps) {
  const [stats, setStats] = useState<BioregionStats | null>(null);
  const [bioregionOrgs, setBioregionOrgs] = useState<Org[]>([]);
  const [bioregionActions, setBioregionActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);

  // Fetch EII data for this bioregion
  const { data: eiiData } = useEII(bioregionCode);

  // Fetch agents committed to this bioregion
  const { data: agents } = useAgentsByBioregion(bioregionCode);

  // Tab-based navigation for cleaner UX
  type TabKey = 'overview' | 'assets' | 'actors' | 'actions';
  const [activeTab, setActiveTab] = useState<TabKey>(defaultTab);

  // Sync tab when defaultTab prop changes (e.g. action click → actions tab)
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  // Mock vault data for bioregion (in production this would come from subgraph)
  const vaultData = useMemo(() => {
    // Generate deterministic mock data based on bioregion code
    const hash = bioregionCode.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const hasVault = hash % 3 !== 0; // 2/3 of bioregions have vaults

    if (!hasVault) return null;

    const tvl = 50000 + (hash % 200) * 1000;
    const yieldRate = 5 + (hash % 15);
    const activeProposals = hash % 5;
    const epoch = 12 + (hash % 8);
    const nextSettlement = Date.now() + (hash % 7) * 24 * 60 * 60 * 1000;

    return {
      tvl,
      yieldRate,
      activeProposals,
      epoch,
      nextSettlement,
      tokenSymbol: 'ESV',
      proposals: [
        { id: 'prop-1', title: 'Wetland restoration phase 2', fundingTarget: 25000, fundingCurrent: 18500, pillar: 'structure' as const },
        { id: 'prop-2', title: 'Native species reintroduction', fundingTarget: 15000, fundingCurrent: 15000, pillar: 'composition' as const },
        { id: 'prop-3', title: 'Water quality monitoring expansion', fundingTarget: 8000, fundingCurrent: 3200, pillar: 'function' as const },
      ].slice(0, activeProposals || 1),
    };
  }, [bioregionCode]);

  // Type filter for asset list
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);

  // Search within asset list
  const [assetSearch, setAssetSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    loadBioregionGeoJSON().then((geojson) => {
      if (cancelled) return;
      const result = getBioregionStats(bioregionCode, allAssets, geojson);
      setStats(result);
      setBioregionOrgs(getOrgsBioregion(allOrgs, bioregionCode, geojson));
      setBioregionActions(
        getActionsBioregion(allActions, bioregionCode, geojson)
      );
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [bioregionCode, allAssets, allOrgs, allActions]);

  const typeEntries = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.typeDistribution).sort(
      ([, a], [, b]) => b.count - a.count
    );
  }, [stats]);

  const totalTypeCount = useMemo(
    () => typeEntries.reduce((sum, [, v]) => sum + v.count, 0),
    [typeEntries]
  );

  // Sort: primary assets first (alphabetical), then second-order (alphabetical)
  const sortedAssets = useMemo(() => {
    if (!stats) return [];
    return [...stats.assets].sort((a, b) => {
      if (a.second_order !== b.second_order) return a.second_order ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  }, [stats]);

  // Filter assets by selected type and search query
  const displayedAssets = useMemo(() => {
    let filtered = sortedAssets;
    if (selectedTypeId) {
      filtered = filtered.filter((a) =>
        a.asset_types?.some((t) => t.id === selectedTypeId)
      );
    }
    if (assetSearch.trim()) {
      const q = assetSearch.toLowerCase();
      filtered = filtered.filter((a) => a.name.toLowerCase().includes(q));
    }
    return filtered;
  }, [sortedAssets, selectedTypeId, assetSearch]);

  if (loading) {
    return (
      <div className="flex-1 min-h-0 bg-cardBackground animate-pulse p-6">
        <div className="h-6 bg-gray-200 rounded w-2/3 mb-4" />
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
        <div className="h-4 bg-gray-200 rounded w-3/4" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex-1 min-h-0 bg-cardBackground p-6 text-center text-gray-400">
        Bioregion not found
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-cardBackground overflow-hidden">
      {/* ── Header — photo background with integrated stats ── */}
      <div className="relative overflow-hidden shrink-0">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(/images/bioregions/${bioregionCode}.webp)`,
            backgroundColor: bioregionColor,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
        <div className="relative z-10 px-5 pt-4 pb-3">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Globe size={14} weight="fill" className="text-white/60" />
                <span className="text-[10px] font-semibold px-2 py-0.5 bg-white/15 text-white/80 backdrop-blur-sm">
                  {bioregionRealmName}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white leading-tight">
                {bioregionName}
              </h2>
              <span className="text-[10px] text-white/35">{bioregionCode}</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/20 transition-colors"
            >
              <X size={18} className="text-white/50" />
            </button>
          </div>
          {/* Inline stats — compact pills at the bottom of the hero */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-white/90">
              <TreeStructure size={12} weight="bold" className="text-white/50" />
              <span className="text-xs font-semibold">{stats.assetCount}</span>
              <span className="text-[10px] text-white/50">assets</span>
            </div>
            <div className="flex items-center gap-1.5 text-white/90">
              <Buildings size={12} weight="bold" className="text-white/50" />
              <span className="text-xs font-semibold">{stats.issuers.length}</span>
              <span className="text-[10px] text-white/50">issuers</span>
            </div>
            {(bioregionOrgs.length > 0 || (agents && agents.length > 0)) && (
              <div className="flex items-center gap-1.5 text-white/90">
                <Users size={12} weight="bold" className="text-white/50" />
                <span className="text-xs font-semibold">{bioregionOrgs.length + (agents?.length || 0)}</span>
                <span className="text-[10px] text-white/50">actors</span>
              </div>
            )}
            {bioregionActions.length > 0 && (
              <div className="flex items-center gap-1.5 text-white/90">
                <Lightning size={12} weight="bold" className="text-white/50" />
                <span className="text-xs font-semibold">{bioregionActions.length}</span>
                <span className="text-[10px] text-white/50">actions</span>
              </div>
            )}
            {/* EII Score in header */}
            {eiiData && (
              <div className="flex items-center gap-1.5 text-white/90">
                <Leaf size={12} weight="bold" className="text-esv-400" />
                <span className="text-xs font-semibold">{(eiiData.eii * 100).toFixed(0)}</span>
                <span className="text-[10px] text-white/50">EII</span>
                {eiiData.delta !== undefined && (
                  <span className={`text-[10px] ${eiiData.delta >= 0 ? 'text-esv-300' : 'text-red-300'}`}>
                    {eiiData.delta >= 0 ? '+' : ''}{(eiiData.delta * 100).toFixed(1)}%
                  </span>
                )}
              </div>
            )}
          </div>
          {stats.secondOrderAssetCount > 0 && (
            <div className="text-[10px] text-white/40 mt-1">
              {stats.primaryAssetCount} primary · {stats.secondOrderAssetCount} derived
            </div>
          )}
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="flex border-b border-gray-200 shrink-0 bg-white">
        {[
          { key: 'overview' as TabKey, label: 'Overview', icon: <Leaf size={14} /> },
          { key: 'assets' as TabKey, label: `Assets (${sortedAssets.length})`, icon: <TreeStructure size={14} /> },
          { key: 'actors' as TabKey, label: `Actors (${bioregionOrgs.length + (agents?.length || 0)})`, icon: <Users size={14} /> },
          { key: 'actions' as TabKey, label: `Actions (${bioregionActions.length})`, icon: <Lightning size={14} /> },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? 'text-gray-900 border-b-2 border-gray-900 -mb-px'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="p-4 space-y-4">
            {/* EII Card */}
            {eiiData && (
              <div className="bg-gradient-to-br from-esv-50 to-emerald-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Leaf size={16} className="text-esv-600" />
                    <span className="text-sm font-semibold text-gray-900">Ecosystem Integrity</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-2xl font-bold text-esv-600">{(eiiData.eii * 100).toFixed(0)}%</span>
                    {eiiData.delta !== undefined && (
                      <span className={`text-xs flex items-center ${eiiData.delta >= 0 ? 'text-esv-500' : 'text-red-500'}`}>
                        {eiiData.delta >= 0 ? <TrendUp size={12} /> : <TrendDown size={12} />}
                        {(eiiData.delta * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  {[
                    { key: 'function' as const, color: 'bg-pillar-function' },
                    { key: 'structure' as const, color: 'bg-pillar-structure' },
                    { key: 'composition' as const, color: 'bg-pillar-composition' },
                  ].map((p) => (
                    <div key={p.key} className="flex items-center gap-2">
                      <span className="w-24 text-[11px] text-gray-600 capitalize">{p.key}</span>
                      <div className="flex-1 h-1.5 bg-white/50 rounded-full">
                        <div className={`h-full ${p.color} rounded-full`} style={{ width: `${eiiData.pillars[p.key] * 100}%` }} />
                      </div>
                      <span className={`w-8 text-[10px] text-right ${p.key === eiiData.limitingPillar ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                        {(eiiData.pillars[p.key] * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vault Card */}
            {vaultData && (
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Vault size={16} className="text-amber-600" />
                    <span className="text-sm font-semibold text-gray-900">Bioregion Vault</span>
                  </div>
                  <span className="text-lg font-bold text-amber-600">${(vaultData.tvl / 1000).toFixed(0)}K</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900">{vaultData.yieldRate}%</div>
                    <div className="text-[10px] text-gray-500">APY</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900">{vaultData.epoch}</div>
                    <div className="text-[10px] text-gray-500">Epoch</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900">{vaultData.proposals.length}</div>
                    <div className="text-[10px] text-gray-500">Proposals</div>
                  </div>
                </div>
                <Link
                  to={`/vaults/${bioregionCode}`}
                  className="flex items-center justify-center gap-1 w-full py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded transition-colors"
                >
                  View Vault <ArrowRight size={12} />
                </Link>
              </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-gray-900">{stats.assetCount}</div>
                <div className="text-[11px] text-gray-500">Assets</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-gray-900">{bioregionOrgs.length + (agents?.length || 0)}</div>
                <div className="text-[11px] text-gray-500">Actors</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-gray-900">{bioregionActions.length}</div>
                <div className="text-[11px] text-gray-500">Actions</div>
              </div>
            </div>
          </div>
        )}

        {/* Assets Tab */}
        {activeTab === 'assets' && (
          <div>
            {/* Type distribution */}
            {typeEntries.length > 0 && (
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
                  {typeEntries.map(([typeId, { count }]) => {
                    const id = Number(typeId);
                    return (
                      <button
                        key={typeId}
                        onClick={() => setSelectedTypeId(selectedTypeId === id ? null : id)}
                        style={{
                          width: `${(count / totalTypeCount) * 100}%`,
                          backgroundColor: TYPE_COLORS[id] ?? "#BDBDBD",
                          opacity: selectedTypeId && selectedTypeId !== id ? 0.3 : 1,
                        }}
                        className="rounded-full transition-opacity cursor-pointer"
                      />
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {typeEntries.map(([typeId, { count, name }]) => {
                    const id = Number(typeId);
                    return (
                      <button
                        key={typeId}
                        onClick={() => setSelectedTypeId(selectedTypeId === id ? null : id)}
                        className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                          selectedTypeId === id ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[id] ?? "#BDBDBD" }} />
                        {name} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Search */}
            {sortedAssets.length > 5 && (
              <div className="relative border-b border-gray-100">
                <MagnifyingGlass size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={assetSearch}
                  onChange={(e) => setAssetSearch(e.target.value)}
                  placeholder="Search assets..."
                  className="w-full pl-9 pr-4 py-2 text-xs focus:outline-none"
                />
              </div>
            )}

            {/* Asset list */}
            <div>
              {displayedAssets.length === 0 ? (
                <div className="text-xs text-gray-400 py-8 text-center">
                  {assetSearch ? "No matching assets" : "No assets in this bioregion"}
                </div>
              ) : (
                displayedAssets.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => onAssetSelect(asset)}
                    className="w-full text-left hover:bg-gray-50 px-4 py-2.5 transition-colors border-b border-gray-50"
                  >
                    <div className="flex items-center gap-2.5">
                      {asset.main_image ? (
                        <div className="w-10 h-10 rounded bg-cover bg-center flex-shrink-0" style={{ backgroundImage: `url(${asset.main_image})` }} />
                      ) : (
                        <div className="w-10 h-10 rounded bg-gray-100 flex-shrink-0 flex items-center justify-center">
                          <TreeStructure size={14} className="text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{asset.name}</div>
                        <div className="text-[10px] text-gray-400 truncate">{asset.issuer?.name}</div>
                      </div>
                      <ArrowRight size={14} className="text-gray-300" />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* People Tab (Actors + Agents) */}
        {activeTab === 'actors' && (
          <div>
            {/* Agents section */}
            {agents && agents.length > 0 && (
              <>
                <div className="px-4 py-2 bg-purple-50 text-[11px] font-semibold text-purple-700 flex items-center gap-1.5">
                  <Robot size={12} />
                  AI Agents ({agents.length})
                </div>
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => onAgentClick?.(agent.address)}
                    className="w-full px-4 py-2.5 hover:bg-purple-50 transition-colors text-left border-b border-gray-50"
                  >
                    <div className="flex items-center gap-2.5">
                      <AgentAvatarCompact address={agent.address} agentType={agent.agentType} status={agent.status} size={36} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{agent.name}</div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded">{AGENT_TYPE_LABELS[agent.agentType]}</span>
                          <span className="text-[10px] text-gray-400">{agent.esvStaked.toLocaleString()} ESV</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </>
            )}

            {/* Actors section */}
            {bioregionOrgs.length > 0 && (
              <>
                <div className="px-4 py-2 bg-blue-50 text-[11px] font-semibold text-blue-700 flex items-center gap-1.5">
                  <Users size={12} />
                  Organizations ({bioregionOrgs.length})
                </div>
                {bioregionOrgs.map((org) => (
                  <Link key={org.id} to={`/orgs/${org.id}`} className="block px-4 py-2.5 hover:bg-blue-50 transition-colors border-b border-gray-50">
                    <div className="flex items-center gap-2.5">
                      {org.main_image ? (
                        <div className="w-10 h-10 rounded bg-cover bg-center flex-shrink-0" style={{ backgroundImage: `url(${org.main_image})` }} />
                      ) : (
                        <div className="w-10 h-10 rounded bg-blue-100 flex-shrink-0 flex items-center justify-center">
                          <Users size={14} className="text-blue-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{org.name}</div>
                        {org.address && <div className="text-[10px] text-gray-400 truncate">{org.address}</div>}
                      </div>
                      <ArrowRight size={14} className="text-gray-300" />
                    </div>
                  </Link>
                ))}
              </>
            )}

            {(!agents || agents.length === 0) && bioregionOrgs.length === 0 && (
              <div className="text-xs text-gray-400 py-8 text-center">No people in this bioregion yet</div>
            )}
          </div>
        )}

        {/* Actions Tab — inline accordion */}
        {activeTab === 'actions' && (
          <div>
            {bioregionActions.length === 0 ? (
              <div className="text-xs text-gray-400 py-8 text-center">No actions in this bioregion yet</div>
            ) : (
              bioregionActions.map((action) => {
                const isOpen = expandedActionId === action.id;
                return (
                  <div key={action.id} className="border-b border-gray-50">
                    <button
                      onClick={() => setExpandedActionId(isOpen ? null : action.id)}
                      className="w-full px-4 py-2.5 hover:bg-emerald-50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        {action.main_image ? (
                          <div
                            className="w-10 h-10 rounded bg-cover bg-center flex-shrink-0"
                            style={{ backgroundImage: `url(${action.main_image})` }}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-emerald-100 flex-shrink-0 flex items-center justify-center">
                            <Lightning size={14} className="text-emerald-600" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{action.title}</div>
                          {action.region && (
                            <div className="flex items-center gap-0.5 text-[10px] text-gray-400">
                              <MapPin size={9} className="flex-shrink-0" />
                              <span className="truncate">{action.region}</span>
                            </div>
                          )}
                        </div>
                        <CaretDown
                          size={14}
                          className={`text-gray-300 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                      </div>
                    </button>
                    {isOpen && (() => {
                      const protocol = action.proofs[0]?.protocol;
                      const platform = action.proofs[0]?.platform;
                      const actor = action.actors[0];
                      const dateRange = [action.action_start_date, action.action_end_date]
                        .filter(Boolean)
                        .map(d => new Date(d!).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }))
                        .join(' – ');

                      return (
                        <div className="pb-1">
                          {/* ── Photo banner with title overlay ── */}
                          <div className="relative h-28 overflow-hidden">
                            <div
                              className="absolute inset-0 bg-cover bg-center"
                              style={{
                                backgroundImage: action.main_image ? `url(${action.main_image})` : undefined,
                                backgroundColor: protocol?.color || '#059669',
                              }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                            <div className="relative z-10 h-full flex flex-col justify-end px-4 pb-3">
                              {protocol && (
                                <span
                                  className="self-start text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded mb-1"
                                  style={{ backgroundColor: protocol.color || '#059669', color: '#fff' }}
                                >
                                  {protocol.name}
                                </span>
                              )}
                              <h3 className="text-sm font-bold text-white leading-tight">{action.title}</h3>
                              <div className="flex items-center gap-1 text-[10px] text-white/70 mt-0.5">
                                {action.country_code && (
                                  <>
                                    <MapPin size={9} />
                                    <span>{action.country_code}</span>
                                    <span className="text-white/30 mx-0.5">·</span>
                                  </>
                                )}
                                {actor && <span>{actor.name}</span>}
                              </div>
                            </div>
                          </div>

                          {/* ── Protocol badge + SDG row ── */}
                          <div className="px-4 pt-2.5 pb-2">
                            <div className="flex items-center gap-2 mb-2">
                              {platform && (
                                <img src={platform.image.thumb} alt="" className="w-5 h-5 rounded-full" />
                              )}
                              <span className="text-xs text-gray-700">{platform?.name || 'Unknown'}</span>
                              {action.proofs.length > 0 && (
                                <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full font-medium">
                                  {action.proofs.length} {action.proofs.length === 1 ? 'proof' : 'proofs'}
                                </span>
                              )}
                              {dateRange && (
                                <span className="text-[10px] text-gray-400 ml-auto">{dateRange}</span>
                              )}
                            </div>

                            {/* SDG icons */}
                            {action.sdg_outcomes.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap">
                                {[...action.sdg_outcomes]
                                  .sort((a, b) => parseInt(a.code, 10) - parseInt(b.code, 10))
                                  .map((sdg) => (
                                    <span
                                      key={sdg.code}
                                      title={sdg.title}
                                      className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full text-[9px] font-bold text-white"
                                      style={{ backgroundColor: SDG_COLORS[sdg.code] || '#6B7280' }}
                                    >
                                      {sdg.code}
                                    </span>
                                  ))}
                              </div>
                            )}
                          </div>

                          {/* ── Description ── */}
                          {action.description && (
                            <div className="px-4 pb-3">
                              <p className="text-xs text-gray-600 leading-relaxed">
                                {action.description}
                              </p>
                            </div>
                          )}

                          {/* ── Verification & Proofs (like Ratings & Certifications) ── */}
                          {action.proofs.length > 0 && (
                            <div className="border-t border-gray-100">
                              <div className="px-4 py-2 flex items-center gap-1.5 text-xs font-medium text-gray-700">
                                <LinkSimple size={13} className="text-gray-400" />
                                <span>Verification ({action.proofs.length})</span>
                              </div>
                              <div className="px-4 pb-2 space-y-1.5">
                                {action.proofs.map((proof) => {
                                  // Match period to proof for date label
                                  const period = action.periods?.find(p => p.proof_id === proof.id);
                                  const periodDate = period
                                    ? new Date(period.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                                    : null;

                                  return (
                                    <a
                                      key={proof.id}
                                      href={proof.proof_explorer_link || proof.proof_link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg hover:bg-emerald-50 transition-colors group"
                                    >
                                      <ProtocolIcon protocolId={proof.protocol.id} protocolName={proof.protocol.name} size={18} />
                                      <div className="flex-1 min-w-0">
                                        <div className="text-xs font-medium text-gray-900">{proof.protocol.name}</div>
                                        {periodDate && (
                                          <div className="text-[10px] text-gray-400">{periodDate}</div>
                                        )}
                                      </div>
                                      <ArrowRight size={12} className="text-gray-300 group-hover:text-emerald-500 flex-shrink-0" />
                                    </a>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* ── Actor / Org (like Issuer) ── */}
                          {action.actors.length > 0 && (
                            <div className="border-t border-gray-100">
                              <div className="px-4 py-2 flex items-center gap-1.5 text-xs font-medium text-gray-700">
                                <Buildings size={13} className="text-gray-400" />
                                <span>Organization</span>
                              </div>
                              <div className="px-4 pb-2 space-y-1">
                                {action.actors.map((act) => (
                                  <div key={act.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                                    <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                      <Users size={10} className="text-blue-500" />
                                    </div>
                                    <span className="text-xs font-medium text-gray-900 flex-1">{act.name}</span>
                                    {act.website && (
                                      <a href={act.website} target="_blank" rel="noopener noreferrer">
                                        <ArrowRight size={12} className="text-gray-300 hover:text-blue-500" />
                                      </a>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* ── Chain / Platform (like Chains) ── */}
                          {platform && (
                            <div className="border-t border-gray-100">
                              <div className="px-4 py-2 flex items-center gap-1.5 text-xs font-medium text-gray-700">
                                <Globe size={13} className="text-gray-400" />
                                <span>Chain</span>
                              </div>
                              <div className="px-4 pb-3">
                                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                                  <img src={platform.image.thumb} alt="" className="w-4 h-4 rounded-full" />
                                  <span className="text-xs text-gray-700">{platform.name}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
