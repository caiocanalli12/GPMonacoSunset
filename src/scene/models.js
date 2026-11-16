import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { convertModelMaterialsToStandard } from '../materials/materials.js';

/**
 * ============================================================================
 * CONFIGURAÇÕES DOS MODELOS 3D, ESCALAS-ALVO E CAMINHOS (M1)
 * ============================================================================
 * Todos os valores de tamanho-alvo e orientação ficam no topo para facilitar
 * ajustes caso a dupla troque a variante do modelo da Kenney.
 */
const MODEL_PATHS = {
  carObj: './models/car/car.obj',
  carMtl: './models/car/car.mtl',
  carResourceDir: './models/car/',
  boatGlb: './models/boat/boat.glb',
  buildingGlb: './models/building/building.glb',
};

// Tamanhos-alvo em metros exigidos pela especificação do M1
const CAR_TARGET_LENGTH = 4.5;          // Comprimento do carro (~4,5 m)
const BOAT_TARGET_LENGTH = 12.0;        // Comprimento base do barco (~12 m)
const BUILDING_BASE_HEIGHT = 28.0;      // Altura base do prédio (clones variam de 20 m a 40 m)

// Ajuste de orientação do carro:
// Na convenção do Three.js, a frente padrão de câmeras e objetos é -Z.
// Os carros do pacote Kenney Racing Kit apontam originalmente para +Z no arquivo OBJ,
// portanto aplicamos Math.PI (180°) para que a frente do carro aponte para -Z.
// (Se usarem um modelo que já aponte para -Z, basta mudar para 0).
const CAR_FORWARD_ROTATION_Y = Math.PI;

/**
 * Verifica se um arquivo existe na pasta public/ antes de passá-lo ao Loader.
 *
 * Por que fazemos essa verificação com fetch() e checamos o Content-Type?
 * Porque o servidor de desenvolvimento do Vite (SPA fallback) responde com HTTP 200
 * devolvendo o próprio index.html (text/html) quando um arquivo estático não existe.
 * Checar `res.ok && !contentType.includes('text/html')` evita erros silenciosos e
 * garante que o fallback de caixa colorida seja acionado de forma limpa.
 *
 * @param {string} url Caminho do arquivo
 * @returns {Promise<boolean>}
 */
