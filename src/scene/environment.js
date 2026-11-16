import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

/**
 * ============================================================================
 * CONFIGURAÇÕES DO AMBIENTE COERENTE (SKY, PMREM, FOG, ÁGUA, CAIS E TERRENO - M3)
 * ============================================================================
 * Constantes centralizadas no topo para facilitar ajustes e justificativa na defesa.
 */
export const ENVIRONMENT_CONFIG = {
  // Parâmetros atmosféricos do modelo analítico de Preetham (Sky.js) calibrados para crepúsculo/pôr do sol
  skyScale: 4500,
  turbidity: 4.5,             // Turbidez moderada para não esbranquiçar o horizonte
  rayleigh: 3.6,              // Espalhamento Rayleigh alto para absorver comprimentos azuis no horizonte
  mieCoefficient: 0.0012,     // Aerossóis controlados para evitar estouro branco (glare excessivo)
  mieDirectionalG: 0.86,      // Concentração da auréola dourada ao redor do disco solar no oeste
  cloudCoverage: 0.0,         // Sem camada de nuvens diurnas brancas para preservar a meia-luz do pôr do sol
  cloudDensity: 0.0,
  cloudElevation: 0.5,

  // Intensidade global do mapa de reflexo (IBL / PMREM) gerado a partir do Sky:
  // Mantida baixa (0.26) para preservar o contraste dramático de meia-luz do M2 e o destaque
  // dos 6 postes (SpotLights) na pista, sem "lavar" as sombras projetadas.
  environmentIntensity: 0.26,

  // Névoa (Fog) com a mesma paleta terracota/âmbar quente do pôr do sol da Entrega M2
  fogColorLowSun: new THREE.Color('#d96b43'),
  fogColorHighSun: new THREE.Color('#e08a5c'),
  fogNear: 75,
  fogFar: 295,

  // Cores sólidas de partida idênticas à estética aprovada no M2
  seaColor: 0x0c2d48,
  quayColor: 0x8a8d93,
  landColor: 0x3a3b40,
  guardrailColor: 0xd97736,
};

/**
 * Aplica os parâmetros atmosféricos de pôr do sol em uma instância de `Sky` e ajusta a curva
 * radiométrica de crepúsculo no shader para que o modelo de Preetham mantenha a estética de
 * meia-luz (horizonte terracota `#d96b43`, auréola dourada `#ffb070` na direção do sol e zênite
 * crepuscular escuro `#262c4f`), além de escurecer o hemisfério inferior (`direction.y < 0`)
 * para eliminar reflexos brancos/serrilhados na superfície da água.
 *
 * @param {Sky} skyInstance
 */
