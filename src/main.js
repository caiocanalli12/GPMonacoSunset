import * as THREE from 'three';
import { createEnvironment } from './scene/environment.js';
import { createTrack } from './scene/track.js';
import { createLights } from './scene/lights.js';
import { loadAndPopulateModels } from './scene/models.js';
import { loadSceneTextures } from './materials/textures.js';
import { createSceneMaterials } from './materials/materials.js';
import { createCarController } from './controls/carController.js';
import { createDriftSystem } from './game/driftSystem.js';
import { createTrackBoundsChecker } from './game/trackBounds.js';
import { createGameHud } from './game/hud.js';
import { createDriftEffects } from './game/effects.js';
import { createGameAudio } from './game/audio.js';
import { createDiagnostics } from './debug/diagnostics.js';
import { createLightPanel } from './debug/lightPanel.js';
import { createMaterialPanel } from './debug/materialPanel.js';
import { createGamePanel } from './debug/gamePanel.js';
import { createZFightingPanel } from './debug/zFightingPanel.js';

/**
 * ============================================================================
 * CONFIGURAÇÕES GERAIS DE INICIALIZAÇÃO E PIPELINE (M1 + M2 + M3 + M4)
 * ============================================================================
 */
const PLAYER_FOV = 60;                  // Campo de visão vertical inicial da câmera do jogador (graus)
const PLAYER_NEAR = 0.5;                // Plano de recorte próximo inicial (m)
const PLAYER_FAR = 260.0;               // Plano de recorte distante inicial (m)

const TOP_CAMERA_FOV = 55;              // FOV da 2ª câmera (visão aérea para o Item 4)
const TOP_CAMERA_POS = new THREE.Vector3(5, 235, 0);
const TOP_CAMERA_TARGET = new THREE.Vector3(5, 0, 0);

const TONE_MAPPING_EXPOSURE = 0.88;     // Exposição calibrada para preservar a meia-luz do pôr do sol (M2 + M3)

// Limite máximo de delta time (0,1 s = 100 ms) exigido pela especificação do M1
// para evitar que o carro dê um salto enorme ao voltar de outra aba do navegador.
const MAX_DELTA_SECONDS = 0.1;

// Intervalo mínimo entre quadros quando o modo de teste de 30 FPS está ativo (~33,3 ms)
const TARGET_30_FPS_MS = 1000 / 30;

/**
 * Ponto de entrada principal da aplicação Monaco Sunset GP (Marcos M1, M2, M3 e M4).
 */