async function checkAssetExists(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    if (!response.ok) return false;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Confirma se o Object3D carregado realmente possui pelo menos uma Mesh com geometria válida.
 *
 * @param {THREE.Object3D} root Objeto carregado
 * @returns {boolean}
 */
function hasValidGeometry(root) {
  if (!root) return false;
  let foundMesh = false;
  root.traverse((child) => {
    if (child.isMesh && child.geometry && child.geometry.attributes.position?.count > 0) {
      foundMesh = true;
    }
  });
  return foundMesh;
}

/**
 * Normaliza qualquer modelo 3D (ou placeholder) usando sua Bounding Box (THREE.Box3).
 *
 * Como funciona a normalização por Box3:
 * 1. Calcula a caixa envolvente (Box3) do modelo original no espaço de mundo;
 * 2. Descobre as dimensões reais (largura X, altura Y, comprimento Z);
 * 3. Se o objetivo for normalizar pelo comprimento horizontal ('length'), garante que
 *    o maior eixo horizontal esteja alinhado ao eixo Z e aplica escala uniforme
 *    `escala = tamanhoAlvo / tamanhoAtual`;
 * 4. Se o objetivo for normalizar pela altura ('height'), usa o eixo Y (`tamanhoAlvo / size.y`);
 * 5. Recalcula a Box3 após a escala, centraliza o modelo em X e Z (0, 0) e apoia a base
 *    exatamente no chão (`y = 0`, subtraindo `box.min.y`).
 *
 * @param {THREE.Object3D} rawObject Objeto 3D recém-carregado
 * @param {{ mode: 'length' | 'height', targetSize: number, rotationY?: number }} options
 * @returns {THREE.Group} Grupo pivô normalizado com base em y = 0
 */
export function normalizeModelByBox3(rawObject, { mode, targetSize, rotationY = 0 }) {
  const wrapper = new THREE.Group();
  wrapper.add(rawObject);

  // Atualiza matrizes para medir a caixa envolvente original
  wrapper.updateMatrixWorld(true);
  const initialBox = new THREE.Box3().setFromObject(rawObject);
  const initialSize = initialBox.getSize(new THREE.Vector3());

  // Se for carro ou barco e o modelo veio deitado no eixo X (X > Z), gira 90° para alinhar ao eixo Z
  if (mode === 'length' && initialSize.x > initialSize.z) {
    rawObject.rotation.y += Math.PI / 2;
  }

  // Aplica rotação extra de orientação (ex.: alinhar a frente do carro para -Z)
  rawObject.rotation.y += rotationY;
  wrapper.updateMatrixWorld(true);

  // Mede novamente após a orientação para calcular o fator de escala uniforme
  const orientedBox = new THREE.Box3().setFromObject(rawObject);
  const orientedSize = orientedBox.getSize(new THREE.Vector3());

  const referenceMeasure =
    mode === 'height'
      ? Math.max(orientedSize.y, 0.001)
      : Math.max(orientedSize.z, orientedSize.x, 0.001);

  const scaleFactor = targetSize / referenceMeasure;
  rawObject.scale.multiplyScalar(scaleFactor);
  wrapper.updateMatrixWorld(true);

  // Recalcula a Box3 escalada para centralizar X/Z na origem e apoiar a base em Y = 0
  const finalBox = new THREE.Box3().setFromObject(rawObject);
  const finalCenter = finalBox.getCenter(new THREE.Vector3());

  rawObject.position.x -= finalCenter.x;
  rawObject.position.y -= finalBox.min.y;
  rawObject.position.z -= finalCenter.z;

  wrapper.updateMatrixWorld(true);
  return wrapper;
}

/**
 * Cria um placeholder de caixas coloridas para o CARRO caso `public/models/car/car.obj` não exista.
 * Inclui faróis na frente (-Z) e aerofólio atrás (+Z) para deixar a direção do carro evidente.
 */
function createCarPlaceholder() {
  const group = new THREE.Group();
  group.name = 'PlaceholderCarro';

  // Chassi principal vermelho corrida
  const bodyGeo = new THREE.BoxGeometry(1.9, 0.65, 4.5, 2, 1, 4);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.4 });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.position.y = 0.55;
  group.add(bodyMesh);

  // Cabine/cockpit escuro
  const cabinGeo = new THREE.BoxGeometry(1.4, 0.55, 1.9);
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x1d3557, roughness: 0.3 });
  const cabinMesh = new THREE.Mesh(cabinGeo, cabinMat);
  cabinMesh.position.set(0, 1.1, 0.15);
  group.add(cabinMesh);

  // Aerofólio traseiro (no lado +Z, indicando claramente a traseira)
  const wingGeo = new THREE.BoxGeometry(1.85, 0.15, 0.45);
  const wingMat = new THREE.MeshStandardMaterial({ color: 0xf1faee });
  const wingMesh = new THREE.Mesh(wingGeo, wingMat);
  wingMesh.position.set(0, 1.15, 1.95);
  group.add(wingMesh);

  // Faixa amarela no bico frontal (lado -Z, indicando a frente do carro)
  const noseGeo = new THREE.BoxGeometry(1.5, 0.25, 0.5);
  const noseMat = new THREE.MeshStandardMaterial({ color: 0xffbe0b });
  const noseMesh = new THREE.Mesh(noseGeo, noseMat);
  noseMesh.position.set(0, 0.5, -2.1);
  group.add(noseMesh);

  return group;
}

/**
 * Cria um placeholder de caixas coloridas para o BARCO caso `public/models/boat/boat.glb` não exista.
 */
function createBoatPlaceholder() {
  const group = new THREE.Group();
  group.name = 'PlaceholderBarco';

  // Casco branco do iate
  const hullGeo = new THREE.BoxGeometry(3.4, 1.5, 12.0, 2, 1, 4);
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xf8f9fa, roughness: 0.35 });
  const hullMesh = new THREE.Mesh(hullGeo, hullMat);
  hullMesh.position.y = 0.75;
  group.add(hullMesh);

  // Convés azul marinho
  const deckGeo = new THREE.BoxGeometry(2.6, 1.2, 5.5);
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x457b9d, roughness: 0.4 });
  const deckMesh = new THREE.Mesh(deckGeo, deckMat);
  deckMesh.position.set(0, 2.1, 0.5);
  group.add(deckMesh);

  return group;
}

/**
 * Cria um placeholder de caixa colorida para o PRÉDIO caso `public/models/building/building.glb` não exista.
 */
