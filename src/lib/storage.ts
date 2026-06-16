"use client";

import type { GolfData, HoleScore, Round } from "./types";
import { courseMap } from "./courses";
import { sampleData } from "./sampleData";

const STORAGE_KEY = "jp-golf-dashboard-data";

export type GolfRepository = {
  load: () => GolfData;
  getRounds: () => Round[];
  getHoleScores: () => HoleScore[];
  saveRound: (round: Round, holeScores: HoleScore[]) => GolfData;
  exportDataAsJson: () => string;
  exportDataAsCsv: () => string;
  importDataFromJson: (json: string) => GolfData;
  clearAllData: () => GolfData;
  resetToSampleData: () => GolfData;
};

const cloneData = (data: GolfData): GolfData => ({
  rounds: [...data.rounds],
  holeScores: [...data.holeScores]
});

const isGolfData = (value: unknown): value is GolfData => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GolfData>;
  return Array.isArray(candidate.rounds) && Array.isArray(candidate.holeScores);
};

const csvEscape = (v: string | number | undefined): string => {
  const s = String(v ?? "");
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
};

export const localGolfRepository: GolfRepository = {
  load: () => {
    if (typeof window === "undefined") return cloneData(sampleData);

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleData));
      return cloneData(sampleData);
    }

    try {
      const parsed = JSON.parse(stored) as unknown;
      if (isGolfData(parsed)) {
        // Normalize legacy "full18" roundType values to "18"
        for (const r of parsed.rounds) {
          if ((r as { roundType?: string }).roundType === "full18") {
            (r as { roundType: string }).roundType = "18";
          }
        }
        return parsed;
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleData));
      return cloneData(sampleData);
    } catch {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleData));
      return cloneData(sampleData);
    }
  },

  getRounds: () => localGolfRepository.load().rounds,

  getHoleScores: () => localGolfRepository.load().holeScores,

  saveRound: (round, holeScores) => {
    const current = localGolfRepository.load();
    const next: GolfData = {
      rounds: [...current.rounds, round],
      holeScores: [...current.holeScores, ...holeScores]
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  },

  exportDataAsJson: () => JSON.stringify(localGolfRepository.load(), null, 2),

  exportDataAsCsv: () => {
    const data = localGolfRepository.load();
    const headers = [
      "Date", "Course", "Round Type", "Total Score", "Par", "Score to Par",
      "Front 9", "Back 9", "Notes"
    ];
    const rows = data.rounds.map((r) =>
      [
        r.date,
        courseMap[r.courseId].name,
        r.roundType ?? "full18",
        r.totalScore,
        r.totalPar,
        r.scoreToPar,
        r.frontNineScore ?? "",
        r.backNineScore ?? "",
        r.notes ?? ""
      ].map(csvEscape)
    );
    return [headers, ...rows].map((row) => row.join(",")).join("\n");
  },

  importDataFromJson: (json: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error("Invalid JSON");
    }
    if (!isGolfData(parsed)) throw new Error("Invalid Chase 54 data format");
    window.localStorage.setItem(STORAGE_KEY, json);
    return parsed;
  },

  clearAllData: () => {
    const empty: GolfData = { rounds: [], holeScores: [] };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(empty));
    return empty;
  },

  resetToSampleData: () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleData));
    return cloneData(sampleData);
  }
};
