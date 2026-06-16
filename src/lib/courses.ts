import type { Course, CourseId } from "./types";

const buildCourse = (id: CourseId, name: string, pars: number[]): Course => ({
  id,
  name,
  totalPar: pars.reduce((sum, par) => sum + par, 0),
  holes: pars.map((par, index) => ({ hole: index + 1, par }))
});

export const courses: Course[] = [
  buildCourse("highlands", "Highlands", [
    4, 4, 3, 5, 4, 3, 4, 4, 5, 4, 4, 3, 5, 4, 4, 5, 3, 4
  ]),
  buildCourse("meadows", "Meadows", [
    4, 3, 5, 4, 5, 4, 3, 4, 4, 3, 4, 5, 4, 3, 4, 4, 5, 4
  ]),
  buildCourse("fairways", "Fairways", [
    4, 3, 5, 4, 3, 4, 3, 4, 4, 5, 4, 3, 5, 4, 3, 4, 4, 4
  ])
];

export const courseMap = Object.fromEntries(
  courses.map((course) => [course.id, course])
) as Record<CourseId, Course>;