function createBuildingPlaceholder() {
  const group = new THREE.Group();
  group.name = 'PlaceholderPredio';

  // Corpo principal do edifício (MeshStandardMaterial p/ reagir de forma consistente às luzes M2)
  const towerGeo = new THREE.BoxGeometry(11, 28, 11, 2, 6, 2);
  const towerMat = new THREE.MeshStandardMaterial({
    color: 0xe9c46a,
    roughness: 0.82,
    metalness: 0.05,
  });
  const towerMesh = new THREE.Mesh(towerGeo, towerMat);
  towerMesh.position.y = 14;
  group.add(towerMesh);

  // Topo/cornija do prédio
  const roofGeo = new THREE.BoxGeometry(11.6, 1.2, 11.6);
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0xbc6c25,
    roughness: 0.75,
    metalness: 0.05,
  });
  const roofMesh = new THREE.Mesh(roofGeo, roofMat);
  roofMesh.position.y = 28.6;
  group.add(roofMesh);

  // Faixas de janelas emissivas quentes acesas ao pôr do sol (M3)
  const windowMat = new THREE.MeshStandardMaterial({
    name: 'window_sunset',
    color: 0xffd180,
    emissive: new THREE.Color(0xffaa44),
    emissiveIntensity: 1.1,
    roughness: 0.15,
    metalness: 0.2,
  });
  const winFloors = [6, 12, 18, 24];
  winFloors.forEach((yPos) => {
    const winBandGeo = new THREE.BoxGeometry(11.15, 1.1, 9.2);
    const winBandMesh = new THREE.Mesh(winBandGeo, windowMat);
    winBandMesh.position.y = yPos;
    winBandMesh.name = `window_floor_${yPos}`;
    group.add(winBandMesh);
  });

  return group;
}

/**
 * Carrega o modelo do carro em formato OBJ (+ MTL e PNG se disponíveis) via MTLLoader e OBJLoader.
 * Caso o arquivo não exista em `public/models/car/car.obj`, retorna o placeholder com aviso no console.
 *
 * @returns {Promise<THREE.Group>}
 */
async function loadCarModel() {
  const objExists = await checkAssetExists(MODEL_PATHS.carObj);

  if (!objExists) {
    console.warn(
      `[Modelos M1] Arquivo "${MODEL_PATHS.carObj}" não encontrado. ` +
      `Usando caixa colorida como placeholder para o CARRO. ` +
      `Coloque car.obj (+ car.mtl e textura .png) em public/models/car/.`
    );
    return normalizeModelByBox3(createCarPlaceholder(), {
      mode: 'length',
      targetSize: CAR_TARGET_LENGTH,
      rotationY: 0, // O placeholder já é construído apontando para -Z
    });
  }

  try {
    const objLoader = new OBJLoader();
    const mtlExists = await checkAssetExists(MODEL_PATHS.carMtl);

    if (mtlExists) {
      const mtlLoader = new MTLLoader();
      // Define a pasta de recursos para que a textura PNG referenciada pelo .mtl seja carregada
      mtlLoader.setResourcePath(MODEL_PATHS.carResourceDir);
      const materials = await mtlLoader.loadAsync(MODEL_PATHS.carMtl);
      materials.preload();
      objLoader.setMaterials(materials);
    } else {
      console.warn(
        `[Modelos M1] Arquivo opcional "${MODEL_PATHS.carMtl}" não encontrado. ` +
        `Carregando "${MODEL_PATHS.carObj}" com material padrão.`
      );
    }

    const loadedObj = await objLoader.loadAsync(MODEL_PATHS.carObj);

    if (!hasValidGeometry(loadedObj)) {
      throw new Error('O arquivo OBJ carregado não contém malhas válidas.');
    }

    return normalizeModelByBox3(loadedObj, {
      mode: 'length',
      targetSize: CAR_TARGET_LENGTH,
      rotationY: CAR_FORWARD_ROTATION_Y,
    });
  } catch (error) {
    console.warn(
      `[Modelos M1] Falha ao carregar "${MODEL_PATHS.carObj}" (${error.message}). ` +
      `Usando placeholder para o CARRO.`
    );
    return normalizeModelByBox3(createCarPlaceholder(), {
      mode: 'length',
      targetSize: CAR_TARGET_LENGTH,
      rotationY: 0,
    });
  }
}

/**
 * Carrega um modelo em formato GLB (glTF 2.0 binário) usando GLTFLoader.
 * Caso o arquivo não exista ou falhe, usa a função de placeholder informada e avisa no console.
 *
 * @param {string} url Caminho do arquivo .glb
 * @param {string} label Nome legível do modelo para log
 * @param {() => THREE.Object3D} createFallbackFn Função que gera o placeholder
 * @param {{ mode: 'length' | 'height', targetSize: number }} normOptions Opções de normalização
 * @returns {Promise<THREE.Group>}
 */
