import type { Metadata } from "next";
import WarmupGame from "@/components/WarmupGame";

export const metadata: Metadata = {
  title: "Warm-up",
  description: "Play a fresh, untimed set of five estimation questions.",
};

export default function WarmupPage() {
  return <WarmupGame />;
}
