import { GAME_CONFIG } from './config.js';

/**
 * ============================================================================
 * SINTETIZADOR PROCEDURAL WEBAUDIO (SEM ARQUIVOS EXTERNOS) — ENTREGA M4 (FASE C)
 * ============================================================================
 * Gera todos os efeitos sonoros matematicamente usando a API nativa `AudioContext`:
 * 1. Motor contínuo: oscilador `sawtooth` + `triangle` filtrado por `BiquadFilterNode`
 *    passa-baixas cuja frequência fundamental (pitch) sobe com a velocidade do carro;
 * 2. Chiado de pneu (skid): buffer de ruído branco filtrado por `bandpass` em ~1100 Hz,
 *    cujo ganho é modulado suavemente enquanto o carro está em drift;
 * 3. Efeitos discretos (one-shots):
 *    - Subida de multiplicador / transição (arpejo ascendente agudo);
 *    - Perda de pontos fora da pista (tom descendente grave);
 *    - Disparo do SUPERDRIFT (acorde triunfante em síntese FM/harmônica).
 *
 * Respeita a política de autoplay dos navegadores: o `AudioContext` só é criado/resumido
 * após a primeira tecla pressionada pelo usuário, e a tecla `M` alterna o modo Mudo.
 */

export function createGameAudio() {
  let ctx = null;
  let masterGain = null;
  let engineOsc1 = null;
  let engineOsc2 = null;
  let engineGain = null;
  let skidGain = null;
  let skidFilter = null;

  let isMuted = false;
  let isInitialized = false;

  /**
   * Inicializa o grafo de áudio contínuo (motor + gerador de ruído de pneu)
   * somente após a primeira interação do jogador.
   */
  function initOnFirstInteraction() {
    if (isInitialized) {
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      ctx = new AudioCtx();
      masterGain = ctx.createGain();
      masterGain.gain.value = isMuted ? 0.0 : 0.28;
      masterGain.connect(ctx.destination);

      // --- 1. Motor (Oscilador duplo filtrado em passa-baixas para timbre grave e suave) ---
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 260;

      engineGain = ctx.createGain();
      engineGain.gain.value = 0.16;

      engineOsc1 = ctx.createOscillator();
      engineOsc1.type = 'sawtooth';
      engineOsc1.frequency.value = 55;

      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'triangle';
      engineOsc2.frequency.value = 110;

      engineOsc1.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(masterGain);

      engineOsc1.start();
      engineOsc2.start();

      // --- 2. Chiado de Pneu (Buffer circular de ruído branco filtrado em passa-faixa) ---
      const bufferSize = ctx.sampleRate * 1.5;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      skidFilter = ctx.createBiquadFilter();
      skidFilter.type = 'bandpass';
      skidFilter.frequency.value = 1050;
      skidFilter.Q.value = 3.2;

      skidGain = ctx.createGain();
      skidGain.gain.value = 0.0;

      noiseSource.connect(skidFilter);
      skidFilter.connect(skidGain);
      skidGain.connect(masterGain);
      noiseSource.start();

      isInitialized = true;
    } catch {
      // Navegador sem suporte ou bloqueio de áudio
    }
  }

  /**
   * Toca um tom curto com envelope ADSR simples.
   */
  function playTone(freqStart, freqEnd, durationSec, type = 'sine', volume = 0.25, delaySec = 0) {
    if (!isInitialized || !ctx || isMuted) return;

    const now = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + durationSec);
    }

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  /**
   * Atualiza o som contínuo do motor e do pneu e dispara efeitos discretos dos eventos do frame.
   */
  function update({ speedAbs, isDrifting, isHandbrake, isOffTrack, isPaused, events }) {
    if (!isInitialized || !ctx) return;

    const now = ctx.currentTime;

    if (isPaused || isMuted) {
      if (engineGain) engineGain.gain.setTargetAtTime(0.0, now, 0.05);
      if (skidGain) skidGain.gain.setTargetAtTime(0.0, now, 0.05);
      return;
    }

    // 1. Pitch do motor proporcional à velocidade (52 Hz em marcha lenta até ~175 Hz em vel. máxima)
    const speedRatio = Math.min(1.0, speedAbs / GAME_CONFIG.maxForwardSpeed);
    const baseFreq = 52 + speedRatio * 125;
    if (engineOsc1 && engineOsc2 && engineGain) {
      engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.04);
      engineOsc2.frequency.setTargetAtTime(baseFreq * 2.0, now, 0.04);
      engineGain.gain.setTargetAtTime(0.12 + speedRatio * 0.14, now, 0.05);
    }

    // 2. Chiado de pneu durante o drift ou freio de mão no asfalto
    const tireSquealActive = (isDrifting || (isHandbrake && speedAbs > 6.5)) && !isOffTrack;
    if (skidGain && skidFilter) {
      const targetSkidVol = tireSquealActive ? Math.min(0.22, 0.06 + speedRatio * 0.16) : 0.0;
      skidGain.gain.setTargetAtTime(targetSkidVol, now, 0.06);
      skidFilter.frequency.setTargetAtTime(920 + speedRatio * 420, now, 0.08);
    }

    // 3. Sons curtos para eventos de pontuação
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (ev.type === 'MULTIPLIER_UP' || ev.type === 'TRANSITION') {
        const pitchBoost = (ev.value || 2) * 18;
        playTone(440 + pitchBoost, 660 + pitchBoost, 0.16, 'triangle', 0.26, 0);
        playTone(660 + pitchBoost, 880 + pitchBoost, 0.18, 'sine', 0.24, 0.07);
      } else if (ev.type === 'OFF_TRACK_PENALTY') {
        playTone(220, 95, 0.38, 'sawtooth', 0.28, 0);
      } else if (ev.type === 'SUPERDRIFT') {
        // Fanfarra harmônica ascendente para o SUPERDRIFT
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
          playTone(freq, freq * 1.02, 0.55, 'triangle', 0.3, idx * 0.08);
        });
      }
    }
  }

  function toggleMute() {
    isMuted = !isMuted;
    if (masterGain && ctx) {
      masterGain.gain.setTargetAtTime(isMuted ? 0.0 : 0.28, ctx.currentTime, 0.04);
    }
    return isMuted;
  }

  return {
    initOnFirstInteraction,
    update,
    toggleMute,
    isMuted: () => isMuted,
  };
}
