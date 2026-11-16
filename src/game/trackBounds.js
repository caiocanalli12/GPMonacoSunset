import * as THREE from 'three';
import { GAME_CONFIG } from './config.js';

/**
 * ============================================================================
 * DETECÇÃO DE PISTA E BORDAS POR AMOSTRAGEM DE 9 PONTOS — ENTREGA M4 (ITEM 4)
 * ============================================================================
 * Como funciona a detecção geométrica sem motor de física:
 * 1. Na inicialização, pré-calculamos `N = 600` pontos igualmente espaçados ao longo da
 *    mesma `CatmullRomCurve3` fechada que gerou a malha da pista (`curve.getSpacedPoints(600)`).
 * 2. Definimos 9 pontos locais na pegada retangular do carro no plano XZ:
 *    - 4 cantos (frente-esq, frente-dir, trás-esq, trás-dir);
 *    - 4 meios de lado (frente-meio, trás-meio, lateral-esq, lateral-dir);
 *    - 1 ponto central (0, 0).
 * 3. A cada frame, transformamos esses 9 pontos para coordenadas de mundo usando a posição
 *    `(car.x, car.z)` e o ângulo `yaw` (`car.rotation.y`), sem alocar `new Vector3()`.
 * 4. Para cada um dos 9 pontos, medimos a menor distância horizontal `d` até os 600 pontos
 *    da curva central da pista:
 *    - Se `d > meiaLargura` (`5,5 m`), aquele ponto está FORA do asfalto;
 *    - Se `5 ou mais dos 9 pontos` (> 50%) estiverem fora, o carro saiu da pista;
 *    - Se o carro estiver dentro da pista e algum ponto estiver a menos de ~1,0 m da borda
 *      (`meiaLargura - 1.05 <= d <= meiaLargura`), ativamos o BÔNUS DE BORDA (`x1,5`).
 */

const COLOR_INSIDE = new THREE.Color(0x4ade80);     // Verde: ponto dentro da pista
const COLOR_EDGE_BONUS = new THREE.Color(0xfacc15); // Amarelo: ponto na faixa de bônus de borda (< 1m)
const COLOR_OUTSIDE = new THREE.Color(0xef4444);    // Vermelho: ponto fora da pista

/**
 * Cria o avaliador de limites da pista e as 9 esferas visuais de depuração.
 *
 * @param {THREE.CatmullRomCurve3} trackCurve Curva paramétrica fechada da pista
 * @param {THREE.Scene} scene Cena principal (para anexar as 9 esferas de diagnóstico)
 */