function configureSkyUniforms(skyInstance) {
  const u = skyInstance.material.uniforms;
  u.turbidity.value = ENVIRONMENT_CONFIG.turbidity;
  u.rayleigh.value = ENVIRONMENT_CONFIG.rayleigh;
  u.mieCoefficient.value = ENVIRONMENT_CONFIG.mieCoefficient;
  u.mieDirectionalG.value = ENVIRONMENT_CONFIG.mieDirectionalG;

  if (u.cloudCoverage) u.cloudCoverage.value = ENVIRONMENT_CONFIG.cloudCoverage;
  if (u.cloudDensity) u.cloudDensity.value = ENVIRONMENT_CONFIG.cloudDensity;
  if (u.cloudElevation) u.cloudElevation.value = ENVIRONMENT_CONFIG.cloudElevation;

  // No Sky.js padrão do Three.js, a constante interna EE = 1000.0 gera luminâncias HDR > 40.0
  // para elevação solar de 12,5°, o que faz o ACESFilmicToneMapping saturar o céu para branco,
  // e o clamp `max(0.0, direction.y)` repete o horizonte claro no hemisfério inferior do cubemap.
  // Aqui modulamos `texColor` antes do `<tonemapping_fragment>` mantendo a dependência física de
  // `vSunDirection` (elevação e azimute do DirectionalLight) e `cosTheta`:
  if (!skyInstance.userData.sunsetShaderPatched) {
    skyInstance.material.fragmentShader = skyInstance.material.fragmentShader.replace(
      'gl_FragColor = vec4( texColor, 1.0 );',
      /* glsl */ `
      // Fator de altura solar: 0.0 no pôr do sol rasante (<= 14°), subindo até 1.0 se o usuário erguer o sol no painel
      float sunElevFactor = clamp( ( vSunDirection.y - 0.16 ) / 0.55, 0.0, 1.0 );

      // Atenua a luminância bruta do modelo de Preetham para não estourar para branco no ACESFilmic
      vec3 preethamSoft = texColor * mix( 0.0035, 0.012, sunElevFactor );

      if ( direction.y < 0.0 ) {
        // Hemisfério inferior escuro (cor profunda do mar) para que o PMREM não reflita branco nas ondas da água
        float nadirFade = clamp( -direction.y * 6.0, 0.0, 1.0 );
        vec3 horizonRim = vec3( 0.36, 0.085, 0.032 );
        vec3 deepSeaUnder = vec3( 0.008, 0.022, 0.042 );
        texColor = mix( horizonRim, deepSeaUnder, nadirFade );
      } else {
        float h = clamp( direction.y, 0.0, 1.0 );

        // Gradiente vertical de meia-luz (terracota M2 no horizonte -> púrpura crepuscular -> azul-noite no zênite)
        vec3 horizonSunset = mix( vec3( 0.42, 0.095, 0.035 ), vec3( 0.52, 0.18, 0.075 ), sunElevFactor );
        vec3 midTwilight   = mix( vec3( 0.18, 0.048, 0.045 ), vec3( 0.24, 0.11, 0.14 ), sunElevFactor );
        vec3 zenithDusk    = mix( vec3( 0.018, 0.022, 0.052 ), vec3( 0.05, 0.09, 0.20 ), sunElevFactor );

        vec3 duskGradient = mix( midTwilight, zenithDusk, smoothstep( 0.08, 0.72, h ) );
        duskGradient = mix( horizonSunset, duskGradient, smoothstep( 0.0, 0.22, h ) );

        // Auréola dourada concentrada na direção real do sol (responde ao Azimute e Elevação do painel "Luz")
        float sunAzimuthGlow = pow( max( 0.0, cosTheta ), 5.0 ) * exp( -h * 4.5 );
        vec3 solarHalo = vec3( 0.75, 0.22, 0.045 ) * sunAzimuthGlow;

        texColor = duskGradient + solarHalo + preethamSoft;
      }

      gl_FragColor = vec4( texColor, 1.0 );
      `
    );
    skyInstance.material.needsUpdate = true;
    skyInstance.userData.sunsetShaderPatched = true;
  }
}

/**
 * Monta o ambiente da cena (M1 + M2 + M3):
 * - Substitui o fundo plano por `Sky` (`three/examples/jsm/objects/Sky.js`) sincronizado com o sol;
 * - Gera o `scene.environment` com `THREE.PMREMGenerator` (regenerado apenas quando o sol muda);
 * - Configura `THREE.Fog` coerente com a cor do horizonte do céu;
 * - Cria as malhas de água, terreno, cais e píeres com UVs proporcionais e sombras configuradas.
 *
 * @param {THREE.Scene} scene Cena principal do Three.js
 * @param {THREE.WebGLRenderer} renderer Renderizador WebGL (necessário para o PMREMGenerator)
 */
