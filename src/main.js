import * as THREE from 'three';
import { createEnvironment } from './scene/environment.js';
import { createTrack } from './scene/track.js';
import { createLights } from './scene/lights.js';
import { loadAndPopulateModels } from './scene/models.js';
import { loadSceneTextures } from './materials/textures.js';
import { createSceneMaterials } from './materials/materials.js';
import { createDiagnostics } from './debug/diagnostics.js';
import { createLightPanel } from './debug/lightPanel.js';
import { createMaterialPanel } from './debug/materialPanel.js';
import { createZFightingPanel } from './debug/zFightingPanel.js';

// --- Imports exclusivos do MOTOR DO JOGO (separados das entregas de Computação Gráfica) ---
import { createCarController } from './controls/carController.js';
import { createDriftSystem } from './game/driftSystem.js';
import { createTrackBoundsChecker } from './game/trackBounds.js';
import { createGameHud } from './game/hud.js';
import { createDriftEffects } from './game/effects.js';
import { createGameAudio } from './game/audio.js';
import { createGamePanel } from './debug/gamePanel.js';

/**
 * ############################################################################
 * #                                                                          #
 * #   PARTE 1 — ENTREGAS DE COMPUTAÇÃO GRÁFICA (M0, M1, M2, M3 e M4-CG)      #
 * #   (Tudo o que o professor pede para mostrar e explicar na arguição)      #
 * #                                                                          #
 * ############################################################################
 */

// ============================================================================
// [ENTREGA M0] — DEFINIÇÃO DO PROJETO, ESCOPO, CENA E CÂMERAS
// ============================================================================
// O QUE EXPLICAR NO M0:
// 1. Escopo delimitado: Circuito compacto de Mônaco ao pôr do sol (mar e barcos a oeste,
//    cais no meio, pista fechada e prédios de Monte Carlo a leste).
// 2. Duas câmeras:
//    - playerCamera: câmera perspectiva em 3ª pessoa atrás do carro (FOV 60°, near 0.5, far 260).
//      Por que near = 0.5 e far = 260? Para manter a razão far/near baixa (520:1) e preservar
//      a precisão de 24 bits do Depth Buffer (Z-Buffer), evitando Z-fighting na cena.
//    - topCamera: 2ª câmera aérea fixa no topo (Y = 235 m) olhando para o centro da pista,
//      usada no Item 4 do diagnóstico para visualizar o tronco de pirâmide (Frustum) da 1ª câmera.

const M0_CONFIG = {
  playerFov: 60,
  playerNear: 0.5,
  playerFar: 260.0,
  topCameraFov: 55,
  topCameraPos: new THREE.Vector3(5, 235, 0),
  topCameraTarget: new THREE.Vector3(5, 0, 0),
  maxDeltaSeconds: 0.1, // Trava dt em 0,1 s para o carro não pular se o usuário trocar de aba
};

function setupM0SceneAndCameras(container) {
  const scene = new THREE.Scene();

  // Renderizador WebGL com antialiasing (MSAA) nativo
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  const aspect = window.innerWidth / Math.max(window.innerHeight, 1);

  // 1ª Câmera: Perspectiva do jogador (3ª pessoa)
  const playerCamera = new THREE.PerspectiveCamera(
    M0_CONFIG.playerFov,
    aspect,
    M0_CONFIG.playerNear,
    M0_CONFIG.playerFar
  );

  // 2ª Câmera: Visão aérea de topo para inspecionar o Frustum (Item 4 do M1)
  const topCamera = new THREE.PerspectiveCamera(
    M0_CONFIG.topCameraFov,
    aspect,
    5.0,
    500.0
  );
  topCamera.position.copy(M0_CONFIG.topCameraPos);
  topCamera.up.set(0, 0, -1); // Orienta o Norte (-Z) para o topo da tela
  topCamera.lookAt(M0_CONFIG.topCameraTarget);

  return { scene, renderer, playerCamera, topCamera };
}

