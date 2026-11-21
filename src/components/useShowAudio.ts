"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Note = readonly [frequency: number, start: number, duration: number, shape?: OscillatorType];

// Bright, syncopated stings mark decisions and reveals in the show.
const CUES = {
  start: [[293.66, 0, 0.09], [392, 0.11, 0.09], [493.88, 0.18, 0.09], [587.33, 0.27, 0.25]],
  lock: [[196, 0, 0.065, "triangle"], [392, 0.055, 0.09]],
  hit: [[523.25, 0, 0.09], [783.99, 0.075, 0.2]],
  miss: [[261.63, 0, 0.11, "triangle"], [185, 0.12, 0.18, "triangle"]],
  turn: [[293.66, 0, 0.075], [440, 0.09, 0.075], [587.33, 0.18, 0.14]],
  win: [[349.23, 0, 0.12], [440, 0.12, 0.12], [523.25, 0.24, 0.12], [698.46, 0.36, 0.34], [523.25, 0.36, 0.32, "triangle"]],
  loss: [[392, 0, 0.11, "triangle"], [329.63, 0.13, 0.11, "triangle"], [246.94, 0.26, 0.34, "triangle"]],
} as const satisfies Record<string, readonly Note[]>;

const SOUND_KEY = "roughlyright:close-call-sound";

export function useShowAudio() {
  const [muted, setMuted] = useState(true);
  const enabled = useRef(false);
  const audio = useRef<{ context: AudioContext; volume: GainNode } | null>(null);

  useEffect(() => {
    try {
      enabled.current = localStorage.getItem(SOUND_KEY) === "on";
      setMuted(!enabled.current);
    } catch {
      // The game still works with storage disabled.
    }
    return () => {
      const active = audio.current;
      audio.current = null;
      if (active) void active.context.close().catch(() => {});
    };
  }, []);

  const play = useCallback((cue: keyof typeof CUES) => {
    if (!enabled.current || typeof AudioContext === "undefined") return;
    try {
      if (!audio.current) {
        const context = new AudioContext();
        const volume = context.createGain();
        volume.gain.value = 0.15;
        volume.connect(context.destination);
        audio.current = { context, volume };
      }
      const { context, volume } = audio.current;
      if (context.state !== "running") void context.resume().catch(() => {});
      const time = context.currentTime;
      volume.gain.setTargetAtTime(0.15, time, 0.01);
      for (const note of CUES[cue] as readonly Note[]) {
        const [frequency, offset, duration, shape = "sine"] = note;
        const oscillator = context.createOscillator();
        const envelope = context.createGain();
        const start = time + offset + 0.01;
        oscillator.type = shape;
        oscillator.frequency.value = frequency;
        envelope.gain.setValueAtTime(0.001, start);
        envelope.gain.exponentialRampToValueAtTime(0.42, start + 0.009);
        envelope.gain.exponentialRampToValueAtTime(0.001, start + duration);
        oscillator.connect(envelope).connect(volume);
        oscillator.start(start);
        oscillator.stop(start + duration);
        oscillator.onended = () => {
          oscillator.disconnect();
          envelope.disconnect();
        };
      }
    } catch {
      // Audio is optional, including when a device cannot open an audio context.
    }
  }, []);

  const toggleMute = useCallback(() => {
    enabled.current = !enabled.current;
    setMuted(!enabled.current);
    try {
      localStorage.setItem(SOUND_KEY, enabled.current ? "on" : "off");
    } catch {
      // Keep the preference for this session.
    }
    if (enabled.current) {
      play("lock");
    } else if (audio.current) {
      const { context, volume } = audio.current;
      volume.gain.setTargetAtTime(0, context.currentTime, 0.01);
    }
  }, [play]);

  return { muted, toggleMute, play };
}
