import { ArrowRight, MapPin, TreeStructure, Users, Lightning, Globe, Leaf, Vault, TrendUp, TrendDown } from "@phosphor-icons/react";
import { Link } from "react-router-dom";

// Official UN SDG colors
const SDG_COLORS: Record<string, string> = {
  "1": "#E5243B", "2": "#DDA63A", "3": "#4C9F38", "4": "#C5192D",
  "5": "#FF3A21", "6": "#26BDE2", "7": "#FCC30B", "8": "#A21942",
  "9": "#FD6925", "10": "#DD1367", "11": "#FD9D24", "12": "#BF8B2E",
  "13": "#3F7E44", "14": "#0A97D9", "15": "#56C02B", "16": "#00689D",
  "17": "#19486A",
};
import { Asset } from "../modules/assets";
import { Org, Action } from "../shared/types";
import { ChainTag } from "../modules/chains/components/ChainTag";
import { ChainIcon } from "../modules/chains/components/ChainIcon";
import { COUNTRY_CODE_TO_NAME } from "../shared/countryCodes";
import type { BioregionProperties } from "../modules/intelligence/bioregionIntelligence";

const TYPE_COLORS: Record<number, string> = {
  5: "#F4D35E",
  1: "#4CAF50",
  6: "#00ACC1",
  7: "#BA68C8",
  4: "#FF8A65",
  8: "#90A4AE",
};

// ── Asset Card ──

interface AssetExploreCardProps {
  asset: Asset;
  onLocate: () => void;
}

