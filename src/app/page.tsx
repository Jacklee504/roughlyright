import Link from "next/link";
import CloseCall from "@/components/CloseCall";
import styles from "@/components/CloseCall.module.css";
import { SIBLING_GAMES } from "@/lib/site";

const modes = [
  { href: "/estimation", label: "Daily puzzle" },
  { href: "/estimation/scale-run", label: "Scale Run" },
  { href: "/estimation/lab", label: "Estimation Lab" },
  { href: "/estimation/warm-up", label: "Warm-up" },
  { href: "/estimation/archive", label: "Puzzle archive" },
  { href: "/estimation/insights", label: "My insights" },
];

export default function LandingPage() {
  return (
    <main className={styles.page}>
      <CloseCall />
      <section className={styles.modeSection} aria-labelledby="other-games">
        <h2 id="other-games">More ways to play</h2>
        <ul className={styles.modes}>
          {modes.map(({ href, label }) => (
            <li key={href}><Link href={href}>{label}<span aria-hidden="true">↗</span></Link></li>
          ))}
        </ul>
      </section>
      {SIBLING_GAMES.length ? (
        <p className={styles.modeSection}>
          {SIBLING_GAMES.map((game) => <a className={styles.returnHome} key={game.url} href={game.url}>{game.name} · {game.blurb}</a>)}
        </p>
      ) : null}
    </main>
  );
}
