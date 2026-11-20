// Web Audio API Synthesizer for CYBER-SPORE 207
// High-impact Boxhead gunshots with procedural noise transients, punchy sub-kicks, and crisp feedback

class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  public enabled: boolean = true;
  private noiseBuffer: AudioBuffer | null = null;
  private distortionNode: WaveShaperNode | null = null;

  private init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.4, this.ctx.currentTime);

      // Create a master saturation / soft-clipper to give gunshots heavy tactile warmth
      this.distortionNode = this.ctx.createWaveShaper();
      this.distortionNode.curve = this.createDistortionCurve(18) as any;
      this.distortionNode.oversample = '2x';
      this.distortionNode.connect(this.masterGain);

      this.masterGain.connect(this.ctx.destination);
      this.generateNoiseBuffer();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Soft-clipping distortion transfer curve for punchy ordnance
  private createDistortionCurve(amount = 20): Float32Array {
    const k = amount;
    const n = 44100;
    const curve = new Float32Array(n);
    const deg = Math.PI / 180;
    for (let i = 0; i < n; ++i) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  // Pre-generate a 1-second white noise buffer for realistic weapon muzzle blasts
  private generateNoiseBuffer() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate;
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
  }

  public toggle(): boolean {
    this.enabled = !this.enabled;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.enabled ? 0.4 : 0, this.ctx.currentTime);
    }
    return this.enabled;
  }

  // TACTICAL PISTOL: High-velocity crack + heavy sub-thud + brass ejection ping
  public playPistol() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.distortionNode || !this.noiseBuffer) return;

    const now = this.ctx.currentTime;
    const jitter = 0.95 + Math.random() * 0.1; // Realistic round-to-round micro variation

    // 1. Supersonic Gunpowder Crack (High-Pass + Bandpass transient)
    const crack = this.ctx.createBufferSource();
    crack.buffer = this.noiseBuffer;
    crack.playbackRate.value = jitter;
    const crackFilter = this.ctx.createBiquadFilter();
    crackFilter.type = 'bandpass';
    crackFilter.frequency.setValueAtTime(3200 * jitter, now);
    crackFilter.Q.setValueAtTime(2.5, now);

    const crackGain = this.ctx.createGain();
    crackGain.gain.setValueAtTime(0.7, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    crack.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(this.distortionNode);
    crack.start(now);
    crack.stop(now + 0.06);

    // 2. Heavy Concussive Sub-Punch (Fast downward pitch sweep)
    const punch = this.ctx.createOscillator();
    const punchGain = this.ctx.createGain();
    punch.type = 'triangle';
    punch.frequency.setValueAtTime(220 * jitter, now);
    punch.frequency.exponentialRampToValueAtTime(35, now + 0.08);

    punchGain.gain.setValueAtTime(0.65, now);
    punchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    punch.connect(punchGain);
    punchGain.connect(this.distortionNode);
    punch.start(now);
    punch.stop(now + 0.095);

    // 3. Mechanical slide action ping (30ms delayed metallic clack)
    const slide = this.ctx.createOscillator();
    const slideGain = this.ctx.createGain();
    slide.type = 'sine';
    slide.frequency.setValueAtTime(1600 * jitter, now + 0.025);
    slide.frequency.exponentialRampToValueAtTime(800, now + 0.055);

    slideGain.gain.setValueAtTime(0, now);
    slideGain.gain.setValueAtTime(0.2, now + 0.025);
    slideGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    slide.connect(slideGain);
    slideGain.connect(this.distortionNode);
    slide.start(now + 0.025);
    slide.stop(now + 0.065);
  }

  // MASSIVE SHOTGUN: Devastating wide-bore concussive blast + low-end shockwave + pump action
  public playShotgun() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.distortionNode || !this.noiseBuffer) return;

    const now = this.ctx.currentTime;
    const jitter = 0.92 + Math.random() * 0.16;

    // 1. Concussive Muzzle Blast (Dense saturated noise blast)
    const blast = this.ctx.createBufferSource();
    blast.buffer = this.noiseBuffer;
    blast.playbackRate.value = jitter;
    const blastFilter = this.ctx.createBiquadFilter();
    blastFilter.type = 'lowpass';
    blastFilter.frequency.setValueAtTime(4500 * jitter, now);
    blastFilter.frequency.exponentialRampToValueAtTime(350, now + 0.18);

    const blastGain = this.ctx.createGain();
    blastGain.gain.setValueAtTime(0.85, now);
    blastGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    blast.connect(blastFilter);
    blastFilter.connect(blastGain);
    blastGain.connect(this.distortionNode);
    blast.start(now);
    blast.stop(now + 0.23);

    // 2. Chest-Crushing Bass Shockwave (Saturated sub drop)
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(160, now);
    sub.frequency.exponentialRampToValueAtTime(28, now + 0.16);

    const subFilter = this.ctx.createBiquadFilter();
    subFilter.type = 'lowpass';
    subFilter.frequency.setValueAtTime(140, now);

    subGain.gain.setValueAtTime(0.75, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    sub.connect(subFilter);
    subFilter.connect(subGain);
    subGain.connect(this.distortionNode);
    sub.start(now);
    sub.stop(now + 0.19);

    // 3. Tactile Pump-Action Rack sound at t=120ms
    const pump = this.ctx.createBufferSource();
    pump.buffer = this.noiseBuffer;
    const pumpFilter = this.ctx.createBiquadFilter();
    pumpFilter.type = 'bandpass';
    pumpFilter.frequency.setValueAtTime(2400, now + 0.12);
    pumpFilter.Q.setValueAtTime(4, now + 0.12);

    const pumpGain = this.ctx.createGain();
    pumpGain.gain.setValueAtTime(0, now);
    pumpGain.gain.setValueAtTime(0.3, now + 0.12);
    pumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    pump.connect(pumpFilter);
    pumpFilter.connect(pumpGain);
    pumpGain.connect(this.distortionNode);
    pump.start(now + 0.12);
    pump.stop(now + 0.19);
  }

  // CYBER-SMG: Crisp metallic cyclic pulse, suppressed snap, tight tactile impact
  public playSMG() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.distortionNode || !this.noiseBuffer) return;

    const now = this.ctx.currentTime;
    const jitter = 0.94 + Math.random() * 0.12;

    // 1. High-frequency supersonic snap
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.playbackRate.value = jitter;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2600 * jitter, now);
    filter.Q.setValueAtTime(3.0, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.55, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.distortionNode);
    noise.start(now);
    noise.stop(now + 0.05);

    // 2. Punchy transient thud
    const punch = this.ctx.createOscillator();
    const punchGain = this.ctx.createGain();
    punch.type = 'triangle';
    punch.frequency.setValueAtTime(180 * jitter, now);
    punch.frequency.exponentialRampToValueAtTime(45, now + 0.04);

    punchGain.gain.setValueAtTime(0.5, now);
    punchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    punch.connect(punchGain);
    punchGain.connect(this.distortionNode);
    punch.start(now);
    punch.stop(now + 0.05);
  }

  // PLASMA ROCKET: Heavy propellant blast + roar
  public playRocketLaunch() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.distortionNode || !this.noiseBuffer) return;

    const now = this.ctx.currentTime;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.linearRampToValueAtTime(2400, now + 0.2);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.55, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.distortionNode);
    noise.start(now);
    noise.stop(now + 0.26);

    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(90, now);
    sub.frequency.exponentialRampToValueAtTime(25, now + 0.22);
    subGain.gain.setValueAtTime(0.5, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    sub.connect(subGain);
    subGain.connect(this.distortionNode);
    sub.start(now);
    sub.stop(now + 0.26);
  }

  // THUNDEROUS EXPLOSION: Barrels, Rockets, Grenades detonating
  public playExplosion() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.distortionNode || !this.noiseBuffer) return;

    const now = this.ctx.currentTime;

    // 1. Noise rumble
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(70, now + 0.6);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.9, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.distortionNode);
    noise.start(now);
    noise.stop(now + 0.66);

    // 2. Sub-bass earthquake impact
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(120, now);
    sub.frequency.exponentialRampToValueAtTime(20, now + 0.5);

    subGain.gain.setValueAtTime(0.9, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    sub.connect(subGain);
    subGain.connect(this.distortionNode);
    sub.start(now);
    sub.stop(now + 0.56);
  }

  // Dash / Jet Thruster
  public playDash() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;

    const now = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2000, now);
    filter.frequency.exponentialRampToValueAtTime(400, now + 0.15);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(now);
    noise.stop(now + 0.17);
  }

  // Hitmarker tick
  public playHitmarker() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2400, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.03);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  // Alias methods for compatibility
  public playShoot() { this.playPistol(); }
  public playFireball() { this.playShotgun(); }
  public playJump() { this.playDash(); }

  // Question Block Bonk
  public playBlockBump() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.09);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  // Coin / Bio-Spore chime
  public playCoin() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    [987.77, 1318.51].forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.2, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.26);
    });
  }

  // Relic Item Pickup Fanfare
  public playRelicPickup() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);

      gain.gain.setValueAtTime(0.25, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.3);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.31);
    });
  }

  // Pipe Warp Sound
  public playPipeWarp() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const tones = [300, 240, 200, 160];
    tones.forEach((t, i) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(t, now + i * 0.06);

      gain.gain.setValueAtTime(0.2, now + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.08);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.09);
    });
  }

  // Boss Roar
  public playBossRoar() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.linearRampToValueAtTime(140, now + 0.3);
    osc.frequency.exponentialRampToValueAtTime(40, now + 1.2);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.25);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 1.3);
  }

  public startAmbientSynth() { return; }
  public stopAmbientSynth() { return; }
}

export const soundEngine = new SoundSynthesizer();
