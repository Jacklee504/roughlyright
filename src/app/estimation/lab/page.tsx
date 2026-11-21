import type { Metadata } from "next";
import EstimationLab from "@/components/EstimationLab";
import { LAB_CASES } from "@/lib/domain/estimation-lab";

export const metadata: Metadata = {
  title: "Estimation Lab",
  description: "Solve a big question with three small guesses. Test your model and find the estimate that threw it off.",
  alternates: { canonical: "/estimation/lab" },
};

export default async function LabPage({ searchParams }: { searchParams: Promise<{ case?: string | string[] }> }) {
  const { case: id } = await searchParams;
  const current = LAB_CASES.find((labCase) => labCase.id === id);
  return <EstimationLab key={current?.id ?? "case-board"} labCase={current} />;
}
