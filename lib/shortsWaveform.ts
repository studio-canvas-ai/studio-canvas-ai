/**
 * Client-side audio peak extraction for the caption wave timeline.
 */

export type ShortsWaveformPeaks = {
  peaks: Float32Array;
  durationSec: number;
  sampleRate: number;
};

const DEFAULT_BARS = 240;

/**
 * Decode an audio/video blob and downsample absolute peaks for drawing.
 */
export async function extractWaveformPeaks(
  blob: Blob,
  barCount = DEFAULT_BARS
): Promise<ShortsWaveformPeaks> {
  if (typeof window === "undefined") {
    throw new Error("waveform_client_only");
  }
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) throw new Error("audio_context_unavailable");

  const ctx = new Ctx();
  try {
    const buf = await blob.arrayBuffer();
    const audio = await ctx.decodeAudioData(buf.slice(0));
    const channel = audio.getChannelData(0);
    const durationSec = audio.duration || channel.length / audio.sampleRate;
    const bars = Math.max(32, Math.min(800, Math.floor(barCount)));
    const block = Math.max(1, Math.floor(channel.length / bars));
    const peaks = new Float32Array(bars);
    let max = 0.0001;
    for (let i = 0; i < bars; i++) {
      const start = i * block;
      const end = Math.min(channel.length, start + block);
      let peak = 0;
      for (let j = start; j < end; j++) {
        const v = Math.abs(channel[j]);
        if (v > peak) peak = v;
      }
      peaks[i] = peak;
      if (peak > max) max = peak;
    }
    for (let i = 0; i < bars; i++) peaks[i] = peaks[i] / max;
    return {
      peaks,
      durationSec: Number.isFinite(durationSec) ? durationSec : 0,
      sampleRate: audio.sampleRate,
    };
  } finally {
    try {
      await ctx.close();
    } catch {
      /* ignore */
    }
  }
}
