import { useState, useEffect, useMemo } from "react";
import {
  Broadcast,
  Globe,
  ShieldCheck,
  ArrowSquareOut,
  TreeStructure,
  Robot,
  CaretDown,
  CaretRight,
  ArrowRight,
  Fingerprint,
  FileText,
  Lightning,
  BookOpen,
  Link,
  FlowArrow,
  MagnifyingGlass,
  ChartBar,
  X,
  Question,
  Info,
  Detective,
  Eye,
  CheckCircle,
  Warning,
  XCircle,
} from "@phosphor-icons/react";
import Header from "../Header";
import Footer from "../Footer";

// ─── Types ──────────────────────────────────────────────────────────

interface TransactionRecord {
  layer: 1 | 2 | 3;
  type: string;
  label: string;
  entityId: string;
  transactionId: string;
  hashscanUrl: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface BioregionFeed {
  bioregionCode: string;
  bioregionName: string;
  topicId: string;
  messageSequence: number;
  actionCount: number;
  tCO2e: number;
}

interface PublishResult {
  network: string;
  operatorId: string;
  publishedAt: string;
  methodology: {
    topicId: string;
    messageSequence: number;
  };
  bioregionFeeds: BioregionFeed[];
  nftCollection: {
    tokenId: string;
    totalMinted: number;
  };
  transactions: TransactionRecord[];
}

// ─── Helpers ────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fmtUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

// ─── Small Components ───────────────────────────────────────────────

function LayerBadge({ layer }: { layer: 1 | 2 | 3 }) {
  const config = {
    1: { label: "HCS Topic", bg: "bg-purple-500/15", text: "text-purple-300", border: "border-purple-500/25" },
    2: { label: "HCS Feed", bg: "bg-emerald-500/15", text: "text-emerald-300", border: "border-emerald-500/25" },
    3: { label: "HTS NFT", bg: "bg-amber-500/15", text: "text-amber-300", border: "border-amber-500/25" },
  }[layer];
  return (
    <span className={`px-2 py-0.5 rounded text-[11px] font-mono border ${config.bg} ${config.text} ${config.border}`}>
      {config.label}
    </span>
  );
}

function LayerNumber({ n, color }: { n: number; color: string }) {
  return (
    <div
      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${color}`}
    >
      {n}
    </div>
  );
}

function HashScanLink({ url, label, className }: { url: string; label?: string; className?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 text-sm transition-colors hover:brightness-125 ${className || "text-purple-400"}`}
    >
      {label || "View on HashScan"}
      <ArrowSquareOut size={13} />
    </a>
  );
}

