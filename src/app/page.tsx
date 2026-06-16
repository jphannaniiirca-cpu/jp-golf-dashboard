"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { courses, courseMap } from "@/lib/courses";
import { createRoundRecord, getResult } from "@/lib/scoring";
import { localGolfRepository } from "@/lib/storage";
import {
  load as loadData,
  saveRound as saveRoundData,
  testSupabaseConnection,
  exportAsJson,
  exportAsCsv,
  getStorageMode,
  getLastDataSource,
  type DataSource
} from "@/lib/dataService";
import {
  formatScoreToPar,
  getBirdieTracker,
  getChartData,
  getCourseAnalytics,
  getDashboardStats,
  getHoleAnalytics,
  getRecentRounds
} from "@/lib/stats";
import type { CourseFilter, CourseId, GolfData, RoundType } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = "dashboard" | "log" | "play" | "courses" | "holes" | "settings";
type HoleSort = "hardest" | "easiest" | "mostBirdied";

// ─── Constants ────────────────────────────────────────────────────────────────
const tabs: { id: Tab; label: string; short: string }[] = [
  { id: "dashboard", label: "Dashboard", short: "Home" },
  { id: "log", label: "Log Round", short: "Log" },
  { id: "play", label: "Play", short: "Play" },
  { id: "courses", label: "Courses", short: "Courses" },
  { id: "holes", label: "Holes", short: "Holes" }
];

// ─── Live Round Draft ─────────────────────────────────────────────────────────
const LIVE_DRAFT_KEY = "jp-golf-dashboard-live-draft";

type LiveRoundDraft = {
  courseId: CourseId;
  roundType: RoundType;
  date: string;
  scores: (number | null)[];
  currentHoleIndex: number;
};

function loadDraft(): LiveRoundDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(LIVE_DRAFT_KEY);
    return stored ? (JSON.parse(stored) as LiveRoundDraft) : null;
  } catch {
    return null;
  }
}

function saveDraftToStorage(draft: LiveRoundDraft): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LIVE_DRAFT_KEY, JSON.stringify(draft));
}

function clearDraftFromStorage(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LIVE_DRAFT_KEY);
}

const filterOptions: { id: CourseFilter; label: string }[] = [
  { id: "all", label: "All" },
  ...courses.map((c) => ({ id: c.id, label: c.name }))
];

const today = new Date().toISOString().slice(0, 10);

// ─── Style helpers ────────────────────────────────────────────────────────────
const card = "rounded-2xl border border-white/[0.07] bg-panel shadow-card";

const displayToPar = (v: number | null | undefined) =>
  v == null ? "--" : formatScoreToPar(v);

const formatDate = (d: string) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(`${d}T12:00:00`)
  );

const scoreToneClass = (toPar: number) => {
  if (toPar <= -1) return "text-fairway";
  if (toPar === 0) return "text-slate-200";
  if (toPar === 1) return "text-warning";
  return "text-danger";
};

const scoreCellClass = (toPar: number): string => {
  if (toPar <= -2) return "border-fairway bg-fairway/20 text-fairway";
  if (toPar === -1) return "border-fairway/60 bg-fairway/10 text-fairway";
  if (toPar === 0)  return "border-line bg-white/[0.04] text-slate-100";
  if (toPar === 1)  return "border-warning/30 bg-warning/10 text-warning";
  return "border-danger/30 bg-danger/10 text-danger";
};

const roundTypeLabel = (rt: RoundType | undefined): string => {
  if (rt === "front9") return "Front 9";
  if (rt === "back9") return "Back 9";
  return "18 Holes";
};

const getChallengeProgress = (data: GolfData) => {
  const courseProgress = courses.map((course) => {
    const tracker = getBirdieTracker(data, course.id);
    const completed = tracker.filter((h) => h.completed).length;
    return {
      course,
      tracker,
      completed,
      remaining: 18 - completed,
      percent: Math.round((completed / 18) * 100)
    };
  });
  const completed = courseProgress.reduce((s, c) => s + c.completed, 0);
  return {
    courseProgress,
    completed,
    remaining: 54 - completed,
    percent: Math.round((completed / 54) * 100)
  };
};

const triggerDownload = (content: string, filename: string, mime: string) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// ─── Icons ────────────────────────────────────────────────────────────────────
function IconHome({ active }: { active: boolean }) {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
    </svg>
  );
}

function IconPlusCircle({ active }: { active: boolean }) {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconFlag({ active }: { active: boolean }) {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
    </svg>
  );
}

function IconBars({ active }: { active: boolean }) {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function IconGear({ size = 5 }: { size?: number }) {
  return (
    <svg className={`h-${size} w-${size}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconPlay({ active }: { active: boolean }) {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd" />
    </svg>
  );
}

// ─── Root Page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [data, setData] = useState<GolfData>({ rounds: [], holeScores: [] });
  const [dataSource, setDataSource] = useState<DataSource>("localStorage");
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [filter, setFilter] = useState<CourseFilter>("all");

  useEffect(() => {
    loadData()
      .then((d) => {
        setData(d);
        setDataSource(getLastDataSource());
      })
      .catch(() => {
        setData(localGolfRepository.load());
        setDataSource("localStorage");
      });
  }, []);

  return (
    <main className="min-h-screen text-slate-100">
      {/* Desktop top nav */}
      <header className="hidden lg:flex items-center justify-between px-8 pt-6 pb-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-gold">Birdie Board</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-white">Chase 54</h1>
        </div>
        <div className="flex items-center gap-2">
          <nav className="flex gap-1 rounded-xl border border-white/[0.08] bg-panel p-1">
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors duration-150 ${
                  activeTab === tab.id
                    ? "bg-fairway text-ink"
                    : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
                }`}>
                {tab.label}
              </button>
            ))}
          </nav>
          {/* Desktop settings gear */}
          <button onClick={() => setActiveTab(activeTab === "settings" ? "dashboard" : "settings")}
            title="Data Settings"
            className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
              activeTab === "settings"
                ? "border-fairway/40 bg-fairway/10 text-fairway"
                : "border-white/[0.08] bg-panel text-slate-500 hover:text-white hover:border-white/[0.16]"
            }`}>
            <IconGear />
          </button>
        </div>
      </header>

      {/* Mobile top bar — branding + settings gear */}
      <div className="flex items-center justify-between px-3 pt-4 pb-0 lg:hidden">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-gold leading-none">
            Birdie Board
          </p>
          <p className="text-base font-bold text-white leading-snug">Chase 54</p>
        </div>
        <button
          onClick={() => setActiveTab(activeTab === "settings" ? "dashboard" : "settings")}
          title="Data Settings"
          className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
            activeTab === "settings"
              ? "border-fairway/40 bg-fairway/10 text-fairway"
              : "border-white/[0.08] bg-white/[0.04] text-slate-500 hover:text-white"
          }`}>
          <IconGear size={4} />
        </button>
      </div>

      {/* Page content */}
      <div className="mx-auto max-w-lg px-3 pt-3 pb-36 lg:max-w-5xl lg:px-8 lg:pb-12 lg:pt-4">
        {activeTab === "dashboard" && (
          <Dashboard
            data={data}
            filter={filter}
            onFilterChange={setFilter}
            onLogRound={() => setActiveTab("log")}
          />
        )}
        {activeTab === "log" && (
          <LogRound
            onSave={(next, source) => {
              setData(next);
              setDataSource(source);
              setFilter("all");
              setActiveTab("dashboard");
            }}
          />
        )}
        {activeTab === "play" && (
          <PlayMode
            data={data}
            onSave={(next, source) => {
              setData(next);
              setDataSource(source);
              setActiveTab("dashboard");
            }}
          />
        )}
        {activeTab === "courses" && <CoursesView data={data} />}
        {activeTab === "holes" && <HoleAnalyticsView data={data} />}
        {activeTab === "settings" && <SettingsView data={data} dataSource={dataSource} onDataChange={setData} />}
      </div>

      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
    </main>
  );
}

// ─── Bottom Nav ─────────────────────────────────────────────────────────────
function navTabIcon(id: Tab, active: boolean) {
  if (id === "dashboard") return <IconHome active={active} />;
  if (id === "log") return <IconPlusCircle active={active} />;
  if (id === "play") return <IconPlay active={active} />;
  if (id === "courses") return <IconFlag active={active} />;
  if (id === "holes") return <IconBars active={active} />;
  return null;
}

