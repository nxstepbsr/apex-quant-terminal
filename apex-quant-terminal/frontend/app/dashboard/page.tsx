"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Copy, Search } from "lucide-react";
import RiskDisclaimer from "@/components/RiskDisclaimer";
import { ConfidenceScoreData, useLiveTradingData } from "@/app/hooks/useLiveTradingData";

export default function DashboardPage() {
  const [tickerInput, setTickerInput] = useState("AAPL");
  const [activeTicker, setActiveTicker] = useState("AAPL");
  const [accountSize, setAccountSize] = useState("");

  const { data, isConnected, isLoading, error } = useLiveTradingData(activeTicker);

  const maxShares = useMemo(() => {
    if (!data) return 0;
    const account = Number(accountSize);
    const riskPerShare = data.tradeLevels.riskPerShare;
    if (!account || account <= 0 || riskPerShare <= 0) return 0;
    return Math.floor((account * 0.01) / riskPerShare);
  }, [accountSize, data]);

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActiveTicker(tickerInput.trim().toUpperCase());
  }

  return (
    <main className="min-h-screen bg-[#05070d] px-4 py-6 text-white md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300/70">Apex Quant Terminal</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">Trading Confidence Dashboard</h1>
            <p className="mt-2 text-sm text-slate-400">
              {isConnected ? "Live stream connected" : "Stream disconnected"}
            </p>
          </div>

          <form onSubmit={submitSearch} className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={tickerInput}
              onChange={(e) => setTickerInput(e.target.value)}
              placeholder="Search ticker..."
              className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-11 pr-4 font-mono text-sm uppercase outline-none backdrop-blur-xl transition focus:border-cyan-400/70 focus:ring-4 focus:ring-cyan-400/10"
            />
          </form>
        </header>

        {isLoading && <SkeletonGrid />}

        {error && (
          <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-5 text-red-200">{error}</div>
        )}

        {!isLoading && !data && <EmptyState />}

        {!isLoading && data && data.tradeLevels.mode === "NEUTRAL" && <EmptyState />}

        {!isLoading && data && data.tradeLevels.mode !== "NEUTRAL" && (
          <section className="grid gap-6 lg:grid-cols-12">
            <div className="order-1 lg:order-none lg:col-span-4">
              <MaxLossCalculator
                accountSize={accountSize}
                setAccountSize={setAccountSize}
                riskPerShare={data.tradeLevels.riskPerShare}
                maxShares={maxShares}
              />
            </div>

            <div className="order-2 lg:col-span-4">
              <ConfidenceGauge data={data} />
            </div>

            <div className="order-3 lg:col-span-4">
              <TradePlanCard data={data} />
            </div>

            <div className="order-4 lg:col-span-12">
              <SafetyChecklist data={data} />
            </div>
          </section>
        )}

        <RiskDisclaimer />
      </div>
    </main>
  );
}

function ConfidenceGauge({ data }: { data: ConfidenceScoreData }) {
  const score = Math.max(0, Math.min(100, data.score));
  const radius = 92;
  const circumference = Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score > 90 ? "#22c55e" : score >= 75 ? "#84cc16" : score >= 60 ? "#f59e0b" : "#ef4444";
  const label = score > 90 ? "Apex Setup" : score >= 75 ? "Valid Setup" : score >= 60 ? "Caution" : "Discard";

  return (
    <Card>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Confidence Score</p>
          <h2 className="text-2xl font-semibold">{data.symbol}</h2>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm">{label}</span>
      </div>

      <div className="relative flex justify-center">
        <svg width="240" height="140" viewBox="0 0 240 140">
          <path d="M28 120 A92 92 0 0 1 212 120" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="18" strokeLinecap="round" />
          <motion.path
            d="M28 120 A92 92 0 0 1 212 120"
            fill="none"
            stroke={color}
            strokeWidth="18"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - progress }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{ filter: `drop-shadow(0 0 18px ${color})` }}
          />
        </svg>

        <div className="absolute bottom-0 text-center">
          <p className="font-mono text-6xl font-bold tracking-tight">{score}</p>
          <p className="text-sm text-slate-400">out of 100</p>
        </div>
      </div>
    </Card>
  );
}