async function init() {
  const container = document.getElementById('app');

  // 1. CRIAÇÃO DA CENA E DO RENDERIZADOR WEBGL (com sombras e gerenciamento de cor M2)
  const scene = new THREE.Scene();

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Espaço de cor de saída sRGB e mapeamento tonal fílmico ACES para evitar estouro nas luzes quentes
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = TONE_MAPPING_EXPOSURE;

  // Habilita mapas de sombra com PCF suave (no Three.js r186+, PCFShadowMap incorpora o filtro
  // suave em disco de Vogel controlado por `shadow.radius`, substituindo o antigo PCFSoftShadowMap)
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  container.appendChild(renderer.domElement);

  // 2. CONFIGURAÇÃO DAS CÂMERAS (1ª: Jogador em 3ª pessoa | 2ª: Visão aérea do Frustum)
  const initialAspect = window.innerWidth / Math.max(window.innerHeight, 1);

  const playerCamera = new THREE.PerspectiveCamera(
    PLAYER_FOV,
    initialAspect,
    PLAYER_NEAR,
    PLAYER_FAR
  );

  const topCamera = new THREE.PerspectiveCamera(
    TOP_CAMERA_FOV,
    initialAspect,
    5.0,
    500.0
  );
  topCamera.position.copy(TOP_CAMERA_POS);
  // Define o vetor "up" da câmera de topo para -Z para que o Norte da pista fique para cima na tela
  topCamera.up.set(0, 0, -1);
  topCamera.lookAt(TOP_CAMERA_TARGET);

  // 3. CONSTRUÇÃO DA CENA BASE (Ambiente Sky/PMREM + Pista com UV por arco + Luzes M2)
  const environmentSystem = createEnvironment(scene, renderer);
  const {
    curve,
    asphaltMesh,
    trackLengthOverWidthRatio,
    startPosition,
    startRotationY,
    setZFightingProblemActive,
  } = createTrack(scene);
  const lightsSystem = createLights(scene, curve);

  // Sincroniza o Sky com a posição inicial do DirectionalLight e gera o PMREM uma única vez
  environmentSystem.syncSkyWithSun(
    lightsSystem.sunLight.position,
    lightsSystem.sunLight.target.position
  );
  environmentSystem.regenerateEnvironmentMap();

  // 4. CARREGAMENTO DAS TEXTURAS E CRIAÇÃO DOS MATERIAIS PBR (M3)
  const textures = await loadSceneTextures(renderer, trackLengthOverWidthRatio);
  const materialsSystem = createSceneMaterials(textures);
  environmentSystem.applyEnvironmentMaterials(materialsSystem);
  asphaltMesh.material = materialsSystem.asphaltMaterial;

  // 5. CARREGAMENTO DOS 3 MODELOS EXTERNOS E CONVERSÃO PBR (ANTES do diagnóstico M1 guardar estados)
  const { car } = await loadAndPopulateModels(
    scene,
    startPosition,
    startRotationY,
    materialsSystem
  );

  // 6. SISTEMAS DO JOGO DE DRIFT (M4: 9 pontos de pista, pontuação pura, HUD, pools de efeitos e WebAudio)
  const trackBounds = createTrackBoundsChecker(curve, scene);
  const driftSystem = createDriftSystem();
  const gameHud = createGameHud();
  const driftEffects = createDriftEffects(scene);
  const gameAudio = createGameAudio();

  let isPaused = false;

  // 7. CONTROLADOR DE NAVEGAÇÃO ARCADE EM 3ª PESSOA (M1 + M4)
  const carController = createCarController(car, playerCamera, {
    startPosition,
    startRotationY,
    onFirstUserInput: () => {
      gameAudio.initOnFirstInteraction();
    },
    onResetRequest: () => {
      handleResetMatch();
    },
    onTogglePause: () => {
      isPaused = !isPaused;
      gameHud.setPaused(isPaused);
    },
    onToggleMute: () => {
      gameAudio.initOnFirstInteraction();
      const muted = gameAudio.toggleMute();
      gameHud.setMuted(muted);
    },
  });

  function handleResetMatch() {
    isPaused = false;
    gameHud.setPaused(false);
    carController.resetCarState();
    driftSystem.resetMatch();
    driftEffects.clearSkidMarks();
    gameHud.showBanner('PARTIDA REINICIADA', '#38bdf8', 900);
    gameHud.update({
      driftState: driftSystem.state,
      events: [],
      speedMetersPerSec: 0,
      slipDeg: 0,
    });
  }

  function handleForceSuperdrift() {
    gameAudio.initOnFirstInteraction();
    const events = driftSystem.forceSuperdrift();
    carController.triggerSuperdriftCameraPunch();
    driftEffects.triggerSuperdriftBurst(car.position);
    gameHud.update({
      driftState: driftSystem.state,
      events,
      speedMetersPerSec: carController.getSpeed(),
      slipDeg: carController.getSlipDeg(),
    });
    gameAudio.update({
      speedAbs: carController.getSpeedAbs(),
      isDrifting: driftSystem.state.isDrifting,
      isHandbrake: carController.isHandbrakeActive(),
      isOffTrack: driftSystem.state.isOffTrack,
      isPaused,
      events,
    });
  }

  // 8. INICIALIZAÇÃO DO PAINEL LIL-GUI ("Diagnóstico" M1 + "Luz" M2 + "Materiais" M3 + "Jogo" e "Caso z-fighting" M4)
  const diagnostics = createDiagnostics({
    scene,
    renderer,
    playerCamera,
    topCamera,
    sceneFog: environmentSystem.fog,
  });

  createLightPanel({
    gui: diagnostics.gui,
    scene,
    renderer,
    lightsSystem,
    environmentSystem,
  });

  createMaterialPanel({
    gui: diagnostics.gui,
    scene,
    materialsSystem,
  });

  createGamePanel({
    gui: diagnostics.gui,
    trackBounds,
    driftEffects,
    onForceSuperdrift: handleForceSuperdrift,
    onResetMatch: handleResetMatch,
  });

  createZFightingPanel({
    gui: diagnostics.gui,
    setZFightingProblemActive,
    diagnostics,
  });

  // Garante que todos os materiais finais (incluindo modelos convertidos) tenham seu estado inicial registrado
  diagnostics.reapplyMaterialStates();

  // 9. TRATAMENTO DE REDIMENSIONAMENTO DA JANELA (Resize)
  window.addEventListener('resize', () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height);
    diagnostics.updateCameraAspects(width, height);
  });

  // 10. LOOP DE ANIMAÇÃO COM THREE.Timer (Independente de Frame Rate)
  // Nota sobre a versão do Three.js (r186+): THREE.Timer faz parte do pacote core ('three').
  const timer = new THREE.Timer();
  timer.connect(document);

  let lastFrameTimestamp = 0;

  function animate(timestamp) {
    requestAnimationFrame(animate);

    // Se o toggle "Simular ~30 FPS" estiver ativo no painel, aguarda ~33,3 ms entre quadros
    // para comprovar na apresentação que a velocidade do carro independe da taxa de quadros.
    if (diagnostics.isFpsLimited30()) {
      if (timestamp - lastFrameTimestamp < TARGET_30_FPS_MS) {
        return;
      }
      lastFrameTimestamp = timestamp;
    }

    // Requisito M1: chama timer.update() UMA única vez por frame antes de ler timer.getDelta()
    timer.update(timestamp);

    // Limita o delta a no máximo 0,1 s para evitar saltos bruscos de posição
    const rawDelta = timer.getDelta();
    const dt = Math.min(rawDelta, MAX_DELTA_SECONDS);

    if (!isPaused) {
      // 1. Atualiza movimento arcade do carro e câmera em 3ª pessoa usando dt
      carController.update(dt);

      // 2. Avalia os 9 pontos da pegada do carro contra os 600 pontos pré-calculados da pista
      const footprint = trackBounds.evaluateCarFootprint(
        car.position.x,
        car.position.z,
        car.rotation.y
      );
      carController.setOffTrack(footprint.isOffTrack);

      // 3. Atualiza máquina pura de detecção de drift, multiplicador, sequência e SUPERDRIFT
      const { state: driftState, events } = driftSystem.update({
        dt,
        speed: carController.getSpeed(),
        slipRad: carController.getSlipRad(),
        offTrackPointsCount: footprint.offTrackPointsCount,
        isNearEdge: footprint.isNearEdge,
      });

      // Se o SUPERDRIFT disparou neste frame, aciona o impacto de câmera e as partículas
      for (let i = 0; i < events.length; i++) {
        if (events[i].type === 'SUPERDRIFT') {
          carController.triggerSuperdriftCameraPunch();
          driftEffects.triggerSuperdriftBurst(car.position);
        }
      }

      // 4. Atualiza pools de fumaça e marcas de pneu (zero alocação por frame)
      driftEffects.update({
        dt,
        isDrifting: driftState.isDrifting,
        isHandbrake: carController.isHandbrakeActive(),
        isOffTrack: driftState.isOffTrack,
        speedAbs: carController.getSpeedAbs(),
        rearWheels: carController.getRearWheelPositions(),
        carPosition: car.position,
      });

      // 5. Atualiza HUD HTML/CSS e sintetizador WebAudio
      gameHud.update({
        driftState,
        events,
        speedMetersPerSec: carController.getSpeed(),
        slipDeg: carController.getSlipDeg(),
      });

      gameAudio.update({
        speedAbs: carController.getSpeedAbs(),
        isDrifting: driftState.isDrifting,
        isHandbrake: carController.isHandbrakeActive(),
        isOffTrack: driftState.isOffTrack,
        isPaused: false,
        events,
      });

      // 6. Anima a rolagem do normal map da água com velocidade independente de frame rate (M3)
      materialsSystem.updateWaterAnimation(dt);

      // 7. Faz a câmera aérea acompanhar suavemente o carro para manter o frustum visível (M1 Item 4)
      topCamera.position.x = THREE.MathUtils.lerp(
        topCamera.position.x,
        car.position.x,
        1 - Math.exp(-3 * dt)
      );
      topCamera.position.z = THREE.MathUtils.lerp(
        topCamera.position.z,
        car.position.z,
        1 - Math.exp(-3 * dt)
      );
      topCamera.lookAt(topCamera.position.x, 0, topCamera.position.z);
    } else {
      gameAudio.update({
        speedAbs: 0,
        isDrifting: false,
        isHandbrake: false,
        isOffTrack: false,
        isPaused: true,
        events: [],
      });
    }

    // Renderiza a cena (tela cheia ou tela dividida) e atualiza contadores do renderer.info
    diagnostics.renderFrame(dt, carController.getSpeed());
  }

  requestAnimationFrame(animate);
}

init();
