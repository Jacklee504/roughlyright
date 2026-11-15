import type { Metadata } from "next";
import EstimationGame from "@/components/EstimationGame";

export const metadata: Metadata = {
  title: "Estimation — today's daily",
};

export default function EstimationPage() {
  return <EstimationGame mode="daily" />;
}
