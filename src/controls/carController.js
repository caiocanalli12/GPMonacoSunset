import * as THREE from 'three';
import { GAME_CONFIG } from '../game/config.js';

/**
 * ============================================================================
 * MODELO DE CARRO ARCADE E CÂMERA EM 3ª PESSOA — ENTREGA M4 (FASE A + C)
 * ============================================================================
 * Estende o controlador do M1 sem usar motor de física externo.
 *
 * Como funciona a física arcade 2D no plano XZ (independente de frame rate):
 * 1. Mantemos o estado cinemático no plano: posição `(x, z)`, orientação `yaw`
 *    (`car.rotation.y`) e o vetor de velocidade no mundo `(vx, vz)` em m/s.
 * 2. A cada frame, após atualizar o esterço (`yaw`) proporcional à velocidade:
 *    - Decompomos o vetor velocidade `(vx, vz)` nos eixos locais do carro:
 *      componente frontal (`vForward = v · F`) e componente lateral (`vLateral = v · R`).
 *    - Quando o carro gira o nariz em alta velocidade, a inércia do vetor `(vx, vz)`
 *      no mundo faz surgir naturalmente uma componente lateral `vLateral`.
 *    - Aplicamos aceleração/freio/ré e arrasto longitudinal em `vForward`.
 *    - Aplicamos atrito lateral exponencial: `vLateral *= Math.exp(-grip * dt)`.
 *      Em condução normal o `grip` é alto (`7.2`), colando o carro na trajetória;
 *      ao puxar o freio de mão (`Espaço`) ou esterçar tudo em alta velocidade (*flick*),
 *      o `grip` cai drasticamente (`1.15` a `2.05`), permitindo derrapar de forma controlável!
 *    - Reconstruímos `vx` e `vz` no mundo e integramos `x += vx * dt`, `z += vz * dt`.
 * 3. O ângulo de deriva (*slip angle*) é `atan2(vLateral, vForward)`.
 * 4. A câmera em 3ª pessoa usa amortecimento exponencial `1 - exp(-k * dt)`,
 *    olha levemente na direção do vetor velocidade durante o drift, ajusta o FOV
 *    dinamicamente pela velocidade e aplica *camera shake* + pulso de FOV no SUPERDRIFT.
 */

const CAMERA_LOCAL_OFFSET = new THREE.Vector3(0, 4.3, 10.5);
const CAMERA_LOOK_OFFSET = new THREE.Vector3(0, 1.3, -6.5);
const UP_AXIS = new THREE.Vector3(0, 1, 0);

/**
 * Cria o controlador arcade do carro e da câmera 3ª pessoa.
 *
 * @param {THREE.Object3D} car Objeto 3D do carro normalizado
 * @param {THREE.PerspectiveCamera} camera Câmera principal do jogador
 * @param {{
 *   startPosition: THREE.Vector3,
 *   startRotationY: number,
 *   onResetRequest?: () => void,
 *   onTogglePause?: () => void,
 *   onToggleMute?: () => void,
 *   onFirstUserInput?: () => void
 * }} options
 */
