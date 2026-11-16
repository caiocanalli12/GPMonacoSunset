import * as THREE from 'three';

/**
 * ============================================================================
 * PARÂMETROS DE ILUMINAÇÃO E SOMBRAS — ENTREGA M2
 * ============================================================================
 * Todos os parâmetros estão declarados em constantes nomeadas no topo para
 * facilitar ajustes experimentais e a justificativa técnica na defesa.
 *
 * Nota sobre a versão do Three.js (r186+):
 * - Luzes pontuais e spots usam unidades físicas luminosas (candela, cd) com `decay = 2`.
 * - O filtro PCF suave agora é unificado em `THREE.PCFShadowMap` (amostragem Vogel Disk
 *   controlada por `shadow.radius`), pois `PCFSoftShadowMap` foi descontinuado no r182+.
 */

// 1. SOL POENTE (DirectionalLight — raios paralelos vindos do horizonte oeste/mar)
export const SUN_CONFIG = {
  enabled: true,
  color: '#ffb070',           // Laranja quente do pôr do sol (ponto de partida especificado)
  intensity: 3.0,             // Intensidade calibrada em conjunto com ACESFilmicToneMapping
  elevationDeg: 12.5,         // Elevação baixa entre 10° e 15° para gerar sombras longas rasantes
  azimuthDeg: 172,            // 180° = Oeste puro (-X, lado do mar); 172° posiciona levemente a noroeste
  orbitRadius: 210,           // Distância da posição da luz e da esfera visual do sol até o alvo
  targetPosition: new THREE.Vector3(6, 0, 0), // Centro geométrico aproximado da área útil da cena
};

// 2. SOMBRA DO SOL (Câmera Ortográfica ajustada sob medida para a cena compacta)
export const SUN_SHADOW_CONFIG = {
  castShadow: true,
  mapSize: 2048,              // Ponto de partida 2048x2048 (~12 cm por texel na largura de 250 m)
  // Limites ortográficos justos cobrindo barcos (X=-80), pista e prédios (X=+80, Z=±112)
  cameraLeft: -125,
  cameraRight: 125,
  cameraTop: 85,
  cameraBottom: -75,
  cameraNear: 55,
  cameraFar: 365,
  // Ajuste fino anti-artefatos:
  // - bias muito próximo de zero evita peter-panning (sombra descolada das rodas do carro);
  // - normalBias desloca a amostra ao longo da normal da superfície, eliminando shadow acne no asfalto sob sol rasante;
  // - radius controla o espalhamento do filtro PCF suave nas bordas da penumbra.
  bias: -0.0004,
  normalBias: 0.04,
  radius: 2.0,
};

// 3. POSTES DA PISTA (SpotLight com decaimento físico quadrático + lâmpada emissiva)
export const SPOT_CONFIG = {
  enabled: true,
  color: '#ffd9a0',           // Branco quente (vapor de sódio / LED quente nos postes de rua)
  // Por que 240 candelas? Com decay = 2 (lei do inverso do quadrado 1/d²) e altura de ~7,1 m,
  // a iluminância no asfalto é E ≈ 240 / (7,1²) ≈ 4,7 lux, destacando o cone sobre a pista no entardecer.
  intensity: 240,
  distance: 34,               // Alcance finito em metros para delimitar o cálculo da luz localmente
  angle: Math.PI / 3.3,       // ~54,5°: abre um cone capaz de cobrir toda a largura da pista (11 m)
  penumbra: 0.55,             // Suaviza 55% da borda do facho luminoso sobre o asfalto
  decay: 2,                   // Decaimento fisicamente correto (inverso do quadrado da distância)
  poleHeight: 7.4,            // Altura do poste metálico em metros
  armLength: 2.2,             // Braço projetando a luminária sobre a borda da pista
  bulbEmissiveIntensity: 2.8, // Brilho próprio da malha da lâmpada para parecer acesa
  // Apenas 2 dos 6 postes projetam sombra para poupar shadow maps e draw calls na GPU
  shadowMapSize: 512,
  shadowBias: -0.0004,
  shadowNormalBias: 0.03,
  shadowRadius: 2.0,
};

// Distribuição dos 6 postes ao longo da curva paramétrica u ∈ [0, 1) da pista:
// Apenas o Poste 1 (Largada/Porto) e o Poste 4 (Grampo Central) têm `castsShadow: true`.
const STREET_LAMP_PLACEMENTS = [
  { u: 0.14, side: 1,  castsShadow: true,  label: 'Poste 1 (Largada - Com Sombra)' },
  { u: 0.25, side: -1, castsShadow: false, label: 'Poste 2 (Reta do Porto)' },
  { u: 0.40, side: -1, castsShadow: false, label: 'Poste 3 (Curva Norte)' },
  { u: 0.65, side: 1,  castsShadow: true,  label: 'Poste 4 (Grampo Central - Com Sombra)' },
  { u: 0.80, side: -1, castsShadow: false, label: 'Poste 5 (Reta Leste-Sul)' },
  { u: 0.93, side: -1, castsShadow: false, label: 'Poste 6 (Curva Sul)' },
];

