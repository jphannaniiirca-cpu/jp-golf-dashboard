import { courses, courseMap } from "./courses";
import type { CourseFilter, CourseId, GolfData, HoleScore, Round, RoundType } from "./types";

const roundDateAsc = (a: Round, b: Round) =>
  new Date(a.date).getTime() - new Date(b.date).getTime();

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const roundToTenth = (value: number) => Math.round(value * 10) / 10;

export const formatScoreToPar = (value: number) => {
  if (value === 0) return "E";
  return value > 0 ? `+${roundToTenth(value)}` : `${roundToTenth(value)}`;
};

export const filterRounds = (rounds: Round[], filter: CourseFilter) =>
  filter === "all" ? rounds : rounds.filter((round) => round.courseId === filter);

export const getDashboardStats = (data: GolfData, filter: CourseFilter) => {
  const rounds = [...filterRounds(data.rounds, filter)].sort(roundDateAsc);
  const lastFive = rounds.slice(-5);
  const previousFive = rounds.slice(-10, -5);
  const recentAverage = average(lastFive.map((r) => r.scoreToPar));
  const previousAverage = average(previousFive.map((r) => r.scoreToPar));
  const trend = previousFive.length ? previousAverage - recentAverage : 0;

  const birdies = data.holeScores.filter(
    (score) =>
      (filter === "all" || score.courseId === filter) &&
      (score.result === "birdie" || score.result === "eagle-or-better")
  ).length;

  const full18 = rounds.filter((r) => {
    const rt = r.roundType ?? "18";
    return rt === "18" || rt === ("full18" as string);
  });
  const nineHole = rounds.filter((r) => r.roundType === "front9" || r.roundType === "back9");

  const totalHolesPlayed = data.holeScores.filter(
    (hs) => filter === "all" || hs.courseId === filter
  ).length;

  return {
    rounds,
    averageToPar: roundToTenth(average(rounds.map((r) => r.scoreToPar))),
    averageToPar18: full18.length ? roundToTenth(average(full18.map((r) => r.scoreToPar))) : null,
    averageToPar9: nineHole.length ? roundToTenth(average(nineHole.map((r) => r.scoreToPar))) : null,
    best18: full18.length ? full18.reduce((b, r) => r.totalScore < b.totalScore ? r : b) : null,
    best9: nineHole.length ? nineHole.reduce((b, r) => r.totalScore < b.totalScore ? r : b) : null,
    latestRound: rounds.length ? rounds[rounds.length - 1] : null,
    totalRounds: rounds.length,
    totalBirdies: birdies,
    totalHolesPlayed,
    recentTrend: roundToTenth(trend),
    trendDirection: trend > 0.2 ? "improving" : trend < -0.2 ? "slipping" : "steady"
  };
};

export const getChartData = (rounds: Round[]) =>
  [...rounds].sort(roundDateAsc).map((round) => {
    const rt = (round.roundType ?? "18") as RoundType;
    return {
      id: round.id,
      rawDate: round.date,
      date: new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
        new Date(`${round.date}T12:00:00`)
      ),
      score: round.totalScore,
      par: round.totalPar,
      toPar: round.scoreToPar,
      course: courseMap[round.courseId].name,
      roundType: rt,
      holesPlayed: round.holesPlayed ?? (rt === "18" ? 18 : 9),
    };
  });

export const getRecentRounds = (rounds: Round[], count = 5) =>
  [...rounds].sort(roundDateAsc).slice(-count).reverse();

export const getCourseAnalytics = (data: GolfData) =>
  courses.map((course) => {
    const rounds = data.rounds.filter((round) => round.courseId === course.id);
    const scores = rounds.map((round) => round.totalScore);
    const courseHoleScores = data.holeScores.filter((score) => score.courseId === course.id);
    const birdies = courseHoleScores.filter(
      (score) => score.result === "birdie" || score.result === "eagle-or-better"
    ).length;
    const holeAverages = course.holes.map((hole) => {
      const scoresForHole = courseHoleScores.filter((score) => score.hole === hole.hole);
      return {
        hole: hole.hole,
        averageToPar: scoresForHole.length
          ? average(scoresForHole.map((score) => score.scoreToPar))
          : null
      };
    });

    const playedHoles = holeAverages.filter(
      (hole): hole is { hole: number; averageToPar: number } => hole.averageToPar !== null
    );
    const hardest = [...playedHoles].sort((a, b) => b.averageToPar - a.averageToPar)[0] ?? null;
    const easiest = [...playedHoles].sort((a, b) => a.averageToPar - b.averageToPar)[0] ?? null;

    return {
      course,
      totalRounds: rounds.length,
      averageToPar: roundToTenth(average(rounds.map((round) => round.scoreToPar))),
      bestToPar: rounds.length ? Math.min(...rounds.map((r) => r.scoreToPar)) : 0,
      worstRound: scores.length ? Math.max(...scores) : 0,
      totalBirdies: birdies,
      birdiesPerRound: roundToTenth(rounds.length ? birdies / rounds.length : 0),
      hardestHole: hardest,
      easiestHole: easiest
    };
  });

export const getBirdieTracker = (data: GolfData, courseId: CourseId) => {
  const course = courseMap[courseId];
  const courseHoleScores = data.holeScores.filter((score) => score.courseId === courseId);

  return course.holes.map((hole) => {
    const scores = courseHoleScores.filter((score) => score.hole === hole.hole);
    const bestScore = scores.length ? Math.min(...scores.map((score) => score.score)) : null;
    const completed = scores.some(
      (score) => score.result === "birdie" || score.result === "eagle-or-better"
    );

    return {
      ...hole,
      bestScore,
      completed
    };
  });
};

const countResult = (scores: HoleScore[], result: HoleScore["result"]) =>
  scores.filter((score) => score.result === result).length;

export const getHoleAnalytics = (data: GolfData) =>
  courses.flatMap((course) =>
    course.holes.map((hole) => {
      const scores = data.holeScores.filter(
        (score) => score.courseId === course.id && score.hole === hole.hole
      );
      const scoreValues = scores.map((score) => score.score);
      const birdieCount = scores.filter(
        (score) => score.result === "birdie" || score.result === "eagle-or-better"
      ).length;

      return {
        course,
        hole: hole.hole,
        par: hole.par,
        averageScore: scoreValues.length ? roundToTenth(average(scoreValues)) : null,
        averageToPar: scores.length
          ? roundToTenth(average(scores.map((score) => score.scoreToPar)))
          : null,
        bestScore: scoreValues.length ? Math.min(...scoreValues) : null,
        worstScore: scoreValues.length ? Math.max(...scoreValues) : null,
        birdied: birdieCount > 0,
        birdieCount,
        parCount: countResult(scores, "par"),
        bogeyCount: countResult(scores, "bogey"),
        doubleOrWorseCount: countResult(scores, "double-or-worse")
      };
    })
  );
