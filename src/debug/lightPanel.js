import * as THREE from 'three';
import {
  SUN_CONFIG,
  SUN_SHADOW_CONFIG,
  SPOT_CONFIG,
  HEMI_CONFIG,
} from '../scene/lights.js';

/**
 * Marca todos os materiais de malhas da cena com `needsUpdate = true`.
 *
 * Por que isso é necessário no Three.js?
 * Quando ligamos/desligamos `renderer.shadowMap.enabled`, `light.castShadow` ou trocamos o
 * `renderer.shadowMap.type`, os shaders GLSL dos materiais precisam ser recompilados para
 * incluir ou remover as diretivas `#ifdef USE_SHADOWMAP`. Sem `needsUpdate = true`, a mudança
 * poderia demorar ou não aparecer na tela imediatamente.
 *
 * @param {THREE.Scene} scene Cena principal
 */
function markSceneMaterialsNeedsUpdate(scene) {
  scene.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    if (Array.isArray(obj.material)) {
      obj.material.forEach((mat) => {
        if (mat) mat.needsUpdate = true;
      });
    } else {
      obj.material.needsUpdate = true;
    }
  });
}

/**
 * Marca um helper e seus descendentes para serem ignorados pelo toggle de Frustum Culling do M1,
 * preservando `frustumCulled = false` que o Three.js exige em helpers de espaço de mundo.
 *
 * @param {THREE.Object3D} helperRoot
 */
function protectHelperFromDiagnostics(helperRoot) {
  helperRoot.userData.ignoreDiagnostics = true;
  helperRoot.traverse((child) => {
    child.userData.ignoreDiagnostics = true;
  });
}

/**
 * Cria a pasta "Luz" no painel lil-gui (Entrega M2) mantendo intacta a pasta "Diagnóstico" do M1.
 * Inclui controles imediatos para cada luz, elevação/azimute do pôr do sol, parâmetros de sombra
 * do sol (mapSize, bias, normalBias, radius), toggle global de sombras e os 3 helpers visuais.
 *
 * @param {{
 *   gui: import('lil-gui').GUI,
 *   scene: THREE.Scene,
 *   renderer: THREE.WebGLRenderer,
 *   lightsSystem: ReturnType<import('../scene/lights.js').createLights>
 * }} params
 */