export function createEnvironment(scene, renderer) {
  // 1. CÉU ANALÍTICO (Sky.js) E NÉVOA (FOG) COERENTES
  const sky = new Sky();
  sky.scale.setScalar(ENVIRONMENT_CONFIG.skyScale);
  sky.name = 'CeuAnaliticoPreetham';
  // Impede que os modos de diagnóstico do M1 (Wireframe, Back-face e Frustum Culling) alterem a caixa do Sky
  sky.userData.ignoreDiagnostics = true;
  configureSkyUniforms(sky);
  scene.add(sky);

  // Removemos background plano para que a cúpula do Sky seja visível no fundo
  scene.background = null;

  const fog = new THREE.Fog(
    ENVIRONMENT_CONFIG.fogColorLowSun.clone(),
    ENVIRONMENT_CONFIG.fogNear,
    ENVIRONMENT_CONFIG.fogFar
  );
  scene.fog = fog;
  scene.environmentIntensity = ENVIRONMENT_CONFIG.environmentIntensity;

  // 2. GERADOR PMREM PARA O ENVIRONMENT MAP (Reflexos metálicos no carro e na água)
  // Criamos uma cena auxiliar contendo apenas uma cúpula `envSky` (com `showSunDisc = 0` conforme
  // recomendado na documentação oficial do Sky.js para evitar artefatos especulares no cubemap).
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileCubemapShader();

  const skyEnvScene = new THREE.Scene();
  const envSky = new Sky();
  envSky.scale.setScalar(100);
  configureSkyUniforms(envSky);
  if (envSky.material.uniforms.showSunDisc) {
    envSky.material.uniforms.showSunDisc.value = 0;
  }
  skyEnvScene.add(envSky);

  let currentEnvRenderTarget = null;
  const sunDirection = new THREE.Vector3();

  /**
   * Atualiza a direção do sol no shader do `Sky` e harmoniza a cor da névoa (`Fog`)
   * com a altura solar. Esta função é leve e roda durante o arraste dos sliders.
   *
   * @param {THREE.Vector3} sunLightPosition Posição atual do DirectionalLight
   * @param {THREE.Vector3} sunTargetPosition Alvo do DirectionalLight
   * @param {number} elevationDeg Elevação solar em graus
   */
  function syncSkyWithSun(sunLightPosition, sunTargetPosition, elevationDeg = 12.5) {
    sunDirection.subVectors(sunLightPosition, sunTargetPosition).normalize();
    sky.material.uniforms.sunPosition.value.copy(sunDirection);
    envSky.material.uniforms.sunPosition.value.copy(sunDirection);

    // Ajusta suavemente o tom do Fog conforme a elevação do sol para manter o horizonte coeso
    const t = THREE.MathUtils.clamp((elevationDeg - 5) / 40, 0, 1);
    fog.color.lerpColors(ENVIRONMENT_CONFIG.fogColorLowSun, ENVIRONMENT_CONFIG.fogColorHighSun, t);
  }

  /**
   * (Re)gera o mapa de reflexo (`scene.environment`) a partir do céu com `PMREMGenerator`.
   *
   * IMPORTANTE (Requisito 4 do M3):
   * Esta função NUNCA é chamada a cada frame no loop `animate()`. Ela só é executada
   * uma vez na inicialização e no evento `onFinishChange` dos sliders de posição do sol!
   */
  function regenerateEnvironmentMap() {
    if (currentEnvRenderTarget) {
      currentEnvRenderTarget.dispose();
    }
    currentEnvRenderTarget = pmremGenerator.fromScene(skyEnvScene, 0.04);
    scene.environment = currentEnvRenderTarget.texture;
  }

  // 3. ÁGUA DO PORTO (Lado Oeste: X < -24)
  // Subdividimos o plano (28x28) para que a malha fique bem visível no modo Wireframe (Item 1).
  const waterGeometry = new THREE.PlaneGeometry(220, 320, 28, 28);
  waterGeometry.rotateX(-Math.PI / 2);
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: ENVIRONMENT_CONFIG.seaColor,
    roughness: 0.1,
    metalness: 0.05,
  });
  const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
  waterMesh.position.set(-134, -0.6, 0);
  waterMesh.receiveShadow = true;
  waterMesh.castShadow = false;
  waterMesh.name = 'MarPorto';
  scene.add(waterMesh);

  // 4. TERRENO DE MONTE CARLO (Lado Leste: X > -22)
  const landGeometry = new THREE.PlaneGeometry(180, 320, 28, 28);
  landGeometry.rotateX(-Math.PI / 2);
  const landMaterial = new THREE.MeshStandardMaterial({
    color: ENVIRONMENT_CONFIG.landColor,
    roughness: 0.9,
    metalness: 0.05,
  });
  const landMesh = new THREE.Mesh(landGeometry, landMaterial);
  landMesh.position.set(68, 0, 0);
  landMesh.receiveShadow = true;
  landMesh.castShadow = false;
  landMesh.name = 'TerrenoMonteCarlo';
  scene.add(landMesh);

  // 5. CAIS E PÍERES DO PORTO (Separando a água em X < -24 e o terreno em X > -22)
  const quayGroup = new THREE.Group();
  quayGroup.name = 'GrupoCais';

  const quayMaterial = new THREE.MeshStandardMaterial({
    color: ENVIRONMENT_CONFIG.quayColor,
    roughness: 0.85,
    metalness: 0.05,
  });
  const guardrailMaterial = new THREE.MeshStandardMaterial({
    color: ENVIRONMENT_CONFIG.guardrailColor,
    roughness: 0.6,
    metalness: 0.15,
  });

  // Muralha principal do cais ao longo do eixo Z (4 m × 320 m)
  const mainWallGeo = new THREE.BoxGeometry(4, 1.4, 320, 2, 1, 24);
  const mainWallMesh = new THREE.Mesh(mainWallGeo, quayMaterial);
  mainWallMesh.position.set(-23, -0.2, 0);
  mainWallMesh.castShadow = true;
  mainWallMesh.receiveShadow = true;
  mainWallMesh.name = 'CaisPrincipal';
  quayGroup.add(mainWallMesh);

  // Mureta baixa de proteção entre o cais e a água
  const curbWallGeo = new THREE.BoxGeometry(0.6, 0.5, 260, 1, 1, 16);
  const curbWallMesh = new THREE.Mesh(curbWallGeo, guardrailMaterial);
  curbWallMesh.position.set(-24.5, 0.65, 0);
  curbWallMesh.castShadow = true;
  curbWallMesh.receiveShadow = true;
  curbWallMesh.name = 'MuretaCais';
  quayGroup.add(curbWallMesh);

  // Píeres perpendiculares avançando sobre o mar para ancoragem dos barcos/iates
  // Ajustamos a escala UV dos píeres (36 m de comprimento vs 320 m do cais) para que os
  // blocos da textura de pedra tenham o mesmo tamanho métrico tanto no cais quanto nos píeres.
  const pierPositionsZ = [-65, -15, 35, 80];
  const pierGeo = new THREE.BoxGeometry(36, 0.7, 3.2, 8, 1, 2);
  const pierUvAttr = pierGeo.attributes.uv;
  for (let i = 0; i < pierUvAttr.count; i++) {
    pierUvAttr.setXY(i, pierUvAttr.getX(i) * 0.8, pierUvAttr.getY(i) * (36 / 320));
  }

  const pierMeshes = [];
  for (let i = 0; i < pierPositionsZ.length; i++) {
    const pierMesh = new THREE.Mesh(pierGeo, quayMaterial);
    pierMesh.position.set(-43, -0.1, pierPositionsZ[i]);
    pierMesh.castShadow = true;
    pierMesh.receiveShadow = true;
    pierMesh.name = `Pier_${i + 1}`;
    quayGroup.add(pierMesh);
    pierMeshes.push(pierMesh);
  }

  scene.add(quayGroup);

  /**
   * Conecta os materiais texturizados do M3 (`waterMaterial`, `groundMaterial`, `stoneMaterial`)
   * às malhas do ambiente.
   *
   * @param {ReturnType<import('../materials/materials.js').createSceneMaterials>} materialsSystem
   */
  function applyEnvironmentMaterials(materialsSystem) {
    waterMesh.material = materialsSystem.waterMaterial;
    landMesh.material = materialsSystem.groundMaterial;
    mainWallMesh.material = materialsSystem.stoneMaterial;
    pierMeshes.forEach((p) => {
      p.material = materialsSystem.stoneMaterial;
    });
  }

  return {
    fog,
    sky,
    waterMesh,
    landMesh,
    mainWallMesh,
    syncSkyWithSun,
    regenerateEnvironmentMap,
    applyEnvironmentMaterials,
  };
}
