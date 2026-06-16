"use client";

import type { CourseId, GolfData, HoleScore, Result, Round, RoundType } from "./types";
import { courses } from "./courses";
import { getSupabaseClient } from "./supabaseClient";

// ── DB row shapes ─────────────────────────────────────────────────────────────
type RoundRow = {
  id: string;
  date: string;
  course_id: string;
  round_type: string | null;
  holes_played: number | null;
  total_score: number;
  total_par: number;
  score_to_par: number;
  front_nine_score: number | null;
  back_nine_score: number | null;
  notes: string | null;
};

type HoleScoreRow = {
  id: string;
  round_id: string;
  course_id: string;
  hole: number;
  par: number;
  score: number;
  score_to_par: number;
  result: string;
};

// ── Mappers ───────────────────────────────────────────────────────────────────
const normalizeRoundType = (rt: string | null | undefined): RoundType => {
  if (rt === "front9") return "front9";
  if (rt === "back9") return "back9";
  return "18"; // handles null, "full18", "18", and anything else
};

const rowToRound = (r: RoundRow): Round => ({
  id: r.id,
  date: r.date,
  courseId: r.course_id as CourseId,
  roundType: normalizeRoundType(r.round_type),
  holesPlayed: r.holes_played ?? (r.round_type === "front9" || r.round_type === "back9" ? 9 : 18),
  totalScore: r.total_score,
  totalPar: r.total_par,
  scoreToPar: r.score_to_par,
  frontNineScore: r.front_nine_score ?? undefined,
  backNineScore: r.back_nine_score ?? undefined,
  notes: r.notes ?? undefined,
});

const roundToRow = (r: Round): RoundRow => ({
  id: r.id,
  date: r.date,
  course_id: r.courseId,
  round_type: r.roundType ?? "18",
  holes_played: r.holesPlayed ?? (r.roundType === "front9" || r.roundType === "back9" ? 9 : 18),
  total_score: r.totalScore,
  total_par: r.totalPar,
  score_to_par: r.scoreToPar,
  front_nine_score: r.frontNineScore ?? null,
  back_nine_score: r.backNineScore ?? null,
  notes: r.notes ?? null,
});

const rowToHoleScore = (r: HoleScoreRow): HoleScore => ({
  id: r.id,
  roundId: r.round_id,
  courseId: r.course_id as CourseId,
  hole: r.hole,
  par: r.par,
  score: r.score,
  scoreToPar: r.score_to_par,
  result: r.result as Result,
});

// ── Public operations ─────────────────────────────────────────────────────────

export async function testSupabaseConnection(): Promise<{ ok: boolean; message: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, message: "Not configured — add env vars to .env.local" };
  }
  try {
    const { error } = await client.from("rounds").select("id", { count: "exact", head: true });
    if (error) throw error;
    return { ok: true, message: "Connected successfully" };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

export async function seedCoursesIfNeeded(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  const { data, error } = await client.from("courses").select("id").limit(1);
  if (error || (data && data.length > 0)) return;

  await client.from("courses").upsert(
    courses.map((c) => ({ id: c.id, name: c.name, total_par: c.totalPar })),
    { onConflict: "id" }
  );

  await client.from("course_holes").upsert(
    courses.flatMap((c) =>
      c.holes.map((h) => ({ course_id: c.id, hole: h.hole, par: h.par }))
    ),
    { onConflict: "course_id,hole" }
  );
}

export async function getRounds(): Promise<Round[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client
    .from("rounds")
    .select("*")
    .order("date", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as RoundRow[]).map(rowToRound);
}

export async function getHoleScores(): Promise<HoleScore[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from("hole_scores").select("*");
  if (error) throw error;
  return ((data ?? []) as HoleScoreRow[]).map(rowToHoleScore);
}

export async function saveRoundWithHoleScores(
  round: Round,
  holeScores: HoleScore[]
): Promise<GolfData> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase not configured");

  const { error: rErr } = await client
    .from("rounds")
    .upsert(roundToRow(round), { onConflict: "id" });
  if (rErr) throw rErr;

  // Delete + re-insert hole scores for idempotency
  await client.from("hole_scores").delete().eq("round_id", round.id);
  const { error: hErr } = await client.from("hole_scores").insert(
    holeScores.map((hs) => ({
      round_id: hs.roundId,
      course_id: hs.courseId,
      hole: hs.hole,
      par: hs.par,
      score: hs.score,
      score_to_par: hs.scoreToPar,
      result: hs.result,
    }))
  );
  if (hErr) throw hErr;

  const [rounds, hs] = await Promise.all([getRounds(), getHoleScores()]);
  return { rounds, holeScores: hs };
}
