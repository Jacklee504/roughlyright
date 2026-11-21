import type { Metadata } from "next";
import ScaleRunGame from "@/components/ScaleRunGame";
import { decodeScaleCourse } from "@/lib/domain/scale-run";

export const metadata: Metadata = {
  title: "Scale Run",
  description: "Seven quick questions about the size of things. Find the closest power of ten, build a combo, and challenge a friend.",
  alternates: { canonical: "/estimation/scale-run" },
  openGraph: {
    title: "Scale Run · Roughly Right",
    description: "How well do you know the size of things? Seven questions, five choices each.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Scale Run · Roughly Right",
    description: "Seven quick questions about the size of things.",
  },
};

export default async function ScaleRunPage({ searchParams }: {
  searchParams: Promise<{ course?: string | string[] }>;
}) {
  const { course } = await searchParams;
  const challenge = typeof course === "string" ? decodeScaleCourse(course) : null;
  return <ScaleRunGame challenge={challenge} invalidChallenge={course !== undefined && !challenge} />;
}