export function createCarController(car, camera, options = {}) {
  const startPos = options.startPosition
    ? options.startPosition.clone()
    : car.position.clone();
  const startRotY =
    options.startRotationY !== undefined ? options.startRotationY : car.rotation.y;

  // Estado das teclas de direção e freio de mão
  const keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    handbrake: false,
  };

  // Estado cinemático no plano XZ (m/s e radianos)
  let vx = 0;
  let vz = 0;
  let vForward = 0;
  let vLateral = 0;
  let speedScalar = 0;
  let slipRad = 0;
  let isOffTrack = false;

  // Efeitos de câmera para o SUPERDRIFT (shake + soco de FOV)
  let shakeTimer = 0;
  let fovPunchOffset = 0;
  let currentDynamicFov = GAME_CONFIG.cameraBaseFov;
  let hasReceivedFirstInput = false;

  // Vetores auxiliares pré-alocados (zero alocação por frame no loop animate)
  const forwardAxis = new THREE.Vector3();
  const rightAxis = new THREE.Vector3();
  const desiredCameraPos = new THREE.Vector3();
  const desiredLookAt = new THREE.Vector3();
  const currentLookAt = new THREE.Vector3();
  const velocityLookOffset = new THREE.Vector3();
  const rearLeftWheelWorld = new THREE.Vector3();
  const rearRightWheelWorld = new THREE.Vector3();

  function notifyFirstInput() {
    if (!hasReceivedFirstInput) {
      hasReceivedFirstInput = true;
      options.onFirstUserInput?.();
    }
  }

  function handleKeyDown(event) {
    if (event.target && event.target.tagName === 'INPUT') return;

    notifyFirstInput();

    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        keys.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        keys.backward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        keys.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        keys.right = true;
        break;
      case 'Space':
        keys.handbrake = true;
        event.preventDefault();
        break;
      case 'KeyR':
        options.onResetRequest?.();
        break;
      case 'KeyP':
        options.onTogglePause?.();
        break;
      case 'KeyM':
        options.onToggleMute?.();
        break;
      default:
        break;
    }
  }

  function handleKeyUp(event) {
    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        keys.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        keys.backward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        keys.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        keys.right = false;
        break;
      case 'Space':
        keys.handbrake = false;
        break;
      default:
        break;
    }
  }

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  /**
   * Posiciona a câmera imediatamente atrás do carro (usado na inicialização e no Reset R).
   */
  function snapCameraToCar() {
    desiredCameraPos
      .copy(CAMERA_LOCAL_OFFSET)
      .applyAxisAngle(UP_AXIS, car.rotation.y)
      .add(car.position);

    desiredLookAt
      .copy(CAMERA_LOOK_OFFSET)
      .applyAxisAngle(UP_AXIS, car.rotation.y)
      .add(car.position);

    camera.position.copy(desiredCameraPos);
    currentLookAt.copy(desiredLookAt);
    camera.lookAt(currentLookAt);
  }

  /**
   * Reposiciona o carro na largada e zera velocidades (Tecla R).
   */
  function resetCarState() {
    car.position.copy(startPos);
    car.rotation.y = startRotY;
    car.rotation.z = 0;
    vx = 0;
    vz = 0;
    vForward = 0;
    vLateral = 0;
    speedScalar = 0;
    slipRad = 0;
    shakeTimer = 0;
    fovPunchOffset = 0;
    snapCameraToCar();
  }

  /**
   * Dispara o efeito de impacto visual na câmera quando o jogador atinge o SUPERDRIFT.
   */
  function triggerSuperdriftCameraPunch() {
    shakeTimer = GAME_CONFIG.cameraShakeSuperdriftDuration;
    fovPunchOffset = GAME_CONFIG.cameraSuperdriftFovPunch;
  }

  snapCameraToCar();

  /**
   * Atualiza a cinemática arcade do carro (decomposição frontal/lateral, grip, slip)
   * e a câmera em 3ª pessoa.
   *
   * @param {number} dt Delta time em segundos (limitado a 0.1 s)
   */
  function update(dt) {
    if (dt <= 0) return;

    const steerInput = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
    const currentSpeedMag = Math.hypot(vx, vz);

    // 1. ESTERÇO PROPORCIONAL À VELOCIDADE (Trava abaixo de minSteerSpeed)
    if (currentSpeedMag >= GAME_CONFIG.minSteerSpeed && steerInput !== 0) {
      const speedSpan = Math.max(0.1, GAME_CONFIG.steerFullSpeed - GAME_CONFIG.minSteerSpeed);
      const steerFactor = THREE.MathUtils.clamp(
        (currentSpeedMag - GAME_CONFIG.minSteerSpeed) / speedSpan,
        0.2,
        1.0
      );

      // Inverte o sentido de giro quando o carro está dando ré
      const reverseSign = vForward < -0.35 ? -1 : 1;
      const isDriftingNow = keys.handbrake || Math.abs(vLateral) > 2.2;
      const turnBoost = isDriftingNow ? GAME_CONFIG.driftTurnBoost : 1.0;

      car.rotation.y +=
        steerInput * GAME_CONFIG.turnSpeedMaxRad * steerFactor * turnBoost * reverseSign * dt;
    }

    // 2. EIXOS UNITÁRIOS FRENTE (-Z local) E DIREITA (+X local) NO PLANO XZ
    const sinY = Math.sin(car.rotation.y);
    const cosY = Math.cos(car.rotation.y);
    forwardAxis.set(-sinY, 0, -cosY);
    rightAxis.set(cosY, 0, -sinY);

    // 3. DECOMPOSIÇÃO DO VETOR VELOCIDADE EM COMPONENTE FRONTAL E LATERAL
    vForward = vx * forwardAxis.x + vz * forwardAxis.z;
    vLateral = vx * rightAxis.x + vz * rightAxis.z;

    // 4. FORÇAS LONGITUDINAIS (Aceleração, Freio, Ré e Arrasto)
    if (keys.forward && !keys.backward) {
      const accel =
        vForward < 0 ? GAME_CONFIG.brakingDeceleration : GAME_CONFIG.forwardAcceleration;
      vForward += accel * dt;
    } else if (keys.backward && !keys.forward) {
      const decel =
        vForward > 0.2 ? GAME_CONFIG.brakingDeceleration : GAME_CONFIG.reverseAcceleration;
      vForward -= decel * dt;
    } else {
      // Desaceleração natural de freio-motor quando nenhuma tecla longitudinal está ativa
      const coastStep = GAME_CONFIG.coastingBrake * dt;
      if (Math.abs(vForward) <= coastStep) {
        vForward = 0;
      } else {
        vForward -= Math.sign(vForward) * coastStep;
      }
    }

    // Arrasto longitudinal proporcional à velocidade (aumenta fora da pista ou com freio de mão)
    let longitudinalDrag = GAME_CONFIG.forwardDrag;
    if (isOffTrack) {
      longitudinalDrag += GAME_CONFIG.offTrackExtraDrag;
    }
    if (keys.handbrake && vForward > 0) {
      longitudinalDrag += GAME_CONFIG.handbrakeForwardDrag * 0.35;
    }
    vForward *= Math.exp(-longitudinalDrag * dt);
    vForward = THREE.MathUtils.clamp(
      vForward,
      GAME_CONFIG.maxReverseSpeed,
      GAME_CONFIG.maxForwardSpeed
    );

    // 5. ATRITO LATERAL COM FATOR exp(-grip * dt) (Freio de mão e "Flick" em alta velocidade)
    const isHighSpeedFlick =
      Math.abs(steerInput) > 0 && vForward >= GAME_CONFIG.flickSpeedThreshold;

    let currentGrip = GAME_CONFIG.lateralGripNormal;
    if (keys.handbrake) {
      currentGrip = GAME_CONFIG.lateralGripHandbrake;
      // Ao puxar o freio de mão esterçando, aplica um leve impulso na traseira para iniciar o drift
      if (steerInput !== 0 && vForward > 5.0) {
        vLateral += steerInput * GAME_CONFIG.handbrakeSlipImpulse * dt;
      }
    } else if (isHighSpeedFlick) {
      currentGrip = GAME_CONFIG.lateralGripFlick;
      vLateral += steerInput * (GAME_CONFIG.handbrakeSlipImpulse * 0.45) * dt;
    }

    vLateral *= Math.exp(-currentGrip * dt);
    if (Math.abs(vLateral) < 0.02) {
      vLateral = 0;
    }

    // 6. RECONSTRUÇÃO DO VETOR VELOCIDADE NO MUNDO E INTEGRAÇÃO DE POSIÇÃO
    vx = forwardAxis.x * vForward + rightAxis.x * vLateral;
    vz = forwardAxis.z * vForward + rightAxis.z * vLateral;

    speedScalar = Math.hypot(vx, vz);

    // Ângulo de deriva (slip) = atan2(lateral, frontal)
    if (speedScalar > 1.0) {
      slipRad = Math.atan2(vLateral, Math.max(Math.abs(vForward), 0.5));
    } else {
      slipRad = 0;
    }

    car.position.x += vx * dt;
    car.position.z += vz * dt;

    // Leve inclinação visual da carroceria (roll) proporcional à força lateral para feedback tátil
    const targetRoll = THREE.MathUtils.clamp(-vLateral * 0.012, -0.09, 0.09);
    car.rotation.z = THREE.MathUtils.lerp(car.rotation.z, targetRoll, 1 - Math.exp(-10 * dt));

    // 7. RESTRIÇÃO AOS LIMITES INVISÍVEIS DO MAPA
    const bounds = GAME_CONFIG.mapBounds;
    const clampedX = THREE.MathUtils.clamp(car.position.x, bounds.minX, bounds.maxX);
    const clampedZ = THREE.MathUtils.clamp(car.position.z, bounds.minZ, bounds.maxZ);

    if (clampedX !== car.position.x || clampedZ !== car.position.z) {
      car.position.x = clampedX;
      car.position.z = clampedZ;
      vx *= 0.4;
      vz *= 0.4;
      vForward *= 0.4;
      vLateral *= 0.4;
    }

    // 8. CÂMERA EM 3ª PESSOA (Olha levemente na direção da velocidade + FOV dinâmico + Shake)
    desiredCameraPos
      .copy(CAMERA_LOCAL_OFFSET)
      .applyAxisAngle(UP_AXIS, car.rotation.y)
      .add(car.position);

    desiredLookAt
      .copy(CAMERA_LOOK_OFFSET)
      .applyAxisAngle(UP_AXIS, car.rotation.y)
      .add(car.position);

    // Desloca suavemente o ponto de mira na direção do vetor velocidade (destaca o ângulo do drift)
    velocityLookOffset.set(vx, 0, vz).multiplyScalar(GAME_CONFIG.cameraVelocityLookAhead);
    desiredLookAt.add(velocityLookOffset);

    const smoothingAlpha = 1 - Math.exp(-GAME_CONFIG.cameraSmoothingK * dt);
    camera.position.lerp(desiredCameraPos, smoothingAlpha);
    currentLookAt.lerp(desiredLookAt, smoothingAlpha);

    // Camera shake temporário quando o SUPERDRIFT é disparado
    if (shakeTimer > 0) {
      shakeTimer = Math.max(0, shakeTimer - dt);
      const shakeFactor =
        (shakeTimer / GAME_CONFIG.cameraShakeSuperdriftDuration) *
        GAME_CONFIG.cameraShakeIntensity;
      camera.position.x += Math.sin(shakeTimer * 48.0) * shakeFactor;
      camera.position.y += Math.cos(shakeTimer * 62.0) * shakeFactor * 0.6;
    }

    camera.lookAt(currentLookAt);

    // FOV dinâmico pela velocidade + amortecimento do "soco" de FOV do SUPERDRIFT
    if (fovPunchOffset > 0.05) {
      fovPunchOffset *= Math.exp(-4.5 * dt);
    } else {
      fovPunchOffset = 0;
    }

    const speedRatio = THREE.MathUtils.clamp(
      speedScalar / GAME_CONFIG.maxForwardSpeed,
      0,
      1
    );
    const targetFov =
      GAME_CONFIG.cameraBaseFov +
      speedRatio * GAME_CONFIG.cameraMaxSpeedFovBoost +
      fovPunchOffset;

    if (Math.abs(targetFov - currentDynamicFov) > 0.05) {
      currentDynamicFov = THREE.MathUtils.lerp(
        currentDynamicFov,
        targetFov,
        1 - Math.exp(-6.0 * dt)
      );
      camera.fov = currentDynamicFov;
      camera.updateProjectionMatrix();
    }
  }

  /**
   * Calcula a posição no mundo das duas rodas traseiras (para emissão de fumaça e marcas de pneu
   * na Fase C sem alocar novos vetores).
   */
  function getRearWheelPositions() {
    const sinY = Math.sin(car.rotation.y);
    const cosY = Math.cos(car.rotation.y);
    const halfTrack = 0.78;
    const rearZ = 1.45; // +Z local é a traseira do carro

    rearLeftWheelWorld.set(
      car.position.x + -halfTrack * cosY + rearZ * sinY,
      0.08,
      car.position.z - -halfTrack * sinY + rearZ * cosY
    );
    rearRightWheelWorld.set(
      car.position.x + halfTrack * cosY + rearZ * sinY,
      0.08,
      car.position.z - halfTrack * sinY + rearZ * cosY
    );

    return { left: rearLeftWheelWorld, right: rearRightWheelWorld };
  }

  return {
    update,
    resetCarState,
    snapCameraToCar,
    triggerSuperdriftCameraPunch,
    setOffTrack: (offTrackFlag) => {
      isOffTrack = Boolean(offTrackFlag);
    },
    getSpeed: () => (vForward < -0.1 ? -speedScalar : speedScalar),
    getSpeedAbs: () => speedScalar,
    getSlipRad: () => slipRad,
    getSlipDeg: () => (slipRad * 180) / Math.PI,
    isHandbrakeActive: () => keys.handbrake,
    getRearWheelPositions,
  };
}
