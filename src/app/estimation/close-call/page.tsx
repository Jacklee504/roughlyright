import type { Metadata } from "next";
import Link from "next/link";
import CloseCall from "@/components/CloseCall";
import styles from "@/components/CloseCall.module.css";
import { decodeEpisode } from "@/lib/domain/close-call";

export const metadata: Metadata = {
  title: "Close Call",
  description: "Make the better guess and beat the House in five rounds of real-world estimation.",
  alternates: { canonical: "/estimation/close-call" },
  openGraph: {
    title: "Close Call · Roughly Right",
    description: "Take on the same questions and computer opponent in this estimation game show.",
  },
};

export default async function CloseCallPage({ searchParams }: { searchParams: Promise<{ episode?: string | string[]; target?: string | string[] }> }) {
  const { episode, target } = await searchParams;
  const challenge = typeof episode === "string" ? decodeEpisode(episode) : null;
  const score = challenge && typeof target === "string" && /^\d{1,3}$/.test(target) && Number(target) <= 600 ? Number(target) : undefined;
  return (
    <main className={styles.page}>
      <CloseCall key={challenge?.code ?? "open"} challenge={challenge ?? undefined} challengedScore={score} invalid={episode !== undefined && challenge === null} />
      <p className={styles.modeSection}><Link href="/" className={styles.returnHome}>More ways to play <span aria-hidden="true">↗</span></Link></p>
    </main>
  );
}