export function createLightPanel({ gui, scene, renderer, lightsSystem, environmentSystem = null }) {
  const {
    sunLight,
    sunDiscMesh,
    hemiLight,
    spotLights,
    shadowCastingSpotLights,
    bulbMaterial,
    updateSunAngles,
    updateSunShadowMapSize,
  } = lightsSystem;

  // ==========================================================================
  // 1. CRIAÇÃO DOS HELPERS VISUAIS DE LUZ E SOMBRA (Iniciam ocultos)
  // ==========================================================================

  // Helper 1: Direção e plano do DirectionalLight (Sol)
  const dirLightHelper = new THREE.DirectionalLightHelper(sunLight, 18, 0xffd166);
  dirLightHelper.visible = false;
  protectHelperFromDiagnostics(dirLightHelper);
  scene.add(dirLightHelper);

  // Helper 2: Caixa ortográfica da câmera de sombra do sol (mostra left/right/top/bottom/near/far)
  const sunShadowCamHelper = new THREE.CameraHelper(sunLight.shadow.camera);
  sunShadowCamHelper.visible = false;
  protectHelperFromDiagnostics(sunShadowCamHelper);
  scene.add(sunShadowCamHelper);

  // Helper 3: Cones de iluminação dos SpotLights dos postes da pista
  const spotHelpersGroup = new THREE.Group();
  spotHelpersGroup.name = 'GrupoHelpersSpotLights';
  spotHelpersGroup.visible = false;

  const spotHelpers = spotLights.map((spot) => {
    const helper = new THREE.SpotLightHelper(spot, 0xffdf9e);
    spotHelpersGroup.add(helper);
    return helper;
  });
  protectHelperFromDiagnostics(spotHelpersGroup);
  scene.add(spotHelpersGroup);

  function refreshHelpers() {
    dirLightHelper.update();
    sunShadowCamHelper.update();
    spotHelpers.forEach((h) => h.update());
  }

  refreshHelpers();

  // ==========================================================================
  // 2. ESTADO REATIVO DO PAINEL "LUZ"
  // ==========================================================================
  const state = {
    // Global (Renderer)
    shadowsGlobal: renderer.shadowMap.enabled,
    shadowMapType: 'PCF (Suave)',
    exposure: renderer.toneMappingExposure,

    // DirectionalLight (Sol poente)
    sunEnabled: SUN_CONFIG.enabled,
    sunColor: SUN_CONFIG.color,
    sunIntensity: SUN_CONFIG.intensity,
    sunElevation: SUN_CONFIG.elevationDeg,
    sunAzimuth: SUN_CONFIG.azimuthDeg,

    // Sombra do Sol
    sunCastShadow: SUN_SHADOW_CONFIG.castShadow,
    sunMapSize: SUN_SHADOW_CONFIG.mapSize,
    sunBias: SUN_SHADOW_CONFIG.bias,
    sunNormalBias: SUN_SHADOW_CONFIG.normalBias,
    sunRadius: SUN_SHADOW_CONFIG.radius,

    // SpotLights (Postes da pista)
    spotsEnabled: SPOT_CONFIG.enabled,
    spotsColor: SPOT_CONFIG.color,
    spotsIntensity: SPOT_CONFIG.intensity,
    spotsCastShadow: true,

    // HemisphereLight (Céu / Chão)
    hemiEnabled: HEMI_CONFIG.enabled,
    hemiSkyColor: HEMI_CONFIG.skyColor,
    hemiGroundColor: HEMI_CONFIG.groundColor,
    hemiIntensity: HEMI_CONFIG.intensity,

    // Helpers
    showDirLightHelper: false,
    showShadowCamHelper: false,
    showSpotHelpers: false,

    // Presets didáticos para demonstrar artefatos na defesa e tirar capturas de tela
    presetAcne: () => {
      ctrlBias.setValue(0);
      ctrlNormalBias.setValue(0);
    },
    presetPeterPanning: () => {
      ctrlBias.setValue(-0.012);
      ctrlNormalBias.setValue(0);
    },
    presetIdeal: () => {
      ctrlBias.setValue(SUN_SHADOW_CONFIG.bias);
      ctrlNormalBias.setValue(SUN_SHADOW_CONFIG.normalBias);
      ctrlRadius.setValue(SUN_SHADOW_CONFIG.radius);
    },
  };

  /**
   * Descarta todos os mapas de sombra alocados quando o tipo de filtro muda.
   */
  function disposeAllShadowMaps() {
    const allShadowLights = [sunLight, ...shadowCastingSpotLights];
    allShadowLights.forEach((light) => {
      if (light.shadow && light.shadow.map) {
        if (light.shadow.map.depthTexture) {
          light.shadow.map.depthTexture.dispose();
          light.shadow.map.depthTexture = null;
        }
        light.shadow.map.dispose();
        light.shadow.map = null;
      }
    });
  }

  // ==========================================================================
  // 3. CONSTRUÇÃO DA PASTA "LUZ" NO LIL-GUI
  // ==========================================================================
  const lightFolder = gui.addFolder('Luz');

  // --- Controles Globais de Sombra e Exposição ---
  lightFolder
    .add(state, 'shadowsGlobal')
    .name('Sombras Globais')
    .onChange((enabled) => {
      renderer.shadowMap.enabled = enabled;
      renderer.shadowMap.needsUpdate = true;
      markSceneMaterialsNeedsUpdate(scene);
    });

  lightFolder
    .add(state, 'shadowMapType', ['PCF (Suave)', 'Basic (Dura/Sem Filtro)'])
    .name('Filtro ShadowMap')
    .onChange((label) => {
      renderer.shadowMap.type =
        label === 'PCF (Suave)' ? THREE.PCFShadowMap : THREE.BasicShadowMap;
      disposeAllShadowMaps();
      renderer.shadowMap.needsUpdate = true;
      markSceneMaterialsNeedsUpdate(scene);
    });

  lightFolder
    .add(state, 'exposure', 0.3, 2.2, 0.05)
    .name('Exposição (ACES)')
    .onChange((val) => {
      renderer.toneMappingExposure = val;
    });

  // --- Subpasta: Sol Poente (DirectionalLight) ---
  const sunFolder = lightFolder.addFolder('Sol Poente (Directional)');

  sunFolder
    .add(state, 'sunEnabled')
    .name('Ligar Sol')
    .onChange((enabled) => {
      sunLight.visible = enabled;
      sunDiscMesh.visible = enabled;
      markSceneMaterialsNeedsUpdate(scene);
    });

  sunFolder
    .add(state, 'sunIntensity', 0.0, 8.0, 0.1)
    .name('Intensidade')
    .onChange((val) => {
      sunLight.intensity = val;
    });

  sunFolder
    .addColor(state, 'sunColor')
    .name('Cor do Sol')
    .onChange((hex) => {
      sunLight.color.set(hex);
      sunDiscMesh.material.color.set(hex);
      refreshHelpers();
    });

  sunFolder
    .add(state, 'sunElevation', 2.0, 60.0, 0.5)
    .name('Elevação (°)')
    .onChange(() => {
      updateSunAngles(state.sunElevation, state.sunAzimuth);
      environmentSystem?.syncSkyWithSun(
        sunLight.position,
        sunLight.target.position,
        state.sunElevation
      );
      refreshHelpers();
    })
    .onFinishChange(() => {
      // Regenera o environment map (PMREM) SOMENTE quando o usuário solta o slider (Requisito 4 do M3)
      environmentSystem?.regenerateEnvironmentMap();
    });

  sunFolder
    .add(state, 'sunAzimuth', 110.0, 250.0, 1.0)
    .name('Azimute (°)')
    .onChange(() => {
      updateSunAngles(state.sunElevation, state.sunAzimuth);
      environmentSystem?.syncSkyWithSun(
        sunLight.position,
        sunLight.target.position,
        state.sunElevation
      );
      refreshHelpers();
    })
    .onFinishChange(() => {
      environmentSystem?.regenerateEnvironmentMap();
    });

  sunFolder.open();

  // --- Subpasta: Sombra do Sol ---
  const sunShadowFolder = lightFolder.addFolder('Sombra do Sol');

  sunShadowFolder
    .add(state, 'sunCastShadow')
    .name('Projetar Sombra')
    .onChange((enabled) => {
      sunLight.castShadow = enabled;
      markSceneMaterialsNeedsUpdate(scene);
    });

  sunShadowFolder
    .add(state, 'sunMapSize', [512, 1024, 2048, 4096])
    .name('mapSize (Resolução)')
    .onChange((size) => {
      updateSunShadowMapSize(Number(size));
      refreshHelpers();
    });

  const ctrlBias = sunShadowFolder
    .add(state, 'sunBias', -0.015, 0.005, 0.0001)
    .name('bias')
    .onChange((val) => {
      sunLight.shadow.bias = val;
    });

  const ctrlNormalBias = sunShadowFolder
    .add(state, 'sunNormalBias', 0.0, 0.2, 0.005)
    .name('normalBias')
    .onChange((val) => {
      sunLight.shadow.normalBias = val;
    });

  const ctrlRadius = sunShadowFolder
    .add(state, 'sunRadius', 0.0, 8.0, 0.1)
    .name('radius (Borda)')
    .onChange((val) => {
      sunLight.shadow.radius = val;
    });

  sunShadowFolder.add(state, 'presetAcne').name('Teste: Shadow Acne (0)');
  sunShadowFolder.add(state, 'presetPeterPanning').name('Teste: Peter-Panning');
  sunShadowFolder.add(state, 'presetIdeal').name('Restaurar Ajuste Ideal');

  sunShadowFolder.open();

  // --- Subpasta: Postes da Pista (SpotLights) ---
  const spotsFolder = lightFolder.addFolder('Postes da Pista (SpotLight)');

  spotsFolder
    .add(state, 'spotsEnabled')
    .name('Ligar Postes (6x)')
    .onChange((enabled) => {
      spotLights.forEach((spot) => {
        spot.visible = enabled;
      });
      bulbMaterial.emissiveIntensity = enabled ? SPOT_CONFIG.bulbEmissiveIntensity : 0.0;
      markSceneMaterialsNeedsUpdate(scene);
    });

  spotsFolder
    .add(state, 'spotsIntensity', 0, 600, 5)
    .name('Intensidade (cd)')
    .onChange((val) => {
      spotLights.forEach((spot) => {
        spot.intensity = val;
      });
    });

  spotsFolder
    .addColor(state, 'spotsColor')
    .name('Cor da Lâmpada')
    .onChange((hex) => {
      spotLights.forEach((spot) => {
        spot.color.set(hex);
      });
      bulbMaterial.emissive.set(hex);
      refreshHelpers();
    });

  spotsFolder
    .add(state, 'spotsCastShadow')
    .name('Sombra (2 Postes)')
    .onChange((enabled) => {
      shadowCastingSpotLights.forEach((spot) => {
        spot.castShadow = enabled;
      });
      markSceneMaterialsNeedsUpdate(scene);
    });

  // --- Subpasta: Preenchimento de Céu (HemisphereLight) ---
  const hemiFolder = lightFolder.addFolder('Céu (HemisphereLight)');

  hemiFolder
    .add(state, 'hemiEnabled')
    .name('Ligar Preenchimento')
    .onChange((enabled) => {
      hemiLight.visible = enabled;
      markSceneMaterialsNeedsUpdate(scene);
    });

  hemiFolder
    .add(state, 'hemiIntensity', 0.0, 2.5, 0.05)
    .name('Intensidade')
    .onChange((val) => {
      hemiLight.intensity = val;
    });

  hemiFolder
    .addColor(state, 'hemiSkyColor')
    .name('Cor do Céu')
    .onChange((hex) => {
      hemiLight.color.set(hex);
    });

  hemiFolder
    .addColor(state, 'hemiGroundColor')
    .name('Cor do Chão')
    .onChange((hex) => {
      hemiLight.groundColor.set(hex);
    });

  // --- Subpasta: Helpers Visuais ---
  const helpersFolder = lightFolder.addFolder('Helpers de Luz e Sombra');

  helpersFolder
    .add(state, 'showDirLightHelper')
    .name('DirectionalLightHelper')
    .onChange((visible) => {
      dirLightHelper.visible = visible;
      if (visible) dirLightHelper.update();
    });

  helpersFolder
    .add(state, 'showShadowCamHelper')
    .name('Shadow CameraHelper (Sol)')
    .onChange((visible) => {
      sunShadowCamHelper.visible = visible;
      if (visible) sunShadowCamHelper.update();
    });

  helpersFolder
    .add(state, 'showSpotHelpers')
    .name('SpotLightHelpers (Postes)')
    .onChange((visible) => {
      spotHelpersGroup.visible = visible;
      if (visible) spotHelpers.forEach((h) => h.update());
    });

  lightFolder.close();

  return {
    refreshHelpers,
  };
}