export function AssetExploreCard({ asset, onLocate }: AssetExploreCardProps) {
  const typeColor = TYPE_COLORS[asset.asset_types[0]?.id] ?? "#9CA3AF";
  const location = [
    asset.region,
    COUNTRY_CODE_TO_NAME[asset.country_code],
  ]
    .filter(Boolean)
    .join(", ");

  const signals: string[] = [];
  if (asset.prefinancing) signals.push("Prefinancing");
  if (asset.pretoken) signals.push("Pretoken");
  if (asset.yield_bearing) signals.push("Yield");
  if (asset.certifications.length > 0)
    signals.push(
      `${asset.certifications.length} rating${asset.certifications.length > 1 ? "s" : ""}`
    );
  if (asset.child_assets.length > 0)
    signals.push(`${asset.child_assets.length} derived`);

  return (
    <div
      className="group bg-cardBackground border border-gray-100 hover:border-gray-300 transition-all cursor-pointer overflow-hidden"
      onClick={onLocate}
    >
      <div className="flex">
        <div
          className="w-1 flex-shrink-0 "
          style={{ backgroundColor: typeColor }}
        />
        {/* Avatar */}
        <div className="flex items-center pl-2.5 py-2.5">
          {asset.main_image ? (
            <div
              className="w-10 h-10 bg-cover bg-center flex-shrink-0"
              style={{ backgroundImage: `url(${asset.main_image})` }}
            />
          ) : (
            <div
              className="w-10 h-10 flex-shrink-0 flex items-center justify-center"
              style={{ backgroundColor: `${typeColor}18` }}
            >
              <TreeStructure size={16} style={{ color: typeColor }} />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 px-2.5 py-2.5">
          {/* Row 1: type + chains */}
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              {asset.asset_types.map((t) => (
                <span
                  key={t.id}
                  className="text-[11px] font-semibold px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: `${TYPE_COLORS[t.id] ?? "#9CA3AF"}18`,
                    color: TYPE_COLORS[t.id] ?? "#666",
                  }}
                >
                  {t.name}
                </span>
              ))}
              {asset.asset_subtypes.slice(0, 1).map((s) => (
                <span key={s.id} className="text-[11px] text-gray-400 truncate">
                  {s.name}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {asset.platforms.slice(0, 2).map((p) => (
                <div key={p.id} className="w-4 h-4 flex items-center justify-center rounded-full [&>div]:!w-4 [&>div]:!h-4">
                  <ChainTag platform={p} />
                </div>
              ))}
            </div>
          </div>

          {/* Row 2: name */}
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-gray-900 truncate">
              {asset.name}
            </h4>
            <Link
              to={`/assets/${asset.id}`}
              onClick={(e) => e.stopPropagation()}
              className="flex-shrink-0 text-gray-300 group-hover:text-gray-500 transition-colors"
            >
              <ArrowRight size={14} />
            </Link>
          </div>

          {/* Row 3: location + issuer */}
          <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-500">
            {location && (
              <span className="flex items-center gap-0.5 truncate">
                <MapPin size={11} className="flex-shrink-0" />
                {location}
              </span>
            )}
            {location && asset.issuer?.name && (
              <span className="text-gray-300">·</span>
            )}
            {asset.issuer?.name && (
              <span className="font-medium text-gray-600 truncate">
                {asset.issuer.name}
              </span>
            )}
          </div>

          {/* Row 4: signals */}
          {signals.length > 0 && (
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {signals.map((s) => (
                <span
                  key={s}
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Org Card ──

interface OrgExploreCardProps {
  org: Org;
  onLocate: () => void;
}

export function OrgExploreCard({ org, onLocate }: OrgExploreCardProps) {
  const signals: string[] = [];
  if (org.assets.length > 0)
    signals.push(`${org.assets.length} asset${org.assets.length > 1 ? "s" : ""}`);
  if (org.issuers.length > 0)
    signals.push(`${org.issuers.length} issuer${org.issuers.length > 1 ? "s" : ""}`);
  if (org.treasury.length > 0)
    signals.push(`${org.treasury.length} treasur${org.treasury.length > 1 ? "ies" : "y"}`);

  return (
    <div
      className="group bg-cardBackground border border-gray-100 hover:border-blue-200 transition-all cursor-pointer overflow-hidden"
      onClick={onLocate}
    >
      <div className="flex">
        <div className="w-1 flex-shrink-0  bg-blue-500" />
        {/* Avatar */}
        <div className="flex items-center pl-2.5 py-2.5">
          {org.main_image ? (
            <div
              className="w-10 h-10 bg-cover bg-center flex-shrink-0"
              style={{ backgroundImage: `url(${org.main_image})` }}
            />
          ) : (
            <div className="w-10 h-10 bg-blue-50 flex-shrink-0 flex items-center justify-center">
              <Users size={16} className="text-blue-400" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 px-2.5 py-2.5">
          {/* Row 1: label + ecosystems */}
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
              Actor
            </span>
            <div className="flex items-center gap-1 flex-shrink-0">
              {org.ecosystems.slice(0, 3).map((eco) => (
                <img
                  key={eco.id}
                  src={eco.icon}
                  alt={eco.name}
                  title={eco.name}
                  className="w-4 h-4 rounded-full"
                />
              ))}
            </div>
          </div>

          {/* Row 2: name */}
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-gray-900 truncate">
              {org.name}
            </h4>
            <Link
              to={`/orgs/${org.id}`}
              onClick={(e) => e.stopPropagation()}
              className="flex-shrink-0 text-gray-300 group-hover:text-blue-500 transition-colors"
            >
              <ArrowRight size={14} />
            </Link>
          </div>

          {/* Row 3: location + established */}
          <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-500">
            {org.address && (
              <span className="flex items-center gap-0.5 truncate">
                <MapPin size={11} className="flex-shrink-0" />
                {org.address}
              </span>
            )}
            {org.address && org.established && (
              <span className="text-gray-300">·</span>
            )}
            {org.established && (
              <span>Est. {new Date(org.established).getFullYear()}</span>
            )}
          </div>

          {/* Row 4: signals */}
          {signals.length > 0 && (
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {signals.map((s) => (
                <span
                  key={s}
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600"
                >
                  {s}
                </span>
              ))}
              {org.treasury.slice(0, 2).map((t) => (
                <div key={t.platform.id} className="w-4 h-4 flex items-center justify-center rounded-full [&>div]:!w-4 [&>div]:!h-4">
                  <ChainTag platform={t.platform} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Action Card ──

interface ActionExploreCardProps {
  action: Action;
  onLocate: () => void;
}

const formatShortDate = (dateString: string | null): string => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
};

export function ActionExploreCard({
  action,
  onLocate,
}: ActionExploreCardProps) {
  const location = [
    action.region,
    action.country_code ? COUNTRY_CODE_TO_NAME[action.country_code] : null,
  ]
    .filter(Boolean)
    .join(", ");

  const sortedSdgs = [...action.sdg_outcomes].sort(
    (a, b) => parseInt(a.code, 10) - parseInt(b.code, 10)
  );

  // First protocol from proofs (like asset type label)
  const protocol = action.proofs[0]?.protocol;
  // First platform from proofs (like chain tag)
  const platform = action.proofs[0]?.platform;
  // First actor (like issuer)
  const actor = action.actors[0];

  return (
    <div
      className="group bg-cardBackground border border-gray-100 hover:border-gray-300 transition-all cursor-pointer overflow-hidden"
      onClick={onLocate}
    >
      <div className="flex">
        <div className="w-1 flex-shrink-0 bg-emerald-500" />
        {/* Avatar */}
        <div className="flex items-center pl-2.5 py-2.5">
          {action.main_image ? (
            <div
              className="w-10 h-10 bg-cover bg-center flex-shrink-0"
              style={{ backgroundImage: `url(${action.main_image})` }}
            />
          ) : (
            <div className="w-10 h-10 bg-emerald-50 flex-shrink-0 flex items-center justify-center">
              <Lightning size={16} className="text-emerald-400" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 px-2.5 py-2.5">
          {/* Row 1: protocol · actor · SDG icons + chain icon */}
          <div className="flex items-center justify-between gap-1.5 mb-0.5">
            <div className="flex items-center gap-1 min-w-0 flex-wrap">
              {protocol && (
                <span
                  className="text-[11px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
                  style={{
                    backgroundColor: `${protocol.color || "#10B981"}18`,
                    color: protocol.color || "#10B981",
                  }}
                >
                  {protocol.name}
                </span>
              )}
              {actor && (
                <span className="text-[11px] text-gray-400 truncate">
                  {actor.name}
                </span>
              )}
              {sortedSdgs.length > 0 && (
                <>
                  <span className="text-gray-300 text-[10px]">·</span>
                  {sortedSdgs.map((sdg) => (
                    <span
                      key={sdg.code}
                      title={sdg.title}
                      className="inline-flex items-center justify-center w-[16px] h-[16px] rounded-full text-[8px] font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: SDG_COLORS[sdg.code] || "#6B7280" }}
                    >
                      {sdg.code}
                    </span>
                  ))}
                </>
              )}
            </div>
            {platform && (
              <div className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 flex-shrink-0">
                <ChainIcon chainId={platform.id} chainName={platform.name} size={16} />
              </div>
            )}
          </div>

          {/* Row 2: title */}
          <h4 className="text-sm font-semibold text-gray-900 truncate">
            {action.title}
          </h4>

          {/* Row 3: location · date */}
          <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-500">
            {location && (
              <span className="flex items-center gap-0.5 truncate">
                <MapPin size={11} className="flex-shrink-0" />
                {location}
              </span>
            )}
            {location && (action.action_start_date || action.created_at) && (
              <span className="text-gray-300">·</span>
            )}
            <span className="font-medium text-gray-600 flex-shrink-0">
              {formatShortDate(action.action_start_date || action.created_at)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Bioregion Card ──

export interface BioregionListItem extends BioregionProperties {
  eii: number;
  eiiDelta: number;
  vaultTVL: number | null;
  assetCount: number;
  actorCount: number;
}

interface BioregionExploreCardProps {
  bioregion: BioregionListItem;
  onSelect: () => void;
}

export function BioregionExploreCard({ bioregion, onSelect }: BioregionExploreCardProps) {
  const eiiPercent = (bioregion.eii * 100).toFixed(0);
  const eiiColor = bioregion.eii >= 0.7 ? "text-emerald-600" : bioregion.eii >= 0.5 ? "text-amber-600" : "text-red-600";
  const eiiDeltaPercent = (bioregion.eiiDelta * 100).toFixed(1);

  return (
    <div
      className="group bg-cardBackground border border-gray-100 hover:border-esv-200 transition-all cursor-pointer overflow-hidden"
      onClick={onSelect}
    >
      <div className="flex">
        <div
          className="w-1 flex-shrink-0"
          style={{ backgroundColor: bioregion.color }}
        />
        {/* Bioregion image or placeholder */}
        <div className="flex items-center pl-2.5 py-2.5">
          <div
            className="w-10 h-10 bg-cover bg-center flex-shrink-0 rounded"
            style={{
              backgroundImage: `url(/images/bioregions/${bioregion.code}.webp)`,
              backgroundColor: bioregion.color,
            }}
          />
        </div>
        <div className="flex-1 min-w-0 px-2.5 py-2.5">
          {/* Row 1: realm + EII */}
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <Globe size={10} className="text-gray-400 flex-shrink-0" />
              <span className="text-[10px] text-gray-500 truncate">{bioregion.realm_name}</span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Leaf size={11} className={eiiColor} />
              <span className={`text-[11px] font-semibold ${eiiColor}`}>{eiiPercent}%</span>
              {bioregion.eiiDelta !== 0 && (
                <span className={`text-[9px] flex items-center ${bioregion.eiiDelta > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {bioregion.eiiDelta > 0 ? <TrendUp size={9} /> : <TrendDown size={9} />}
                  {eiiDeltaPercent}%
                </span>
              )}
            </div>
          </div>

          {/* Row 2: name */}
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-gray-900 truncate">
              {bioregion.name}
            </h4>
            <ArrowRight size={14} className="flex-shrink-0 text-gray-300 group-hover:text-esv-500 transition-colors" />
          </div>

          {/* Row 3: stats */}
          <div className="flex items-center gap-3 mt-1">
            {bioregion.vaultTVL !== null && (
              <div className="flex items-center gap-1 text-[11px]">
                <Vault size={11} className="text-amber-500" />
                <span className="font-medium text-amber-700">${(bioregion.vaultTVL / 1000).toFixed(0)}K</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-[11px] text-gray-500">
              <TreeStructure size={10} />
              <span>{bioregion.assetCount} assets</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-gray-500">
              <Users size={10} />
              <span>{bioregion.actorCount} actors</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