// ============================================================================
// [ENTREGA M1] — PIPELINE DE VISUALIZAÇÃO, PISTA, 3 MODELOS, TIMER E DIAGNÓSTICO
// ============================================================================
// O QUE EXPLICAR NO M1:
// 1. Pista gerada por curva fechada (CatmullRomCurve3 do tipo 'centripetal'):
//    Em vez de TubeGeometry (que gera um cano redondo), geramos uma BufferGeometry plana
//    calculando em cada ponto a tangente da curva e o vetor lateral (produto vetorial
//    entre tangente e eixo Y: side = tangent x Y).
// 2. Três modelos externos em formatos distintos (CC0 Kenney):
//    - Carro: car.obj + car.mtl (OBJLoader / MTLLoader) -> normalizado para 4,5 m
//    - Barco: boat.glb (GLTFLoader) -> normalizado para 12 m (16 instâncias no porto)
//    - Prédio: building.glb (GLTFLoader) -> normalizado para 20 a 40 m (24 instâncias)
//    Total = 40 objetos espalhados para tornar o Frustum Culling visível nos contadores!
// 3. Normalização automática por Bounding Box (THREE.Box3):
//    Medimos o modelo com `new THREE.Box3().setFromObject(obj)`, aplicamos escala uniforme
//    `fator = tamanhoAlvo / tamanhoAtual`, centralizamos X/Z na origem e subtraímos `box.min.y`
//    para apoiar a base exatamente no chão (Y = 0).
// 4. Movimento independente de Frame Rate (THREE.Timer):
//    No loop de animação usamos `timer.update(timestamp)` e `dt = Math.min(timer.getDelta(), 0.1)`.
//    Toda velocidade é multiplicada por `dt` (metros/segundo e radianos/segundo).
// 5. Os 5 Itens do Modo Diagnóstico (Teclas 1 a 5 e painel lil-gui):
//    - [1] Wireframe: percorre as malhas (`scene.traverse`) e ativa `material.wireframe = true`.
//    - [2] Depth Buffer: aplica `scene.overrideMaterial = new THREE.MeshDepthMaterial()`, mostrando
//          a distribuição não-linear (1/z) da profundidade conforme alteramos `near` e `far`.
//    - [3] Back-face Culling: alterna `material.side` entre `THREE.FrontSide` (descarta faces
//          traseiras cujo produto escalar normal·visão >= 0) e `THREE.DoubleSide`.
//    - [4] Frustum de 2ª Câmera: divide a tela ao meio com `setViewport` e `setScissor`
//          (esquerda: `playerCamera`; direita: `topCamera` exibindo o `THREE.CameraHelper`).
//    - [5] Frustum Culling: alterna `mesh.frustumCulled` entre `true` e `false`, mostrando o salto
//          imediato em `renderer.info.render.calls` (Draw Calls) e `triangles`.

function renderM1PipelineFrame({
  renderer,
  scene,
  playerCamera,
  topCamera,
  diagnostics,
  environmentFog,
}) {
  // Se o Item 4 (Frustum de 2ª Câmera) estiver desligado, faz o passe único normal
  if (!diagnostics.isSplitViewActive()) {
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissorTest(false);
    renderer.render(scene, playerCamera);
    return;
  }

  // Se o Item 4 estiver LIGADO: divide a tela em 2 viewports (Split-Screen)
  const fullWidth = window.innerWidth;
  const fullHeight = window.innerHeight;
  const halfWidth = Math.floor(fullWidth * 0.5);
  const rightWidth = fullWidth - halfWidth;

  renderer.setScissorTest(true);

  // Passe Esquerdo: Câmera do Jogador em 3ª pessoa (oculta o CameraHelper para não sujar a tela)
  playerCamera.aspect = halfWidth / Math.max(fullHeight, 1);
  playerCamera.updateProjectionMatrix();
  diagnostics.cameraHelper.visible = false;

  renderer.setViewport(0, 0, halfWidth, fullHeight);
  renderer.setScissor(0, 0, halfWidth, fullHeight);
  renderer.render(scene, playerCamera);

  // Passe Direito: 2ª Câmera de Topo enxergando o cone do Frustum (CameraHelper) da 1ª câmera
  topCamera.aspect = rightWidth / Math.max(fullHeight, 1);
  topCamera.updateProjectionMatrix();
  diagnostics.cameraHelper.visible = true;
  diagnostics.cameraHelper.update();

  // Desliga a névoa apenas na vista aérea para que o mapa inteiro fique nítido de cima
  const previousFog = scene.fog;
  scene.fog = null;

  renderer.setViewport(halfWidth, 0, rightWidth, fullHeight);
  renderer.setScissor(halfWidth, 0, rightWidth, fullHeight);
  renderer.render(scene, topCamera);

  scene.fog = previousFog || environmentFog;
}

