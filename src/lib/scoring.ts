import type { CourseId, HoleScore, Result, Round, RoundType } from "./types";
import { courseMap } from "./courses";

export const getResult = (scoreToPar: number): Result => {
  if (scoreToPar <= -2) return "eagle-or-better";
  if (scoreToPar === -1) return "birdie";
  if (scoreToPar === 0) return "par";
  if (scoreToPar === 1) return "bogey";
  return "double-or-worse";
};

export const createRoundRecord = ({
  id,
  date,
  courseId,
  roundType = "18",
  scores,
  notes
}: {
  id: string;
  date: string;
  courseId: CourseId;
  roundType?: RoundType;
  scores: number[];
  notes?: string;
}): { round: Round; holeScores: HoleScore[] } => {
  const course = courseMap[courseId];

  const playedHoles =
    roundType === "back9"
      ? course.holes.slice(9)
      : roundType === "front9"
        ? course.holes.slice(0, 9)
        : course.holes;

  const totalScore = scores.reduce((sum, score) => sum + score, 0);
  const totalPar = playedHoles.reduce((sum, h) => sum + h.par, 0);

  const round: Round = {
    id,
    date,
    courseId,
    roundType,
    holesPlayed: playedHoles.length,
    totalScore,
    totalPar,
    scoreToPar: totalScore - totalPar,
    notes
  };

  if (roundType === "18") {
    round.frontNineScore = scores.slice(0, 9).reduce((s, v) => s + v, 0);
    round.backNineScore = scores.slice(9).reduce((s, v) => s + v, 0);
  } else if (roundType === "front9") {
    round.frontNineScore = totalScore;
  } else {
    round.backNineScore = totalScore;
  }

  const holeScores: HoleScore[] = scores.map((score, index) => {
    const hole = playedHoles[index];
    const scoreToPar = score - hole.par;
    return {
      id: `${id}-${hole.hole}`,
      roundId: id,
      courseId,
      hole: hole.hole,
      par: hole.par,
      score,
      scoreToPar,
      result: getResult(scoreToPar)
    };
  });

  return { round, holeScores };
};
