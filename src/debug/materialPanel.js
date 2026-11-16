import { MATERIAL_DEFAULTS } from '../materials/materials.js';
import { TEXTURE_REPEAT_DEFAULTS } from '../materials/textures.js';
import { ENVIRONMENT_CONFIG } from '../scene/environment.js';

/**
 * Cria a pasta "Materiais" no painel lil-gui (Entrega M3), mantendo intactas
 * as pastas "Diagnóstico" (M1) e "Luz" (M2).
 *
 * Permite controlar em tempo real:
 * - Toggle "Visualizar UV" (xadrez numerado em CanvasTexture) e "Sem Texturas" (cores sólidas);
 * - Intensidade do reflexo de ambiente (`scene.environmentIntensity`) e velocidade da água;
 * - Liga/desliga individual de `map`, `normalMap` e `roughnessMap` por material;
 * - `normalScale`, `roughness`, `metalness` e `repeat` (asfalto, pedra e terreno).
 *
 * @param {{
 *   gui: import('lil-gui').GUI,
 *   scene: THREE.Scene,
 *   materialsSystem: ReturnType<import('../materials/materials.js').createSceneMaterials>
 * }} params
 */
export function createMaterialPanel({ gui, scene, materialsSystem }) {
  const {
    asphaltMaterial,
    stoneMaterial,
    groundMaterial,
    waterMaterial,
    carBodyMaterials,
    mapFlags,
    syncMaterialMaps,
    updateSurfaceRepeat,
  } = materialsSystem;

  const state = {
    // Modos globais de comparação M3
    uvPreviewMode: false,
    noTexturesMode: false,
    environmentIntensity: ENVIRONMENT_CONFIG.environmentIntensity,
    waterScrollSpeed: MATERIAL_DEFAULTS.water.scrollMultiplier,

    // 1. Asfalto (Pista)
    asphaltMap: true,
    asphaltNormalMap: true,
    asphaltRoughnessMap: true,
    asphaltNormalScale: MATERIAL_DEFAULTS.asphalt.normalScale,
    asphaltRoughness: MATERIAL_DEFAULTS.asphalt.roughness,
    asphaltMetalness: MATERIAL_DEFAULTS.asphalt.metalness,
    asphaltRepeat: TEXTURE_REPEAT_DEFAULTS.asphaltWidthRepeats,

    // 2. Pedra / Cais
    stoneMap: true,
    stoneNormalMap: true,
    stoneRoughnessMap: true,
    stoneNormalScale: MATERIAL_DEFAULTS.stone.normalScale,
    stoneRoughness: MATERIAL_DEFAULTS.stone.roughness,
    stoneMetalness: MATERIAL_DEFAULTS.stone.metalness,
    stoneRepeat: TEXTURE_REPEAT_DEFAULTS.stoneRepeatX,

    // 3. Terreno (Monte Carlo)
    groundMap: true,
    groundNormalMap: true,
    groundRoughnessMap: true,
    groundNormalScale: MATERIAL_DEFAULTS.ground.normalScale,
    groundRoughness: MATERIAL_DEFAULTS.ground.roughness,
    groundMetalness: MATERIAL_DEFAULTS.ground.metalness,
    groundRepeat: TEXTURE_REPEAT_DEFAULTS.groundRepeatX,

    // 4. Água do Porto
    waterNormalMap: true,
    waterNormalScale: MATERIAL_DEFAULTS.water.normalScale,
    waterRoughness: MATERIAL_DEFAULTS.water.roughness,
    waterMetalness: MATERIAL_DEFAULTS.water.metalness,

    // 5. Carroceria Metálica do Carro
    carRoughness: MATERIAL_DEFAULTS.carBody.roughness,
    carMetalness: MATERIAL_DEFAULTS.carBody.metalness,
  };

  const matFolder = gui.addFolder('Materiais');

  // --- Controles Globais de Ambiente e Diagnóstico de UV/Texturas ---
  const ctrlUvPreview = matFolder
    .add(state, 'uvPreviewMode')
    .name('Visualizar UV (Xadrez)')
    .onChange((enabled) => {
      mapFlags.uvPreviewMode = enabled;
      if (enabled && state.noTexturesMode) {
        ctrlNoTextures.setValue(false);
      }
      syncMaterialMaps();
    });

  const ctrlNoTextures = matFolder
    .add(state, 'noTexturesMode')
    .name('Sem Texturas (Sólido)')
    .onChange((enabled) => {
      mapFlags.noTexturesMode = enabled;
      if (enabled && state.uvPreviewMode) {
        ctrlUvPreview.setValue(false);
      }
      syncMaterialMaps();
    });

  matFolder
    .add(state, 'environmentIntensity', 0.0, 2.0, 0.05)
    .name('Reflexo Env (PMREM)')
    .onChange((val) => {
      scene.environmentIntensity = val;
    });

  matFolder
    .add(state, 'waterScrollSpeed', 0.0, 3.0, 0.05)
    .name('Velocidade da Água')
    .onChange((val) => {
      mapFlags.waterScrollMultiplier = val;
    });

  // --- Subpasta 1: Asfalto (Pista) ---
  const asphaltFolder = matFolder.addFolder('1. Asfalto (Pista)');
  asphaltFolder
    .add(state, 'asphaltMap')
    .name('Mapa de Cor (map)')
    .onChange((v) => {
      mapFlags.asphalt.map = v;
      syncMaterialMaps();
    });
  asphaltFolder
    .add(state, 'asphaltNormalMap')
    .name('Normal Map')
    .onChange((v) => {
      mapFlags.asphalt.normalMap = v;
      syncMaterialMaps();
    });
  asphaltFolder
    .add(state, 'asphaltRoughnessMap')
    .name('Roughness Map')
    .onChange((v) => {
      mapFlags.asphalt.roughnessMap = v;
      syncMaterialMaps();
    });
  asphaltFolder
    .add(state, 'asphaltNormalScale', 0.0, 3.0, 0.05)
    .name('normalScale')
    .onChange((v) => {
      mapFlags.asphalt.normalScale = v;
      asphaltMaterial.normalScale.set(v, v);
    });
  asphaltFolder
    .add(state, 'asphaltRoughness', 0.0, 1.0, 0.02)
    .name('roughness (Mult.)')
    .onChange((v) => {
      asphaltMaterial.roughness = v;
    });
  asphaltFolder
    .add(state, 'asphaltMetalness', 0.0, 1.0, 0.02)
    .name('metalness')
    .onChange((v) => {
      asphaltMaterial.metalness = v;
    });
  asphaltFolder
    .add(state, 'asphaltRepeat', 0.5, 6.0, 0.25)
    .name('Repeat (Escala UV)')
    .onChange((v) => {
      updateSurfaceRepeat('asphalt', v);
    });

  // --- Subpasta 2: Pedra / Concreto (Cais e Píeres) ---
  const stoneFolder = matFolder.addFolder('2. Pedra (Cais/Calçada)');
  stoneFolder
    .add(state, 'stoneMap')
    .name('Mapa de Cor (map)')
    .onChange((v) => {
      mapFlags.stone.map = v;
      syncMaterialMaps();
    });
  stoneFolder
    .add(state, 'stoneNormalMap')
    .name('Normal Map')
    .onChange((v) => {
      mapFlags.stone.normalMap = v;
      syncMaterialMaps();
    });
  stoneFolder
    .add(state, 'stoneRoughnessMap')
    .name('Roughness Map')
    .onChange((v) => {
      mapFlags.stone.roughnessMap = v;
      syncMaterialMaps();
    });
  stoneFolder
    .add(state, 'stoneNormalScale', 0.0, 3.0, 0.05)
    .name('normalScale')
    .onChange((v) => {
      mapFlags.stone.normalScale = v;
      stoneMaterial.normalScale.set(v, v);
    });
  stoneFolder
    .add(state, 'stoneRoughness', 0.0, 1.0, 0.02)
    .name('roughness (Mult.)')
    .onChange((v) => {
      stoneMaterial.roughness = v;
    });
  stoneFolder
    .add(state, 'stoneMetalness', 0.0, 1.0, 0.02)
    .name('metalness')
    .onChange((v) => {
      stoneMaterial.metalness = v;
    });
  stoneFolder
    .add(state, 'stoneRepeat', 1.0, 10.0, 0.5)
    .name('Repeat (Escala UV)')
    .onChange((v) => {
      updateSurfaceRepeat('stone', v);
    });

  // --- Subpasta 3: Terreno (Monte Carlo) ---
  const groundFolder = matFolder.addFolder('3. Terreno (Solo)');
  groundFolder
    .add(state, 'groundMap')
    .name('Mapa de Cor (map)')
    .onChange((v) => {
      mapFlags.ground.map = v;
      syncMaterialMaps();
    });
  groundFolder
    .add(state, 'groundNormalMap')
    .name('Normal Map')
    .onChange((v) => {
      mapFlags.ground.normalMap = v;
      syncMaterialMaps();
    });
  groundFolder
    .add(state, 'groundRoughnessMap')
    .name('Roughness Map')
    .onChange((v) => {
      mapFlags.ground.roughnessMap = v;
      syncMaterialMaps();
    });
  groundFolder
    .add(state, 'groundNormalScale', 0.0, 3.0, 0.05)
    .name('normalScale')
    .onChange((v) => {
      mapFlags.ground.normalScale = v;
      groundMaterial.normalScale.set(v, v);
    });
  groundFolder
    .add(state, 'groundRoughness', 0.0, 1.0, 0.02)
    .name('roughness (Mult.)')
    .onChange((v) => {
      groundMaterial.roughness = v;
    });
  groundFolder
    .add(state, 'groundMetalness', 0.0, 1.0, 0.02)
    .name('metalness')
    .onChange((v) => {
      groundMaterial.metalness = v;
    });
  groundFolder
    .add(state, 'groundRepeat', 4.0, 60.0, 2.0)
    .name('Repeat (Escala UV)')
    .onChange((v) => {
      updateSurfaceRepeat('ground', v);
    });

  // --- Subpasta 4: Água do Porto ---
  const waterFolder = matFolder.addFolder('4. Água (Mar / Porto)');
  waterFolder
    .add(state, 'waterNormalMap')
    .name('Normal Map (Ondas)')
    .onChange((v) => {
      mapFlags.water.normalMap = v;
      syncMaterialMaps();
    });
  waterFolder
    .add(state, 'waterNormalScale', 0.0, 2.5, 0.05)
    .name('normalScale')
    .onChange((v) => {
      mapFlags.water.normalScale = v;
      waterMaterial.normalScale.set(v, v);
    });
  waterFolder
    .add(state, 'waterRoughness', 0.0, 1.0, 0.01)
    .name('roughness (Espelho)')
    .onChange((v) => {
      waterMaterial.roughness = v;
    });
  waterFolder
    .add(state, 'waterMetalness', 0.0, 1.0, 0.02)
    .name('metalness')
    .onChange((v) => {
      waterMaterial.metalness = v;
    });

  // --- Subpasta 5: Carro Metálico ---
  const carFolder = matFolder.addFolder('5. Carroceria (Metálica)');
  carFolder
    .add(state, 'carMetalness', 0.0, 1.0, 0.02)
    .name('metalness (Carro)')
    .onChange((v) => {
      carBodyMaterials.forEach((mat) => {
        mat.metalness = v;
      });
    });
  carFolder
    .add(state, 'carRoughness', 0.0, 1.0, 0.02)
    .name('roughness (Carro)')
    .onChange((v) => {
      carBodyMaterials.forEach((mat) => {
        mat.roughness = v;
      });
    });

  asphaltFolder.close();
  waterFolder.close();
  matFolder.close();
}
