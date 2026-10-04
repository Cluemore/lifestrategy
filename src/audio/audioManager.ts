let context: AudioContext | undefined;
let master: GainNode | undefined;
let oscillators: OscillatorNode[] = [];
let muted = false;
let musicVolume = 0.35;
let sfxVolume = 0.5;

const tracks = [
  [261.63, 329.63, 392],
  [220, 277.18, 329.63],
  [293.66, 369.99, 440],
];

const getContext = () => {
  if (!context) context = new AudioContext();
  return context;
};

const applyMaster = () => {
  if (master && context) master.gain.setTargetAtTime(muted ? 0 : musicVolume * 0.12, context.currentTime, 0.04);
};

const stop = () => {
  oscillators.forEach((oscillator) => {
    try {
      oscillator.stop();
    } catch {
      // Already stopped; this is harmless when a user toggles quickly.
    }
  });
  oscillators = [];
  master = undefined;
};

export const audioManager = {
  startAmbient(track = 0) {
    stop();
    const audio = getContext();
    if (audio.state === 'suspended') void audio.resume();
    master = audio.createGain();
    master.connect(audio.destination);
    tracks[track % tracks.length].forEach((frequency, index) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = index === 0 ? 'sine' : 'triangle';
      oscillator.frequency.value = frequency / (index === 2 ? 2 : 1);
      gain.gain.value = 0.07 / (index + 1);
      oscillator.connect(gain).connect(master!);
      oscillator.start();
      oscillators.push(oscillator);
    });
    applyMaster();
  },
  pauseAmbient() {
    stop();
  },
  setMuted(value: boolean) {
    muted = value;
    applyMaster();
  },
  setMusicVolume(value: number) {
    musicVolume = Math.max(0, Math.min(1, value));
    applyMaster();
  },
  setSfxVolume(value: number) {
    sfxVolume = Math.max(0, Math.min(1, value));
  },
  coin() {
    if (muted || sfxVolume === 0) return;
    const audio = getContext();
    if (audio.state === 'suspended') void audio.resume();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.setValueAtTime(620, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(920, audio.currentTime + 0.08);
    gain.gain.setValueAtTime(0.07 * sfxVolume, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.16);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.17);
  },
  trackCount: tracks.length,
};
