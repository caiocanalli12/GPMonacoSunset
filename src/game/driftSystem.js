import { GAME_CONFIG } from './config.js';

/**
 * ============================================================================
 * SISTEMA PURO DE DETECÇÃO DE DRIFT, MULTIPLICADOR E PONTUAÇÃO — ENTREGA M4
 * ============================================================================
 * Este módulo NÃO importa o Three.js. Toda a lógica de estado é matemática pura,
 * facilitando a explicação na defesa e permitindo execução direta em Node.js
 * para calibrar a dificuldade e rodar testes automatizados (`node:test`).
 */

const STORAGE_KEYS = {
  bestTotal: 'monaco_sunset_gp_best_total_v1',
  bestSequence: 'monaco_sunset_gp_best_seq_v1',
};

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function readStorageNumber(key) {
  try {
    if (typeof localStorage === 'undefined') return 0;
    const raw = localStorage.getItem(key);
    const num = Number(raw);
    return Number.isFinite(num) && num >= 0 ? Math.floor(num) : 0;
  } catch {
    return 0;
  }
}

function writeStorageNumber(key, value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, String(Math.floor(value)));
  } catch {
    // Ignora caso localStorage esteja bloqueado no navegador
  }
}

/**
 * Cria uma instância da máquina de estados de pontuação e drift.
 *
 * @param {typeof GAME_CONFIG} [customConfig] Configuração opcional (útil para testes/simulação)
 */
