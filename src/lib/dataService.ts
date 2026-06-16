"use client";

import type { GolfData, HoleScore, Round } from "./types";
import { courseMap } from "./courses";
import { localGolfRepository } from "./storage";
import { isSupabaseConfigured } from "./supabaseClient";
import {
  testSupabaseConnection,
  seedCoursesIfNeeded,
  getRounds,
  getHoleScores,
  saveRoundWithHoleScores,
} from "./supabaseService";

export { testSupabaseConnection };

export type DataSource = "supabase" | "localStorage" | "sample";

let _lastDataSource: DataSource = "localStorage";

export const getStorageMode = (): "supabase" | "localStorage" =>
  isSupabaseConfigured() ? "supabase" : "localStorage";

export const getLastDataSource = (): DataSource => _lastDataSource;

export const load = async (): Promise<GolfData> => {
  if (isSupabaseConfigured()) {
    try {
      await seedCoursesIfNeeded();
      const [rounds, holeScores] = await Promise.all([getRounds(), getHoleScores()]);
      // Always return Supabase data when configured — even if empty.
      // Never fall through to localStorage when Supabase is connected.
      _lastDataSource = "supabase";
      return { rounds, holeScores };
    } catch (err) {
      console.warn("Supabase load failed, falling back to localStorage:", err);
    }
  }
  const data = localGolfRepository.load();
  // Detect sample data: localStorage seeds sample data when nothing is stored.
  // We track this by checking if the key existed before load() wrote to it.
  const hasRealData =
    typeof window !== "undefined" &&
    window.localStorage.getItem("jp-golf-dashboard-data-real") === "1";
  _lastDataSource = hasRealData ? "localStorage" : "sample";
  return data;
};

export const saveRound = async (
  round: Round,
  holeScores: HoleScore[]
): Promise<{ data: GolfData; savedTo: DataSource; error?: string }> => {
  if (isSupabaseConfigured()) {
    try {
      const data = await saveRoundWithHoleScores(round, holeScores);
      // Mark that we have real data in localStorage too (for fallback detection)
      if (typeof window !== "undefined") {
        window.localStorage.setItem("jp-golf-dashboard-data-real", "1");
      }
      return { data, savedTo: "supabase" };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn("Supabase save failed:", errMsg);
      return {
        data: await _localSave(round, holeScores),
        savedTo: "localStorage",
        error: `Supabase error: ${errMsg}`
      };
    }
  }
  return { data: await _localSave(round, holeScores), savedTo: "localStorage" };
};

async function _localSave(round: Round, holeScores: HoleScore[]): Promise<GolfData> {
  const data = localGolfRepository.saveRound(round, holeScores);
  if (typeof window !== "undefined") {
    window.localStorage.setItem("jp-golf-dashboard-data-real", "1");
  }
  return data;
}

const csvEscape = (v: string | number | undefined): string => {
  const s = String(v ?? "");
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"` : s;
};

export const exportAsJson = (data: GolfData): string => JSON.stringify(data, null, 2);

export const exportAsCsv = (data: GolfData): string => {
  const headers = [
    "Date", "Course", "Round Type", "Holes Played", "Total Score", "Par", "Score to Par",
    "Front 9", "Back 9", "Notes",
  ];
  const rows = data.rounds.map((r) =>
    [
      r.date,
      courseMap[r.courseId]?.name ?? r.courseId,
      r.roundType ?? "18",
      r.holesPlayed ?? 18,
      r.totalScore,
      r.totalPar,
      r.scoreToPar,
      r.frontNineScore ?? "",
      r.backNineScore ?? "",
      r.notes ?? "",
    ].map(csvEscape)
  );
  return [headers, ...rows].map((row) => row.join(",")).join("\n");
};