function BottomNav({ activeTab, onChange }: { activeTab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.07] bg-ink/95 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.375rem)", paddingTop: "0.375rem" }}
    >
      <div className="grid grid-cols-5">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => onChange(tab.id)}
              className={`flex flex-col items-center gap-0.5 py-1.5 transition-colors duration-150 ${
                active ? "text-fairway" : "text-slate-600"
              }`}>
              {navTabIcon(tab.id, active)}
              <span className="text-[10px] font-semibold">{tab.short}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ data, filter, onFilterChange, onLogRound }: {
  data: GolfData;
  filter: CourseFilter;
  onFilterChange: (f: CourseFilter) => void;
  onLogRound: () => void;
}) {
  const stats = useMemo(() => getDashboardStats(data, filter), [data, filter]);
  const chartData = useMemo(() => getChartData(stats.rounds), [stats.rounds]);
  const recentRounds = useMemo(() => getRecentRounds(stats.rounds), [stats.rounds]);
  const progress = useMemo(() => getChallengeProgress(data), [data]);
  const empty = stats.totalRounds === 0;

  // Domain always includes scratch (0) so the goal line is always visible.
  // With reversed=true, lower values appear higher — the scratch line sits
  // above the data as a target when all rounds are over par.
  const chartDomain = useMemo((): [number, number] => {
    if (!chartData.length) return [-2, 15];
    const toParValues = chartData.map((d) => d.toPar);
    const minToPar = Math.min(...toParValues);
    const maxToPar = Math.max(...toParValues);
    return [Math.min(0, minToPar) - 2, maxToPar + 4];
  }, [chartData]);

  return (
    <section className="flex flex-col gap-3">
      {/* ── Hero ── */}
      <div className={`${card} overflow-hidden`}>
        <div className="p-4 sm:p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold">
            Birdie Board · Prestonwood
          </p>
          <div className="mt-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-3xl font-bold tracking-tight text-white leading-none">Chase 54</h2>
              <p className="mt-1.5 text-sm text-slate-400">
                54 holes. One goal. Birdie them all.
              </p>
            </div>
            <div className="shrink-0 text-right">
              <div className="flex items-baseline justify-end gap-0.5">
                <span className="text-5xl font-bold text-white leading-none tabular-nums">
                  {progress.completed}
                </span>
                <span className="text-lg text-slate-500 font-normal self-end pb-0.5">/54</span>
              </div>
              <p className="mt-0.5 text-[11px] font-semibold text-fairway">birdied</p>
            </div>
          </div>

          <div className="mt-4">
            <div className="h-2.5 overflow-hidden rounded-full bg-ink">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${progress.percent}%`,
                  background: "linear-gradient(90deg, #1db870 0%, #5fe09c 100%)"
                }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <p className="text-xs text-slate-500">{progress.remaining} holes left to chase</p>
              <p className="text-xs font-bold text-fairway">{progress.percent}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Score trend chart ── */}
      <div className={`${card} overflow-hidden`}>
        <div className="px-4 pt-4 pb-2 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                Scoring Trend
              </p>
              <div className="mt-0.5 flex items-baseline gap-2">
                <p className={`text-3xl font-bold leading-tight tabular-nums ${
                  empty || !stats.latestRound ? "text-white" : scoreToneClass(stats.latestRound.scoreToPar)
                }`}>
                  {empty || !stats.latestRound ? "--" : formatScoreToPar(stats.latestRound.scoreToPar)}
                </p>
                {!empty && (
                  <span className={`text-base font-semibold ${scoreToneClass(stats.averageToPar)}`}>
                    {formatScoreToPar(stats.averageToPar)} avg
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-slate-600">
                {empty
                  ? "Log rounds to see your trend"
                  : "Real score to par · no projected holes"}
              </p>
            </div>
          </div>

          {/* Course filter chips */}
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
            {filterOptions.map((opt) => (
              <button key={opt.id} onClick={() => onFilterChange(opt.id)}
                className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                  filter === opt.id
                    ? "bg-fairway text-ink"
                    : "bg-white/[0.06] text-slate-400 hover:text-white"
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-52 w-full sm:h-64">
          {empty ? (
            <EmptyState onLogRound={onLogRound} />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ left: -8, right: 12, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1db870" stopOpacity={0.22} />
                    <stop offset="92%" stopColor="#1db870" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1a2b3c" strokeDasharray="2 10" vertical={false} />
                <XAxis dataKey="date" stroke="#475569" tickLine={false} axisLine={false}
                  tick={{ fontSize: 10, fill: "#4b5d70" }} dy={6} />
                <YAxis stroke="#475569" tickLine={false} axisLine={false}
                  domain={chartDomain} reversed width={36}
                  tick={{ fontSize: 10, fill: "#4b5d70" }}
                  tickFormatter={(v: number) => {
                    if (v === 0) return "E";
                    return v > 0 ? `+${v}` : `${v}`;
                  }}
                />
                {/* Scratch / par goal line */}
                <ReferenceLine
                  y={0}
                  stroke="#1db870"
                  strokeOpacity={0.5}
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                  label={{ value: "E / Scratch", position: "insideBottomRight", fill: "#1db870", fillOpacity: 0.75, fontSize: 9 }}
                />
                {/* Average line — updates with course filter */}
                <ReferenceLine
                  y={stats.averageToPar}
                  stroke="#c9a96e"
                  strokeOpacity={0.65}
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  label={{ value: `Avg ${formatScoreToPar(stats.averageToPar)}`, position: "insideTopRight", fill: "#c9a96e", fillOpacity: 0.85, fontSize: 9 }}
                />
                <Tooltip
                  content={(props) => (
                    <ScoreTooltip
                      active={props.active}
                      payload={props.payload as { payload: ReturnType<typeof getChartData>[number] }[] | undefined}
                      avgToPar={stats.averageToPar}
                    />
                  )}
                  cursor={{ stroke: "#1db870", strokeWidth: 1, strokeDasharray: "4 4" }}
                />
                <Area type="monotone" dataKey="toPar" stroke="#1db870" strokeWidth={2.5}
                  fill="url(#scoreGradient)"
                  dot={{ r: 3, fill: "#1db870", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#5fe09c", stroke: "#07101a", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {!empty && (
          <p className="px-4 pb-3 text-center text-[9px] text-slate-700">
            Lower score to par is better · Higher on this chart means better performance
          </p>
        )}
      </div>

      {/* ── Metrics 2-col ── */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <MetricCard
          label="Avg to Par"
          value={empty ? "--" : formatScoreToPar(stats.averageToPar)}
          tone={!empty && stats.averageToPar <= 0 ? "good" : "neutral"}
        />
        <MetricCard
          label="Avg ± (9-Hole)"
          value={stats.averageToPar9 !== null ? formatScoreToPar(stats.averageToPar9) : "--"}
          tone={stats.averageToPar9 !== null && stats.averageToPar9 <= 0 ? "good" : "neutral"}
        />
        <MetricCard
          label="Avg ± (18-Hole)"
          value={stats.averageToPar18 !== null ? formatScoreToPar(stats.averageToPar18) : "--"}
          tone={stats.averageToPar18 !== null && stats.averageToPar18 <= 0 ? "good" : "neutral"}
        />
        <MetricCard
          label="Best 9-Hole"
          value={stats.best9 ? formatScoreToPar(stats.best9.scoreToPar) : "--"}
          tone={stats.best9 ? "good" : "neutral"}
        />
        <MetricCard
          label="Best 18-Hole"
          value={stats.best18 ? formatScoreToPar(stats.best18.scoreToPar) : "--"}
          tone={stats.best18 ? "good" : "neutral"}
        />
        <MetricCard label="Holes Played" value={stats.totalHolesPlayed} />
        <MetricCard label="Total Birdies" value={stats.totalBirdies} tone="good" />
        <MetricCard label="Chase 54" value={`${progress.completed}/54`} />
      </div>

      {/* ── Course progress ── */}
      <CourseProgressCards progress={progress.courseProgress} />

      {/* ── Recent rounds ── */}
      <RecentRounds rounds={recentRounds} empty={empty} onLogRound={onLogRound} />

      <p className="py-1 text-center text-[10px] text-slate-700">Powered by Birdie Board</p>
    </section>
  );
}

// ─── Score Tooltip ───────────────────────────────────────────────────────────
type ChartPoint = ReturnType<typeof getChartData>[number];

function ScoreTooltip({ active, payload, avgToPar }: {
  active?: boolean;
  payload?: { payload: ChartPoint }[];
  avgToPar?: number;
}) {
  if (!active || !payload?.length) return null;
  const pt = payload[0].payload;
  const throughText = pt.holesPlayed === 9 ? "through 9" : "through 18";
  const diff = avgToPar !== undefined ? Math.round((pt.toPar - avgToPar) * 10) / 10 : null;
  const diffAbs = diff !== null ? Math.abs(diff) : 0;
  const diffLabel =
    diff === null ? null
    : diff < -0.05 ? `${diffAbs} stroke${diffAbs !== 1 ? "s" : ""} better than avg`
    : diff > 0.05  ? `${diffAbs} stroke${diffAbs !== 1 ? "s" : ""} worse than avg`
    : "At avg";
  const diffColor =
    diff === null ? "text-slate-500"
    : diff < -0.05 ? "text-fairway"
    : diff > 0.05  ? "text-warning"
    : "text-slate-400";

  return (
    <div className="min-w-[190px] rounded-xl border border-white/[0.1] bg-ink/95 px-4 py-3 shadow-2xl backdrop-blur">
      <p className="text-[11px] text-slate-400">{pt.date} · {pt.course}</p>
      <p className="text-[11px] text-slate-500">{roundTypeLabel(pt.roundType)}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <p className={`text-2xl font-bold tabular-nums ${scoreToneClass(pt.toPar)}`}>
          {formatScoreToPar(pt.toPar)}
        </p>
        <p className="text-sm text-slate-400">{throughText}</p>
      </div>
      <p className="mt-0.5 text-[11px] text-slate-500">
        {pt.score} on par {pt.par}
      </p>
      {diffLabel && (
        <p className={`mt-1.5 text-[11px] font-semibold ${diffColor}`}>{diffLabel}</p>
      )}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ onLogRound }: { onLogRound: () => void }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-fairway/20 bg-fairway/10">
          <svg className="h-6 w-6 text-fairway" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-white">Start the Chase</p>
        <p className="mt-1 text-xs text-slate-400">Log your first round to see your scoring trend.</p>
        <button onClick={onLogRound}
          className="mt-4 rounded-xl bg-fairway px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-mint">
          Log First Round
        </button>
      </div>
    </div>
  );
}

// ─── Metric Card ──────────────────────────────────────────────────────────────
function MetricCard({ label, value, tone = "neutral" }: {
  label: string; value: string | number; tone?: "neutral" | "good" | "bad";
}) {
  return (
    <div className={`${card} p-4`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 leading-none">{label}</p>
      <p className={`mt-2 text-2xl font-bold tracking-tight tabular-nums ${
        tone === "good" ? "text-fairway" : tone === "bad" ? "text-danger" : "text-white"
      }`}>{value}</p>
    </div>
  );
}

// ─── Course Progress Cards ────────────────────────────────────────────────────
function CourseProgressCards({ progress }: {
  progress: ReturnType<typeof getChallengeProgress>["courseProgress"];
}) {
  return (
    <div className="grid gap-2.5 lg:grid-cols-3">
      {progress.map((item) => (
        <div key={item.course.id} className={`${card} p-4`}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-white leading-tight">{item.course.name}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{item.remaining} holes remaining</p>
            </div>
            <div className="shrink-0 text-right">
              <span className="text-2xl font-bold text-fairway tabular-nums">{item.completed}</span>
              <span className="text-sm font-normal text-slate-500">/18</span>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink">
            <div className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${item.percent}%`,
                background: "linear-gradient(90deg, #1db870, #5fe09c)"
              }} />
          </div>
          <p className="mt-1.5 text-right text-[10px] font-semibold text-slate-600">{item.percent}%</p>
        </div>
      ))}
    </div>
  );
}