async function loadGlbModel(url, label, createFallbackFn, normOptions) {
  const exists = await checkAssetExists(url);

  if (!exists) {
    console.warn(
      `[Modelos M1] Arquivo "${url}" não encontrado. ` +
      `Usando caixa colorida como placeholder para ${label}.`
    );
    return normalizeModelByBox3(createFallbackFn(), normOptions);
  }

  try {
    const gltfLoader = new GLTFLoader();
    const gltf = await gltfLoader.loadAsync(url);

    if (!hasValidGeometry(gltf.scene)) {
      throw new Error('O arquivo GLB não contém geometria válida.');
    }

    return normalizeModelByBox3(gltf.scene, normOptions);
  } catch (error) {
    console.warn(
      `[Modelos M1] Falha ao carregar "${url}" (${error.message}). ` +
      `Usando placeholder para ${label}.`
    );
    return normalizeModelByBox3(createFallbackFn(), normOptions);
  }
}

/**
 * Clona materiais das malhas de uma instância para que variações de cor ou estados
 * individuais não afetem todos os outros clones de forma indesejada.
 *
 * @param {THREE.Object3D} root Raiz do clone
 * @param {number | null} tintHex Cor opcional para matizar os placeholders
 * @param {boolean} isPlaceholder Se está usando o placeholder de caixa
 */
function prepareInstanceMaterials(root, tintHex = null, isPlaceholder = false, materialsSystem = null) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    const registerClonedMat = (m) => {
      if (materialsSystem) {
        materialsSystem.modelMaterialsWithUV.push({
          mat: m,
          originalMap: m.map,
          originalColorHex: m.color.getHex(),
        });
      }
    };

    if (Array.isArray(child.material)) {
      child.material = child.material.map((m) => {
        const cloned = m.clone();
        registerClonedMat(cloned);
        return cloned;
      });
    } else {
      child.material = child.material.clone();
      if (isPlaceholder && tintHex !== null && child.geometry.parameters?.height > 5) {
        child.material.color.setHex(tintHex);
      }
      registerClonedMat(child.material);
    }
  });
}

/**
 * Espalha os barcos ancorados no porto (lado oeste, X < -28) usando clone() do modelo base,
 * com variações de escala, rotação e posição.
 *
 * @param {THREE.Scene} scene Cena principal
 * @param {THREE.Group} baseBoat Modelo de barco já normalizado (~12 m)
 * @returns {THREE.Group[]} Lista de instâncias criadas
 */
function spawnHarborBoats(scene, baseBoat, materialsSystem) {
  const boatsGroup = new THREE.Group();
  boatsGroup.name = 'GrupoBarcosPorto';

  // 14 barcos distribuídos nos 4 píeres e no canal do porto de Mônaco
  const boatPlacements = [
    // Píer 1 (Z = -65)
    { x: -35, z: -72, scale: 0.95, rotY: Math.PI * 0.5 },
    { x: -50, z: -72, scale: 1.15, rotY: Math.PI * 0.5 },
    { x: -42, z: -57, scale: 1.0,  rotY: -Math.PI * 0.48 },
    // Píer 2 (Z = -15)
    { x: -36, z: -22, scale: 1.05, rotY: Math.PI * 0.52 },
    { x: -52, z: -22, scale: 1.25, rotY: Math.PI * 0.5 },
    { x: -44, z: -7,  scale: 0.9,  rotY: -Math.PI * 0.5 },
    // Píer 3 (Z = 35)
    { x: -36, z: 27,  scale: 1.1,  rotY: Math.PI * 0.5 },
    { x: -52, z: 27,  scale: 1.3,  rotY: Math.PI * 0.47 },
    { x: -43, z: 43,  scale: 0.92, rotY: -Math.PI * 0.52 },
    // Píer 4 (Z = 80)
    { x: -36, z: 72,  scale: 1.0,  rotY: Math.PI * 0.5 },
    { x: -52, z: 72,  scale: 1.2,  rotY: Math.PI * 0.5 },
    // Iates maiores ancorados mais ao largo no porto
    { x: -75, z: -45, scale: 1.4,  rotY: 0.15 },
    { x: -78, z: 5,   scale: 1.5,  rotY: -0.1 },
    { x: -74, z: 55,  scale: 1.35, rotY: 0.08 },
  ];

  const instances = [];

  boatPlacements.forEach((cfg, idx) => {
    const boatClone = baseBoat.clone(true);
    prepareInstanceMaterials(boatClone, null, false, materialsSystem);
    boatClone.name = `Barco_${idx + 1}`;
    // Posiciona na superfície da água (y = -0.55)
    boatClone.position.set(cfg.x, -0.55, cfg.z);
    boatClone.rotation.y = cfg.rotY;
    boatClone.scale.setScalar(cfg.scale);

    boatsGroup.add(boatClone);
    instances.push(boatClone);
  });

  scene.add(boatsGroup);
  return instances;
}

