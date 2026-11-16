/**
 * ============================================================================
 * CONTROLADOR DO HUD EM HTML/CSS — ENTREGA M4
 * ============================================================================
 * Atualiza os elementos visuais de pontuação, anel regressivo de 3 s,
 * velocímetro em km/h, medidor de ângulo de drift, vinheta de erro e o
 * efeito especial SUPERDRIFT sem interferir no canvas WebGL nem no split-screen.
 */

const RING_CIRCUMFERENCE = 2 * Math.PI * 28; // r = 28 -> ~175.93 px

export function createGameHud() {
  const totalEl = document.getElementById('score-total');
  const pendingEl = document.getElementById('score-pending');
  const recordEl = document.getElementById('score-record');
  const bestSeqEl = document.getElementById('score-best-seq');
  const multEl = document.getElementById('score-multiplier');
  const ringCircleEl = document.getElementById('seq-ring-circle');
  const victoryBadgeEl = document.getElementById('victory-badge');
  const bannerEl = document.getElementById('drift-event-banner');

  const speedKmhEl = document.getElementById('speed-kmh');
  const slipDegValEl = document.getElementById('slip-deg-val');
  const slipNeedleEl = document.getElementById('slip-needle');

  const vignetteEl = document.getElementById('offtrack-vignette');
  const flashEl = document.getElementById('screen-flash');
  const superdriftOverlayEl = document.getElementById('superdrift-overlay');
  const superdriftSubEl = document.getElementById('superdrift-subtext');

  const tutorialOverlayEl = document.getElementById('tutorial-overlay');
  const pauseBannerEl = document.getElementById('pause-banner');
  const hudAudioEl = document.getElementById('hud-audio');

  let bannerTimeoutId = null;
  let vignetteTimeoutId = null;
  let superdriftTimeoutId = null;
  let multPopTimeoutId = null;

  // Fecha o tutorial inicial ao pressionar qualquer tecla ou clicar na tela
  function dismissTutorial() {
    if (tutorialOverlayEl && !tutorialOverlayEl.classList.contains('hidden')) {
      tutorialOverlayEl.classList.add('hidden');
    }
  }

  window.addEventListener('keydown', dismissTutorial, { once: true });
  window.addEventListener('pointerdown', dismissTutorial, { once: true });

  /**
   * Exibe uma mensagem curta de feedback ("DRIFT!", "TRANSIÇÃO! +1", "BORDA! x1.5", "PONTOS PERDIDOS").
   *
   * @param {string} text Texto a exibir
   * @param {string} colorHex Cor CSS do texto
   * @param {number} durationMs Duração em milissegundos
   */
  function showBanner(text, colorHex = '#fbbf24', durationMs = 1100) {
    if (!bannerEl) return;
    bannerEl.textContent = text;
    bannerEl.style.color = colorHex;
    bannerEl.classList.add('active');

    if (bannerTimeoutId) clearTimeout(bannerTimeoutId);
    bannerTimeoutId = setTimeout(() => {
      bannerEl.classList.remove('active');
    }, durationMs);
  }

  /**
   * Anima o texto do multiplicador sempre que ele sobe de degrau.
   */
  function animateMultiplierPop() {
    if (!multEl) return;
    multEl.classList.remove('pop');
    void multEl.offsetWidth;
    multEl.classList.add('pop');

    if (multPopTimeoutId) clearTimeout(multPopTimeoutId);
    multPopTimeoutId = setTimeout(() => {
      multEl.classList.remove('pop');
    }, 320);
  }

  /**
   * Dispara a vinheta vermelha nas bordas da tela ao perder pontos fora da pista.
   */
  function triggerOffTrackVignette() {
    if (!vignetteEl) return;
    vignetteEl.classList.add('active');
    if (vignetteTimeoutId) clearTimeout(vignetteTimeoutId);
    vignetteTimeoutId = setTimeout(() => {
      vignetteEl.classList.remove('active');
    }, 650);
  }

  /**
   * Dispara o efeito visual completo do SUPERDRIFT (flash rápido + texto grande com degradê,
   * escala com overshoot, tremor e fatias glitch + selo de vitória permanente no HUD).
   *
   * @param {number} bankedPoints Pontos guardados no momento do disparo
   */
  function triggerSuperdriftEffect(bankedPoints = 25000) {
    if (flashEl) {
      flashEl.classList.add('flash');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          flashEl.classList.remove('flash');
        });
      });
    }

    if (superdriftSubEl) {
      superdriftSubEl.textContent = `+${Math.round(bankedPoints).toLocaleString('pt-BR')} PTS GUARDADOS!`;
    }

    if (superdriftOverlayEl) {
      superdriftOverlayEl.classList.remove('active');
      void superdriftOverlayEl.offsetWidth;
      superdriftOverlayEl.classList.add('active');

      if (superdriftTimeoutId) clearTimeout(superdriftTimeoutId);
      superdriftTimeoutId = setTimeout(() => {
        superdriftOverlayEl.classList.remove('active');
      }, 3150);
    }

    if (victoryBadgeEl) {
      victoryBadgeEl.classList.add('visible');
    }
  }

  /**
   * Atualiza todos os indicadores do HUD a cada frame.
   *
   * @param {{
   *   driftState: ReturnType<import('./driftSystem.js').createDriftSystem>['state'],
   *   events: Array<{ type: string, text?: string, value?: number }>,
   *   speedMetersPerSec: number,
   *   slipDeg: number
   * }} params
   */
  function update({ driftState, events, speedMetersPerSec, slipDeg }) {
    // 1. Números de pontuação
    if (totalEl) {
      totalEl.textContent = Math.round(driftState.totalScore).toLocaleString('pt-BR');
    }
    if (pendingEl) {
      pendingEl.textContent = Math.round(driftState.pendingScore).toLocaleString('pt-BR');
    }
    if (recordEl) {
      recordEl.textContent = Math.round(driftState.recordTotalScore).toLocaleString('pt-BR');
    }
    if (bestSeqEl) {
      bestSeqEl.textContent = Math.round(driftState.bestSequenceScore).toLocaleString('pt-BR');
    }
    if (multEl) {
      multEl.textContent = `x${driftState.multiplier}`;
    }

    // 2. Anel regressivo de 3 segundos da sequência
    if (ringCircleEl) {
      const hasActiveSequence = driftState.pendingScore > 0 || driftState.stepIndex > 0;
      const ratio = hasActiveSequence ? driftState.sequenceCountdownRatio : 0;
      const offset = RING_CIRCUMFERENCE * (1.0 - ratio);
      ringCircleEl.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
      ringCircleEl.style.strokeDashoffset = `${offset}`;

      if (driftState.isDrifting) {
        ringCircleEl.style.stroke = '#4ade80'; // Verde brilhante enquanto está derrapando
      } else if (ratio < 0.35) {
        ringCircleEl.style.stroke = '#ef4444'; // Vermelho quando faltam < 1s para acabar os 3s
      } else {
        ringCircleEl.style.stroke = '#ff9e57'; // Laranja pôr do sol padrão
      }
    }

    // 3. Selo de vitória
    if (victoryBadgeEl) {
      victoryBadgeEl.classList.toggle('visible', driftState.victoryAchieved);
    }

    // 4. Velocímetro em km/h (1 m/s = 3.6 km/h)
    if (speedKmhEl) {
      const kmh = Math.round(Math.abs(speedMetersPerSec) * 3.6);
      speedKmhEl.textContent = String(kmh);
    }

    // 5. Medidor de ângulo de deriva (slip)
    const roundedSlip = Math.round(Math.abs(slipDeg));
    if (slipDegValEl) {
      slipDegValEl.textContent = `${roundedSlip}°`;
      slipDegValEl.style.color = driftState.isDrifting ? '#fbbf24' : '#cbd5e1';
    }
    if (slipNeedleEl) {
      // Mapeia [-55°, +55°] para [5%, 95%] da barra
      const normalized = Math.max(-1, Math.min(1, slipDeg / 55.0));
      const leftPercent = 50 + normalized * 44;
      slipNeedleEl.style.left = `${leftPercent}%`;
      slipNeedleEl.style.background = driftState.isDrifting
        ? '#f59e0b'
        : driftState.isOffTrack
          ? '#ef4444'
          : '#38bdf8';
    }

    // 6. Eventos discretos emitidos pelo driftSystem neste frame
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      switch (ev.type) {
        case 'DRIFT_START':
          showBanner('DRIFT!', '#fbbf24', 900);
          break;
        case 'TRANSITION':
          showBanner('TRANSIÇÃO! +1', '#38bdf8', 1200);
          animateMultiplierPop();
          break;
        case 'EDGE_BONUS':
          showBanner('BORDA! x1.5', '#4ade80', 1000);
          break;
        case 'MULTIPLIER_UP':
          showBanner(ev.text || `x${ev.value}!`, '#ff758f', 1000);
          animateMultiplierPop();
          break;
        case 'SEQUENCE_BANKED':
          showBanner(ev.text || 'PONTOS GUARDADOS!', '#a7f3d0', 1300);
          break;
        case 'OFF_TRACK_PENALTY':
          showBanner('PONTOS PERDIDOS', '#ef4444', 1400);
          triggerOffTrackVignette();
          break;
        case 'SUPERDRIFT':
          triggerSuperdriftEffect(ev.value);
          break;
        default:
          break;
      }
    }
  }

  function setPaused(paused) {
    if (pauseBannerEl) {
      pauseBannerEl.classList.toggle('visible', Boolean(paused));
    }
  }

  function setMuted(muted) {
    if (hudAudioEl) {
      hudAudioEl.textContent = muted ? 'MUDO (OFF)' : 'ATIVO (ON)';
      hudAudioEl.style.color = muted ? '#f87171' : '#4ade80';
    }
  }

  return {
    update,
    setPaused,
    setMuted,
    showBanner,
    triggerSuperdriftEffect,
  };
}