export function createTrackBoundsChecker(trackCurve, scene) {
  const sampleCount = GAME_CONFIG.trackSamplePointsCount;
  const rawPoints = trackCurve.getSpacedPoints(sampleCount);

  // Armazena os 600 pontos em arrays planos Float32Array para leitura rápida na CPU
  const curveX = new Float32Array(rawPoints.length);
  const curveZ = new Float32Array(rawPoints.length);
  for (let i = 0; i < rawPoints.length; i++) {
    curveX[i] = rawPoints[i].x;
    curveZ[i] = rawPoints[i].z;
  }

  // Coordenadas normalizadas (-1, 0, +1) dos 9 pontos da pegada do carro:
  // 4 cantos + 4 meios de lado + 1 centro
  const footprintTemplate = [
    { nx: -1, nz: -1, label: 'Canto Frontal Esq.' },
    { nx:  0, nz: -1, label: 'Meio Frontal' },
    { nx:  1, nz: -1, label: 'Canto Frontal Dir.' },
    { nx: -1, nz:  0, label: 'Meio Lateral Esq.' },
    { nx:  0, nz:  0, label: 'Centro do Carro' },
    { nx:  1, nz:  0, label: 'Meio Lateral Dir.' },
    { nx: -1, nz:  1, label: 'Canto Traseiro Esq.' },
    { nx:  0, nz:  1, label: 'Meio Traseiro' },
    { nx:  1, nz:  1, label: 'Canto Traseiro Dir.' },
  ];

  // Grupo com as 9 esferas para o toggle "Mostrar pontos de detecção" no painel
  const debugGroup = new THREE.Group();
  debugGroup.name = 'Grupo9PontosDeteccaoPista';
  debugGroup.visible = false;
  debugGroup.userData.ignoreDiagnostics = true;

  const sphereGeo = new THREE.SphereGeometry(0.18, 10, 10);
  const debugSpheres = footprintTemplate.map((pt, idx) => {
    const mat = new THREE.MeshBasicMaterial({
      color: COLOR_INSIDE,
      depthTest: false, // Permite enxergar claramente os 9 pontos sobre a carroceria/asfalto
      transparent: true,
      opacity: 0.95,
    });
    mat.userData.ignoreDiagnostics = true;
    const mesh = new THREE.Mesh(sphereGeo, mat);
    mesh.renderOrder = 10;
    mesh.name = `PontoPegada_${idx + 1}_${pt.label}`;
    mesh.userData.ignoreDiagnostics = true;
    debugGroup.add(mesh);
    return mesh;
  });

  if (scene) {
    scene.add(debugGroup);
  }

  // Buffers pré-alocados para os 9 pontos no espaço de mundo (zero alocação por frame)
  const worldPointsX = new Float32Array(9);
  const worldPointsZ = new Float32Array(9);

  /**
   * Calcula a menor distância quadrada de um ponto (px, pz) à poligonal de 600 pontos da pista.
   *
   * @param {number} px
   * @param {number} pz
   * @returns {number} Distância euclidiana em metros até o centro da pista mais próximo
   */
  function getDistanceToTrackCenter(px, pz) {
    let minDistSq = Infinity;
    const n = curveX.length;
    for (let i = 0; i < n; i++) {
      const dx = px - curveX[i];
      const dz = pz - curveZ[i];
      const dSq = dx * dx + dz * dz;
      if (dSq < minDistSq) {
        minDistSq = dSq;
      }
    }
    return Math.sqrt(minDistSq);
  }

  /**
   * Avalia os 9 pontos da pegada do carro para o frame atual.
   *
   * @param {number} carX Posição X do carro
   * @param {number} carZ Posição Z do carro
   * @param {number} carYaw Ângulo de rotação Y do carro (radianos)
   * @returns {{
   *   offTrackPointsCount: number,
   *   isOffTrack: boolean,
   *   isNearEdge: boolean,
   *   centerDistance: number
   * }}
   */
  function evaluateCarFootprint(carX, carZ, carYaw) {
    const halfW = GAME_CONFIG.carFootprintHalfWidth;
    const halfL = GAME_CONFIG.carFootprintHalfLength;
    const trackHalfWidth = GAME_CONFIG.trackWidth * 0.5;
    const edgeBonusMinDist = Math.max(0, trackHalfWidth - GAME_CONFIG.edgeBonusDistanceMeters);

    const cosY = Math.cos(carYaw);
    const sinY = Math.sin(carYaw);

    let offTrackPointsCount = 0;
    let edgePointsCount = 0;
    let centerDistance = 0;

    for (let i = 0; i < 9; i++) {
      const tpl = footprintTemplate[i];
      const lx = tpl.nx * halfW;
      const lz = tpl.nz * halfL;

      // Rotação 2D no plano XZ compatível com Three.js (rotation.y em torno de +Y)
      const wx = carX + lx * cosY + lz * sinY;
      const wz = carZ - lx * sinY + lz * cosY;

      worldPointsX[i] = wx;
      worldPointsZ[i] = wz;

      const dist = getDistanceToTrackCenter(wx, wz);
      if (i === 4) {
        centerDistance = dist;
      }

      const isPointOut = dist > trackHalfWidth;
      const isPointNearEdge = !isPointOut && dist >= edgeBonusMinDist;

      if (isPointOut) {
        offTrackPointsCount += 1;
      } else if (isPointNearEdge) {
        edgePointsCount += 1;
      }

      // Se as esferas de depuração estiverem visíveis, atualiza posição e cor (verde/amarelo/vermelho)
      if (debugGroup.visible) {
        const sphere = debugSpheres[i];
        sphere.position.set(wx, 0.28, wz);
        if (isPointOut) {
          sphere.material.color.copy(COLOR_OUTSIDE);
        } else if (isPointNearEdge) {
          sphere.material.color.copy(COLOR_EDGE_BONUS);
        } else {
          sphere.material.color.copy(COLOR_INSIDE);
        }
      }
    }

    const isOffTrack = offTrackPointsCount >= GAME_CONFIG.offTrackPointsThreshold;
    const isNearEdge = !isOffTrack && edgePointsCount > 0;

    return {
      offTrackPointsCount,
      isOffTrack,
      isNearEdge,
      centerDistance,
    };
  }

  function setShowDebugPoints(visible) {
    debugGroup.visible = Boolean(visible);
  }

  return {
    evaluateCarFootprint,
    setShowDebugPoints,
    isShowingDebugPoints: () => debugGroup.visible,
    debugGroup,
  };
}
