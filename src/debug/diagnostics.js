import * as THREE from 'three';
import GUI from 'lil-gui';

/**
 * ============================================================================
 * CONFIGURAÇÕES DO MODO DIAGNÓSTICO (PAINEL LIL-GUI + ATALHOS 1 A 5 E H)
 * ============================================================================
 */
const DEFAULT_NEAR = 0.5;
const DEFAULT_FAR = 260.0;

/**
 * Percorre todas as malhas (Mesh) da cena e executa um callback para cada material,
 * tratando corretamente tanto materiais únicos quanto arrays de materiais.
 *
 * @param {THREE.Scene} scene Cena principal
 * @param {(material: THREE.Material, mesh: THREE.Mesh) => void} callback
 */
function forEachSceneMaterial(scene, callback) {
  scene.traverse((obj) => {
    if (!obj.isMesh || !obj.material || obj.isSky || obj.userData.ignoreDiagnostics) return;

    if (Array.isArray(obj.material)) {
      obj.material.forEach((mat) => {
        if (mat) callback(mat, obj);
      });
    } else {
      callback(obj.material, obj);
    }
  });
}

/**
 * Inicializa o sistema de diagnóstico gráfico do M1 com os 5 itens obrigatórios:
 * 1. Wireframe (traverse em todos os materiais, salvando estado original);
 * 2. Profundidade (MeshDepthMaterial em scene.overrideMaterial + sliders near/far);
 * 3. Back-face culling (alterna material.side entre FrontSide e DoubleSide);
 * 4. Frustum de uma 2ª câmera (tela dividida com setViewport/setScissor + CameraHelper);
 * 5. Contadores de renderer.info (calls, triangles e FPS só da vista principal + toggle frustumCulled).
 *
 * @param {{
 *   scene: THREE.Scene,
 *   renderer: THREE.WebGLRenderer,
 *   playerCamera: THREE.PerspectiveCamera,
 *   topCamera: THREE.PerspectiveCamera,
 *   sceneFog: THREE.Fog
 * }} params
 */