// ============================================================================
// [ENTREGA M2] — LUZES (3 TIPOS DISTINTOS), TONE MAPPING E SOMBRAS CALIBRADAS
// ============================================================================
// O QUE EXPLICAR NO M2:
// 1. Tone Mapping e Espaço de Cor de Saída:
//    Usamos `ACESFilmicToneMapping` (exposição 0.88) e `SRGBColorSpace` para comprimir
//    suavemente as altas luzes do sol poente e dos postes sem estourar para branco puro.
// 2. Os 3 tipos de luz combinados na cena (parâmetros em SUN_CONFIG, SPOT_CONFIG, HEMI_CONFIG):
//    a) DirectionalLight (Sol poente): cor quente #ffb070, intensidade 3.0, elevação baixa (12,5°)
//       vinda do lado do mar (oeste), gerando sombras longas e rasantes.
//    b) SpotLight nos 6 postes da pista: cor #ffd9a0, intensidade física de 240 candelas (cd),
//       `decay = 2` (lei do inverso do quadrado da distância 1/d²), `angle = 54,5°` e `penumbra = 0.55`.
//       DECISÃO DE DESEMPENHO: Apenas 2 dos 6 postes têm `castShadow = true` (largada e grampo),
//       pois cada sombra extra exige 1 passe de profundidade da cena na GPU. Os outros 4 postes
//       iluminam a pista sem sombra e todos possuem uma malha emissiva na lâmpada.
//    c) HemisphereLight (Preenchimento atmosférico): céu laranja-rosado (#ff9e7a) e chão azul escuro
//       (#1e273c), intensidade 0.45, sem sombra. Substitui uma AmbientLight plana dando volume 3D.
// 3. Configuração das Sombras do Sol (SUN_SHADOW_CONFIG):
//    - `PCFShadowMap` com `radius = 2.0` e resolução `mapSize = 2048x2048`.
//    - Câmera ortográfica justa ao tamanho do mapa (`left/right = ±125 m`, `top/bottom = -75..85 m`),
//      não desperdiçando texels fora da cena (~12 cm por texel).
//    - `bias = -0.0004` e `normalBias = 0.04`: sob sol rasante (12,5°), o `normalBias` desloca a
//      amostra ao longo da normal da superfície, eliminando as listras de *Shadow Acne* no asfalto
//      sem causar *Peter-Panning* (sombra descolada das rodas do carro).

const M2_TONE_MAPPING_EXPOSURE = 0.88;

function configureM2RendererAndLights(renderer, scene, curve, environmentSystem) {
  // Configuração fotométrica do renderizador exigida no M2
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = M2_TONE_MAPPING_EXPOSURE;

  // Habilita mapas de sombra PCF suave
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  // Instancia as 3 famílias de luz (Directional + 6 SpotLights + Hemisphere)
  const lightsSystem = createLights(scene, curve);

  // Sincroniza o céu analítico com a direção inicial do DirectionalLight (Sol)
  environmentSystem.syncSkyWithSun(
    lightsSystem.sunLight.position,
    lightsSystem.sunLight.target.position
  );
  environmentSystem.regenerateEnvironmentMap();

  return lightsSystem;
}