function TopicIdPill({ id, network }: { id: string; network: string }) {
  return (
    <a
      href={`https://hashscan.io/${network}/topic/${id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-800 border border-gray-700/60 text-xs font-mono text-gray-300 hover:border-purple-500/40 hover:text-purple-300 transition-colors"
    >
      {id}
      <ArrowSquareOut size={11} className="opacity-50" />
    </a>
  );
}

// ─── Certifier tier visual ──────────────────────────────────────────

const TRUST_TIERS = [
  { tier: "guardian+registry", label: "Guardian + Registry", examples: "Verra VCS, Gold Standard", weight: 1.0, color: "bg-emerald-500" },
  { tier: "guardian+self", label: "Guardian + Self-Certified", examples: "DOVU dMRV, Capturiant", weight: 0.7, color: "bg-emerald-500/60" },
  { tier: "bare-hts", label: "Bare HTS", examples: "Uncertified tokens", weight: 0.3, color: "bg-emerald-500/25" },
];

// ─── Main Component ─────────────────────────────────────────────────

export default function PublishPage() {
  const [data, setData] = useState<PublishResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txExpanded, setTxExpanded] = useState(false);
  const [filterLayer, setFilterLayer] = useState<1 | 2 | 3 | null>(null);

  useEffect(() => {
    fetch("/data/hedera-transactions.json")
      .then((r) => {
        if (!r.ok) throw new Error("Run the publisher first");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  const filteredTx = useMemo(() => {
    if (!data) return [];
    return filterLayer
      ? data.transactions.filter((t) => t.layer === filterLayer)
      : data.transactions;
  }, [data, filterLayer]);

  const totalTCO2e = useMemo(
    () => data?.bioregionFeeds.reduce((s, f) => s + f.tCO2e, 0) ?? 0,
    [data]
  );

  const maxBioTCO2e = useMemo(
    () => Math.max(...(data?.bioregionFeeds.map((f) => f.tCO2e) ?? [1])),
    [data]
  );

  const totalActions = useMemo(
    () => data?.bioregionFeeds.reduce((s, f) => s + f.actionCount, 0) ?? 0,
    [data]
  );

  // ─── Error state ──────────────────────────────────────────────
  if (error) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <Broadcast size={48} className="text-gray-700 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">No Publish Data</h2>
            <p className="text-gray-500 mb-4">Run the RAEIS publisher to generate onchain artifacts.</p>
            <code className="block bg-gray-900 border border-gray-800 rounded-lg p-4 text-sm text-emerald-400 font-mono text-left">
              cd integrations<br />
              npm run publish:hedera:dry-run
            </code>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  // ─── Loading state ────────────────────────────────────────────
  if (!data) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <div className="animate-pulse text-gray-600">Loading...</div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-950 text-white">

        {/* ═══════════════════════════════════════════════════════════
            HERO — Methodology standard header with generated bg
            ═══════════════════════════════════════════════════════════ */}
        <div
          className="border-b border-gray-800/80 relative overflow-hidden"
          style={{
            backgroundImage: "url(/images/raeis-header-bg.webp)",
            backgroundSize: "cover",
            backgroundPosition: "center bottom",
          }}
        >
          {/* Gradient overlay — opaque at top for text, transparent at bottom to reveal imagery */}
          <div className="absolute inset-0 bg-gradient-to-b from-gray-950 via-gray-950/60 to-transparent" />
          <div className="relative max-w-5xl mx-auto px-6 pt-16 pb-10">
            {/* Breadcrumb-like context */}
            <div className="flex items-center gap-2 text-xs text-gray-600 mb-4">
              <span>Hedera Consensus Service</span>
              <ArrowRight size={10} />
              <span>Published Standard</span>
              <ArrowRight size={10} />
              <span className="text-gray-400">RAEIS v1.0</span>
            </div>

            <div className="flex items-start justify-between gap-8">
              <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">
                  <span className="text-purple-400">RAEIS</span>{" "}
                  <span className="text-white/90">Environmental Intelligence Standard</span>
                </h1>
                <p className="text-gray-400 max-w-xl leading-relaxed">
                  The first AI-agent-native environmental methodology published to
                  Hedera consensus. Agents discover, subscribe, verify, and act on
                  scientifically-valued bioregional intelligence.
                </p>
              </div>

              {/* Right side — key identifiers */}
              <div className="hidden md:flex flex-col items-end gap-2 shrink-0">
                <span className="px-3 py-1 rounded-full text-xs font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20">
                  {data.network}
                </span>
                <span className="text-xs text-gray-600 font-mono">
                  {new Date(data.publishedAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Headline stats — inline, backdrop for readability over image */}
            <div className="flex flex-wrap items-center gap-6 mt-6 pt-5 px-5 -mx-5 border-t border-white/10 rounded-lg bg-gray-950/60 backdrop-blur-sm pb-5">
              <div>
                <div className="text-2xl font-bold tabular-nums">{data.transactions.length}</div>
                <div className="text-[11px] text-gray-500 uppercase tracking-wider">Transactions</div>
              </div>
              <div className="w-px h-8 bg-gray-800" />
              <div>
                <div className="text-2xl font-bold tabular-nums">{data.bioregionFeeds.length}</div>
                <div className="text-[11px] text-gray-500 uppercase tracking-wider">Bioregions</div>
              </div>
              <div className="w-px h-8 bg-gray-800" />
              <div>
                <div className="text-2xl font-bold tabular-nums text-emerald-400">{fmt(totalTCO2e)}</div>
                <div className="text-[11px] text-gray-500 uppercase tracking-wider">tCO2e Valued</div>
              </div>
              <div className="w-px h-8 bg-gray-800" />
              <div>
                <div className="text-2xl font-bold tabular-nums">
                  {fmtUSD(totalTCO2e * 51)} – {fmtUSD(totalTCO2e * 190)}
                </div>
                <div className="text-[11px] text-gray-500 uppercase tracking-wider">Service Value (SCC-EPA)</div>
              </div>
              <div className="w-px h-8 bg-gray-800" />
              <div>
                <div className="text-2xl font-bold tabular-nums text-amber-400">{data.nftCollection.totalMinted}</div>
                <div className="text-[11px] text-gray-500 uppercase tracking-wider">RAVA NFTs</div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-10 space-y-12">

          {/* ═══════════════════════════════════════════════════════════
              HOW IT WORKS — Guardian pipeline explanation for judges
              ═══════════════════════════════════════════════════════════ */}
          <section className="bg-gray-900/40 border border-gray-800/60 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <FlowArrow size={18} className="text-purple-400" />
              <h2 className="font-bold text-sm uppercase tracking-wider text-gray-400">How It Works: Guardian to RAEIS</h2>
            </div>
            <div className="grid md:grid-cols-4 gap-4">
              {[
                {
                  step: "Read",
                  Icon: Globe,
                  color: "text-blue-400",
                  desc: "Mirror Node API ingests tokens from 9 treasury accounts across 6 Guardian-based platforms on Hedera mainnet.",
                },
                {
                  step: "Parse",
                  Icon: TreeStructure,
                  color: "text-emerald-400",
                  desc: "Extract Guardian topic IDs from token memos. Identify certifications (Verra, Gold Standard). Normalize tCO2e per platform.",
                },
                {
                  step: "Value",
                  Icon: ChartBar,
                  color: "text-amber-400",
                  desc: "Apply EPA Social Cost of Carbon ($51\u2013$190/tCO2e). Score by trust tier. Map to bioregions. Generate agent directives.",
                },
                {
                  step: "Publish",
                  Icon: Broadcast,
                  color: "text-purple-400",
                  desc: "Write methodology + bioregion feeds to HCS topics. Mint RAVA attestation NFTs on HTS. All verifiable on HashScan.",
                },
              ].map((s) => (
                <div key={s.step} className="flex flex-col">
                  <div className="flex items-center gap-2 mb-2">
                    <s.Icon size={16} className={s.color} />
                    <span className={`text-xs font-bold uppercase tracking-wider ${s.color}`}>{s.step}</span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-gray-800/60 flex items-center gap-2">
              <ShieldCheck size={14} className="text-gray-600" />
              <p className="text-[11px] text-gray-600">
                Guardian is Hedera's MRV infrastructure for environmental credits. RAEIS adds cross-platform intelligence, scientific valuation, and AI-agent interfaces on top of Guardian data.
              </p>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════
              LAYER 1 — Methodology (the standard itself)
              Full width, document-like, shows schema structure
              ═══════════════════════════════════════════════════════════ */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <LayerNumber n={1} color="border-purple-500/60 text-purple-400" />
              <div>
                <h2 className="font-bold text-lg">Methodology Topic</h2>
                <p className="text-xs text-gray-500">The standard itself — published to HCS</p>
              </div>
              <div className="ml-auto">
                <TopicIdPill id={data.methodology.topicId} network={data.network} />
              </div>
            </div>

            <div className="grid md:grid-cols-[1fr_280px] gap-4">
              {/* Schema preview */}
              <div className="bg-gray-900/80 border border-gray-800/80 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={16} className="text-purple-400" />
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Schema: RAEIS/Methodology/v1</span>
                </div>
                <pre className="text-xs font-mono text-gray-400 leading-relaxed overflow-x-auto">
{`{
  "schema": "RAEIS/Methodology/v1",
  "name": "Regen Atlas Environmental Intelligence Standard",
  "version": "1.0.0",
  "methodology": {
    "valuation": "SCC-EPA-2024",
    "carbonPrice": { "low": 51, "high": 190, "unit": "USD/tCO2e" }
  },
  "agentInterface": {
    "subscribeTo": ["RAEIS/BioregionalIntelligence/v1"],
    "capabilities": ["eii-interpret", "gap-analysis", "capital-routing"],
    "taskTypes": ["GROUND_TRUTH", "SPECIES_SURVEY", "WATER_SAMPLE"]
  },
  "bioregionTopics": {`}
                  {data.bioregionFeeds.map((f, i) => (
                    <span key={f.bioregionCode}>
                      {`\n    "${f.bioregionCode}": "${f.topicId}"${i < data.bioregionFeeds.length - 1 ? "," : ""}`}
                    </span>
                  ))}
{`
  }
}`}
                </pre>
              </div>

              {/* Trust hierarchy */}
              <div className="bg-gray-900/80 border border-gray-800/80 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck size={16} className="text-emerald-400" />
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Trust Hierarchy</span>
                </div>
                <div className="space-y-3">
                  {TRUST_TIERS.map((t) => (
                    <div key={t.tier}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-300">{t.label}</span>
                        <span className="text-xs font-mono text-gray-500">{t.weight}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${t.color}`}
                          style={{ width: `${t.weight * 100}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-gray-600 mt-0.5">{t.examples}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════
              LAYER 2 — Bioregional Intelligence Feeds
              Per-bioregion bars with data density
              ═══════════════════════════════════════════════════════════ */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <LayerNumber n={2} color="border-emerald-500/60 text-emerald-400" />
              <div>
                <h2 className="font-bold text-lg">Bioregional Intelligence Feeds</h2>
                <p className="text-xs text-gray-500">
                  {data.bioregionFeeds.length} HCS topics — {totalActions} actions across {fmt(totalTCO2e)} tCO2e
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {data.bioregionFeeds
                .sort((a, b) => b.tCO2e - a.tCO2e)
                .map((f) => {
                  const pct = maxBioTCO2e > 0 ? (f.tCO2e / maxBioTCO2e) * 100 : 0;
                  return (
                    <div
                      key={f.bioregionCode}
                      className="bg-gray-900/60 border border-gray-800/60 rounded-lg px-4 py-3 group hover:border-emerald-500/20 transition-colors"
                    >
                      <div className="flex items-center gap-4 mb-2">
                        <Globe size={16} className="text-emerald-500/60 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{f.bioregionName}</span>
                            <span className="text-xs font-mono text-gray-600">{f.bioregionCode}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0">
                          <span>{f.actionCount} actions</span>
                          <span className="font-mono text-emerald-400 font-medium">{fmt(f.tCO2e)} tCO2e</span>
                          <span className="text-gray-600">{fmtUSD(f.tCO2e * 51)} – {fmtUSD(f.tCO2e * 190)}</span>
                          <TopicIdPill id={f.topicId} network={data.network} />
                        </div>
                      </div>
                      {/* tCO2e bar */}
                      <div className="h-1 rounded-full bg-gray-800/80 overflow-hidden ml-8">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all"
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Agent directives callout */}
            <div className="mt-4 bg-amber-500/5 border border-amber-500/15 rounded-lg px-4 py-3">
              <div className="flex items-start gap-3">
                <Robot size={18} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-medium text-amber-300 mb-1">Agent Directives Embedded</div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Each feed message includes <code className="text-amber-400/80">agentDirectives</code> — structured
                    instructions telling subscribing agents what to do: <code className="text-amber-400/80">VERIFY</code> tCO2e
                    claims, post <code className="text-amber-400/80">BOUNTY</code> for ground truth verification,
                    and <code className="text-amber-400/80">ALERT</code> economic agents to unpriced environmental value.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════
              LAYER 3 — Verification NFTs (RAVA)
              Compact attestation display
              ═══════════════════════════════════════════════════════════ */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <LayerNumber n={3} color="border-amber-500/60 text-amber-400" />
              <div>
                <h2 className="font-bold text-lg">Verification NFTs</h2>
                <p className="text-xs text-gray-500">RAVA (RAEIS Verified Action) — attestation, not ownership</p>
              </div>
              <div className="ml-auto">
                <HashScanLink
                  url={`https://hashscan.io/${data.network}/token/${data.nftCollection.tokenId}`}
                  label={data.nftCollection.tokenId}
                  className="text-amber-400 font-mono text-xs"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-[1fr_1fr] gap-4">
              {/* NFT schema preview */}
              <div className="bg-gray-900/80 border border-gray-800/80 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Fingerprint size={16} className="text-amber-400" />
                  <span className="text-xs text-gray-500 uppercase tracking-wider">NFT Metadata Pattern</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="font-mono text-gray-500 bg-gray-800/50 rounded px-3 py-2">
                    <span className="text-amber-300">RAEIS:v1</span>:<span className="text-gray-400">hedera-1</span>:<span className="text-emerald-400">PA12</span>
                  </div>
                  <p className="text-gray-500 leading-relaxed">
                    Compact onchain reference ({"\u2264"}100 bytes). Full provenance JSON
                    stored on IPFS. Each serial = one independently verified environmental
                    action with SCC-EPA valuation.
                  </p>
                </div>
              </div>

              {/* Collection stats */}
              <div className="bg-gray-900/80 border border-gray-800/80 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Lightning size={16} className="text-amber-400" />
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Collection</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-3xl font-bold text-amber-400 tabular-nums">{data.nftCollection.totalMinted}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Actions Verified</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold tabular-nums">{data.bioregionFeeds.length}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Bioregions Covered</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-emerald-400 tabular-nums">{fmt(totalTCO2e)}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Total tCO2e Attested</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold tabular-nums">6</div>
                    <div className="text-xs text-gray-500 mt-0.5">Guardian Platforms</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════
              LAYER 4 — Agent Network (Scout + Diligence)
              ═══════════════════════════════════════════════════════════ */}
          <AgentNetworkSection network={data.network} />

          {/* ═══════════════════════════════════════════════════════════
              TRANSACTION LOG — Collapsible proof-of-work
              ═══════════════════════════════════════════════════════════ */}
          <section>
            <button
              onClick={() => setTxExpanded(!txExpanded)}
              className="flex items-center gap-2 w-full text-left group"
            >
              {txExpanded ? (
                <CaretDown size={16} className="text-gray-500" />
              ) : (
                <CaretRight size={16} className="text-gray-500" />
              )}
              <h3 className="font-bold text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
                Transaction Log
              </h3>
              <span className="text-xs text-gray-600 font-mono">
                {data.transactions.length} transactions on {data.network}
              </span>
            </button>

            {txExpanded && (
              <div className="mt-3">
                {/* Filters */}
                <div className="flex gap-1.5 mb-3">
                  {[
                    { layer: null as 1 | 2 | 3 | null, label: "All" },
                    { layer: 1 as const, label: "L1 Methodology" },
                    { layer: 2 as const, label: "L2 Feeds" },
                    { layer: 3 as const, label: "L3 NFTs" },
                  ].map(({ layer, label }) => {
                    const count = layer
                      ? data.transactions.filter((t) => t.layer === layer).length
                      : data.transactions.length;
                    const active = filterLayer === layer;
                    return (
                      <button
                        key={label}
                        onClick={() => setFilterLayer(active ? null : layer)}
                        className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                          active
                            ? "bg-gray-700 text-white"
                            : "bg-gray-900 text-gray-500 hover:text-gray-300 border border-gray-800/60"
                        }`}
                      >
                        {label} ({count})
                      </button>
                    );
                  })}
                </div>

                {/* Table */}
                <div className="bg-gray-900/60 border border-gray-800/60 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-800/80 text-gray-600 uppercase tracking-wider">
                        <th className="text-left p-2.5 w-20">Layer</th>
                        <th className="text-left p-2.5 w-28">Type</th>
                        <th className="text-left p-2.5">Label</th>
                        <th className="text-left p-2.5 w-36">Entity</th>
                        <th className="text-left p-2.5 w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/40">
                      {filteredTx.map((tx, i) => (
                        <tr key={i} className="hover:bg-gray-800/20">
                          <td className="p-2.5"><LayerBadge layer={tx.layer} /></td>
                          <td className="p-2.5 font-mono text-gray-500">{tx.type}</td>
                          <td className="p-2.5 text-gray-400 max-w-xs truncate">{tx.label}</td>
                          <td className="p-2.5 font-mono text-gray-500">{tx.entityId}</td>
                          <td className="p-2.5">
                            <a
                              href={tx.hashscanUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-purple-400/60 hover:text-purple-400"
                            >
                              <ArrowSquareOut size={14} />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

        </div>
      </div>
      <Footer />

      {/* ═══════════════════════════════════════════════════════════
          JUDGE ORB — Pinned documentation overlay
          ═══════════════════════════════════════════════════════════ */}
      <JudgeOrb />
    </>
  );
}

// ─── Agent Network Section ──────────────────────────────────────────

interface AgentTopics {
  network: string;
  scoutTopicId: string;
  diligenceTopicId: string;
  createdAt: string;
}

interface OpportunityScore {
  bioregionCode: string;
  bioregionName: string;
  compositeScore: number;
  breakdown: {
    gap: number;
    certification: number;
    volume: number;
    completeness: number;
  };
  topActions: Array<{
    actionId: string;
    title: string;
    sourceToken: string;
    tCO2e: number;
    certifier: string | null;
  }>;
  rationale: string;
}

interface ScoutReport {
  schema: string;
  agentId: string;
  agentVersion: string;
  timestamp: string;
  scanSummary: {
    bioregionsScanned: number;
    totalActions: number;
    totalTCO2e: number;
  };
  opportunities: OpportunityScore[];
}

type Verdict = "PASS" | "CAUTION" | "FAIL";

interface TokenAssessment {
  sourceToken: string;
  bioregionCode: string;
  actionTitle: string;
  verification: {
    tokenExists: boolean;
    totalSupply: number;
    hasMemo: boolean;
    guardianTopicId: string | null;
    treasuryAccount: string | null;
  };
  trustTier: string;
  verdict: Verdict;
  rationale: string;
}

interface DiligenceReport {
  schema: string;
  agentId: string;
  agentVersion: string;
  timestamp: string;
  assessments: TokenAssessment[];
}

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const config = {
    PASS: { Icon: CheckCircle, bg: "bg-emerald-500/15", text: "text-emerald-300", border: "border-emerald-500/25" },
    CAUTION: { Icon: Warning, bg: "bg-amber-500/15", text: "text-amber-300", border: "border-amber-500/25" },
    FAIL: { Icon: XCircle, bg: "bg-red-500/15", text: "text-red-300", border: "border-red-500/25" },
  }[verdict];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border ${config.bg} ${config.text} ${config.border}`}>
      <config.Icon size={12} weight="fill" />
      {verdict}
    </span>
  );
}

function ScoreBar({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-500 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-gray-800/80 overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.max(value, 2)}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-gray-500 w-8 text-right">{value}</span>
    </div>
  );
}

function AgentNetworkSection({ network }: { network: string }) {
  const [topics, setTopics] = useState<AgentTopics | null>(null);
  const [scout, setScout] = useState<ScoutReport | null>(null);
  const [diligence, setDiligence] = useState<DiligenceReport | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showAllTokens, setShowAllTokens] = useState(false);

  useEffect(() => {
    Promise.allSettled([
      fetch("/data/agent-topics.json").then((r) => r.ok ? r.json() : null),
      fetch("/data/agent-scout-report.json").then((r) => r.ok ? r.json() : null),
      fetch("/data/agent-diligence-report.json").then((r) => r.ok ? r.json() : null),
    ]).then(([t, s, d]) => {
      if (t.status === "fulfilled") setTopics(t.value);
      if (s.status === "fulfilled") setScout(s.value);
      if (d.status === "fulfilled") setDiligence(d.value);
      setLoaded(true);
    });
  }, []);

  if (!loaded) return null;
  if (!scout && !topics) return null;

  // Build verdict lookup by source token
  const verdictMap = new Map<string, TokenAssessment>();
  if (diligence) {
    for (const a of diligence.assessments) {
      verdictMap.set(a.sourceToken, a);
    }
  }

  const verdictCounts = diligence
    ? {
        PASS: diligence.assessments.filter((a) => a.verdict === "PASS").length,
        CAUTION: diligence.assessments.filter((a) => a.verdict === "CAUTION").length,
        FAIL: diligence.assessments.filter((a) => a.verdict === "FAIL").length,
      }
    : null;

  // Merge Scout opportunities with Diligence verdicts for pipeline view
  const pipelineRows = scout?.opportunities.map((opp) => {
    // Find diligence assessments matching this bioregion
    const assessments = diligence?.assessments.filter(
      (a) => a.bioregionCode === opp.bioregionCode
    ) ?? [];
    const passCount = assessments.filter((a) => a.verdict === "PASS").length;
    const cautionCount = assessments.filter((a) => a.verdict === "CAUTION").length;
    const failCount = assessments.filter((a) => a.verdict === "FAIL").length;
    return { ...opp, assessments, passCount, cautionCount, failCount };
  }) ?? [];

  // Sort CAUTION/FAIL first for the token detail view
  const sortedAssessments = diligence
    ? [...diligence.assessments].sort((a, b) => {
        const order: Record<Verdict, number> = { FAIL: 0, CAUTION: 1, PASS: 2 };
        return order[a.verdict] - order[b.verdict];
      })
    : [];

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <LayerNumber n={4} color="border-cyan-500/60 text-cyan-400" />
        <div>
          <h2 className="font-bold text-lg">Agent Network</h2>
          <p className="text-xs text-gray-500">
            Autonomous agents that consume RAEIS feeds and coordinate through Hedera consensus
          </p>
        </div>
      </div>

      {/* Narrative intro — the "why" */}
      <div className="bg-cyan-500/5 border border-cyan-500/15 rounded-xl p-5 mb-4">
        <div className="flex items-start gap-4">
          <Robot size={22} className="text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-cyan-300 mb-2">Why agents?</div>
            <p className="text-[13px] text-gray-400 leading-relaxed mb-3">
              RAEIS feeds (Layer 2) are designed for machine consumption — structured JSON with embedded
              directives telling agents what to verify, what to investigate, and where capital is missing.
              These two agents demonstrate that pipeline working end-to-end:
            </p>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="flex items-start gap-2.5">
                <Eye size={16} className="text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-medium text-gray-300">Impact Scout</div>
                  <div className="text-[11px] text-gray-500">
                    Reads all 7 bioregion feeds from HCS via Mirror Node. Scores each bioregion on four axes.
                    Posts a ranked OpportunityReport back to its own HCS topic.
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Detective size={16} className="text-violet-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-medium text-gray-300">Due Diligence</div>
                  <div className="text-[11px] text-gray-500">
                    Reads Scout's report from HCS (not a database). Cross-verifies the underlying
                    tokens against Hedera mainnet. Posts verdicts to a second HCS topic.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Key differentiator callout */}
        <div className="mt-3 pt-3 border-t border-cyan-500/10 flex items-center gap-3">
          <div className="px-2 py-0.5 rounded text-[10px] font-mono border bg-cyan-500/10 text-cyan-300 border-cyan-500/20 shrink-0">
            KEY
          </div>
          <p className="text-[12px] text-cyan-300/80">
            No shared database. All coordination happens through Hedera Consensus Service.
            Agent B discovers Agent A's output by reading HCS topics via Mirror Node — the same way any third-party agent would.
          </p>
        </div>
      </div>

      {/* Agent HCS topics — compact pill row */}
      {topics && (
        <div className="flex items-center gap-3 mb-4 px-1">
          <span className="text-[11px] text-gray-600">Agent topics on {network}:</span>
          <a
            href={`https://hashscan.io/${network}/topic/${topics.scoutTopicId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-800 border border-gray-700/60 text-xs font-mono text-gray-300 hover:border-cyan-500/40 hover:text-cyan-300 transition-colors"
          >
            <Eye size={11} className="text-cyan-400" />
            {topics.scoutTopicId}
            <ArrowSquareOut size={11} className="opacity-50" />
          </a>
          <ArrowRight size={12} className="text-gray-600" />
          <a
            href={`https://hashscan.io/${network}/topic/${topics.diligenceTopicId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-800 border border-gray-700/60 text-xs font-mono text-gray-300 hover:border-violet-500/40 hover:text-violet-300 transition-colors"
          >
            <Detective size={11} className="text-violet-400" />
            {topics.diligenceTopicId}
            <ArrowSquareOut size={11} className="opacity-50" />
          </a>
        </div>
      )}

      {/* Pipeline view — unified Scout ranking + Diligence verdicts */}
      {scout && (
        <div className="bg-gray-900/80 border border-gray-800/80 rounded-xl overflow-hidden mb-4">
          <div className="px-5 py-3 border-b border-gray-800/60 flex items-center gap-2">
            <FlowArrow size={16} className="text-cyan-400" />
            <span className="text-xs text-gray-500 uppercase tracking-wider">Scout Analysis + Diligence Verification</span>
            <span className="ml-auto text-[10px] text-gray-600">
              {scout.scanSummary.bioregionsScanned} bioregions / {fmt(scout.scanSummary.totalTCO2e)} tCO2e / {scout.scanSummary.totalActions} actions
            </span>
          </div>

          <div className="divide-y divide-gray-800/40">
            {pipelineRows.map((row, i) => (
              <div key={row.bioregionCode} className="px-5 py-3 hover:bg-gray-800/20 transition-colors">
                {/* Top row: rank, name, score, verdicts */}
                <div className="flex items-center gap-3 mb-2">
                  <span className={`text-sm font-bold tabular-nums w-6 ${
                    row.compositeScore >= 70 ? "text-cyan-400" :
                    row.compositeScore >= 40 ? "text-gray-300" : "text-gray-500"
                  }`}>
                    {row.compositeScore}
                  </span>
                  <span className="text-xs font-mono text-gray-600 w-10">#{i + 1}</span>
                  <span className="text-sm font-medium text-gray-200 flex-1">{row.bioregionName}</span>
                  <span className="text-xs font-mono text-gray-600">{row.bioregionCode}</span>

                  {/* Diligence verdict summary for this bioregion */}
                  {row.assessments.length > 0 && (
                    <div className="flex items-center gap-2 ml-3">
                      {row.passCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                          <CheckCircle size={12} weight="fill" /> {row.passCount}
                        </span>
                      )}
                      {row.cautionCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-400">
                          <Warning size={12} weight="fill" /> {row.cautionCount}
                        </span>
                      )}
                      {row.failCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-red-400">
                          <XCircle size={12} weight="fill" /> {row.failCount}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Score breakdown with human-readable labels */}
                <div className="ml-16 grid grid-cols-4 gap-x-4 gap-y-0.5">
                  <ScoreBar value={row.breakdown.gap} label="Unpriced value" color="bg-cyan-500" />
                  <ScoreBar value={row.breakdown.certification} label="Cert strength" color="bg-emerald-500" />
                  <ScoreBar value={row.breakdown.volume} label="Carbon tonnage" color="bg-amber-500" />
                  <ScoreBar value={row.breakdown.completeness} label="Data coverage" color="bg-purple-500" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diligence detail — collapsed by default, interesting findings first */}
      {diligence && (
        <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowAllTokens(!showAllTokens)}
            className="w-full px-5 py-3 flex items-center gap-2 text-left hover:bg-gray-800/20 transition-colors"
          >
            {showAllTokens ? <CaretDown size={14} className="text-gray-500" /> : <CaretRight size={14} className="text-gray-500" />}
            <Detective size={14} className="text-violet-400" />
            <span className="text-xs font-medium text-gray-400">Token Verification Detail</span>
            <div className="flex items-center gap-2 ml-3">
              {verdictCounts && (
                <>
                  <span className="inline-flex items-center gap-1 text-[11px]">
                    <CheckCircle size={12} className="text-emerald-400" weight="fill" />
                    <span className="text-emerald-400 font-bold tabular-nums">{verdictCounts.PASS}</span>
                    <span className="text-gray-500">verified</span>
                  </span>
                  {verdictCounts.CAUTION > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px]">
                      <Warning size={12} className="text-amber-400" weight="fill" />
                      <span className="text-amber-400 font-bold tabular-nums">{verdictCounts.CAUTION}</span>
                      <span className="text-gray-500">flagged</span>
                    </span>
                  )}
                  {verdictCounts.FAIL > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px]">
                      <XCircle size={12} className="text-red-400" weight="fill" />
                      <span className="text-red-400 font-bold tabular-nums">{verdictCounts.FAIL}</span>
                      <span className="text-gray-500">failed</span>
                    </span>
                  )}
                </>
              )}
            </div>
            <span className="ml-auto text-[10px] text-gray-600">
              {diligence.assessments.length} mainnet tokens cross-verified
            </span>
          </button>

          {showAllTokens && (
            <div className="px-5 pb-4 space-y-1.5">
              {sortedAssessments.map((a) => (
                <div
                  key={a.sourceToken}
                  className="bg-gray-800/30 border border-gray-800/40 rounded-lg px-3 py-2"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <VerdictBadge verdict={a.verdict} />
                    <a
                      href={`https://hashscan.io/mainnet/token/${a.sourceToken}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-mono text-gray-400 hover:text-violet-300 flex items-center gap-1"
                    >
                      {a.sourceToken}
                      <ArrowSquareOut size={9} className="opacity-50" />
                    </a>
                    <span className="ml-auto text-[10px] text-gray-600">{a.trustTier}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-[11px] text-gray-500 truncate flex-1">{a.actionTitle}</div>
                    {a.verification.guardianTopicId && (
                      <div className="text-[10px] text-gray-600 shrink-0">
                        Guardian: {a.verification.guardianTopicId}
                      </div>
                    )}
                  </div>
                  {a.verdict !== "PASS" && (
                    <div className="text-[10px] text-amber-400/60 mt-0.5 italic">{a.rationale}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ─── Documentation Orb ──────────────────────────────────────────────

const GUIDE_ICON_CLASS = "text-purple-400 shrink-0";
const GUIDE_ICON_SIZE = 20;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GUIDE_STEPS: Array<{
  title: string;
  Icon: React.ComponentType<any>;
  body: string;
}> = [
  {
    title: "What is RAEIS?",
    Icon: BookOpen,
    body: "RAEIS is the first **environmental intelligence methodology designed for AI agents**, published directly to Hedera Consensus Service.\n\nInstead of a PDF that human auditors read, RAEIS is a machine-readable standard that any AI agent can discover on Hedera, subscribe to, and implement. It defines how to value carbon credits, which certifications to trust, and what actions agents should take — all onchain and verifiable.",
  },
  {
    title: "How Guardian Fits In",
    Icon: ShieldCheck,
    body: "Hedera Guardian is the **MRV (Measurement, Reporting, Verification) infrastructure** that carbon credit platforms build on. Six Guardian-based platforms — DOVU, Tolam Earth, Capturiant, OrbexCO2, GCR, and TYMLEZ — have tokenized environmental credits on Hedera using Guardian policies.\n\nRAEIS reads these Guardian-created tokens via **Mirror Node**, extracts Guardian topic IDs from token memos, and traces each credit back to its MRV provenance record. We then apply scientific valuation and publish a unified intelligence layer **on top of Guardian data** that no single platform provides alone.",
  },
  {
    title: "Three Hedera Services",
    Icon: Link,
    body: "**Hedera Consensus Service (HCS)** — Layer 1 publishes the RAEIS methodology standard. Layer 2 publishes per-bioregion intelligence feeds that agents subscribe to. All messages are JSON, all verifiable on HashScan.\n\n**Hedera Token Service (HTS)** — Layer 3 mints RAVA NFTs. Each NFT is an attestation that a specific environmental action was independently verified and scientifically valued.\n\n**Mirror Node API** — The read layer. We ingest ~46 actions from 6 Guardian platforms by enumerating tokens from 9 treasury accounts, parsing metadata, and extracting Guardian topic IDs for provenance tracing.",
  },
  {
    title: "Data Pipeline",
    Icon: FlowArrow,
    body: "**Source:** 9 treasury accounts across 6 Guardian platforms on Hedera mainnet.\n\n**Ingestion:** Mirror Node API enumerates HTS tokens, extracts Guardian topic IDs from memos (DOVU format: \"DOVU:SYMBOL:topic_id\"; Tolam/GCR: direct topic in memo; Capturiant: IPFS CID in memo).\n\n**Normalization:** Platform-specific tCO2e extraction (some encode in supply, some in metadata, some require IPFS resolution). Decimal correction, unit harmonization per source.\n\n**Valuation:** EPA Social Cost of Carbon ($51–$190/tCO2e). Trust hierarchy weights Guardian+Registry credits (Verra, Gold Standard) higher than self-certified.\n\n**Output:** Bioregion-mapped, scientifically-valued intelligence published back to Hedera via HCS + HTS.",
  },
  {
    title: "Why This Matters",
    Icon: Robot,
    body: "Guardian platforms publish environmental credits independently. No single platform provides cross-platform intelligence. RAEIS solves this by:\n\n**For AI Agents:** Each bioregion feed contains structured **agentDirectives** — VERIFY (audit tCO2e claims), BOUNTY (pay for ground truth verification), ALERT (flag unpriced environmental value). Agents receive tasks, not just data.\n\n**For Capital Allocation:** The gap analysis in each feed shows that all environmental value tracked is currently unpriced on markets — a concrete signal for capital routing.\n\n**For Transparency:** Every claim traces from RAVA NFT → bioregion feed → Guardian topic → source token. Full provenance chain, all on Hedera.",
  },
  {
    title: "Agent Network",
    Icon: Eye,
    body: "Layer 4 demonstrates agents actually consuming the RAEIS standard. Two autonomous OpenClaw agents coordinate entirely through Hedera — no shared database.\n\n**Impact Scout** reads all 7 bioregion HCS topics via Mirror Node, scores each bioregion on four axes (unpriced value, certification strength, carbon tonnage, data coverage), and posts a ranked OpportunityReport back to HCS.\n\n**Due Diligence Agent** reads Scout's report from HCS, then cross-verifies each referenced token against Hedera mainnet. It checks token existence, supply, Guardian topic provenance, and trust tier. 10 tokens passed, 5 flagged CAUTION (real finding: tokens exist but lack Guardian topic IDs in their memos).\n\n**Why this matters:** Any third-party agent can join by reading these HCS topics via Mirror Node. The network gets more valuable with each agent added — more verification depth, more analysis, more trust.",
  },
  {
    title: "Valuation Methodology",
    Icon: ChartBar,
    body: "**Social Cost of Carbon (EPA 2024):** The economic damage of one additional ton of CO2. Range: $51/tCO2e (conservative) to $190/tCO2e (high).\n\n**Trust Hierarchy:**\n- Guardian + Registry (weight 1.0) — Verra VCS, Gold Standard, EcoRegistry. Third-party certified.\n- Guardian + Self-Certified (weight 0.7) — DOVU dMRV, Capturiant Standard. Platform-verified.\n- Bare HTS (weight 0.3) — Uncertified tokens. Guardian infrastructure only.\n\nWeights determine confidence scoring in bioregion feeds. Higher-tier certifications produce higher quality scores.",
  },
  {
    title: "Verify on HashScan",
    Icon: MagnifyingGlass,
    body: "Every topic ID and NFT collection on this page links directly to **HashScan**, Hedera's block explorer.\n\n**What to check:**\n- Click the methodology topic ID — the full RAEIS JSON is readable in the topic messages.\n- Click any bioregion topic — see aggregated environmental data with agent directives.\n- Click the RAVA collection — each NFT serial maps to a specific action with its source Guardian token ID.\n\nAll transactions were submitted to Hedera testnet and are independently verifiable.",
  },
];

function JudgeOrb() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const currentStep = GUIDE_STEPS[step];
  const StepIcon = currentStep.Icon;

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 right-6 w-[420px] max-h-[75vh] z-50 bg-gray-900 border border-gray-700/60 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-5 pt-4 pb-3 border-b border-gray-800/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info size={14} className="text-purple-400" />
                <div className="text-sm font-bold">Guide for Judges</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-500 hover:text-gray-300 p-1"
              >
                <X size={14} />
              </button>
            </div>
            {/* Step navigation — clickable labels */}
            <div className="flex gap-1 mt-3 flex-wrap">
              {GUIDE_STEPS.map((s, i) => {
                const Icon = s.Icon;
                return (
                  <button
                    key={i}
                    onClick={() => setStep(i)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-all ${
                      i === step
                        ? "bg-purple-500/15 text-purple-300 border border-purple-500/25"
                        : "text-gray-600 hover:text-gray-400 border border-transparent"
                    }`}
                  >
                    <Icon size={11} />
                    <span>{i + 1}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="px-5 py-4 overflow-y-auto flex-1">
            <div className="flex items-center gap-2.5 mb-3">
              <StepIcon size={GUIDE_ICON_SIZE} className={GUIDE_ICON_CLASS} />
              <h4 className="font-bold text-sm">{currentStep.title}</h4>
              <span className="text-[10px] text-gray-600 font-mono ml-auto">
                {step + 1}/{GUIDE_STEPS.length}
              </span>
            </div>
            <div className="text-[13px] text-gray-400 leading-relaxed">
              {currentStep.body.split("\n\n").map((paragraph, pi) => (
                <p key={pi} className={pi > 0 ? "mt-3" : ""}>
                  {paragraph.split("**").map((part, i) =>
                    i % 2 === 1 ? (
                      <span key={i} className="text-white font-medium">{part}</span>
                    ) : (
                      <span key={i}>{part}</span>
                    )
                  )}
                </p>
              ))}
            </div>
          </div>

          {/* Nav */}
          <div className="px-5 py-3 border-t border-gray-800/80 flex items-center justify-between">
            <button
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
              className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-default"
            >
              Previous
            </button>
            <div className="flex gap-1">
              {GUIDE_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 rounded-full transition-all ${
                    i === step ? "w-5 bg-purple-400" : "w-1.5 bg-gray-700"
                  }`}
                />
              ))}
            </div>
            <button
              onClick={() => setStep(Math.min(GUIDE_STEPS.length - 1, step + 1))}
              disabled={step === GUIDE_STEPS.length - 1}
              className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-default"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Orb button */}
      <button
        onClick={() => { setOpen(!open); setStep(0); }}
        className={`fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg ${
          open
            ? "bg-gray-700 shadow-gray-900/50"
            : "bg-purple-600 shadow-purple-900/50 hover:bg-purple-500 hover:scale-105"
        }`}
        title="Guide for Judges"
      >
        {open ? (
          <X size={18} className="text-gray-300" />
        ) : (
          <Question size={20} className="text-white" weight="bold" />
        )}
      </button>
    </>
  );
}
