"use client";

/**
 * Web Audio API synthesizer for retro laboratory & instrumentation feedback.
 * Zero external audio files required, instant latency, respecting browser autoplay policies.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  // Off by default (owner decision): sound only after the player explicitly
  // enables it. Persisted choice flips it on permanently.
  private muted: boolean = true;

  constructor() {
    if (typeof window !== "undefined") {
      this.muted = localStorage.getItem("rr_audio_muted") !== "false";
    }
  }

  private initCtx() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (typeof window !== "undefined") {
      localStorage.setItem("rr_audio_muted", String(this.muted));
    }
    if (!this.muted) {
      this.playTone(520, "sine", 0.08, 0.12);
    }
    return this.muted;
  }

  private playTone(freq: number, type: OscillatorType, duration: number, volume: number = 0.15) {
    if (this.muted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // AudioContext policy catch
    }
  }

  /** Subtle tick sound when appending numbers or clicking suffix chips */
  public click() {
    this.playTone(800, "sine", 0.03, 0.08);
  }

  /** Pleasant ascending chime when locking an Exact or Close estimate */
  public success() {
    if (this.muted) return;
    this.initCtx();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      setTimeout(() => this.playTone(f, "triangle", 0.18, 0.12), i * 70);
    });
  }

  /** Warm tone when In Range */
  public warm() {
    if (this.muted) return;
    this.initCtx();
    [440, 554.37].forEach((f, i) => {
      setTimeout(() => this.playTone(f, "sine", 0.15, 0.1), i * 80);
    });
  }

  /** Low blip when guess is Far */
  public far() {
    this.playTone(180, "sawtooth", 0.15, 0.08);
  }

  /** Soft descending thud on Pass */
  public pass() {
    this.playTone(220, "sine", 0.12, 0.08);
  }
}

export const sound = new SoundEngine();
