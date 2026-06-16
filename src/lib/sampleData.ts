import type { CourseId, GolfData } from "./types";
import { createRoundRecord } from "./scoring";

const seedRounds: {
  id: string;
  date: string;
  courseId: CourseId;
  scores: number[];
  notes?: string;
}[] = [
  {
    id: "seed-highlands-1",
    date: "2026-02-22",
    courseId: "highlands",
    scores: [5, 4, 3, 6, 4, 3, 5, 4, 5, 4, 5, 3, 6, 4, 4, 5, 3, 5],
    notes: "Steady opener with clean wedges late."
  },
  {
    id: "seed-highlands-2",
    date: "2026-03-08",
    courseId: "highlands",
    scores: [4, 5, 3, 5, 4, 4, 5, 4, 6, 4, 4, 3, 5, 5, 4, 6, 3, 4]
  },
  {
    id: "seed-highlands-3",
    date: "2026-03-28",
    courseId: "highlands",
    scores: [4, 5, 2, 6, 5, 3, 4, 4, 5, 5, 4, 3, 6, 5, 5, 5, 3, 4]
  },
  {
    id: "seed-highlands-4",
    date: "2026-04-19",
    courseId: "highlands",
    scores: [5, 5, 4, 6, 5, 3, 5, 4, 6, 5, 4, 4, 7, 5, 5, 6, 4, 5]
  },
  {
    id: "seed-highlands-5",
    date: "2026-05-10",
    courseId: "highlands",
    scores: [4, 5, 3, 5, 3, 4, 5, 5, 5, 4, 5, 2, 6, 5, 4, 5, 4, 4]
  },
  {
    id: "seed-meadows-1",
    date: "2026-02-28",
    courseId: "meadows",
    scores: [4, 3, 6, 4, 5, 5, 3, 5, 4, 3, 5, 5, 4, 4, 5, 4, 6, 5]
  },
  {
    id: "seed-meadows-2",
    date: "2026-03-15",
    courseId: "meadows",
    scores: [5, 4, 5, 5, 6, 4, 3, 4, 5, 3, 4, 6, 5, 3, 4, 5, 5, 4]
  },
  {
    id: "seed-meadows-3",
    date: "2026-04-05",
    courseId: "meadows",
    scores: [4, 3, 5, 4, 4, 5, 4, 4, 5, 3, 5, 5, 5, 3, 5, 4, 6, 4]
  },
  {
    id: "seed-meadows-4",
    date: "2026-04-26",
    courseId: "meadows",
    scores: [5, 4, 6, 5, 6, 5, 4, 5, 5, 4, 5, 7, 5, 4, 5, 5, 6, 5]
  },
  {
    id: "seed-meadows-5",
    date: "2026-05-17",
    courseId: "meadows",
    scores: [4, 4, 5, 5, 5, 4, 2, 5, 4, 3, 5, 5, 5, 3, 4, 5, 5, 5]
  },
  {
    id: "seed-fairways-1",
    date: "2026-03-01",
    courseId: "fairways",
    scores: [4, 4, 5, 5, 3, 5, 3, 4, 5, 5, 5, 3, 6, 5, 3, 5, 4, 4]
  },
  {
    id: "seed-fairways-2",
    date: "2026-03-22",
    courseId: "fairways",
    scores: [5, 3, 6, 5, 4, 4, 4, 5, 4, 6, 4, 3, 5, 5, 4, 4, 5, 4]
  },
  {
    id: "seed-fairways-3",
    date: "2026-04-12",
    courseId: "fairways",
    scores: [4, 4, 5, 5, 3, 5, 2, 5, 4, 5, 4, 4, 6, 5, 3, 5, 4, 5]
  },
  {
    id: "seed-fairways-4",
    date: "2026-05-03",
    courseId: "fairways",
    scores: [5, 4, 6, 5, 4, 5, 4, 5, 5, 6, 5, 4, 6, 5, 4, 5, 5, 5]
  },
  {
    id: "seed-fairways-5",
    date: "2026-05-31",
    courseId: "fairways",
    scores: [5, 3, 4, 5, 4, 5, 3, 5, 4, 6, 5, 3, 5, 5, 3, 5, 5, 5]
  }
];

export const sampleData: GolfData = seedRounds.reduce<GolfData>(
  (data, seed) => {
    const record = createRoundRecord(seed);
    data.rounds.push(record.round);
    data.holeScores.push(...record.holeScores);
    return data;
  },
  { rounds: [], holeScores: [] }
);
