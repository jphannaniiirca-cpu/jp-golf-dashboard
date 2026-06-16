export type CourseId = "highlands" | "meadows" | "fairways";

export type RoundType = "18" | "front9" | "back9";

export type Result =
  | "eagle-or-better"
  | "birdie"
  | "par"
  | "bogey"
  | "double-or-worse";

export type Course = {
  id: CourseId;
  name: string;
  totalPar: number;
  holes: { hole: number; par: number }[];
};

export type Round = {
  id: string;
  date: string;
  courseId: CourseId;
  roundType?: RoundType;
  holesPlayed?: number;
  totalScore: number;
  totalPar: number;
  scoreToPar: number;
  frontNineScore?: number;
  backNineScore?: number;
  notes?: string;
};

export type HoleScore = {
  id: string;
  roundId: string;
  courseId: CourseId;
  hole: number;
  par: number;
  score: number;
  scoreToPar: number;
  result: Result;
};

export type GolfData = {
  rounds: Round[];
  holeScores: HoleScore[];
};

export type CourseFilter = CourseId | "all";