/**
 * Espalha os prédios de Monte Carlo (lado oposto ao mar e entorno do circuito) usando clone()
 * do modelo base, variando altura entre 20 m e 40 m, largura, rotação e posição.
 *
 * Junto com os 14 barcos, totaliza 40 instâncias (requisito mínimo: >= 30 objetos) para que
 * o Frustum Culling (Item 5 do diagnóstico) altere significativamente os draw calls e triângulos.
 *
 * @param {THREE.Scene} scene Cena principal
 * @param {THREE.Group} baseBuilding Modelo de prédio já normalizado (altura base = 28 m)
 * @param {any} materialsSystem Sistema de materiais M3
 * @returns {THREE.Group[]} Lista de instâncias criadas
 */
function spawnMonteCarloBuildings(scene, baseBuilding, materialsSystem) {
  const buildingsGroup = new THREE.Group();
  buildingsGroup.name = 'GrupoPrediosMonteCarlo';

  // Paleta mediterrânea de Monte Carlo (tons creme, terracota suave, areia e salmão)
  const facadePalette = [0xe9c46a, 0xf4a261, 0xe76f51, 0xd4a373, 0xfaedcd, 0xddb892];

  // 26 prédios distribuídos em quarteirões a leste da pista, além das curvas norte e sul
  const buildingPlacements = [
    // Primeira avenida costeira (logo à direita da pista, X = 52)
    { x: 52, z: -84, height: 26, footprint: 1.0,  rotY: -Math.PI / 2 },
    { x: 52, z: -66, height: 34, footprint: 1.1,  rotY: -Math.PI / 2 },
    { x: 52, z: -48, height: 22, footprint: 0.95, rotY: -Math.PI / 2 },
    { x: 52, z: -30, height: 38, footprint: 1.05, rotY: -Math.PI / 2 },
    { x: 52, z: -12, height: 29, footprint: 1.0,  rotY: -Math.PI / 2 },
    { x: 52, z: 6,   height: 40, footprint: 1.15, rotY: -Math.PI / 2 },
    { x: 52, z: 24,  height: 24, footprint: 0.95, rotY: -Math.PI / 2 },
    { x: 52, z: 42,  height: 35, footprint: 1.05, rotY: -Math.PI / 2 },
    { x: 52, z: 60,  height: 31, footprint: 1.0,  rotY: -Math.PI / 2 },
    { x: 52, z: 78,  height: 27, footprint: 1.0,  rotY: -Math.PI / 2 },

    // Segunda fileira mais alta na encosta de Monte Carlo (X = 74)
    { x: 74, z: -76, height: 36, footprint: 1.2,  rotY: Math.PI },
    { x: 74, z: -52, height: 40, footprint: 1.15, rotY: -Math.PI / 2 },
    { x: 74, z: -28, height: 32, footprint: 1.1,  rotY: 0 },
    { x: 74, z: -4,  height: 39, footprint: 1.2,  rotY: -Math.PI / 2 },
    { x: 74, z: 20,  height: 30, footprint: 1.1,  rotY: Math.PI / 2 },
    { x: 74, z: 44,  height: 37, footprint: 1.15, rotY: -Math.PI / 2 },
    { x: 74, z: 68,  height: 33, footprint: 1.1,  rotY: Math.PI },

    // Quarteirões ao Norte da Curva 1 (Sainte Dévote, Z < -102)
    { x: -4, z: -105, height: 24, footprint: 1.0,  rotY: 0 },
    { x: 16, z: -105, height: 31, footprint: 1.05, rotY: 0 },
    { x: 36, z: -105, height: 28, footprint: 1.0,  rotY: 0 },

    // Quarteirões ao Sul da Curva 3 (Rascasse, Z > 102)
    { x: -4, z: 105,  height: 25, footprint: 1.0,  rotY: Math.PI },
    { x: 16, z: 105,  height: 34, footprint: 1.1,  rotY: Math.PI },
    { x: 36, z: 105,  height: 22, footprint: 0.95, rotY: Math.PI },

    // Ilhas urbanas internas do circuito (entre a reta do porto e o trecho leste)
    { x: 12, z: -52, height: 21, footprint: 0.85, rotY: Math.PI / 2 },
    { x: 12, z: 50,  height: 23, footprint: 0.85, rotY: -Math.PI / 2 },
    { x: 25, z: -2,  height: 20, footprint: 0.8,  rotY: -Math.PI / 2 },
  ];

  // Detecta se estamos usando o placeholder para matizar as cores das fachadas
  let isPlaceholder = false;
  baseBuilding.traverse((c) => {
    if (c.name === 'PlaceholderPredio') isPlaceholder = true;
  });

  const instances = [];

  buildingPlacements.forEach((cfg, idx) => {
    const buildingClone = baseBuilding.clone(true);
    const tint = facadePalette[idx % facadePalette.length];
    prepareInstanceMaterials(buildingClone, tint, isPlaceholder, materialsSystem);

    buildingClone.name = `Predio_${idx + 1}`;
    buildingClone.position.set(cfg.x, 0, cfg.z);
    buildingClone.rotation.y = cfg.rotY;

    // Aplica escala proporcional para atingir a altura desejada (entre 20 m e 40 m)
    const heightScale = cfg.height / BUILDING_BASE_HEIGHT;
    buildingClone.scale.set(cfg.footprint, heightScale, cfg.footprint);

    buildingsGroup.add(buildingClone);
    instances.push(buildingClone);
  });

  scene.add(buildingsGroup);
  return instances;
}