// ============================================================================
// [ENTREGA M3] — TEXTURAS (sRGB vs LINEAR), UVs POR ARCO, 7 MATERIAIS PBR E ÁGUA
// ============================================================================
// O QUE EXPLICAR NO M3:
// 1. Espaço de cor correto nas texturas (`src/materials/textures.js`):
//    - Mapas de COR (`color.jpg`): configurados com `SRGBColorSpace`, pois imagens fotográficas
//      são salvas com curva gama (~1/2.2) e precisam ser linearizadas antes do cálculo de luz PBR.
//    - Mapas de RELEVO (`normal.jpg`) e RUGOSIDADE (`roughness.jpg`): configurados em espaço
//      linear (`NoColorSpace`), pois guardam vetores matemáticos (Nx, Ny, Nz) e escalares de
//      microfacetas. Aplicar sRGB neles entortaria as normais e o brilho!
//    - Todos usam `RepeatWrapping`, mipmaps trilineares e `anisotropy = getMaxAnisotropy()`
//      para que o asfalto visto de longe em ângulo rasante não fique borrado.
// 2. Coordenadas UV da pista sem estiramento (`createRibbonGeometry` em `src/scene/track.js`):
//    - U vai de 0 a 1 na largura da pista (11 m).
//    - V é calculado proporcionalmente ao COMPRIMENTO DE ARCO ACUMULADO real da curva
//      (`s_i / comprimentoTotal`, onde `L_total = 431,24 m`), e o `repeat.y` é multiplicado pela
//      razão `comprimento / largura` (~39,2). Com isso, ao ligar "Visualizar UV (Checker)" na GUI,
//      os quadrados ficam perfeitos tanto nas retas quanto no grampo fechado!
// 3. Os 7 Materiais PBR (`MeshStandardMaterial` em `src/materials/materials.js`):
//    - (1) Asfalto da pista, (2) Pedra do cais, (3) Terreno urbano (todos com Color + Normal + Roughness);
//    - (4) Água do mar (`roughness = 0.14`, `normalMap` animado a cada frame somando `dt` no `offset`);
//    - (5) Pintura metálica do carro (`metalness = 0.82`, `roughness = 0.28`, refletindo o céu PMREM);
//    - (6) Casco dos barcos e (7) Prédios de Monte Carlo com janelas emissivas quentes.
// 4. Ambiente coerente (`Sky.js` + `PMREMGenerator`):
//    O shader analítico `Sky` gera um mapa de ambiente pré-filtrado (`scene.environment`) via
//    `PMREMGenerator`. Ele só é recalculado no `onFinishChange` do slider do sol para manter 60 FPS.

async function setupM3TexturesMaterialsAndModels({
  renderer,
  scene,
  environmentSystem,
  asphaltMesh,
  trackLengthOverWidthRatio,
  startPosition,
  startRotationY,
}) {
  // 1. Carrega texturas CC0 com fallback seguro (se faltar arquivo, usa cor sólida / canvas procedural)
  const textures = await loadSceneTextures(renderer, trackLengthOverWidthRatio);

  // 2. Cria os 7 materiais PBR (MeshStandardMaterial)
  const materialsSystem = createSceneMaterials(textures);

  // 3. Aplica materiais PBR na água, cais, terreno e faixa de asfalto da pista
  environmentSystem.applyEnvironmentMaterials(materialsSystem);
  asphaltMesh.material = materialsSystem.asphaltMaterial;

  // 4. Carrega os 3 modelos (OBJ+MTL e GLB), normaliza via Box3 (M1) e converte para PBR (M3)
  const { car } = await loadAndPopulateModels(
    scene,
    startPosition,
    startRotationY,
    materialsSystem
  );

  return { materialsSystem, car };
}

// ============================================================================
// [ENTREGA M4 — CASO DE DIAGNÓSTICO] — PROBLEMA DE PROFUNDIDADE (Z-FIGHTING)
// ============================================================================
// O QUE EXPLICAR NO CASO DE DIAGNÓSTICO (Z-FIGHTING):
// 1. Onde acontece: Entre a malha de asfalto (`Y = 0,05 m`) e os 65 traços brancos pintados
//    no centro da pista (`src/scene/track.js` -> `setZFightingProblemActive`).
// 2. Por que acontece matematicamente:
//    O Depth Buffer (24 bits) mapeia a profundidade de forma não-linear proporcional a `1 / z`.
//    Quase toda a precisão fica concentrada perto de `camera.near`. Quando dois triângulos são
//    coplanares (`Y = 0,05 m`), pequenos erros de arredondamento de ponto flutuante (IEEE 754)
//    na interpolação baricêntrica fazem ora a faixa branca vencer o teste `GL_LEQUAL`, ora o
//    asfalto vencer, gerando o efeito de piscar (flickering / dentes de serra).
// 3. Como reproduzir ao vivo para o professor:
//    Na pasta "Caso z-fighting" do lil-gui, clicar em "1. Ativar bug + agravar near/far".
//    Isso coloca as faixas na mesma altura do asfalto (`Y = 0,05 m`), desliga o `polygonOffset`
//    e muda `near` para `0.02` e `far` para `2000` (razão 100.000:1).
// 4. Nossa solução combinada em 3 camadas ("2. Aplicar correção"):
//    - Razão `far/near` enxuta na câmera (`near = 0.5`, `far = 260`);
//    - Pequeno deslocamento geométrico vertical de 2,5 cm (`Y = 0,075 m` vs `0,05 m`);
//    - `polygonOffset: true` (`factor: -1, units: -1`) no material das faixas, que soma um viés
//      de profundidade proporcional à inclinação do triângulo diretamente no rasterizador da GPU.


