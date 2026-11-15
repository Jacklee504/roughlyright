import { setClock } from "@/lib/domain/clock";

// Deterministic clock for all tests. 2026-11-15 is "today" in tests.
setClock(new Date("2026-11-15T12:00:00Z"));