export function createDiagnostics({
  scene,
  renderer,
  playerCamera,
  topCamera,
  sceneFog,
}) {
  // Desativa o reset automático do renderer.info para controlarmos manualmente
  // em qual passe de renderização lemos os contadores (evita soma duplicada no split-screen).
  renderer.info.autoReset = false;

  // Material usado no Item 2 (Visualização do Depth Buffer)
  const depthOverrideMaterial = new THREE.MeshDepthMaterial();

  // CameraHelper para visualizar o frustum da câmera do jogador no Item 4
  const cameraHelper = new THREE.CameraHelper(playerCamera);
  cameraHelper.visible = false;
  scene.add(cameraHelper);

  // Elementos do DOM para atualizar o HUD (Item 5 + texturas M3) e a divisória do Split-Screen (Item 4)
  const hudFpsEl = document.getElementById('hud-fps');
  const hudCallsEl = document.getElementById('hud-calls');
  const hudTrianglesEl = document.getElementById('hud-triangles');
  const hudTexturesEl = document.getElementById('hud-textures');
  const hudCullingEl = document.getElementById('hud-culling');
  const hudSpeedEl = document.getElementById('hud-speed');
  const splitScreenUiEl = document.getElementById('split-screen-ui');

  // Estado reativo ligado ao painel lil-gui
  const state = {
    wireframe: false,             // Item 1 (Tecla 1)
    depthView: false,             // Item 2 (Tecla 2)
    cameraNear: playerCamera.near || DEFAULT_NEAR,
    cameraFar: playerCamera.far || DEFAULT_FAR,
    backFaceCulling: true,        // Item 3 (Tecla 3): true = FrontSide, false = DoubleSide
    splitFrustumView: false,      // Item 4 (Tecla 4): tela dividida + CameraHelper
    frustumCulling: true,         // Item 5 (Tecla 5): obj.frustumCulled em todos os objetos
    limitFps30: false,            // Auxiliar p/ testar movimento independente de FPS na defesa
  };

  // ==========================================================================
  // ITEM 1: WIREFRAME (Percorre materiais com traverse e restaura original)
  // ==========================================================================
  function applyWireframe(enabled) {
    state.wireframe = enabled;

    forEachSceneMaterial(scene, (mat) => {
      // Guarda o estado original na primeira vez que visitamos o material
      if (mat.userData.originalWireframe === undefined) {
        mat.userData.originalWireframe = mat.wireframe;
      }
      mat.wireframe = enabled ? true : mat.userData.originalWireframe;
    });

    // Também reflete no material de profundidade caso o Item 2 esteja ligado
    depthOverrideMaterial.wireframe = enabled;
  }

  // ==========================================================================
  // ITEM 2: PROFUNDIDADE (scene.overrideMaterial = MeshDepthMaterial + near/far)
  // ==========================================================================
  function applyDepthView(enabled) {
    state.depthView = enabled;

    // Oculta a cúpula analítica do Sky enquanto inspecionamos o buffer de profundidade
    scene.traverse((obj) => {
      if (obj.isSky) obj.visible = !enabled;
    });

    if (enabled) {
      scene.overrideMaterial = depthOverrideMaterial;
      // Desativa temporariamente o fog enquanto inspecionamos o buffer de profundidade
      // para que o gradiente de near/far não seja mascarado pela cor da névoa.
      scene.fog = null;
    } else {
      scene.overrideMaterial = null;
      scene.fog = sceneFog;
    }
  }

  function updateCameraNearFar() {
    // Garante que near nunca ultrapasse far - 1
    if (state.cameraNear >= state.cameraFar - 1) {
      state.cameraNear = Math.max(0.1, state.cameraFar - 1);
    }
    playerCamera.near = state.cameraNear;
    playerCamera.far = state.cameraFar;
    playerCamera.updateProjectionMatrix();
    cameraHelper.update();
  }

  // ==========================================================================
  // ITEM 3: BACK-FACE CULLING (FrontSide vs DoubleSide com needsUpdate)
  // ==========================================================================
  function applyBackFaceCulling(cullingEnabled) {
    state.backFaceCulling = cullingEnabled;
    const targetSide = cullingEnabled ? THREE.FrontSide : THREE.DoubleSide;

    forEachSceneMaterial(scene, (mat) => {
      if (mat.userData.originalSide === undefined) {
        mat.userData.originalSide = mat.side;
      }
      const nextSide = cullingEnabled ? mat.userData.originalSide : THREE.DoubleSide;
      if (mat.side !== nextSide) {
        mat.side = nextSide;
        mat.needsUpdate = true;
      }
    });

    depthOverrideMaterial.side = targetSide;
    depthOverrideMaterial.needsUpdate = true;
  }

  // ==========================================================================
  // ITEM 4: FRUSTUM DE UMA 2ª CÂMERA (Viewport dividida + CameraHelper)
  // ==========================================================================
  function applySplitFrustumView(enabled) {
    state.splitFrustumView = enabled;
    if (splitScreenUiEl) {
      splitScreenUiEl.classList.toggle('active', enabled);
    }
    updateCameraAspects(window.innerWidth, window.innerHeight);
  }

  function updateCameraAspects(width, height) {
    const safeHeight = Math.max(height, 1);

    if (state.splitFrustumView) {
      // Na tela dividida, cada viewport ocupa metade da largura (width / 2)
      const halfWidth = Math.max(width * 0.5, 1);
      playerCamera.aspect = halfWidth / safeHeight;
      topCamera.aspect = halfWidth / safeHeight;
    } else {
      playerCamera.aspect = width / safeHeight;
      topCamera.aspect = width / safeHeight;
    }

    playerCamera.updateProjectionMatrix();
    topCamera.updateProjectionMatrix();
    cameraHelper.update();
  }

  // ==========================================================================
  // ITEM 5: FRUSTUM CULLING EM TODOS OS OBJETOS + CONTADORES RENDERER.INFO
  // ==========================================================================
  function applyFrustumCulling(enabled) {
    state.frustumCulling = enabled;

    scene.traverse((obj) => {
      // Não alteramos o CameraHelper nem os helpers de luz do M2 (que operam em espaço de mundo)
      if (obj === cameraHelper || obj.userData.ignoreDiagnostics) return;
      if (obj.isMesh || obj.isLine || obj.isPoints) {
        obj.frustumCulled = enabled;
      }
    });

    if (hudCullingEl) {
      hudCullingEl.textContent = enabled ? 'ON (Ativo)' : 'OFF (Desligado)';
      hudCullingEl.style.color = enabled ? '#4ade80' : '#f87171';
    }
  }

  // Inicializa o status visual do Frustum Culling no HUD
  applyFrustumCulling(true);

  // ==========================================================================
  // CONSTRUÇÃO DO PAINEL LIL-GUI (Pasta "Diagnóstico")
  // ==========================================================================
  const gui = new GUI({ title: 'Monaco Sunset GP · Painel', width: 310 });
  const diagFolder = gui.addFolder('Diagnóstico');

  const ctrlWireframe = diagFolder
    .add(state, 'wireframe')
    .name('[1] Wireframe (Malha)')
    .onChange((val) => applyWireframe(val));

  const ctrlDepth = diagFolder
    .add(state, 'depthView')
    .name('[2] Profundidade (Depth)')
    .onChange((val) => applyDepthView(val));

  const ctrlNear = diagFolder
    .add(state, 'cameraNear', 0.1, 45.0, 0.1)
    .name('  ↳ Câmera Near')
    .onChange(() => updateCameraNearFar());

  const ctrlFar = diagFolder
    .add(state, 'cameraFar', 35.0, 450.0, 1.0)
    .name('  ↳ Câmera Far')
    .onChange(() => updateCameraNearFar());

  const ctrlBackFace = diagFolder
    .add(state, 'backFaceCulling')
    .name('[3] Back-face Culling')
    .onChange((val) => applyBackFaceCulling(val));

  const ctrlSplitFrustum = diagFolder
    .add(state, 'splitFrustumView')
    .name('[4] Frustum 2ª Câmera (Split)')
    .onChange((val) => applySplitFrustumView(val));

  const ctrlFrustumCulling = diagFolder
    .add(state, 'frustumCulling')
    .name('[5] Frustum Culling (Objetos)')
    .onChange((val) => applyFrustumCulling(val));

  diagFolder
    .add(state, 'limitFps30')
    .name('Simular ~30 FPS (Teste dt)');

  diagFolder.open();

  // ==========================================================================
  // ATALHOS DE TECLADO (1 a 5 para os itens e H para esconder/mostrar o painel)
  // ==========================================================================
  let guiVisible = true;

  window.addEventListener('keydown', (event) => {
    // Evita disparar atalhos se o foco estiver em um input de texto do lil-gui
    if (event.target && event.target.tagName === 'INPUT') return;

    switch (event.key) {
      case '1':
        ctrlWireframe.setValue(!state.wireframe);
        break;
      case '2':
        ctrlDepth.setValue(!state.depthView);
        break;
      case '3':
        ctrlBackFace.setValue(!state.backFaceCulling);
        break;
      case '4':
        ctrlSplitFrustum.setValue(!state.splitFrustumView);
        break;
      case '5':
        ctrlFrustumCulling.setValue(!state.frustumCulling);
        break;
      case 'h':
      case 'H':
        guiVisible = !guiVisible;
        gui.show(guiVisible);
        break;
      default:
        break;
    }
  });

  // ==========================================================================
  // CÁLCULO DE FPS SUAVIZADO E RENDERIZAÇÃO (SIMPLES OU VIEWPORT DIVIDIDA)
  // ==========================================================================
  let frameCount = 0;
  let fpsAccumulator = 0;
  let currentFps = 0;

  /**
   * Executa a renderização do frame (simples ou dividida) e atualiza o HUD com os
   * contadores exclusivos da câmera principal (Vista 1).
   *
   * @param {number} dt Delta de tempo do frame em segundos
   * @param {number} carSpeed Velocidade atual do carro em m/s
   */
  function renderFrame(dt, carSpeed = 0) {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // 1. Atualiza o cálculo de FPS a cada 0.25s para leitura estável na tela
    frameCount += 1;
    fpsAccumulator += dt;
    if (fpsAccumulator >= 0.25) {
      currentFps = Math.round(frameCount / fpsAccumulator);
      frameCount = 0;
      fpsAccumulator = 0;
      if (hudFpsEl) hudFpsEl.textContent = String(currentFps);
    }

    if (hudSpeedEl) {
      hudSpeedEl.textContent = `${Math.abs(carSpeed).toFixed(1)} m/s`;
    }
    if (hudTexturesEl) {
      hudTexturesEl.textContent = String(renderer.info.memory.textures);
    }

    // 2. Zera manualmente o renderer.info ANTES da renderização da vista principal
    renderer.info.reset();

    if (!state.splitFrustumView) {
      // MODO TELA CHEIA (Apenas câmera do jogador)
      cameraHelper.visible = false;

      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, width, height);
      renderer.render(scene, playerCamera);

      // Lê os contadores logo após renderizar a câmera do jogador
      if (hudCallsEl) hudCallsEl.textContent = String(renderer.info.render.calls);
      if (hudTrianglesEl) hudTrianglesEl.textContent = String(renderer.info.render.triangles);
    } else {
      // MODO TELA DIVIDIDA (Item 4: Esquerda = Jogador | Direita = Visão de Topo com Frustum)
      const halfWidth = Math.floor(width * 0.5);

      renderer.setScissorTest(true);

      // --- PASSE 1: Metade Esquerda (Câmera do Jogador, SEM o CameraHelper visível) ---
      cameraHelper.visible = false;
      if (state.depthView) {
        scene.overrideMaterial = depthOverrideMaterial;
      }

      renderer.setViewport(0, 0, halfWidth, height);
      renderer.setScissor(0, 0, halfWidth, height);
      renderer.render(scene, playerCamera);

      // IMPORTANTE (Item 5): Capturamos calls e triangles IMEDIATAMENTE após o Passe 1,
      // antes de renderizar a câmera de topo, para que os números mostrem apenas a vista principal!
      if (hudCallsEl) hudCallsEl.textContent = String(renderer.info.render.calls);
      if (hudTrianglesEl) hudTrianglesEl.textContent = String(renderer.info.render.triangles);

      // --- PASSE 2: Metade Direita (Câmera de Topo, COM o CameraHelper visível) ---
      cameraHelper.update();
      cameraHelper.visible = true;

      // Na vista de cima mantemos as cores normais para enxergar claramente as linhas do CameraHelper
      if (state.depthView) {
        scene.overrideMaterial = null;
      }

      // Reaproveita os shadow maps já atualizados no Passe 1 sem recalculá-los no Passe 2
      const prevShadowAutoUpdate = renderer.shadowMap.autoUpdate;
      renderer.shadowMap.autoUpdate = false;

      renderer.setViewport(halfWidth, 0, width - halfWidth, height);
      renderer.setScissor(halfWidth, 0, width - halfWidth, height);
      renderer.render(scene, topCamera);

      renderer.shadowMap.autoUpdate = prevShadowAutoUpdate;

      // Restaura overrideMaterial se o modo de profundidade estiver ligado
      if (state.depthView) {
        scene.overrideMaterial = depthOverrideMaterial;
      }
    }
  }

  return {
    gui,
    renderFrame,
    updateCameraAspects,
    isFpsLimited30: () => state.limitFps30,
    reapplyMaterialStates: () => {
      // Garante que modelos carregados de forma assíncrona recebam o estado atual do diagnóstico
      applyWireframe(state.wireframe);
      applyBackFaceCulling(state.backFaceCulling);
      applyFrustumCulling(state.frustumCulling);
    },
    controls: { ctrlNear, ctrlFar },
  };
}