/**
 * Habilita projeção e recepção de sombras em todas as sub-malhas de um modelo 3D (M2).
 *
 * Por que precisamos usar `traverse` em modelos OBJ e GLB?
 * Os loaders (`OBJLoader` e `GLTFLoader`) retornam uma árvore `THREE.Group` onde as geometrias
 * reais estão nos nós filhos `THREE.Mesh`. No Three.js, definir `castShadow = true` apenas no
 * `Group` raiz NÃO propaga para os filhos; é obrigatório percorrer a hierarquia com `traverse`.
 *
 * @param {THREE.Object3D} root Objeto raiz do modelo ou clone
 */
function enableModelShadows(root) {
  root.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

export async function loadAndPopulateModels(
  scene,
  carStartPosition,
  carStartRotationY = 0,
  materialsSystem = null
) {
  // Carrega os 3 modelos em paralelo para inicializar rápido
  const [carModel, baseBoatModel, baseBuildingModel] = await Promise.all([
    loadCarModel(),
    loadGlbModel(MODEL_PATHS.boatGlb, 'o BARCO', createBoatPlaceholder, {
      mode: 'length',
      targetSize: BOAT_TARGET_LENGTH,
    }),
    loadGlbModel(MODEL_PATHS.buildingGlb, 'o PRÉDIO', createBuildingPlaceholder, {
      mode: 'height',
      targetSize: BUILDING_BASE_HEIGHT,
    }),
  ]);

  // Converte materiais dos modelos carregados (ex.: Phong do OBJ+MTL -> MeshStandardMaterial PBR)
  // ANTES de o diagnóstico do M1 salvar o estado original (Requisito 3.e do M3)
  convertModelMaterialsToStandard(carModel, 'car', materialsSystem);
  convertModelMaterialsToStandard(baseBoatModel, 'boat', materialsSystem);
  convertModelMaterialsToStandard(baseBuildingModel, 'building', materialsSystem);

  // Configura sombras nos modelos-base antes da clonagem (assim todos os clones herdam castShadow/receiveShadow)
  enableModelShadows(carModel);
  enableModelShadows(baseBoatModel);
  enableModelShadows(baseBuildingModel);

  // Configura o carro do jogador na pista
  carModel.name = 'CarroJogador';
  carModel.position.copy(carStartPosition);
  carModel.rotation.y = carStartRotationY;
  scene.add(carModel);

  // Instancia os barcos no porto (14 clones) e os prédios em Monte Carlo (26 clones) = 40 instâncias
  const boats = spawnHarborBoats(scene, baseBoatModel, materialsSystem);
  const buildings = spawnMonteCarloBuildings(scene, baseBuildingModel, materialsSystem);

  return {
    car: carModel,
    boats,
    buildings,
  };
}