function TradePlanCard({ data }: { data: ConfidenceScoreData }) {
  const isApex = data.score > 90;

  return (
    <motion.section
      animate={
        isApex
          ? {
              boxShadow: [
                "0 0 0 rgba(34,197,94,0)",
                "0 0 30px rgba(34,197,94,0.25)",
                "0 0 0 rgba(34,197,94,0)",
              ],
            }
          : {}
      }
      transition={{ repeat: isApex ? Infinity : 0, duration: 2.2 }}
      className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl"
    >
      <div className="mb-6">
        <p className="text-sm text-slate-400">Trade Plan</p>
        <h2 className="text-2xl font-semibold">{data.tradeLevels.mode}</h2>
      </div>

      <div className="space-y-4">
        <PriceRow label="Entry" value={data.tradeLevels.entry} />
        <PriceRow label="Stop Loss" value={data.tradeLevels.stopLoss} />
        <PriceRow label="Target 2R" value={data.tradeLevels.takeProfit2R} />
      </div>
    </motion.section>
  );
}

function PriceRow({ label, value }: { label: string; value: number | null }) {
  const display = value !== null ? `$${value.toFixed(2)}` : "N/A";

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm text-slate-400">{label}</p>
        <button
          onClick={() => navigator.clipboard.writeText(display)}
          className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
          aria-label={`Copy ${label}`}
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-end justify-between gap-4">
        <p className="font-mono text-3xl font-bold tracking-tight">{display}</p>
        <Sparkline />
      </div>
    </div>
  );
}

function Sparkline() {
  return (
    <svg width="80" height="32" viewBox="0 0 80 32" className="opacity-80">
      <path d="M2 24 L14 21 L25 23 L37 14 L49 17 L62 8 L78 11" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-300" />
    </svg>
  );
}

function SafetyChecklist({ data }: { data: ConfidenceScoreData }) {
  const flags = [
    ["Spread Too Wide", data.riskFlags.spreadTooWide],
    ["News Blackout", data.riskFlags.newsBlackout],
    ["Stop Moved to Break-Even", !data.riskFlags.stopMovedToBreakeven],
    ["Slippage Risk", data.riskFlags.profitToSlippageRatioTooLow],
    ["Low Liquidity", data.riskFlags.lowLiquidity],
    ["Reversal Candle", data.riskFlags.reversalCandleDetected],
  ];

  return (
    <Card>
      <h2 className="mb-5 text-2xl font-semibold">Safety Checklist</h2>
      <div className="grid gap-3 md:grid-cols-3">
        {flags.map(([label, active]) => (
          <div key={String(label)} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-4">
            <span className="text-sm text-slate-300">{label}</span>
            <span className={`h-3 w-3 rounded-full ${active ? "bg-red-500 shadow-[0_0_16px_rgba(239,68,68,0.8)]" : "bg-green-400 shadow-[0_0_16px_rgba(34,197,94,0.8)]"}`} />
          </div>
        ))}
      </div>
    </Card>
  );
}

function MaxLossCalculator({
  accountSize,
  setAccountSize,
  riskPerShare,
  maxShares,
}: {
  accountSize: string;
  setAccountSize: (value: string) => void;
  riskPerShare: number;
  maxShares: number;
}) {
  const account = Number(accountSize);
  const maxRisk = account > 0 ? account * 0.01 : 0;

  return (
    <Card>
      <p className="text-sm text-slate-400">Recommended Max Shares</p>
      <motion.p key={maxShares} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-2 font-mono text-7xl font-black tracking-tight text-cyan-300">
        {maxShares}
      </motion.p>

      <div className="mt-6 space-y-4">
        <input
          value={accountSize}
          onChange={(e) => setAccountSize(e.target.value)}
          type="number"
          placeholder="Account size..."
          className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 font-mono text-sm outline-none transition focus:border-cyan-400/70 focus:ring-4 focus:ring-cyan-400/10"
        />

        <div className="grid grid-cols-2 gap-3">
          <MiniStat label="Max Risk 1%" value={`$${maxRisk.toFixed(2)}`} />
          <MiniStat label="Risk / Share" value={`$${riskPerShare.toFixed(2)}`} />
        </div>
      </div>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-xl font-bold">{value}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex min-h-[460px] items-center justify-center rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center backdrop-blur-xl">
      <div>
        <div className="mx-auto mb-6 h-20 w-20 rounded-full border border-cyan-300/20 bg-cyan-300/10 shadow-[0_0_40px_rgba(34,211,238,0.15)]" />
        <h2 className="text-3xl font-semibold">Scanning the Horizon...</h2>
        <p className="mt-3 max-w-md text-slate-400">No high-probability setups at this moment.</p>
      </div>
    </motion.section>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {[1, 2, 3].map((item) => (
        <div key={item} className="h-80 animate-pulse rounded-3xl border border-white/10 bg-white/[0.04]" />
      ))}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">{children}</section>;
}
