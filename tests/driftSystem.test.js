import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createDriftSystem } from '../src/game/driftSystem.js';
import { GAME_CONFIG } from '../src/game/config.js';

describe('M4 — Sistema Puro de Drift, Multiplicador e SUPERDRIFT (driftSystem.js)', () => {
  it('1. Deve exigir histerese de entrada (0,25 s) e de saída (0,20 s) para ativar/desativar o drift', () => {
    const sys = createDriftSystem();
    const slip25DegRad = (25 * Math.PI) / 180;

    // 0,20 s ainda é menor que 0,25 s -> não deve estar em drift
    sys.update({ dt: 0.2, speed: 18, slipRad: slip25DegRad, offTrackPointsCount: 0, isNearEdge: false });
    assert.equal(sys.state.isDrifting, false);

    // Mais 0,06 s (total 0,26 s >= 0,25 s) -> entra em DRIFTANDO
    const resStart = sys.update({
      dt: 0.06,
      speed: 18,
      slipRad: slip25DegRad,
      offTrackPointsCount: 0,
      isNearEdge: false,
    });
    assert.equal(sys.state.isDrifting, true);
    assert.equal(resStart.events.some((e) => e.type === 'DRIFT_START'), true);

    // Reduz ângulo para 2° por 0,15 s (< 0,20 s de histerese de saída) -> continua em drift
    sys.update({ dt: 0.15, speed: 18, slipRad: 0.03, offTrackPointsCount: 0, isNearEdge: false });
    assert.equal(sys.state.isDrifting, true);

    // Mais 0,06 s (total 0,21 s >= 0,20 s) -> sai do drift
    sys.update({ dt: 0.06, speed: 18, slipRad: 0.03, offTrackPointsCount: 0, isNearEdge: false });
    assert.equal(sys.state.isDrifting, false);
  });

  it('2. Deve subir o multiplicador pelos degraus [x1, x2, x3, x5, x8, x12, x20] nos limiares de tempo', () => {
    const sys = createDriftSystem();
    const slipRad = (26 * Math.PI) / 180;

    // Confirma entrada (0.26 s)
    sys.update({ dt: 0.26, speed: 15, slipRad, offTrackPointsCount: 0, isNearEdge: false });
    assert.equal(sys.state.isDrifting, true);

    // Atinge 2.0 s de drift -> sobe para x2
    sys.update({ dt: 1.8, speed: 15, slipRad, offTrackPointsCount: 0, isNearEdge: false });
    assert.equal(sys.state.multiplier, 2);

    // Atinge 5.0 s -> sobe para x3
    sys.update({ dt: 3.0, speed: 15, slipRad, offTrackPointsCount: 0, isNearEdge: false });
    assert.equal(sys.state.multiplier, 3);

    // Atinge 9.0 s -> sobe para x5
    sys.update({ dt: 4.0, speed: 15, slipRad, offTrackPointsCount: 0, isNearEdge: false });
    assert.equal(sys.state.multiplier, 5);
  });

  it('3. Deve conceder +1 degrau imediato ao inverter o sentido do drift em até 1,5 s (TRANSIÇÃO)', () => {
    const sys = createDriftSystem();
    const leftSlip = (24 * Math.PI) / 180;
    const rightSlip = (-24 * Math.PI) / 180;

    // Entra em drift para a esquerda (x1)
    sys.update({ dt: 0.3, speed: 18, slipRad: leftSlip, offTrackPointsCount: 0, isNearEdge: false });
    assert.equal(sys.state.multiplier, 1);

    // Inverte para a direita em 0,5 s (< 1,5 s) -> deve subir imediatamente para x2 com evento TRANSITION
    const res = sys.update({
      dt: 0.5,
      speed: 18,
      slipRad: rightSlip,
      offTrackPointsCount: 0,
      isNearEdge: false,
    });
    assert.equal(sys.state.multiplier, 2);
    assert.equal(res.events.some((e) => e.type === 'TRANSITION'), true);
  });

  it('4. Deve aplicar bônus de borda de x1,5 quando isNearEdge é verdadeiro', () => {
    const sysNormal = createDriftSystem();
    const sysEdge = createDriftSystem();
    const slipRad = (28 * Math.PI) / 180;

    sysNormal.update({ dt: 0.3, speed: 19, slipRad, offTrackPointsCount: 0, isNearEdge: false });
    sysEdge.update({ dt: 0.3, speed: 19, slipRad, offTrackPointsCount: 0, isNearEdge: false });

    const p0Normal = sysNormal.state.pendingScore;
    const p0Edge = sysEdge.state.pendingScore;

    sysNormal.update({ dt: 1.0, speed: 19, slipRad, offTrackPointsCount: 0, isNearEdge: false });
    sysEdge.update({ dt: 1.0, speed: 19, slipRad, offTrackPointsCount: 0, isNearEdge: true });

    const deltaNormal = sysNormal.state.pendingScore - p0Normal;
    const deltaEdge = sysEdge.state.pendingScore - p0Edge;

    assert.ok(Math.abs(deltaEdge / deltaNormal - 1.5) < 0.01);
  });

  it('5. Deve guardar os pontos PENDENTES no TOTAL e voltar a x1 após 3 s sem drift', () => {
    const sys = createDriftSystem();
    const slipRad = (28 * Math.PI) / 180;

    // Derrapa por 2,5 s (sobe a x2 e acumula pontos pendentes)
    sys.update({ dt: 0.3, speed: 20, slipRad, offTrackPointsCount: 0, isNearEdge: false });
    sys.update({ dt: 2.2, speed: 20, slipRad, offTrackPointsCount: 0, isNearEdge: false });
    assert.ok(sys.state.pendingScore > 100);
    assert.equal(sys.state.multiplier, 2);

    // Sai do drift (0.25 s) e fica mais 3.0 s em linha reta
    sys.update({ dt: 0.25, speed: 20, slipRad: 0, offTrackPointsCount: 0, isNearEdge: false });
    sys.update({ dt: 3.05, speed: 20, slipRad: 0, offTrackPointsCount: 0, isNearEdge: false });

    assert.equal(sys.state.pendingScore, 0);
    assert.equal(sys.state.multiplier, 1);
    assert.ok(sys.state.totalScore > 100);
  });

  it('6. Sair com >= 5 de 9 pontos fora da pista deve zerar PENDENTES mas preservar TOTAL', () => {
    const sys = createDriftSystem();
    const slipRad = (28 * Math.PI) / 180;

    // Guarda 1ª sequência no TOTAL
    sys.update({ dt: 0.3, speed: 20, slipRad, offTrackPointsCount: 0, isNearEdge: false });
    sys.update({ dt: 1.5, speed: 20, slipRad, offTrackPointsCount: 0, isNearEdge: false });
    sys.bankPendingPoints();
    const savedTotal = sys.state.totalScore;
    assert.ok(savedTotal > 0);

    // Inicia 2ª sequência com pontos pendentes
    sys.update({ dt: 0.3, speed: 20, slipRad, offTrackPointsCount: 0, isNearEdge: false });
    sys.update({ dt: 2.2, speed: 20, slipRad, offTrackPointsCount: 0, isNearEdge: false });
    assert.ok(sys.state.pendingScore > 0);

    // Sai da pista com 5 de 9 pontos (> 50%)
    const res = sys.update({
      dt: 0.1,
      speed: 20,
      slipRad,
      offTrackPointsCount: 5,
      isNearEdge: false,
    });
    assert.equal(sys.state.pendingScore, 0);
    assert.equal(sys.state.multiplier, 1);
    assert.equal(sys.state.totalScore, savedTotal);
    assert.equal(res.events.some((e) => e.type === 'OFF_TRACK_PENALTY'), true);
  });

  it('7. Simulação de calibração: uma boa sequência realista deve atingir SUPERDRIFT entre 40 s e 60 s', () => {
    const sys = createDriftSystem(GAME_CONFIG);
    const dt = 0.05;
    let elapsed = 0;
    let triggerTime = null;

    // Simula condução realista pelo circuito: curvas em drift intercaladas com pequenas retas (< 3 s)
    while (elapsed < 75) {
      const cycle = elapsed % 7.6;
      const inCurve1 = cycle >= 0.2 && cycle < 2.6;
      const inCurve2 = cycle >= 3.7 && cycle < 6.1;
      let slipRad = 0;
      let nearEdge = false;

      if (inCurve1) {
        slipRad = (27 * Math.PI) / 180;
        nearEdge = cycle > 1.2 && cycle < 2.0;
      } else if (inCurve2) {
        slipRad = (-27 * Math.PI) / 180;
        nearEdge = cycle > 4.6 && cycle < 5.4;
      }

      const { events } = sys.update({
        dt,
        speed: 19.5,
        slipRad,
        offTrackPointsCount: 0,
        isNearEdge: nearEdge,
      });

      if (events.some((e) => e.type === 'SUPERDRIFT') && triggerTime === null) {
        triggerTime = elapsed;
        break;
      }
      elapsed += dt;
    }

    assert.notEqual(triggerTime, null, 'SUPERDRIFT deve disparar durante a simulação');
    assert.ok(
      triggerTime >= 40 && triggerTime <= 60,
      `Tempo de disparo (${triggerTime.toFixed(1)} s) deve estar entre 40 s e 60 s`
    );
    assert.equal(sys.state.victoryAchieved, true);
  });
});