// 4. PREENCHIMENTO DE CÉU (HemisphereLight fraca substituindo AmbientLight plana)
export const HEMI_CONFIG = {
  enabled: true,
  skyColor: '#ff9e7a',        // Tom laranja-rosado difundido pelo céu poente nas faces superiores
  groundColor: '#1e273c',     // Tom azulado escuro rebatido pelo mar e asfalto nas faces inferiores
  intensity: 0.45,            // Baixa intensidade para não lavar as sombras projetadas pelo sol
};

/**
 * Constrói a geometria de um poste de iluminação de pista com malha emissiva na lâmpada.
 *
 * Detalhe importante de sombra:
 * A haste e a cúpula superior têm `castShadow = true`, mas o bulbo luminoso (`bulbMesh`) tem
 * `castShadow = false` e o `SpotLight` nasce logo abaixo dele para que a própria geometria
 * da lâmpada não bloqueie o facho de luz nem gere auto-sombra indesejada.
 *
 * @param {THREE.Material} poleMaterial Material metálico compartilhado dos postes
 * @param {THREE.MeshStandardMaterial} bulbMaterial Material emissivo compartilhado das lâmpadas
 * @returns {{ group: THREE.Group, lightLocalPos: THREE.Vector3 }}
 */
function createStreetLampGeometry(poleMaterial, bulbMaterial) {
  const group = new THREE.Group();

  const h = SPOT_CONFIG.poleHeight;
  const arm = SPOT_CONFIG.armLength;

  // Base de concreto/metal do poste
  const baseGeo = new THREE.CylinderGeometry(0.32, 0.4, 0.6, 8);
  const baseMesh = new THREE.Mesh(baseGeo, poleMaterial);
  baseMesh.position.y = 0.3;
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  group.add(baseMesh);

  // Coluna vertical
  const mastGeo = new THREE.CylinderGeometry(0.13, 0.18, h, 8);
  const mastMesh = new THREE.Mesh(mastGeo, poleMaterial);
  mastMesh.position.y = h * 0.5;
  mastMesh.castShadow = true;
  mastMesh.receiveShadow = true;
  group.add(mastMesh);

  // Braço horizontal avançando na direção +Z local (que será alinhado rumo ao centro da pista)
  const armGeo = new THREE.BoxGeometry(0.16, 0.16, arm);
  const armMesh = new THREE.Mesh(armGeo, poleMaterial);
  armMesh.position.set(0, h - 0.1, arm * 0.5);
  armMesh.castShadow = true;
  armMesh.receiveShadow = true;
  group.add(armMesh);

  // Cúpula da luminária na ponta do braço
  const hoodGeo = new THREE.BoxGeometry(0.55, 0.18, 0.85);
  const hoodMesh = new THREE.Mesh(hoodGeo, poleMaterial);
  hoodMesh.position.set(0, h - 0.12, arm);
  hoodMesh.castShadow = true;
  hoodMesh.receiveShadow = true;
  group.add(hoodMesh);

  // Lâmpada emissiva (parece acesa mesmo nos postes onde castShadow = false)
  const bulbGeo = new THREE.SphereGeometry(0.22, 10, 8);
  const bulbMesh = new THREE.Mesh(bulbGeo, bulbMaterial);
  bulbMesh.scale.set(1.0, 0.55, 1.3);
  bulbMesh.position.set(0, h - 0.26, arm);
  bulbMesh.castShadow = false;    // Não bloqueia o SpotLight abaixo dela
  bulbMesh.receiveShadow = false;
  bulbMesh.name = 'LampadaEmissivaPoste';
  group.add(bulbMesh);

  // Posição exata de saída do SpotLight (logo abaixo do bulbo)
  const lightLocalPos = new THREE.Vector3(0, h - 0.36, arm);

  return { group, lightLocalPos };
}

/**
 * Cria todo o sistema de iluminação e sombras da Entrega M2:
 * - DirectionalLight (sol poente com sombra ortográfica ajustada + disco solar visual);
 * - 6 SpotLights nos postes da pista (2 com sombra e 4 sem sombra + lâmpadas emissivas);
 * - HemisphereLight fraca como preenchimento atmosférico de céu/chão.
 *
 * @param {THREE.Scene} scene Cena principal
 * @param {THREE.CatmullRomCurve3} trackCurve Curva paramétrica fechada da pista para posicionar os postes
 */
