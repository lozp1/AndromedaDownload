import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  private audioCtx: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {}

  public setEnabled(val: boolean): void {
    this.enabled = val;
  }

  private getContext(): AudioContext | null {
    if (!this.audioCtx) {
      const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtor) {
        this.audioCtx = new AudioCtor();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.1): void {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Ignorar restricciones de audio policy
    }
  }

  public playComplete(): void {
    if (!this.enabled) return;
    this.playTone(523.25, 0.12, 'sine', 0.12); // C5
    setTimeout(() => this.playTone(659.25, 0.12, 'sine', 0.12), 100); // E5
    setTimeout(() => this.playTone(783.99, 0.25, 'sine', 0.15), 200); // G5
  }

  public playError(): void {
    if (!this.enabled) return;
    this.playTone(320, 0.18, 'sawtooth', 0.15);
    setTimeout(() => this.playTone(240, 0.25, 'sawtooth', 0.15), 150);
  }

  public playClick(): void {
    if (!this.enabled) return;
    this.playTone(900, 0.04, 'sine', 0.04);
  }
}
