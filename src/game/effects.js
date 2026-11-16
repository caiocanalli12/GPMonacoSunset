import * as THREE from 'three';
import { GAME_CONFIG } from './config.js';

/**
 * ============================================================================
 * EFEITOS DE DRIFT COM POOLING E ZERO ALOCAÇÃO POR FRAME — ENTREGA M4 (FASE C)
 * ============================================================================
 * Implementa:
 * 10.a) Fumaça nos pneus traseiros: UM ÚNICO `THREE.Points` com pool fixo de 300
 *       partículas e textura radial suave gerada em `<canvas>`;
 * 10.b) Marcas de pneu no asfalto: UM ÚNICO `THREE.Mesh` com `BufferGeometry` em
 *       *ring buffer* (buffer circular), `polygonOffset: true` e `depthWrite: false`
 *       para nunca causar z-fighting nem interferir no caso diagnóstico da Fase B;
 * 10.d) Faíscas/confete dourado-magenta no disparo do `SUPERDRIFT`: UM ÚNICO
 *       `THREE.Points` com pool fixo de 120 partículas (visível apenas na comemoração).
 *
 * Custo em `renderer.info`: apenas +2 draw calls durante o drift (+1 fumaça, +1 marcas).
 */

/**
 * Cria uma textura radial suave em Canvas para as partículas de fumaça.
 */
function createSmokePuffTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createRadialGradient(
    size * 0.5,
    size * 0.5,
    2,
    size * 0.5,
    size * 0.5,
    size * 0.48
  );
  grad.addColorStop(0.0, 'rgba(255, 245, 238, 0.95)');
  grad.addColorStop(0.45, 'rgba(235, 215, 205, 0.55)');
  grad.addColorStop(1.0, 'rgba(200, 180, 175, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Inicializa os pools de fumaça, marcas de pneu (ring buffer) e confete/faíscas do SUPERDRIFT.
 *
 * @param {THREE.Scene} scene Cena principal
 */
export function createDriftEffects(scene) {
  // ==========================================================================
  // 1. POOL DE FUMAÇA DOS PNEUS TRASEIROS (1 único THREE.Points com 300 partículas)
  // ==========================================================================
  const smokeCount = GAME_CONFIG.smokePoolSize;
  const smokePositions = new Float32Array(smokeCount * 3);
  const smokeColors = new Float32Array(smokeCount * 3);
  const smokeVelocities = new Float32Array(smokeCount * 3);
  const smokeAges = new Float32Array(smokeCount);
  const smokeLifetimes = new Float32Array(smokeCount);

  // Inicializa todas as partículas inativas (escondidas abaixo do solo)
  for (let i = 0; i < smokeCount; i++) {
    smokePositions[i * 3 + 1] = -1000;
    smokeAges[i] = 999;
    smokeLifetimes[i] = 1.0;
  }

  const smokeGeo = new THREE.BufferGeometry();
  const smokePosAttr = new THREE.BufferAttribute(smokePositions, 3);
  smokePosAttr.setUsage(THREE.DynamicDrawUsage);
  const smokeColAttr = new THREE.BufferAttribute(smokeColors, 3);
  smokeColAttr.setUsage(THREE.DynamicDrawUsage);

  smokeGeo.setAttribute('position', smokePosAttr);
  smokeGeo.setAttribute('color', smokeColAttr);

  const smokeMat = new THREE.PointsMaterial({
    size: 1.85,
    map: createSmokePuffTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  smokeMat.userData.ignoreDiagnostics = true;

  const smokePoints = new THREE.Points(smokeGeo, smokeMat);
  smokePoints.name = 'PoolFumacaDrift';
  smokePoints.frustumCulled = false;
  smokePoints.userData.ignoreDiagnostics = true;
  scene.add(smokePoints);

  let smokeCursor = 0;
  let smokeSpawnAccum = 0;

  function spawnSmokeParticle(x, y, z) {
    const idx = smokeCursor;
    smokeCursor = (smokeCursor + 1) % smokeCount;

    const i3 = idx * 3;
    smokePositions[i3] = x + (Math.random() - 0.5) * 0.28;
    smokePositions[i3 + 1] = y + 0.08;
    smokePositions[i3 + 2] = z + (Math.random() - 0.5) * 0.28;

    smokeVelocities[i3] = (Math.random() - 0.5) * 1.4;
    smokeVelocities[i3 + 1] = 0.75 + Math.random() * 0.85;
    smokeVelocities[i3 + 2] = (Math.random() - 0.5) * 1.4;

    smokeAges[idx] = 0;
    smokeLifetimes[idx] = 0.55 + Math.random() * 0.35;

    // Tom quente rosado/creme iluminado pelo pôr do sol
    smokeColors[i3] = 0.95;
    smokeColors[i3 + 1] = 0.82;
    smokeColors[i3 + 2] = 0.76;
  }

  // ==========================================================================
  // 2. MARCAS DE PNEU EM RING BUFFER (1 único BufferGeometry + polygonOffset)
  // ==========================================================================
  const maxSegs = GAME_CONFIG.skidMarksMaxSegments;
  // Cada segmento grava 2 quads (roda esquerda + roda direita) = 4 triângulos = 12 vértices
  const vertsPerRecord = 12;
  const totalSkidVerts = maxSegs * vertsPerRecord;
  const skidPositions = new Float32Array(totalSkidVerts * 3);

  const skidGeo = new THREE.BufferGeometry();
  const skidPosAttr = new THREE.BufferAttribute(skidPositions, 3);
  skidPosAttr.setUsage(THREE.DynamicDrawUsage);
  skidGeo.setAttribute('position', skidPosAttr);

  const skidMat = new THREE.MeshBasicMaterial({
    color: 0x111216,
    transparent: true,
    opacity: 0.56,
    depthWrite: false,       // Não escreve no depth buffer para jamais causar z-fighting
    polygonOffset: true,     // Empurra a profundidade lógica levemente em direção à câmera
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    side: THREE.DoubleSide,
  });
  skidMat.userData.ignoreDiagnostics = true;

  const skidMesh = new THREE.Mesh(skidGeo, skidMat);
  skidMesh.name = 'RingBufferMarcasPneu';
  skidMesh.frustumCulled = false;
  skidMesh.visible = GAME_CONFIG.skidMarksEnabled;
  skidMesh.userData.ignoreDiagnostics = true;
  scene.add(skidMesh);

  let skidWriteIndex = 0;
  let hasPrevWheelPos = false;
  let prevLeftX = 0;
  let prevLeftZ = 0;
  let prevRightX = 0;
  let prevRightZ = 0;

  function appendQuadToSkidBuffer(baseFloatIdx, x0, z0, x1, z1, halfWidth, yLevel) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    if (len < 0.001) return;

    // Perpendicular no plano XZ para dar largura ao rastro do pneu
    const nx = (-dz / len) * halfWidth;
    const nz = (dx / len) * halfWidth;

    const ax = x0 - nx, az = z0 - nz;
    const bx = x0 + nx, bz = z0 + nz;
    const cx = x1 - nx, cz = z1 - nz;
    const ex = x1 + nx, ez = z1 + nz;

    // Triângulo 1 (A, B, C)
    skidPositions[baseFloatIdx + 0] = ax;
    skidPositions[baseFloatIdx + 1] = yLevel;
    skidPositions[baseFloatIdx + 2] = az;

    skidPositions[baseFloatIdx + 3] = bx;
    skidPositions[baseFloatIdx + 4] = yLevel;
    skidPositions[baseFloatIdx + 5] = bz;

    skidPositions[baseFloatIdx + 6] = cx;
    skidPositions[baseFloatIdx + 7] = yLevel;
    skidPositions[baseFloatIdx + 8] = cz;

    // Triângulo 2 (B, E, C)
    skidPositions[baseFloatIdx + 9] = bx;
    skidPositions[baseFloatIdx + 10] = yLevel;
    skidPositions[baseFloatIdx + 11] = bz;

    skidPositions[baseFloatIdx + 12] = ex;
    skidPositions[baseFloatIdx + 13] = yLevel;
    skidPositions[baseFloatIdx + 14] = ez;

    skidPositions[baseFloatIdx + 15] = cx;
    skidPositions[baseFloatIdx + 16] = yLevel;
    skidPositions[baseFloatIdx + 17] = cz;
  }

  function clearSkidMarks() {
    skidPositions.fill(0);
    skidPosAttr.needsUpdate = true;
    skidWriteIndex = 0;
    hasPrevWheelPos = false;
  }

  // ==========================================================================
  // 3. FAÍSCAS E CONFETE NO SUPERDRIFT (1 único THREE.Points com 120 partículas)
  // ==========================================================================
  const burstCount = 120;
  const burstPositions = new Float32Array(burstCount * 3);
  const burstColors = new Float32Array(burstCount * 3);
  const burstVelocities = new Float32Array(burstCount * 3);
  let burstTimer = 0;

  const burstGeo = new THREE.BufferGeometry();
  const burstPosAttr = new THREE.BufferAttribute(burstPositions, 3);
  burstPosAttr.setUsage(THREE.DynamicDrawUsage);
  const burstColAttr = new THREE.BufferAttribute(burstColors, 3);
  burstGeo.setAttribute('position', burstPosAttr);
  burstGeo.setAttribute('color', burstColAttr);

  const burstMat = new THREE.PointsMaterial({
    size: 0.42,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  burstMat.userData.ignoreDiagnostics = true;

  const burstPoints = new THREE.Points(burstGeo, burstMat);
  burstPoints.name = 'PoolConfeteSuperdrift';
  burstPoints.visible = false;
  burstPoints.frustumCulled = false;
  burstPoints.userData.ignoreDiagnostics = true;
  scene.add(burstPoints);

  function triggerSuperdriftBurst(originPos) {
    burstTimer = 2.6;
    burstPoints.visible = true;

    for (let i = 0; i < burstCount; i++) {
      const i3 = i * 3;
      const angle = Math.random() * Math.PI * 2;
      const speed = 3.5 + Math.random() * 9.5;

      burstPositions[i3] = originPos.x + (Math.random() - 0.5) * 1.8;
      burstPositions[i3 + 1] = originPos.y + 0.8 + Math.random() * 1.2;
      burstPositions[i3 + 2] = originPos.z + (Math.random() - 0.5) * 1.8;

      burstVelocities[i3] = Math.cos(angle) * speed;
      burstVelocities[i3 + 1] = 4.5 + Math.random() * 7.5;
      burstVelocities[i3 + 2] = Math.sin(angle) * speed;

      // Paleta pôr do sol: ouro, laranja neon e magenta
      const paletteChoice = i % 3;
      if (paletteChoice === 0) {
        burstColors[i3] = 1.0;
        burstColors[i3 + 1] = 0.85;
        burstColors[i3 + 2] = 0.25;
      } else if (paletteChoice === 1) {
        burstColors[i3] = 1.0;
        burstColors[i3 + 1] = 0.45;
        burstColors[i3 + 2] = 0.18;
      } else {
        burstColors[i3] = 1.0;
        burstColors[i3 + 1] = 0.22;
        burstColors[i3 + 2] = 0.62;
      }
    }
    burstPosAttr.needsUpdate = true;
    burstColAttr.needsUpdate = true;
  }

  /**
   * Atualiza os 3 sistemas de efeitos usando apenas os arrays tipados pré-alocados.
   *
   * @param {{
   *   dt: number,
   *   isDrifting: boolean,
   *   isHandbrake: boolean,
   *   isOffTrack: boolean,
   *   speedAbs: number,
   *   rearWheels: { left: THREE.Vector3, right: THREE.Vector3 },
   *   carPosition: THREE.Vector3
   * }} params
   */
  function update({
    dt,
    isDrifting,
    isHandbrake,
    isOffTrack,
    speedAbs,
    rearWheels,
    carPosition,
  }) {
    if (dt <= 0) return;

    const emitActive = (isDrifting || (isHandbrake && speedAbs > 6.0)) && !isOffTrack;

    // 1. Emissão e atualização do pool de fumaça
    if (emitActive) {
      smokeSpawnAccum += dt * 55.0; // ~55 partículas/s divididas entre as duas rodas traseiras
      while (smokeSpawnAccum >= 1.0) {
        smokeSpawnAccum -= 1.0;
        spawnSmokeParticle(rearWheels.left.x, rearWheels.left.y, rearWheels.left.z);
        spawnSmokeParticle(rearWheels.right.x, rearWheels.right.y, rearWheels.right.z);
      }
    }

    let anySmokeAlive = false;
    for (let i = 0; i < smokeCount; i++) {
      const age = smokeAges[i];
      const life = smokeLifetimes[i];
      if (age < life) {
        anySmokeAlive = true;
        const nextAge = age + dt;
        smokeAges[i] = nextAge;
        const i3 = i * 3;

        if (nextAge >= life) {
          smokePositions[i3 + 1] = -1000;
        } else {
          // Expansão e subida suave com desaceleração horizontal
          smokePositions[i3] += smokeVelocities[i3] * dt;
          smokePositions[i3 + 1] += smokeVelocities[i3 + 1] * dt;
          smokePositions[i3 + 2] += smokeVelocities[i3 + 2] * dt;

          const fade = 1.0 - nextAge / life;
          smokeColors[i3] = 0.95 * fade;
          smokeColors[i3 + 1] = 0.82 * fade;
          smokeColors[i3 + 2] = 0.76 * fade;
        }
      }
    }
    if (anySmokeAlive) {
      smokePosAttr.needsUpdate = true;
      smokeColAttr.needsUpdate = true;
    }

    // 2. Gravação das marcas de pneu no ring buffer
    if (skidMesh.visible && emitActive) {
      const lx = rearWheels.left.x;
      const lz = rearWheels.left.z;
      const rx = rearWheels.right.x;
      const rz = rearWheels.right.z;

      if (!hasPrevWheelPos) {
        prevLeftX = lx;
        prevLeftZ = lz;
        prevRightX = rx;
        prevRightZ = rz;
        hasPrevWheelPos = true;
      } else {
        const distMoved = Math.hypot(lx - prevLeftX, lz - prevLeftZ);
        if (distMoved >= 0.32 && distMoved < 3.5) {
          const baseFloat = skidWriteIndex * vertsPerRecord * 3;
          const tireHalfW = 0.14;
          const yLevel = 0.053; // Ligeiramente acima do asfalto (0.05) + polygonOffset

          // Roda esquerda (primeiros 6 vértices = 18 floats)
          appendQuadToSkidBuffer(baseFloat, prevLeftX, prevLeftZ, lx, lz, tireHalfW, yLevel);
          // Roda direita (próximos 6 vértices = 18 floats)
          appendQuadToSkidBuffer(
            baseFloat + 18,
            prevRightX,
            prevRightZ,
            rx,
            rz,
            tireHalfW,
            yLevel
          );

          skidWriteIndex = (skidWriteIndex + 1) % maxSegs;
          skidPosAttr.needsUpdate = true;

          prevLeftX = lx;
          prevLeftZ = lz;
          prevRightX = rx;
          prevRightZ = rz;
        } else if (distMoved >= 3.5) {
          prevLeftX = lx;
          prevLeftZ = lz;
          prevRightX = rx;
          prevRightZ = rz;
        }
      }
    } else {
      hasPrevWheelPos = false;
    }

    // 3. Atualização das faíscas/confete do SUPERDRIFT
    if (burstTimer > 0) {
      burstTimer = Math.max(0, burstTimer - dt);
      for (let i = 0; i < burstCount; i++) {
        const i3 = i * 3;
        burstVelocities[i3 + 1] -= 12.0 * dt; // Gravidade leve
        burstPositions[i3] += burstVelocities[i3] * dt;
        burstPositions[i3 + 1] = Math.max(0.08, burstPositions[i3 + 1] + burstVelocities[i3 + 1] * dt);
        burstPositions[i3 + 2] += burstVelocities[i3 + 2] * dt;
      }
      burstMat.opacity = Math.min(1.0, burstTimer * 0.8);
      burstPosAttr.needsUpdate = true;

      if (burstTimer <= 0) {
        burstPoints.visible = false;
      }
    }
  }

  function setSkidMarksEnabled(enabled) {
    GAME_CONFIG.skidMarksEnabled = Boolean(enabled);
    skidMesh.visible = Boolean(enabled);
  }

  return {
    update,
    clearSkidMarks,
    setSkidMarksEnabled,
    triggerSuperdriftBurst,
  };
}