export function createLights(scene, trackCurve) {
  // ==========================================================================
  // 1. HEMISPHERELIGHT (Preenchimento atmosférico de céu/chão, sem sombra)
  // ==========================================================================
  const hemiLight = new THREE.HemisphereLight(
    HEMI_CONFIG.skyColor,
    HEMI_CONFIG.groundColor,
    HEMI_CONFIG.intensity
  );
  hemiLight.position.set(0, 120, 0);
  hemiLight.visible = HEMI_CONFIG.enabled;
  hemiLight.name = 'LuzHemisfericaCeu';
  scene.add(hemiLight);

  // ==========================================================================
  // 2. DIRECTIONALLIGHT (Sol poente baixo do lado do mar, com sombra)
  // ==========================================================================
  const sunLight = new THREE.DirectionalLight(SUN_CONFIG.color, SUN_CONFIG.intensity);
  sunLight.visible = SUN_CONFIG.enabled;
  sunLight.name = 'SolPoenteDirectional';

  // O alvo (target) precisa estar na cena para que a matriz da sombra e os helpers apontem certo
  sunLight.target.position.copy(SUN_CONFIG.targetPosition);
  sunLight.target.name = 'AlvoSolPoente';
  scene.add(sunLight.target);

  // Configuração da sombra ortográfica justa à nossa cena compacta
  sunLight.castShadow = SUN_SHADOW_CONFIG.castShadow;
  sunLight.shadow.mapSize.set(SUN_SHADOW_CONFIG.mapSize, SUN_SHADOW_CONFIG.mapSize);
  sunLight.shadow.camera.left = SUN_SHADOW_CONFIG.cameraLeft;
  sunLight.shadow.camera.right = SUN_SHADOW_CONFIG.cameraRight;
  sunLight.shadow.camera.top = SUN_SHADOW_CONFIG.cameraTop;
  sunLight.shadow.camera.bottom = SUN_SHADOW_CONFIG.cameraBottom;
  sunLight.shadow.camera.near = SUN_SHADOW_CONFIG.cameraNear;
  sunLight.shadow.camera.far = SUN_SHADOW_CONFIG.cameraFar;
  sunLight.shadow.bias = SUN_SHADOW_CONFIG.bias;
  sunLight.shadow.normalBias = SUN_SHADOW_CONFIG.normalBias;
  sunLight.shadow.radius = SUN_SHADOW_CONFIG.radius;
  sunLight.shadow.camera.updateProjectionMatrix();

  scene.add(sunLight);

  // Núcleo visual discreto do sol (complementa o disco solar analítico do Sky.js do M3)
  const sunDiscGeo = new THREE.SphereGeometry(3.5, 16, 16);
  const sunDiscMat = new THREE.MeshBasicMaterial({
    color: SUN_CONFIG.color,
    fog: false, // Impede que a névoa apague o disco do sol no horizonte
  });
  const sunDiscMesh = new THREE.Mesh(sunDiscGeo, sunDiscMat);
  sunDiscMesh.name = 'SolPorDoSol';
  sunDiscMesh.castShadow = false;
  sunDiscMesh.receiveShadow = false;
  scene.add(sunDiscMesh);

  /**
   * Atualiza a posição 3D do sol e do disco visual a partir dos ângulos de
   * elevação (altura acima do horizonte) e azimute (direção horizontal).
   *
   * @param {number} elevationDeg Elevação solar em graus (ex.: 12.5°)
   * @param {number} azimuthDeg Azimute em graus (180° = Oeste / lado do mar)
   */
  function updateSunAngles(elevationDeg, azimuthDeg) {
    const elevRad = THREE.MathUtils.degToRad(elevationDeg);
    const azimRad = THREE.MathUtils.degToRad(azimuthDeg);

    const horizontalDist = SUN_CONFIG.orbitRadius * Math.cos(elevRad);
    const x = SUN_CONFIG.targetPosition.x + horizontalDist * Math.cos(azimRad);
    const y = SUN_CONFIG.orbitRadius * Math.sin(elevRad);
    const z = SUN_CONFIG.targetPosition.z - horizontalDist * Math.sin(azimRad);

    sunLight.position.set(x, y, z);
    sunDiscMesh.position.set(x, y, z);

    sunLight.updateMatrixWorld();
    sunLight.target.updateMatrixWorld();
    sunLight.shadow.camera.updateMatrixWorld();
  }

  // Posiciona o sol inicialmente na configuração de pôr do sol
  updateSunAngles(SUN_CONFIG.elevationDeg, SUN_CONFIG.azimuthDeg);

  // ==========================================================================
  // 3. POSTES DE ILUMINAÇÃO COM SPOTLIGHTS AO LONGO DA PISTA (6 postes, 2 com sombra)
  // ==========================================================================
  const streetLampsGroup = new THREE.Group();
  streetLampsGroup.name = 'GrupoPostesPista';

  const poleMaterial = new THREE.MeshStandardMaterial({
    color: 0x2f3542,
    roughness: 0.5,
    metalness: 0.65,
  });

  const bulbMaterial = new THREE.MeshStandardMaterial({
    color: 0xfff3d6,
    emissive: new THREE.Color(SPOT_CONFIG.color),
    emissiveIntensity: SPOT_CONFIG.bulbEmissiveIntensity,
    roughness: 0.2,
  });

  const upAxis = new THREE.Vector3(0, 1, 0);
  const lateralOffsetFromCenter = 6.9; // Borda da zebra fica em 6.2 m; poste fica a 6.9 m do centro

  const spotLights = [];
  const shadowCastingSpotLights = [];

  STREET_LAMP_PLACEMENTS.forEach((spec, index) => {
    const trackCenter = trackCurve.getPointAt(spec.u);
    const tangent = trackCurve.getTangentAt(spec.u).normalize();
    const rightVec = new THREE.Vector3().crossVectors(tangent, upAxis).normalize();

    // Posição da base do poste na margem escolhida (+1 ou -1)
    const poleBasePos = trackCenter.clone().addScaledVector(rightVec, spec.side * lateralOffsetFromCenter);
    // Vetor apontando da margem de volta para o centro da pista
    const inwardDir = rightVec.clone().multiplyScalar(-spec.side);

    const { group: poleMeshGroup, lightLocalPos } = createStreetLampGeometry(poleMaterial, bulbMaterial);
    poleMeshGroup.name = `PostePista_${index + 1}`;
    poleMeshGroup.position.set(poleBasePos.x, 0, poleBasePos.z);
    // Faz o eixo +Z local do braço do poste apontar para dentro da pista
    poleMeshGroup.rotation.y = Math.atan2(inwardDir.x, inwardDir.z);
    poleMeshGroup.updateMatrixWorld(true);

    // Converte a posição local da luminária para coordenadas de mundo
    const spotWorldPos = lightLocalPos.clone().applyMatrix4(poleMeshGroup.matrixWorld);

    const spotLight = new THREE.SpotLight(
      SPOT_CONFIG.color,
      SPOT_CONFIG.intensity,
      SPOT_CONFIG.distance,
      SPOT_CONFIG.angle,
      SPOT_CONFIG.penumbra,
      SPOT_CONFIG.decay
    );
    spotLight.name = spec.label;
    spotLight.position.copy(spotWorldPos);
    spotLight.visible = SPOT_CONFIG.enabled;

    // Mira o facho ligeiramente adiante do poste no centro da faixa de asfalto
    spotLight.target.position.set(trackCenter.x, 0.05, trackCenter.z);
    spotLight.target.name = `AlvoPoste_${index + 1}`;
    scene.add(spotLight.target);
    spotLight.target.updateMatrixWorld();

    // Configura sombra apenas nos postes selecionados (2 de 6) devido ao custo de renderização
    spotLight.castShadow = spec.castsShadow;
    if (spec.castsShadow) {
      spotLight.shadow.mapSize.set(SPOT_CONFIG.shadowMapSize, SPOT_CONFIG.shadowMapSize);
      spotLight.shadow.camera.near = 1.0;
      spotLight.shadow.camera.far = SPOT_CONFIG.distance;
      spotLight.shadow.bias = SPOT_CONFIG.shadowBias;
      spotLight.shadow.normalBias = SPOT_CONFIG.shadowNormalBias;
      spotLight.shadow.radius = SPOT_CONFIG.shadowRadius;
      spotLight.shadow.camera.updateProjectionMatrix();
      shadowCastingSpotLights.push(spotLight);
    }

    streetLampsGroup.add(poleMeshGroup);
    scene.add(spotLight);
    spotLights.push(spotLight);
  });

  scene.add(streetLampsGroup);

  /**
   * Descarta o RenderTarget de sombra do sol para forçar o WebGLShadowMap a
   * alocar uma nova textura quando `mapSize` é alterado no painel em tempo real.
   *
   * @param {number} newMapSize Resolução quadrada (512, 1024, 2048 ou 4096)
   */
  function updateSunShadowMapSize(newMapSize) {
    sunLight.shadow.mapSize.set(newMapSize, newMapSize);
    if (sunLight.shadow.map) {
      if (sunLight.shadow.map.depthTexture) {
        sunLight.shadow.map.depthTexture.dispose();
        sunLight.shadow.map.depthTexture = null;
      }
      sunLight.shadow.map.dispose();
      sunLight.shadow.map = null;
    }
    sunLight.shadow.needsUpdate = true;
  }

  return {
    sunLight,
    sunDiscMesh,
    hemiLight,
    spotLights,
    shadowCastingSpotLights,
    bulbMaterial,
    streetLampsGroup,
    updateSunAngles,
    updateSunShadowMapSize,
  };
}
