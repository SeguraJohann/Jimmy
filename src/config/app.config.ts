import type { BlockType, ColorKey } from "@/types/models";

// Single point of configuration for this instance.
export const APP_CONFIG = {
  appName: "Jimmy",
  locale: "es-CR",

  /** Weight step for the −/+ buttons (kg). */
  weightStep: 2.5,
  /** Epley 1RM is only computed for sets with at most this many reps. */
  maxRepsFor1RM: 12,

  analytics: {
    /** Trend window: last N sessions within this many days. */
    trendMaxSessions: 6,
    trendWindowDays: 120,
    trendMinSessions: 3,
    /** No session in this many days → "inactive". */
    inactiveAfterDays: 35,
    /** % change per 4 weeks that counts as progress / decline. */
    strengthThreshold: 1.5,
    volumeThreshold: 5,
    /** Sessions without a record that reinforce a "stalled" warning. */
    stalledSessions: 5,
    /** Charts aggregate by week past this many points. */
    maxChartPoints: 60,
    movingAverage: 3,
    historyPageSize: 10,
    recentRecordsDays: 30,
    recentRecordsMax: 8,
  },

  colors: ["amber", "blue", "coral", "violet", "green", "teal", "pink", "slate"] as ColorKey[],

  defaults: {
    muscleGroups: ["Espalda", "Pecho", "Pierna", "Hombro", "Brazo", "Core"],
    blockTypes: [
      { id: "pull", name: "Pull", color: "amber" },
      { id: "leg", name: "Leg", color: "blue" },
      { id: "push", name: "Push", color: "coral" },
      { id: "full", name: "Full body", color: "violet" },
    ] as BlockType[],
  },
} as const;