/**
 * ############################################################################
 * #                                                                          #
 * #   PARTE 2 — MOTOR DO JOGO DE DRIFT (CAMADA CRIATIVA SEPARADA DA CG)      #
 * #   (Física Arcade 2D, Pontuação Pura, 9 Pontos, Partículas e WebAudio)    #
 * #                                                                          #
 * ############################################################################
 *
 * O QUE EXPLICAR SE O PROFESSOR PERGUNTAR DO MOTOR DO JOGO:
 * - Isolamos o jogo em `src/game/` e `src/controls/carController.js` para não interferir no pipeline:
 *   1. Física Arcade (`carController.js`): decompõe a velocidade em frontal e lateral; o atrito
 *      lateral decai por `exp(-grip * dt)`. O freio de mão (`Espaço`) reduz o grip para derrapar.
 *   2. Pontuação Pura (`driftSystem.js`): JavaScript puro (sem Three.js), com histerese de entrada
 *      (0,25 s acima de 13°) e saída (0,20 s abaixo de 8°), janela de 3 s nas retas, multiplicador
 *      até x20 e vitória `SUPERDRIFT` aos 25.000 pontos.
 *   3. Detecção de Pista (`trackBounds.js`): amostra 600 pontos da curva e monitora 9 pontos do
 *      chassi (se >= 5 pontos saírem de 5,5 m, perde os pontos pendentes).
 *   4. Efeitos Zero-Allocation (`effects.js`): 1 `THREE.Points` (300 partículas de fumaça) e
 *      1 `THREE.Mesh` (ring buffer de 360 marcas de pneu), sem dar `new` durante o loop.
 */
function setupDriftGameEngine({
  scene,
  curve,
  car,
  playerCamera,
  startPosition,
  startRotationY,
}) {
  const trackBounds = createTrackBoundsChecker(curve, scene);
  const driftSystem = createDriftSystem();
  const gameHud = createGameHud();
  const driftEffects = createDriftEffects(scene);
  const gameAudio = createGameAudio();

  const gameRuntime = { isPaused: false };

  function handleResetMatch() {
    gameRuntime.isPaused = false;
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
      isPaused: gameRuntime.isPaused,
      events,
    });
  }

  const carController = createCarController(car, playerCamera, {
    startPosition,
    startRotationY,
    onFirstUserInput: () => gameAudio.initOnFirstInteraction(),
    onResetRequest: () => handleResetMatch(),
    onTogglePause: () => {
      gameRuntime.isPaused = !gameRuntime.isPaused;
      gameHud.setPaused(gameRuntime.isPaused);
    },
    onToggleMute: () => {
      gameAudio.initOnFirstInteraction();
      const muted = gameAudio.toggleMute();
      gameHud.setMuted(muted);
    },
  });

  function updateGameFrame(dt) {
    if (!gameRuntime.isPaused) {
      // 1. Atualiza física arcade 2D do carro e câmera de 3ª pessoa
      carController.update(dt);

      // 2. Avalia os 9 pontos do chassi contra os 600 pontos amostrados da pista
      const boundsStatus = trackBounds.evaluateCarFootprint(car.position, car.rotation.y);

      // 3. Atualiza máquina de estados pura de pontuação de drift
      const events = driftSystem.update({
        dt,
        speed: carController.getSpeedAbs(),
        slipRad: carController.getSlipRad(),
        isOnTrack: boundsStatus.isOnTrack,
        distanceToEdge: boundsStatus.distanceToEdge,
      });

      if (events.some((e) => e.type === 'SUPERDRIFT')) {
        carController.triggerSuperdriftCameraPunch();
        driftEffects.triggerSuperdriftBurst(car.position);
      }

      // 4. Atualiza pools pré-alocados de fumaça, marcas de pneu e confetes
      driftEffects.update({
        dt,
        carPosition: car.position,
        carYaw: car.rotation.y,
        speedAbs: carController.getSpeedAbs(),
        slipRad: carController.getSlipRad(),
        isDrifting: driftSystem.state.isDrifting,
        isHandbrake: carController.isHandbrakeActive(),
        isOnTrack: boundsStatus.isOnTrack,
      });

      // 5. Atualiza HUD HTML/SVG e sintetizador procedural WebAudio
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
        isPaused: false,
        events,
      });
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
  }

  return {
    trackBounds,
    driftEffects,
    carController,
    handleResetMatch,
    handleForceSuperdrift,
    updateGameFrame,
  };
}