export function createDriftSystem(customConfig = GAME_CONFIG) {
  const cfg = customConfig;

  const state = {
    // Pontuações principais (Item 3)
    totalScore: 0,              // Pontos já guardados com segurança no banco
    pendingScore: 0,            // Pontos da sequência atual (em risco se sair da pista)
    bestSequenceScore: 0,       // Maior sequência da sessão/histórico
    recordTotalScore: readStorageNumber(STORAGE_KEYS.bestTotal),

    // Multiplicador e degraus (x1, x2, x3, x5, x8, x12, x20)
    stepIndex: 0,
    timeThresholdIndex: 0,      // Quantos limiares de tempo (2, 5, 9, 14, 20, 27 s) já foram superados
    multiplier: cfg.multiplierSteps[0],
    driftTimeInSequence: 0,     // Segundos acumulados em drift dentro da sequência atual
    transitionBonusSteps: 0,    // Degraus extras ganhos por "TRANSIÇÃO +1"

    // Estado instantâneo de drift e histerese (Item 2)
    isDrifting: false,
    slipAngleDeg: 0,            // Ângulo de deriva atual em graus (-180 a +180)
    entryTimer: 0,              // Precisa atingir 0.25 s para confirmar entrada em drift
    exitTimer: 0,               // Precisa atingir 0.20 s para confirmar saída do drift
    isNearEdge: false,          // Bônus de borda (x1.5) ativo

    // Controle de transição de direção (< 1.5 s ao inverter o sentido do drift)
    lastDriftSign: 0,           // -1 (esquerda) ou +1 (direita)
    timeSinceLastDirection: 99, // Tempo decorrido desde a última direção válida
    transitionCooldown: 0,      // Evita farm artificial de transições em linha reta

    // Temporizador de 3 s sem drift para encerrar sequência e guardar pontos
    noDriftTimer: 0,
    sequenceCountdownRatio: 1.0,// 1.0 = cheio, 0.0 = prestes a encerrar os 3 s

    // Penalidade de saída de pista (Item 4)
    offTrackCooldown: 0,
    isOffTrack: false,
    offTrackPointsCount: 0,

    // SUPERDRIFT (Item 5 — Vitória uma vez por partida, mas continua dirigindo)
    superdriftTriggeredThisMatch: false,
    victoryAchieved: false,
    maxMultHoldTimer: 0,        // Segundos mantendo o multiplicador máximo (x20) em drift

    // Controle de aviso de borda
    edgeBannerCooldown: 0,
  };

  state.bestSequenceScore = readStorageNumber(STORAGE_KEYS.bestSequence);

  /**
   * Atualiza os recordes persistidos no `localStorage`.
   */
  function syncRecords() {
    if (state.totalScore > state.recordTotalScore) {
      state.recordTotalScore = state.totalScore;
      writeStorageNumber(STORAGE_KEYS.bestTotal, state.recordTotalScore);
    }
    writeStorageNumber(STORAGE_KEYS.bestSequence, state.bestSequenceScore);
  }

  /**
   * Zera os contadores internos da sequência atual (usado ao guardar pontos ou ao perder pontos).
   */
  function clearCurrentSequence() {
    state.pendingScore = 0;
    state.stepIndex = 0;
    state.timeThresholdIndex = 0;
    state.multiplier = cfg.multiplierSteps[0];
    state.driftTimeInSequence = 0;
    state.transitionBonusSteps = 0;
    state.noDriftTimer = 0;
    state.sequenceCountdownRatio = 1.0;
    state.lastDriftSign = 0;
    state.timeSinceLastDirection = 99;
    state.maxMultHoldTimer = 0;
  }

  /**
   * Guarda os pontos PENDENTES no TOTAL e atualiza a melhor sequência.
   *
   * @returns {number} Quantidade inteira de pontos guardados
   */
  function bankPendingPoints() {
    const banked = Math.round(state.pendingScore);
    if (banked > 0) {
      state.totalScore += banked;
      if (banked > state.bestSequenceScore) {
        state.bestSequenceScore = banked;
      }
      syncRecords();
    }
    clearCurrentSequence();
    return banked;
  }

  /**
   * Calcula qual degrau de multiplicador é garantido pelo tempo acumulado de drift na sequência.
   * Limiares padrão: 2 s, 5 s, 9 s, 14 s, 20 s, 27 s.
   */
  function computeTimeStepIndex(accumulatedDriftSeconds) {
    const thresholds = cfg.multiplierTimeThresholds;
    let idx = 0;
    for (let i = 0; i < thresholds.length; i++) {
      if (accumulatedDriftSeconds >= thresholds[i]) {
        idx = i + 1;
      } else {
        break;
      }
    }
    return idx;
  }

  /**
   * Dispara o evento especial SUPERDRIFT (Item 5), guardando os pontos pendentes
   * no total e marcando a vitória da partida.
   *
   * @param {Array<{ type: string, text?: string, value?: number }>} events Lista de eventos do frame
   */
  function executeSuperdrift(events) {
    state.superdriftTriggeredThisMatch = true;
    state.victoryAchieved = true;

    // Se foi acionado pelo botão "Forçar SUPERDRIFT" com poucos pontos pendentes,
    // garante pelo menos o valor de limiar para uma demonstração visual convincente
    if (state.pendingScore < 100) {
      state.pendingScore = cfg.superdriftThreshold;
    }

    const banked = bankPendingPoints();
    events.push({
      type: 'SUPERDRIFT',
      text: 'SUPERDRIFT!',
      value: banked,
    });
  }

  /**
   * Avança a simulação de pontuação e detecção de drift em `dt` segundos.
   *
   * @param {{
   *   dt: number,
   *   speed: number,
   *   slipRad: number,
   *   offTrackPointsCount: number,
   *   isNearEdge: boolean
   * }} input
   * @returns {{
   *   state: typeof state,
   *   events: Array<{ type: string, text?: string, value?: number }>
   * }}
   */
  function update({
    dt,
    speed,
    slipRad,
    offTrackPointsCount = 0,
    isNearEdge = false,
  }) {
    const events = [];
    if (dt <= 0) return { state, events };

    const absSpeed = Math.abs(speed);
    const slipDeg = (slipRad * 180) / Math.PI;
    const absSlipDeg = Math.abs(slipDeg);

    state.slipAngleDeg = slipDeg;
    state.offTrackPointsCount = offTrackPointsCount;
    state.isOffTrack = offTrackPointsCount >= cfg.offTrackPointsThreshold;
    state.isNearEdge = isNearEdge && !state.isOffTrack;

    if (state.offTrackCooldown > 0) {
      state.offTrackCooldown = Math.max(0, state.offTrackCooldown - dt);
    }
    if (state.transitionCooldown > 0) {
      state.transitionCooldown = Math.max(0, state.transitionCooldown - dt);
    }
    if (state.edgeBannerCooldown > 0) {
      state.edgeBannerCooldown = Math.max(0, state.edgeBannerCooldown - dt);
    }

    // ========================================================================
    // 1. VERIFICAÇÃO DE SAÍDA DE PISTA (>= 5 DE 9 PONTOS FORA DA MEIA-LARGURA)
    // ========================================================================
    if (state.isOffTrack) {
      state.isDrifting = false;
      state.entryTimer = 0;
      state.exitTimer = 0;

      if (state.offTrackCooldown <= 0) {
        state.offTrackCooldown = cfg.offTrackPenaltyCooldownSec;

        const hadPending = state.pendingScore >= 1 || state.stepIndex > 0;
        clearCurrentSequence();

        if (hadPending) {
          events.push({
            type: 'OFF_TRACK_PENALTY',
            text: 'PONTOS PERDIDOS',
          });
        }
      }

      return { state, events };
    }

    // ========================================================================
    // 2. DETECÇÃO DE DRIFT COM HISTERESE DE ENTRADA (0.25 s) E SAÍDA (0.20 s)
    // ========================================================================
    const meetsEntryCondition =
      absSpeed >= cfg.minDriftSpeed && absSlipDeg >= cfg.driftEntryAngleDeg && speed > 0;
    const belowExitCondition =
      absSpeed < cfg.minDriftSpeed || absSlipDeg < cfg.driftExitAngleDeg || speed <= 0;

    if (!state.isDrifting) {
      if (meetsEntryCondition) {
        state.entryTimer += dt;
        if (state.entryTimer >= cfg.driftEntryConfirmTime) {
          state.isDrifting = true;
          state.exitTimer = 0;
          state.noDriftTimer = 0;
          events.push({ type: 'DRIFT_START', text: 'DRIFT!' });
        }
      } else {
        state.entryTimer = Math.max(0, state.entryTimer - dt * 2.0);
      }
    } else {
      if (belowExitCondition) {
        state.exitTimer += dt;
        if (state.exitTimer >= cfg.driftExitConfirmTime) {
          state.isDrifting = false;
          state.entryTimer = 0;
          state.exitTimer = 0;
        }
      } else {
        state.exitTimer = 0;
      }
    }

    // ========================================================================
    // 3. TRANSIÇÃO DE SENTIDO ("TRANSIÇÃO +1" EM ATÉ 1,5 s)
    // ========================================================================
    const maxStepIdx = cfg.multiplierSteps.length - 1;
    const currentSign = absSlipDeg >= cfg.driftEntryAngleDeg ? Math.sign(slipDeg) : 0;
    let steppedUpByTransition = false;

    if (state.isDrifting && currentSign !== 0) {
      if (
        state.lastDriftSign !== 0 &&
        currentSign !== state.lastDriftSign &&
        state.timeSinceLastDirection <= cfg.transitionMaxWindowSec &&
        state.transitionCooldown <= 0
      ) {
        state.transitionBonusSteps += 1;
        state.transitionCooldown = cfg.transitionCooldownSec;
        if (state.stepIndex < maxStepIdx) {
          state.stepIndex += 1;
          state.multiplier = cfg.multiplierSteps[state.stepIndex];
          steppedUpByTransition = true;
        }
        events.push({
          type: 'TRANSITION',
          text: 'TRANSIÇÃO! +1',
        });
      }
      state.lastDriftSign = currentSign;
      state.timeSinceLastDirection = 0;
    } else {
      state.timeSinceLastDirection += dt;
    }

    // ========================================================================
    // 4. ACÚMULO DE PONTOS, DEGRAUS DE MULTIPLICADOR E BÔNUS DE BORDA
    // ========================================================================
    if (state.isDrifting) {
      state.noDriftTimer = 0;
      state.sequenceCountdownRatio = 1.0;
      state.driftTimeInSequence += dt;

      // Verifica se o tempo acumulado de drift na sequência atingiu o limiar do próximo degrau
      const timeStepIdx = computeTimeStepIndex(state.driftTimeInSequence);

      if (timeStepIdx > state.stepIndex && state.stepIndex < maxStepIdx) {
        state.stepIndex = clamp(timeStepIdx, 0, maxStepIdx);
        state.multiplier = cfg.multiplierSteps[state.stepIndex];
        events.push({
          type: 'MULTIPLIER_UP',
          text: `MULTIPLICADOR x${state.multiplier}!`,
          value: state.multiplier,
        });
      } else if (steppedUpByTransition) {
        // Sincroniza o tempo base da sequência com o degrau alcançado pela transição (com bônus de até 3s)
        const targetThreshold = cfg.multiplierTimeThresholds[state.stepIndex - 1] || 0;
        state.driftTimeInSequence = Math.max(
          state.driftTimeInSequence,
          Math.min(targetThreshold, state.driftTimeInSequence + 1.0)
        );
        events.push({
          type: 'MULTIPLIER_UP',
          text: `MULTIPLICADOR x${state.multiplier}!`,
          value: state.multiplier,
        });
      } else {
        state.multiplier = cfg.multiplierSteps[state.stepIndex];
      }

      // Pontos por segundo = base * fator_velocidade * fator_angulo * bonus_borda * multiplicador
      const speedFactor = clamp(
        absSpeed / cfg.referenceSpeedForScore,
        0.35,
        cfg.maxSpeedScoreFactor
      );
      const angleFactor = clamp(
        absSlipDeg / cfg.referenceAngleForScore,
        0.45,
        cfg.maxAngleScoreFactor
      );
      const edgeMultiplier = state.isNearEdge ? cfg.edgeBonusMultiplier : 1.0;

      if (state.isNearEdge && state.edgeBannerCooldown <= 0) {
        state.edgeBannerCooldown = 1.6;
        events.push({
          type: 'EDGE_BONUS',
          text: 'BORDA! x1.5',
        });
      }

      const pointsPerSec =
        cfg.basePointsPerSecond *
        speedFactor *
        angleFactor *
        edgeMultiplier *
        state.multiplier;

      state.pendingScore += pointsPerSec * dt;

      // Conta o tempo mantendo o multiplicador máximo (x20) em drift ativo (após atingir o teto de 27s)
      const maxTimeThreshold = cfg.multiplierTimeThresholds[maxStepIdx - 1] || 27;
      if (state.stepIndex === maxStepIdx && state.driftTimeInSequence >= maxTimeThreshold) {
        state.maxMultHoldTimer += dt;
      } else {
        state.maxMultHoldTimer = 0;
      }

      // Verifica condição de disparo do SUPERDRIFT (Item 5 — UMA vez por partida)
      if (
        !state.superdriftTriggeredThisMatch &&
        (state.pendingScore >= cfg.superdriftThreshold ||
          state.maxMultHoldTimer >= cfg.superdriftMaxMultHoldSec)
      ) {
        executeSuperdrift(events);
      }
    } else {
      // Fora de drift: se houver sequência ativa, corre a contagem regressiva de 3 s
      if (state.pendingScore > 0 || state.stepIndex > 0) {
        state.noDriftTimer += dt;
        state.sequenceCountdownRatio = clamp(
          1.0 - state.noDriftTimer / cfg.sequenceResetTimeSec,
          0.0,
          1.0
        );

        if (state.noDriftTimer >= cfg.sequenceResetTimeSec) {
          const banked = bankPendingPoints();
          if (banked > 0) {
            events.push({
              type: 'SEQUENCE_BANKED',
              text: `+${banked.toLocaleString('pt-BR')} PTS GUARDADOS`,
              value: banked,
            });
          }
        }
      } else {
        state.noDriftTimer = 0;
        state.sequenceCountdownRatio = 1.0;
      }
    }

    return { state, events };
  }

  /**
   * Força o disparo imediato do SUPERDRIFT (botão do painel "Jogo" para gravação do vídeo).
   */
  function forceSuperdrift() {
    const events = [];
    executeSuperdrift(events);
    return events;
  }

  /**
   * Reinicia a partida (Tecla R ou botão "Zerar pontuação").
   */
  function resetMatch() {
    clearCurrentSequence();
    state.totalScore = 0;
    state.isDrifting = false;
    state.entryTimer = 0;
    state.exitTimer = 0;
    state.offTrackCooldown = 0;
    state.superdriftTriggeredThisMatch = false;
    state.victoryAchieved = false;
  }

  return {
    state,
    update,
    forceSuperdrift,
    resetMatch,
    bankPendingPoints,
  };
}