// ─── Recent Rounds ─────────────────────────────────────────────────────────────
function RecentRounds({ rounds, empty, onLogRound }: {
  rounds: GolfData["rounds"]; empty: boolean; onLogRound: () => void;
}) {
  return (
    <div className={`${card} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3.5 sm:px-5">
        <div>
          <h2 className="font-semibold text-white text-sm">Recent Rounds</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">Last 5 rounds logged</p>
        </div>
        <button onClick={onLogRound}
          className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-[11px] font-semibold text-slate-300 transition hover:border-fairway/40 hover:text-fairway">
          + Add
        </button>
      </div>
      {empty ? (
        <p className="px-4 py-5 text-sm text-slate-500">No rounds yet. Log your first round above.</p>
      ) : (
        <div className="flex flex-col gap-2 p-3 sm:p-4">
          {rounds.map((round) => {
            const rt = round.roundType ?? "18";
            const statCells: [string, string | number][] =
              rt === "18"
                ? [
                    ["Front", round.frontNineScore ?? "--"],
                    ["Back", round.backNineScore ?? "--"],
                    ["Par", round.totalPar]
                  ]
                : [
                    ["Score", round.totalScore],
                    ["Par", round.totalPar],
                    ["±", formatScoreToPar(round.scoreToPar)]
                  ];
            return (
              <div key={round.id}
                className="rounded-xl border border-white/[0.06] bg-panelSoft/70 p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-white text-sm leading-tight">
                      {courseMap[round.courseId].name}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {formatDate(round.date)} · {roundTypeLabel(rt)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-3xl font-bold text-white leading-none tabular-nums">
                      {round.totalScore}
                    </p>
                    <p className={`text-sm font-semibold mt-0.5 ${scoreToneClass(round.scoreToPar)}`}>
                      {formatScoreToPar(round.scoreToPar)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  {statCells.map(([label, value]) => (
                    <div key={String(label)} className="rounded-lg bg-ink/60 px-2 py-1.5 text-center">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-600">{label}</p>
                      <p className="text-sm font-semibold text-slate-300 tabular-nums">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Log Round ─────────────────────────────────────────────────────────────────
function LogRound({ onSave }: { onSave: (data: GolfData, source: DataSource) => void }) {
  const [date, setDate] = useState(today);
  const [courseId, setCourseId] = useState<CourseId>("highlands");
  const [roundType, setRoundType] = useState<RoundType>("18");
  const [scores, setScores] = useState<number[]>(courseMap.highlands.holes.map((h) => h.par));
  const [notes, setNotes] = useState("");
  const course = courseMap[courseId];

  useEffect(() => {
    const holes =
      roundType === "back9"
        ? courseMap[courseId].holes.slice(9)
        : roundType === "front9"
          ? courseMap[courseId].holes.slice(0, 9)
          : courseMap[courseId].holes;
    setScores(holes.map((h) => h.par));
  }, [courseId, roundType]);

  const total = scores.reduce((s, v) => s + v, 0);
  const playedPar =
    roundType === "front9"
      ? course.holes.slice(0, 9).reduce((s, h) => s + h.par, 0)
      : roundType === "back9"
        ? course.holes.slice(9).reduce((s, h) => s + h.par, 0)
        : course.totalPar;
  const toPar = total - playedPar;
  const frontNine =
    roundType !== "back9"
      ? (roundType === "18" ? scores.slice(0, 9) : scores).reduce((s, v) => s + v, 0)
      : undefined;
  const backNine =
    roundType !== "front9"
      ? (roundType === "18" ? scores.slice(9) : scores).reduce((s, v) => s + v, 0)
      : undefined;
  const expectedHoles = roundType === "18" ? 18 : 9;
  const canSave = Boolean(date) && scores.length === expectedHoles && scores.every((s) => s >= 1 && s <= 12);

  const updateScore = (absoluteHoleIndex: number, v: number) => {
    const localIndex = absoluteHoleIndex - (roundType === "back9" ? 9 : 0);
    const next = Number.isFinite(v) && v >= 1 ? Math.min(12, v) : course.holes[absoluteHoleIndex].par;
    setScores((cur) => cur.map((s, si) => (si === localIndex ? next : s)));
  };

  const [isSaving, setIsSaving] = useState(false);

  const saveRound = async () => {
    if (!canSave || isSaving) return;
    setIsSaving(true);
    try {
      const record = createRoundRecord({
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `round-${Date.now()}`,
        date,
        courseId,
        roundType,
        scores,
        notes: notes.trim() || undefined
      });
      const { data: next, savedTo } = await saveRoundData(record.round, record.holeScores);
      onSave(next, savedTo);
    } catch {
      setIsSaving(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 pb-40 lg:grid lg:grid-cols-[1fr_288px] lg:gap-5 lg:pb-0">
      <div className="flex flex-col gap-3">
        {/* Course + Date */}
        <div className={`${card} p-4 sm:p-5`}>
          <h2 className="mb-3 text-sm font-semibold text-white">Round Details</h2>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Course</span>
              <select value={courseId} onChange={(e) => setCourseId(e.target.value as CourseId)}
                className="h-11 rounded-xl border border-line bg-panelSoft px-3 text-sm text-white outline-none focus:border-fairway/60">
                {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="h-11 rounded-xl border border-line bg-panelSoft px-3 text-sm text-white outline-none focus:border-fairway/60" />
            </label>
          </div>
        </div>

        {/* Round Type */}
        <div className={`${card} p-3`}>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Round Type</p>
          <div className="grid grid-cols-3 gap-1.5">
            {(["18", "front9", "back9"] as RoundType[]).map((rt) => (
              <button key={rt} onClick={() => setRoundType(rt)}
                className={`rounded-xl py-2.5 text-[11px] font-semibold transition-colors ${
                  roundType === rt
                    ? "bg-fairway text-ink"
                    : "bg-white/[0.06] text-slate-400 hover:text-white"
                }`}>
                {roundTypeLabel(rt)}
              </button>
            ))}
          </div>
        </div>

        {/* Front 9 scorecard — shown for 18 and front9 */}
        {roundType !== "back9" && (
          <ScorecardNine
            label="Front"
            holes={course.holes.slice(0, 9)}
            scores={roundType === "18" ? scores.slice(0, 9) : scores}
            startIndex={0}
            updateScore={updateScore}
          />
        )}
        {/* Back 9 scorecard — shown for 18 and back9 */}
        {roundType !== "front9" && (
          <ScorecardNine
            label="Back"
            holes={course.holes.slice(9)}
            scores={roundType === "18" ? scores.slice(9) : scores}
            startIndex={9}
            updateScore={updateScore}
          />
        )}

        {/* Notes */}
        <div className={`${card} p-4`}>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Notes</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="How did it go?"
              className="resize-none rounded-xl border border-line bg-panelSoft px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-700 focus:border-fairway/50" />
          </label>
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className={`${card} sticky top-6 hidden h-fit p-5 lg:block`}>
        <RoundSummary
          roundType={roundType}
          frontNine={frontNine}
          backNine={backNine}
          total={total}
          totalPar={playedPar}
          toPar={toPar}
          canSave={canSave && !isSaving}
          onSave={saveRound}
        />
      </aside>

      {/* Mobile sticky save bar */}
      <div className="fixed inset-x-0 z-40 border-t border-white/[0.07] bg-ink/95 px-3 py-2.5 backdrop-blur-xl lg:hidden"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 3.75rem)" }}>
        <div className="mx-auto flex max-w-sm items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Live Total</p>
            <p className="text-xl font-bold leading-tight text-white">
              {total}
              <span className={`ml-1.5 text-sm font-semibold ${scoreToneClass(toPar)}`}>
                {formatScoreToPar(toPar)}
              </span>
            </p>
          </div>
          <div className="flex gap-2 text-[10px] text-slate-500 shrink-0">
            {roundType !== "back9" && frontNine !== undefined && (
              <span>F <span className="font-semibold text-slate-300">{frontNine}</span></span>
            )}
            {roundType !== "front9" && backNine !== undefined && (
              <span>B <span className="font-semibold text-slate-300">{backNine}</span></span>
            )}
          </div>
          <button onClick={saveRound} disabled={!canSave || isSaving}
            className="shrink-0 rounded-xl bg-fairway px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-mint disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500">
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </section>
  );
}

// ─── Scorecard Nine ───────────────────────────────────────────────────────────
function ScorecardNine({ label, holes, scores, startIndex, updateScore }: {
  label: "Front" | "Back";
  holes: { hole: number; par: number }[];
  scores: number[];
  startIndex: number;
  updateScore: (i: number, v: number) => void;
}) {
  const nineTotal = scores.reduce((s, v) => s + v, 0);
  const parTotal  = holes.reduce((s, h) => s + h.par, 0);
  const nineToPar = nineTotal - parTotal;
  const outLabel  = label === "Front" ? "Out" : "In";

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-2.5">
        <h2 className="text-sm font-semibold text-white">{label} Nine</h2>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-bold text-white tabular-nums">{nineTotal}</span>
          <span className={`text-xs font-semibold ${scoreToneClass(nineToPar)}`}>
            {formatScoreToPar(nineToPar)}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div
          className="grid min-w-[300px] px-3 pt-2.5 pb-3"
          style={{ gridTemplateColumns: "30px repeat(9, 1fr) 38px" }}
        >
          {/* ── Hole numbers ── */}
          <div className="pb-1.5" />
          {holes.map((h) => (
            <div key={h.hole} className="pb-1.5 text-center">
              <span className="text-[11px] font-bold text-slate-400 tabular-nums">{h.hole}</span>
            </div>
          ))}
          <div className="pb-1.5 text-center">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600">{outLabel}</span>
          </div>

          {/* ── Par row ── */}
          <div className="flex items-center py-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600">Par</span>
          </div>
          {holes.map((h) => (
            <div key={h.hole} className="py-1 text-center">
              <span className="text-[11px] font-semibold text-slate-500 tabular-nums">{h.par}</span>
            </div>
          ))}
          <div className="py-1 text-center">
            <span className="text-[11px] font-semibold text-slate-500 tabular-nums">{parTotal}</span>
          </div>

          {/* ── Score inputs ── */}
          <div className="flex items-center py-0.5">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600">Score</span>
          </div>
          {holes.map((h, i) => {
            const toPar = scores[i] - h.par;
            return (
              <div key={h.hole} className="px-0.5 py-0.5">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={12}
                  value={scores[i]}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v) && v >= 1) updateScore(startIndex + i, Math.min(12, v));
                  }}
                  onFocus={(e) => e.target.select()}
                  onBlur={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (isNaN(v) || v < 1) updateScore(startIndex + i, h.par);
                  }}
                  className={`block w-full rounded-lg border py-1.5 text-center text-sm font-bold tabular-nums outline-none transition-colors ${scoreCellClass(toPar)}`}
                />
              </div>
            );
          })}
          <div className="flex items-center justify-center py-0.5 pl-1">
            <span className={`text-sm font-bold tabular-nums ${scoreToneClass(nineToPar)}`}>
              {nineTotal}
            </span>
          </div>

          {/* ── Result labels ── */}
          <div className="pt-1" />
          {holes.map((h, i) => {
            const toPar = scores[i] - h.par;
            return (
              <div key={h.hole} className="pt-1 text-center">
                <span className={`text-[8px] font-bold leading-none ${scoreToneClass(toPar)}`}>
                  {formatScoreToPar(toPar)}
                </span>
              </div>
            );
          })}
          <div className="pt-1" />
        </div>
      </div>
    </div>
  );
}

function RoundSummary({ roundType, frontNine, backNine, total, totalPar, toPar, canSave, onSave }: {
  roundType: RoundType;
  frontNine?: number;
  backNine?: number;
  total: number;
  totalPar: number;
  toPar: number;
  canSave: boolean;
  onSave: () => void;
}) {
  const cells: [string, number][] =
    roundType === "18"
      ? [["Front 9", frontNine ?? 0], ["Back 9", backNine ?? 0], ["Total", total], ["Par", totalPar]]
      : [["Score", total], ["Par", totalPar]];

  return (
    <>
      <h2 className="mb-1 text-sm font-semibold text-white">Round Summary</h2>
      <p className="mb-3 text-[10px] text-slate-500">{roundTypeLabel(roundType)}</p>
      <div className="grid grid-cols-2 gap-2">
        {cells.map(([l, v]) => (
          <div key={l} className="rounded-xl border border-white/[0.06] bg-panelSoft p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{l}</p>
            <p className="mt-1 text-xl font-bold text-white tabular-nums">{v}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl border border-fairway/20 bg-fairway/10 p-3.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Score to Par</p>
        <p className={`mt-1 text-3xl font-bold tabular-nums ${scoreToneClass(toPar)}`}>
          {formatScoreToPar(toPar)}
        </p>
      </div>
      <button onClick={onSave} disabled={!canSave}
        className="mt-3 w-full rounded-xl bg-fairway py-3 text-sm font-semibold text-ink transition hover:bg-mint disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500">
        Save Round
      </button>
    </>
  );
}

// ─── Courses View ─────────────────────────────────────────────────────────────
function CoursesView({ data }: { data: GolfData }) {
  const analytics = useMemo(() => getCourseAnalytics(data), [data]);
  const progress = useMemo(() => getChallengeProgress(data), [data]);

  return (
    <section className="flex flex-col gap-3">
      <div className="pt-1">
        <h2 className="text-xl font-bold text-white">Courses</h2>
        <p className="mt-0.5 text-sm text-slate-500">Prestonwood Chase 54 — progress &amp; stats</p>
      </div>

      {analytics.map((item) => {
        const cp = progress.courseProgress.find((p) => p.course.id === item.course.id);
        return (
          <div key={item.course.id} className={`${card} overflow-hidden`}>
            <div className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-white">{item.course.name}</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Par {item.course.totalPar}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-2xl font-bold text-fairway tabular-nums">
                    {cp?.completed ?? 0}
                    <span className="text-sm font-normal text-slate-500">/18</span>
                  </p>
                  <p className="text-[10px] text-slate-500">{cp?.percent ?? 0}% done</p>
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${cp?.percent ?? 0}%`,
                    background: "linear-gradient(90deg, #1db870, #5fe09c)"
                  }} />
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-white/[0.05] border-t border-white/[0.05]">
              {([
                ["Avg ±", item.totalRounds ? formatScoreToPar(item.averageToPar) : "--"],
                ["Best ±", item.totalRounds ? formatScoreToPar(item.bestToPar) : "--"],
                ["Birdies", item.totalBirdies]
              ] as [string, string | number][]).map(([l, v]) => (
                <div key={l} className="p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{l}</p>
                  <p className="mt-1 text-lg font-bold text-white tabular-nums">{v}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 divide-x divide-white/[0.05] border-t border-white/[0.05]">
              {([
                ["Rounds", item.totalRounds],
                ["Hardest", item.hardestHole ? `#${item.hardestHole.hole} (${formatScoreToPar(item.hardestHole.averageToPar)})` : "--"],
                ["Easiest", item.easiestHole ? `#${item.easiestHole.hole} (${formatScoreToPar(item.easiestHole.averageToPar)})` : "--"]
              ] as [string, string | number][]).map(([l, v]) => (
                <div key={l} className="p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{l}</p>
                  <p className="mt-1 text-sm font-semibold text-white">{v}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <BirdieTrackerView data={data} />
    </section>
  );
}

// ─── Birdie Tracker ───────────────────────────────────────────────────────────
function BirdieTrackerView({ data }: { data: GolfData }) {
  const progress = useMemo(() => getChallengeProgress(data), [data]);
  return (
    <section className="mt-1 flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-bold text-white">Birdie Tracker</h2>
        <p className="text-[11px] text-slate-500 mt-0.5">Hole-by-hole Chase 54 progress</p>
      </div>
      {progress.courseProgress.map((item) => (
        <BirdieTrackerCard key={item.course.id} item={item} />
      ))}
    </section>
  );
}

function BirdieTrackerCard({ item }: {
  item: ReturnType<typeof getChallengeProgress>["courseProgress"][number];
}) {
  return (
    <div className={`${card} overflow-hidden`}>
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold text-white text-sm">{item.course.name}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{item.remaining} holes still needed</p>
          </div>
          <p className="text-lg font-bold text-fairway tabular-nums">
            {item.completed}<span className="text-xs font-normal text-slate-500">/18</span>
          </p>
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-ink">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${item.percent}%`, background: "linear-gradient(90deg, #1db870, #5fe09c)" }} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-px border-t border-white/[0.05] bg-white/[0.03] sm:grid-cols-6">
        {item.tracker.map((hole) => (
          <div key={hole.hole}
            className={`flex flex-col p-2.5 ${hole.completed ? "bg-fairway/[0.1]" : "bg-panel"}`}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-bold text-slate-500">H{hole.hole}</p>
              {hole.completed && (
                <span className="text-fairway"><IconCheck /></span>
              )}
            </div>
            <p className="text-[9px] text-slate-700">P{hole.par}</p>
            <p className={`text-base font-bold leading-tight tabular-nums ${
              hole.completed ? "text-fairway" : "text-slate-500"
            }`}>
              {hole.bestScore ?? "–"}
            </p>
            <p className={`text-[9px] font-bold uppercase tracking-wide mt-0.5 ${
              hole.completed ? "text-fairway/60" : "text-slate-700"
            }`}>
              {hole.completed ? "Done" : "Need"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Hole Analytics ───────────────────────────────────────────────────────────
function HoleAnalyticsView({ data }: { data: GolfData }) {
  const rows = useMemo(() => getHoleAnalytics(data), [data]);
  const [courseFilter, setCourseFilter] = useState<CourseFilter>("all");
  const [sort, setSort] = useState<HoleSort>("hardest");

  const visibleRows = useMemo(() => {
    const filtered = courseFilter === "all" ? rows : rows.filter((r) => r.course.id === courseFilter);
    return [...filtered].sort((a, b) => {
      if (sort === "mostBirdied") return b.birdieCount - a.birdieCount;
      const aTP = a.averageToPar ?? 0;
      const bTP = b.averageToPar ?? 0;
      return sort === "hardest" ? bTP - aTP : aTP - bTP;
    });
  }, [courseFilter, rows, sort]);

  return (
    <section className="flex flex-col gap-3">
      <div className="pt-1">
        <h2 className="text-xl font-bold text-white">Hole Analytics</h2>
        <p className="mt-0.5 text-sm text-slate-500">All 54 holes ranked and compared</p>
      </div>

      <div className={`${card} p-3.5`}>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {filterOptions.map((opt) => (
            <button key={opt.id} onClick={() => setCourseFilter(opt.id)}
              className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                courseFilter === opt.id ? "bg-fairway text-ink" : "bg-white/[0.06] text-slate-400 hover:text-white"
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
        <div className="mt-2.5 grid grid-cols-3 gap-1.5">
          {([
            { id: "hardest", label: "Hardest" },
            { id: "easiest", label: "Easiest" },
            { id: "mostBirdied", label: "Most Birdied" }
          ] as { id: HoleSort; label: string }[]).map((opt) => (
            <button key={opt.id} onClick={() => setSort(opt.id)}
              className={`rounded-lg py-2 text-[11px] font-semibold transition-colors ${
                sort === opt.id ? "bg-gold text-ink" : "bg-white/[0.06] text-slate-400 hover:text-white"
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {visibleRows.map((row) => (
          <div key={`${row.course.id}-${row.hole}`} className={`${card} p-4`}>
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {row.course.name}
                </p>
                <p className="text-xl font-bold text-white">Hole {row.hole}</p>
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                row.birdied
                  ? "border-fairway/30 bg-fairway/10 text-fairway"
                  : "border-white/[0.07] bg-white/[0.03] text-slate-500"
              }`}>
                {row.birdied ? "Birdied" : "Needed"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {([
                ["Par", row.par],
                ["Avg", row.averageScore ?? "--"],
                ["Best", row.bestScore ?? "--"],
                ["Avg ±", displayToPar(row.averageToPar)],
                ["Birdies", row.birdieCount],
                ["Worst", row.worstScore ?? "--"]
              ] as [string, string | number][]).map(([l, v]) => (
                <div key={l} className="rounded-lg border border-white/[0.05] bg-panelSoft/60 p-2">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-slate-600">{l}</p>
                  <p className="mt-0.5 text-sm font-bold text-white tabular-nums">{v}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Play Mode ────────────────────────────────────────────────────────────────
type PlayScreen = "start" | "hole" | "finish";

function PlayMode({ data, onSave }: { data: GolfData; onSave: (d: GolfData, source: DataSource) => void }) {
  const [screen, setScreen] = useState<PlayScreen>("start");
  const [draft, setDraft] = useState<LiveRoundDraft | null>(null);
  const [existingDraft, setExistingDraft] = useState<LiveRoundDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | undefined>(undefined);
  const [setupCourse, setSetupCourse] = useState<CourseId>("highlands");
  const [setupRoundType, setSetupRoundType] = useState<RoundType>("18");
  const [setupDate, setSetupDate] = useState(today);

  useEffect(() => {
    const d = loadDraft();
    if (d) setExistingDraft(d);
  }, []);

  const updateDraft = (next: LiveRoundDraft) => {
    setDraft(next);
    saveDraftToStorage(next);
  };

  const startRound = () => {
    const course = courseMap[setupCourse];
    const playedHoles =
      setupRoundType === "back9" ? course.holes.slice(9)
      : setupRoundType === "front9" ? course.holes.slice(0, 9)
      : course.holes;
    const newDraft: LiveRoundDraft = {
      courseId: setupCourse,
      roundType: setupRoundType,
      date: setupDate,
      scores: playedHoles.map(() => null),
      currentHoleIndex: 0,
    };
    setExistingDraft(null);
    updateDraft(newDraft);
    setScreen("hole");
  };

  const resumeDraft = () => {
    if (!existingDraft) return;
    setDraft(existingDraft);
    setExistingDraft(null);
    setScreen(existingDraft.scores.every((s) => s !== null) ? "finish" : "hole");
  };

  const discardDraft = () => {
    clearDraftFromStorage();
    setExistingDraft(null);
    setDraft(null);
  };

  const saveHoleScore = (score: number) => {
    if (!draft) return;
    const newScores = draft.scores.map((s, i) => (i === draft.currentHoleIndex ? score : s));
    const isLastHole = draft.currentHoleIndex === draft.scores.length - 1;
    const next: LiveRoundDraft = {
      ...draft,
      scores: newScores,
      currentHoleIndex: isLastHole ? draft.currentHoleIndex : draft.currentHoleIndex + 1,
    };
    updateDraft(next);
    if (isLastHole) setScreen("finish");
  };

  const saveRoundFinal = async () => {
    if (!draft || isSaving) return;
    const allScores = draft.scores as number[];
    setIsSaving(true);
    try {
      const record = createRoundRecord({
        id: typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `round-${Date.now()}`,
        date: draft.date,
        courseId: draft.courseId,
        roundType: draft.roundType,
        scores: allScores,
      });
      const { data: next, savedTo, error } = await saveRoundData(record.round, record.holeScores);
      clearDraftFromStorage();
      setDraft(null);
      setScreen("start");
      setSaveError(error);
      onSave(next, savedTo);
    } catch {
      setIsSaving(false);
    }
  };

  if (screen === "hole" && draft) {
    return (
      <PlayHoleScreen
        draft={draft}
        data={data}
        onScore={saveHoleScore}
        onBack={() => setScreen("start")}
      />
    );
  }

  if (screen === "finish" && draft) {
    return (
      <PlayFinishScreen
        draft={draft}
        isSaving={isSaving}
        saveError={saveError}
        onSave={saveRoundFinal}
        onBack={() => {
          if (!draft) return;
          const next: LiveRoundDraft = {
            ...draft,
            currentHoleIndex: draft.scores.length - 1
          };
          updateDraft(next);
          setScreen("hole");
        }}
      />
    );
  }

  // Start screen
  return (
    <section className="flex flex-col gap-3">
      <div className="pt-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold">Live Mode</p>
        <h2 className="mt-0.5 text-2xl font-bold text-white">Play a Round</h2>
        <p className="mt-0.5 text-sm text-slate-500">Track your score hole by hole as you play.</p>
      </div>

      {existingDraft && (
        <div className="rounded-2xl border border-gold/20 bg-gold/[0.05] p-4 shadow-card">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gold">Unfinished Round</p>
          <p className="mt-1 text-sm font-semibold text-white">
            {courseMap[existingDraft.courseId].name} · {roundTypeLabel(existingDraft.roundType)}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {formatDate(existingDraft.date)} · Hole {existingDraft.currentHoleIndex + 1} of {existingDraft.scores.length}
          </p>
          <div className="mt-3 flex gap-2">
            <button onClick={resumeDraft}
              className="flex-1 rounded-xl bg-fairway py-2.5 text-sm font-semibold text-ink transition hover:bg-mint">
              Resume Round
            </button>
            <button onClick={discardDraft}
              className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-400 transition hover:border-danger/30 hover:text-danger">
              Discard
            </button>
          </div>
        </div>
      )}

      <div className={`${card} p-4 sm:p-5`}>
        <h3 className="mb-4 text-sm font-semibold text-white">New Round</h3>
        <div className="flex flex-col gap-4">

          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Course</p>
            <div className="flex flex-col gap-1.5">
              {courses.map((c) => (
                <button key={c.id} onClick={() => setSetupCourse(c.id)}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                    setupCourse === c.id
                      ? "border-fairway/40 bg-fairway/10 text-fairway"
                      : "border-white/[0.07] bg-white/[0.03] text-slate-300 hover:border-white/[0.16] hover:text-white"
                  }`}>
                  <span>{c.name}</span>
                  <span className="text-[11px] font-normal text-slate-500">Par {c.totalPar}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Round Type</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(["18", "front9", "back9"] as RoundType[]).map((rt) => (
                <button key={rt} onClick={() => setSetupRoundType(rt)}
                  className={`rounded-xl py-2.5 text-[11px] font-semibold transition-colors ${
                    setupRoundType === rt
                      ? "bg-fairway text-ink"
                      : "bg-white/[0.06] text-slate-400 hover:text-white"
                  }`}>
                  {roundTypeLabel(rt)}
                </button>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Date</span>
            <input type="date" value={setupDate} onChange={(e) => setSetupDate(e.target.value)}
              className="h-11 rounded-xl border border-line bg-panelSoft px-3 text-sm text-white outline-none focus:border-fairway/60" />
          </label>

          <button onClick={startRound}
            className="mt-1 w-full rounded-xl bg-fairway py-3.5 text-sm font-semibold text-ink transition hover:bg-mint active:scale-[0.98]">
            Start Live Round →
          </button>
        </div>
      </div>
    </section>
  );
}

// ─── Play Hole Screen ─────────────────────────────────────────────────────────
function PlayHoleScreen({ draft, data, onScore, onBack }: {
  draft: LiveRoundDraft;
  data: GolfData;
  onScore: (score: number) => void;
  onBack: () => void;
}) {
  const course = courseMap[draft.courseId];
  const playedHoles =
    draft.roundType === "back9" ? course.holes.slice(9)
    : draft.roundType === "front9" ? course.holes.slice(0, 9)
    : course.holes;
  const currentHole = playedHoles[draft.currentHoleIndex];
  const [holeScore, setHoleScore] = useState(currentHole.par);

  useEffect(() => {
    setHoleScore(currentHole.par);
  }, [draft.currentHoleIndex, currentHole.par]);

  const holeHistory = data.holeScores.filter(
    (hs) => hs.courseId === draft.courseId && hs.hole === currentHole.hole
  );
  const timesPlayed = holeHistory.length;
  const avgScore = timesPlayed > 0
    ? Math.round((holeHistory.reduce((s, hs) => s + hs.score, 0) / timesPlayed) * 10) / 10
    : null;
  const bestScore = timesPlayed > 0 ? Math.min(...holeHistory.map((hs) => hs.score)) : null;
  const avgToPar = timesPlayed > 0
    ? Math.round((holeHistory.reduce((s, hs) => s + hs.scoreToPar, 0) / timesPlayed) * 10) / 10
    : null;
  const birdiesOnHole = holeHistory.filter((hs) => hs.result === "birdie" || hs.result === "eagle-or-better").length;
  const parsOnHole = holeHistory.filter((hs) => hs.result === "par").length;

  const birdiedForChase = birdiesOnHole > 0;

  const scoredScores = draft.scores.slice(0, draft.currentHoleIndex).filter((s): s is number => s !== null);
  const parSoFar = playedHoles.slice(0, draft.currentHoleIndex).reduce((s, h) => s + h.par, 0);
  const toParSoFar = scoredScores.reduce((s, v) => s + v, 0) - parSoFar;

  const insight =
    timesPlayed === 0 ? "No history yet — first logged attempt."
    : birdiedForChase ? "You've birdied this before. Go get another!"
    : avgToPar !== null && avgToPar < -0.3 ? "Good birdie chance based on your history."
    : avgToPar !== null && avgToPar > 0.6 ? "This has been one of your tougher holes."
    : "You usually play this hole close to par.";

  const scoreToPar = holeScore - currentHole.par;
  const result = getResult(scoreToPar);
  const resultLabel: Record<string, string> = {
    "eagle-or-better": "Eagle+",
    "birdie": "Birdie",
    "par": "Par",
    "bogey": "Bogey",
    "double-or-worse": "Double+"
  };

  const isLastHole = draft.currentHoleIndex === draft.scores.length - 1;

  return (
    <section className="flex flex-col gap-3 pb-4">
      {/* Header */}
      <div className="flex items-start justify-between pt-1">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold">
            {course.name} · {roundTypeLabel(draft.roundType)}
          </p>
          <h2 className="mt-0.5 text-3xl font-bold text-white leading-none">
            Hole {currentHole.hole}
          </h2>
        </div>
        <button onClick={onBack}
          className="mt-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-slate-400 transition hover:text-white">
          ← Exit
        </button>
      </div>

      {/* Progress + par */}
      <div className={`${card} p-4`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Hole {draft.currentHoleIndex + 1} of {draft.scores.length}
            </p>
            <p className="mt-0.5 text-4xl font-bold text-white leading-none tabular-nums">
              Par {currentHole.par}
            </p>
          </div>
          <div className="text-right">
            {scoredScores.length > 0 ? (
              <>
                <p className={`text-3xl font-bold tabular-nums ${scoreToneClass(toParSoFar)}`}>
                  {formatScoreToPar(toParSoFar)}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">thru {scoredScores.length}</p>
              </>
            ) : (
              <p className="text-[11px] text-slate-600">Round starting</p>
            )}
          </div>
        </div>
      </div>

      {/* Chase 54 status */}
      <div className={`${card} flex items-center gap-3 px-4 py-3 ${
        birdiedForChase ? "border-fairway/20 bg-fairway/[0.06]" : ""
      }`}>
        <div className={`h-2 w-2 shrink-0 rounded-full ${birdiedForChase ? "bg-fairway" : "bg-slate-600"}`} />
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Chase 54</p>
          <p className={`text-sm font-semibold ${birdiedForChase ? "text-fairway" : "text-slate-300"}`}>
            {birdiedForChase ? "Birdied ✓" : "Still needed"}
          </p>
        </div>
      </div>

      {/* Hole stats */}
      <div className={`${card} p-4`}>
        <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Your History Here</p>
        {timesPlayed === 0 ? (
          <p className="text-[11px] italic text-slate-500">{insight}</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {([
                ["Times", timesPlayed],
                ["Avg", avgScore ?? "--"],
                ["Best", bestScore ?? "--"],
                ["Avg ±", avgToPar !== null ? formatScoreToPar(avgToPar) : "--"],
                ["Birdies", birdiesOnHole],
                ["Pars", parsOnHole],
              ] as [string, string | number][]).map(([l, v]) => (
                <div key={l} className="rounded-lg bg-ink/60 p-2 text-center">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-600">{l}</p>
                  <p className="mt-0.5 text-sm font-bold text-slate-300 tabular-nums">{v}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] italic text-slate-500">{insight}</p>
          </>
        )}
      </div>

      {/* Score entry */}
      <div className={`${card} p-5`}>
        <p className="mb-4 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">Your Score</p>
        <div className="flex items-center justify-center gap-8">
          <button
            onClick={() => setHoleScore((s) => Math.max(1, s - 1))}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.06] text-3xl font-light text-white transition hover:bg-white/[0.12] active:scale-95">
            −
          </button>
          <div className="text-center min-w-[80px]">
            <p className="text-8xl font-bold tabular-nums leading-none text-white">{holeScore}</p>
            <p className={`mt-3 text-xl font-bold ${scoreToneClass(scoreToPar)}`}>
              {resultLabel[result]}
            </p>
            <p className={`mt-0.5 text-sm font-semibold ${scoreToneClass(scoreToPar)}`}>
              {formatScoreToPar(scoreToPar)}
            </p>
          </div>
          <button
            onClick={() => setHoleScore((s) => Math.min(12, s + 1))}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.06] text-3xl font-light text-white transition hover:bg-white/[0.12] active:scale-95">
            +
          </button>
        </div>
      </div>

      <button
        onClick={() => onScore(holeScore)}
        className="w-full rounded-2xl bg-fairway py-4 text-base font-bold text-ink transition hover:bg-mint active:scale-[0.98]">
        {isLastHole ? "Finish Round →" : "Save & Next Hole →"}
      </button>
    </section>
  );
}

// ─── Play Finish Screen ───────────────────────────────────────────────────────
function PlayFinishScreen({ draft, isSaving, saveError, onSave, onBack }: {
  draft: LiveRoundDraft;
  isSaving: boolean;
  saveError?: string;
  onSave: () => void;
  onBack: () => void;
}) {
  const course = courseMap[draft.courseId];
  const playedHoles =
    draft.roundType === "back9" ? course.holes.slice(9)
    : draft.roundType === "front9" ? course.holes.slice(0, 9)
    : course.holes;

  const allScores = draft.scores as number[];
  const totalScore = allScores.reduce((s, v) => s + v, 0);
  const totalPar = playedHoles.reduce((s, h) => s + h.par, 0);
  const toParFinal = totalScore - totalPar;

  const resultsByHole = allScores.map((score, i) => getResult(score - playedHoles[i].par));
  const birdies = resultsByHole.filter((r) => r === "birdie" || r === "eagle-or-better").length;
  const pars = resultsByHole.filter((r) => r === "par").length;
  const bogeys = resultsByHole.filter((r) => r === "bogey").length;
  const doubles = resultsByHole.filter((r) => r === "double-or-worse").length;

  return (
    <section className="flex flex-col gap-3 pb-4">
      <div className="pt-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold">Round Complete</p>
        <h2 className="mt-0.5 text-2xl font-bold text-white">Round Summary</h2>
      </div>

      {/* Hero score */}
      <div className={`${card} p-5 text-center`}>
        <p className="text-[11px] text-slate-500">{course.name} · {roundTypeLabel(draft.roundType)}</p>
        <p className="mt-3 text-7xl font-bold tabular-nums text-white leading-none">{totalScore}</p>
        <p className={`mt-2 text-2xl font-bold tabular-nums ${scoreToneClass(toParFinal)}`}>
          {formatScoreToPar(toParFinal)}
        </p>
        <p className="mt-1 text-sm text-slate-500">on par {totalPar}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {([
          ["Holes", allScores.length],
          ["Total Par", totalPar],
          ["Birdies", birdies],
          ["Pars", pars],
          ["Bogeys", bogeys],
          ["Doubles+", doubles],
        ] as [string, number][]).map(([l, v]) => (
          <div key={l} className={`${card} p-4`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{l}</p>
            <p className={`mt-1.5 text-2xl font-bold tabular-nums ${
              l === "Birdies" && v > 0 ? "text-fairway" : "text-white"
            }`}>{v}</p>
          </div>
        ))}
      </div>

      {/* Hole-by-hole recap */}
      <div className={`${card} overflow-hidden`}>
        <p className="border-b border-white/[0.07] px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Hole by Hole
        </p>
        <div className="grid grid-cols-3 gap-px bg-white/[0.03] sm:grid-cols-6">
          {allScores.map((score, i) => {
            const hole = playedHoles[i];
            const stp = score - hole.par;
            const res = getResult(stp);
            const isBirdie = res === "birdie" || res === "eagle-or-better";
            return (
              <div key={hole.hole} className={`flex flex-col p-2.5 ${isBirdie ? "bg-fairway/[0.1]" : "bg-panel"}`}>
                <p className="text-[10px] font-bold text-slate-500">H{hole.hole}</p>
                <p className="text-xl font-bold text-white tabular-nums">{score}</p>
                <p className={`text-[9px] font-bold ${
                  isBirdie ? "text-fairway" :
                  res === "par" ? "text-slate-500" :
                  res === "bogey" ? "text-warning" : "text-danger"
                }`}>{formatScoreToPar(stp)}</p>
              </div>
            );
          })}
        </div>
      </div>

      {saveError && (
        <div className="rounded-xl border border-warning/25 bg-warning/10 px-4 py-3 text-[11px] text-warning">
          Saved locally — Supabase error: {saveError}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={onBack}
          className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 py-3 text-sm font-semibold text-slate-400 transition hover:text-white">
          ← Back
        </button>
        <button onClick={onSave} disabled={isSaving}
          className="flex-1 rounded-xl bg-fairway py-3 text-sm font-semibold text-ink transition hover:bg-mint disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500">
          {isSaving ? "Saving…" : "Save Round"}
        </button>
      </div>
    </section>
  );
}

// ─── Settings View ────────────────────────────────────────────────────────────
type ConfirmState = "idle" | "confirmClear" | "confirmReset";
type ImportStatus = "idle" | "success" | "error";

function SettingsView({ data, dataSource, onDataChange }: { data: GolfData; dataSource: DataSource; onDataChange: (d: GolfData) => void }) {
  const [confirm, setConfirm] = useState<ConfirmState>("idle");
  const [importStatus, setImportStatus] = useState<ImportStatus>("idle");
  const [connStatus, setConnStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [connMessage, setConnMessage] = useState("");
  const storageMode = getStorageMode();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleTestConnection = async () => {
    setConnStatus("testing");
    const result = await testSupabaseConnection();
    setConnStatus(result.ok ? "ok" : "error");
    setConnMessage(result.message);
  };

  const handleExportJson = () => {
    triggerDownload(exportAsJson(data), "chase54-data.json", "application/json");
  };

  const handleExportCsv = () => {
    triggerDownload(exportAsCsv(data), "chase54-rounds.csv", "text/csv");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const newData = localGolfRepository.importDataFromJson(ev.target?.result as string);
        onDataChange(newData);
        setImportStatus("success");
      } catch {
        setImportStatus("error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleClearAll = () => {
    onDataChange(localGolfRepository.clearAllData());
    setConfirm("idle");
  };

  const handleResetSample = () => {
    onDataChange(localGolfRepository.resetToSampleData());
    setConfirm("idle");
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="pt-1">
        <h2 className="text-xl font-bold text-white">Data Settings</h2>
        <p className="mt-0.5 text-sm text-slate-500">Storage, backup, and developer tools</p>
      </div>

      {/* Current storage */}
      <div className={`${card} p-4 sm:p-5`}>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-3">Current Storage</p>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
            <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-white text-sm">
              {storageMode === "supabase" ? "Supabase" : "Local browser storage"}
            </p>
            <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
              {storageMode === "supabase"
                ? "Rounds are synced to Supabase. Local storage is used as a fallback when offline."
                : "Your rounds are saved on this browser only. Export a backup before clearing browser data or switching browsers."}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-white/[0.06] bg-panelSoft p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Rounds</p>
                <p className="mt-1 text-2xl font-bold text-white tabular-nums">{data.rounds.length}</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-panelSoft p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Hole Scores</p>
                <p className="mt-1 text-2xl font-bold text-white tabular-nums">{data.holeScores.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Supabase connection */}
      <div className={`${card} p-4 sm:p-5`}>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3">Supabase Connection</p>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${
              storageMode === "supabase" ? "bg-fairway" : "bg-slate-600"
            }`} />
            <span className="text-sm text-slate-300">
              {storageMode === "supabase" ? "Supabase configured" : "Not configured — using local storage"}
            </span>
          </div>
          {connStatus !== "idle" && (
            <p className={`rounded-xl border px-3 py-2 text-[11px] font-medium ${
              connStatus === "ok"
                ? "border-fairway/20 bg-fairway/10 text-fairway"
                : connStatus === "error"
                ? "border-danger/20 bg-danger/10 text-danger"
                : "border-white/[0.08] bg-white/[0.04] text-slate-400"
            }`}>
              {connStatus === "testing" ? "Testing connection…" : connMessage}
            </p>
          )}
          <button
            onClick={handleTestConnection}
            disabled={connStatus === "testing"}
            className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-panelSoft px-4 py-3 text-sm font-semibold text-white transition hover:border-white/[0.18] disabled:opacity-50">
            <span>Test Supabase Connection</span>
            <span className="text-[11px] font-normal text-slate-500">
              {connStatus === "testing" ? "Checking…" : "Verify live access"}
            </span>
          </button>
          {storageMode !== "supabase" && (
            <p className="text-[11px] text-slate-600 leading-relaxed">
              To enable: add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local and restart the dev server.
            </p>
          )}
        </div>
      </div>

      {/* Backup & transfer */}
      <div className={`${card} p-4 sm:p-5`}>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3">Backup &amp; Transfer</p>
        <div className="flex flex-col gap-2">
          <button onClick={handleExportJson}
            className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-panelSoft px-4 py-3 text-sm font-semibold text-white transition hover:border-white/[0.18]">
            <span>Export as JSON</span>
            <span className="text-[11px] font-normal text-slate-500">Full backup · all data</span>
          </button>
          <button onClick={handleExportCsv}
            className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-panelSoft px-4 py-3 text-sm font-semibold text-white transition hover:border-white/[0.18]">
            <span>Export as CSV</span>
            <span className="text-[11px] font-normal text-slate-500">Rounds only · spreadsheet</span>
          </button>
          <button onClick={() => { setImportStatus("idle"); fileRef.current?.click(); }}
            className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-panelSoft px-4 py-3 text-sm font-semibold text-white transition hover:border-white/[0.18]">
            <span>Import from JSON</span>
            <span className="text-[11px] font-normal text-slate-500">Replaces all current data</span>
          </button>
          <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          {importStatus === "success" && (
            <p className="rounded-xl border border-fairway/20 bg-fairway/10 px-3 py-2 text-sm font-medium text-fairway">
              Data imported successfully.
            </p>
          )}
          {importStatus === "error" && (
            <p className="rounded-xl border border-danger/20 bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
              Invalid file. Please use a Chase 54 JSON export.
            </p>
          )}
        </div>
      </div>

      {/* Debug panel */}
      <div className={`${card} p-4 sm:p-5`}>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3">Debug</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([
            ["Mode", getStorageMode()],
            ["Source", dataSource],
            ["Rounds", data.rounds.length],
            ["Holes", data.holeScores.length],
          ] as [string, string | number][]).map(([l, v]) => (
            <div key={l} className="rounded-xl border border-white/[0.06] bg-panelSoft p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{l}</p>
              <p className="mt-1 text-sm font-bold text-white tabular-nums">{v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Developer tools */}
      <div className={`${card} p-4 sm:p-5`}>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3">Developer Tools</p>
        <div className="flex flex-col gap-2">
          {confirm === "confirmReset" ? (
            <div className="rounded-xl border border-warning/25 bg-warning/10 p-4">
              <p className="text-sm font-semibold text-white mb-1">Reset to 15 sample rounds?</p>
              <p className="text-[11px] text-slate-400 mb-3">Your current data will be replaced.</p>
              <div className="flex gap-2">
                <button onClick={handleResetSample}
                  className="flex-1 rounded-lg bg-warning py-2.5 text-sm font-semibold text-ink">
                  Yes, reset
                </button>
                <button onClick={() => setConfirm("idle")}
                  className="flex-1 rounded-lg border border-white/[0.08] bg-panelSoft py-2.5 text-sm font-semibold text-white">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirm("confirmReset")}
              className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-panelSoft px-4 py-3 text-sm font-semibold text-white transition hover:border-white/[0.18]">
              <span>Reset to Sample Data</span>
              <span className="text-[11px] font-normal text-slate-500">Loads 15 seed rounds</span>
            </button>
          )}

          {confirm === "confirmClear" ? (
            <div className="rounded-xl border border-danger/25 bg-danger/10 p-4">
              <p className="text-sm font-semibold text-white mb-1">Delete all data permanently?</p>
              <p className="text-[11px] text-slate-400 mb-3">This cannot be undone. Export first to be safe.</p>
              <div className="flex gap-2">
                <button onClick={handleClearAll}
                  className="flex-1 rounded-lg bg-danger py-2.5 text-sm font-semibold text-white">
                  Delete everything
                </button>
                <button onClick={() => setConfirm("idle")}
                  className="flex-1 rounded-lg border border-white/[0.08] bg-panelSoft py-2.5 text-sm font-semibold text-white">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirm("confirmClear")}
              className="flex items-center justify-between rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm font-semibold text-danger transition hover:border-danger/35">
              <span>Clear All Data</span>
              <span className="text-[11px] font-normal text-danger/50">Cannot be undone</span>
            </button>
          )}
        </div>
      </div>

      <p className="py-1 text-center text-[10px] text-slate-700">Powered by Birdie Board</p>
    </section>
  );
}
