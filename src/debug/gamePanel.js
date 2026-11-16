import { GAME_CONFIG } from '../game/config.js';

/**
 * ============================================================================
 * PASTA "JOGO" NO PAINEL LIL-GUI — ENTREGA M4 (FASE A + C)
 * ============================================================================
 * Permite ajustar ao vivo todos os parâmetros da física arcade e da pontuação:
 * - Grip normal, grip do freio de mão e impulso lateral;
 * - Limiares de entrada e saída de drift (graus) e velocidade mínima;
 * - Tempo de reset da sequência (3 s) e limiar do SUPERDRIFT (25.000 pts);
 * - Toggle "Mostrar 9 Pontos (Pista)" (esferas de detecção verde/amarela/vermelha);
 * - Toggle "Marcas de Pneu" (ring buffer);
 * - Botões "Forçar SUPERDRIFT" (para demonstrar na defesa/vídeo) e "Zerar Pontuação".
 *
 * @param {{
 *   gui: import('lil-gui').GUI,
 *   trackBounds: ReturnType<import('../game/trackBounds.js').createTrackBoundsChecker>,
 *   driftEffects: ReturnType<import('../game/effects.js').createDriftEffects>,
 *   onForceSuperdrift: () => void,
 *   onResetMatch: () => void
 * }} params
 */
export function createGamePanel({
  gui,
  trackBounds,
  driftEffects,
  onForceSuperdrift,
  onResetMatch,
}) {
  const state = {
    lateralGripNormal: GAME_CONFIG.lateralGripNormal,
    lateralGripHandbrake: GAME_CONFIG.lateralGripHandbrake,
    driftEntryAngleDeg: GAME_CONFIG.driftEntryAngleDeg,
    driftExitAngleDeg: GAME_CONFIG.driftExitAngleDeg,
    minDriftSpeed: GAME_CONFIG.minDriftSpeed,
    sequenceResetTimeSec: GAME_CONFIG.sequenceResetTimeSec,
    superdriftThreshold: GAME_CONFIG.superdriftThreshold,
    showDetectionPoints: false,
    skidMarksEnabled: GAME_CONFIG.skidMarksEnabled,
    forceSuperdriftBtn: () => onForceSuperdrift?.(),
    resetScoreBtn: () => onResetMatch?.(),
  };

  const gameFolder = gui.addFolder('Jogo');

  gameFolder
    .add(state, 'showDetectionPoints')
    .name('Mostrar 9 Pontos (Pista)')
    .onChange((val) => {
      trackBounds.setShowDebugPoints(val);
    });

  gameFolder
    .add(state, 'skidMarksEnabled')
    .name('Marcas de Pneu (RingBuf)')
    .onChange((val) => {
      driftEffects.setSkidMarksEnabled(val);
    });

  gameFolder
    .add(state, 'lateralGripNormal', 2.0, 14.0, 0.2)
    .name('Grip Normal (Asfalto)')
    .onChange((val) => {
      GAME_CONFIG.lateralGripNormal = val;
    });

  gameFolder
    .add(state, 'lateralGripHandbrake', 0.3, 4.0, 0.05)
    .name('Grip Freio de Mão')
    .onChange((val) => {
      GAME_CONFIG.lateralGripHandbrake = val;
    });

  gameFolder
    .add(state, 'driftEntryAngleDeg', 6.0, 30.0, 0.5)
    .name('Ângulo Entrada Drift (°)')
    .onChange((val) => {
      GAME_CONFIG.driftEntryAngleDeg = val;
    });

  gameFolder
    .add(state, 'driftExitAngleDeg', 3.0, 20.0, 0.5)
    .name('Ângulo Saída Drift (°)')
    .onChange((val) => {
      GAME_CONFIG.driftExitAngleDeg = val;
    });

  gameFolder
    .add(state, 'sequenceResetTimeSec', 1.0, 8.0, 0.5)
    .name('Tempo Reset Seq. (s)')
    .onChange((val) => {
      GAME_CONFIG.sequenceResetTimeSec = val;
    });

  gameFolder
    .add(state, 'superdriftThreshold', 5000, 60000, 1000)
    .name('Meta SUPERDRIFT (pts)')
    .onChange((val) => {
      GAME_CONFIG.superdriftThreshold = val;
    });

  gameFolder.add(state, 'forceSuperdriftBtn').name('★ Forçar SUPERDRIFT');
  gameFolder.add(state, 'resetScoreBtn').name('↺ Zerar Pontuação (R)');

  gameFolder.open();

  return {
    gameFolder,
  };
}