// ============================================================================
// FUNÇÃO PRINCIPAL DE INICIALIZAÇÃO E LOOP ( INTEGRA PARTE 1: CG + PARTE 2: JOGO )
// ============================================================================
async function init() {
  const container = document.getElementById('app');

  // --- [PASSO M0] Cena e Câmeras ---
  const { scene, renderer, playerCamera, topCamera } = setupM0SceneAndCameras(container);

  // --- [PASSO M1] Ambiente geográfico e Geometria da Pista por Curva Fechada ---
  const environmentSystem = createEnvironment(scene, renderer);
  const {
    curve,
    asphaltMesh,
    trackLengthOverWidthRatio,
    startPosition,
    startRotationY,
    setZFightingProblemActive,
  } = createTrack(scene);

  // --- [PASSO M2] Luzes (Directional + 6 SpotLights + Hemisphere), ToneMapping e Sombras ---
  const lightsSystem = configureM2RendererAndLights(renderer, scene, curve, environmentSystem);

  // --- [PASSO M3 + M1 Modelos] Texturas, 7 Materiais PBR e 3 Modelos normalizados via Box3 ---
  const { materialsSystem, car } = await setupM3TexturesMaterialsAndModels({
    renderer,
    scene,
    environmentSystem,
    asphaltMesh,
    trackLengthOverWidthRatio,
    startPosition,
    startRotationY,
  });

  // --- [PASSO MOTOR DO JOGO] Inicializa a camada do jogo de drift separada da CG ---
  const gameEngine = setupDriftGameEngine({
    scene,
    curve,
    car,
    playerCamera,
    startPosition,
    startRotationY,
  });

  // --- [PAINÉIS DE INSPEÇÃO LIL-GUI] Organizados por Entrega (M1, M2, M3, M4-ZFighting e Jogo) ---
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
    trackBounds: gameEngine.trackBounds,
    driftEffects: gameEngine.driftEffects,
    onForceSuperdrift: gameEngine.handleForceSuperdrift,
    onResetMatch: gameEngine.handleResetMatch,
  });

  createZFightingPanel({
    gui: diagnostics.gui,
    setZFightingProblemActive,
    diagnostics,
  });

  // Registra o estado original de todos os materiais para os toggles do Diagnóstico M1
  diagnostics.reapplyMaterialStates();

  window.addEventListener('resize', () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height);
    diagnostics.updateCameraAspects(width, height);
  });

  // --- [LOOP DE ANIMAÇÃO M1] THREE.Timer com delta independente de Frame Rate ---
  const timer = new THREE.Timer();
  timer.connect(document);

  let lastFrameTimestamp = 0;
  const TARGET_30_FPS_MS = 1000 / 30;

  function animate(timestamp) {
    requestAnimationFrame(animate);

    // Simulador de ~30 FPS do painel de Diagnóstico M1 para provar independência de frame rate
    if (diagnostics.isFpsLimited30()) {
      if (timestamp - lastFrameTimestamp < TARGET_30_FPS_MS) {
        return;
      }
      lastFrameTimestamp = timestamp;
    }

    timer.update(timestamp);

    // Delta time em segundos limitado a 0,1 s (M1) ou forçado em 50 ms para teste (M4)
    let dt = Math.min(timer.getDelta(), M0_CONFIG.maxDeltaSeconds);
    if (gameEngine.trackBounds.isFixedDtSimulationActive()) {
      dt = 0.05;
    }

    // 1. Anima o normalMap da água em função de dt (Entrega M3)
    materialsSystem.updateWaterAnimation(dt);

    // 2. Atualiza o Motor do Jogo de Drift (Parte 2)
    gameEngine.updateGameFrame(dt);

    // 3. Renderiza o Pipeline de Visualização (Entrega M1: passe único ou Split-Screen Item 4)
    renderM1PipelineFrame({
      renderer,
      scene,
      playerCamera,
      topCamera,
      diagnostics,
      environmentFog: environmentSystem.fog,
    });

    // 4. Atualiza contadores de FPS, Draw Calls e Triangles lendo renderer.info (Entrega M1 Item 5)
    diagnostics.updateStatsHud(dt, gameEngine.carController.getSpeed());
  }

  requestAnimationFrame(animate);
}

init();
