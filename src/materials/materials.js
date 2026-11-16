import * as THREE from 'three';

/**
 * ============================================================================
 * PARÂMETROS DOS MATERIAIS PBR (MeshStandardMaterial) — ENTREGA M3
 * ============================================================================
 * Valores-base no topo do arquivo para facilitar ajustes e justificativa na defesa.
 * Temos 7 categorias de materiais distintos na cena (meta da disciplina: >= 5):
 * 1. Asfalto da pista (`asphalt`)
 * 2. Pedra / Concreto do cais e calçada (`stone`)
 * 3. Terreno urbano de Monte Carlo (`ground`)
 * 4. Água do porto com normal map animado e reflexo PMREM (`water`)
 * 5. Carroceria metálica do carro (`carBody`) + Vidros (`carGlass`) + Pneus (`carTire`)
 * 6. Casco dos barcos/iates (`boat`)
 * 7. Fachadas foscas dos prédios com janelas emissivas (`building`)
 */
export const MATERIAL_DEFAULTS = {
  asphalt: {
    solidColor: 0x26272b,
    roughness: 1.0,       // Base 1.0 para que o roughnessMap controle os micro-brilhos do piche/brita
    metalness: 0.0,       // Asfalto é um material dielétrico (não-metálico)
    normalScale: 0.75,
  },
  stone: {
    solidColor: 0x8a8d93,
    roughness: 0.88,      // Pedra/concreto portuário áspero
    metalness: 0.04,
    normalScale: 0.85,    // Relevo nas juntas de blocos sob luz rasante
  },
  ground: {
    solidColor: 0x3a3b40,
    roughness: 0.95,      // Solo urbano bastante difuso/fosco
    metalness: 0.0,
    normalScale: 0.65,
  },
  water: {
    solidColor: 0x0c2d48, // Azul mediterrâneo profundo de entardecer
    roughness: 0.14,      // Baixa rugosidade (0.05 a 0.15) para refletir o sol e o céu PMREM sem serrilhado
    metalness: 0.0,       // Água é um dielétrico (metalness = 0 conforme especificado no item 3d)
    normalScale: 0.16,    // Ondulação suave de porto abrigado (evita faixas bruscas nos reflexos rasantes)
    envMapIntensity: 1.15,
    scrollSpeedX: 0.05,   // Velocidade de rolagem UV em unidades/segundo (independente de FPS)
    scrollSpeedY: 0.035,
    scrollMultiplier: 1.0,
  },
  carBody: {
    roughness: 0.28,      // Verniz automotivo polido (~0.25 a 0.40)
    metalness: 0.82,      // Pintura metálica (~0.70 a 0.90) que reflete o skybox do pôr do sol
    envMapIntensity: 1.35,
  },
  carGlass: {
    roughness: 0.08,      // Vidro muito liso e espelhado
    metalness: 0.15,
  },
  carTire: {
    roughness: 0.92,      // Borracha fosca sem reflexo especular forte
    metalness: 0.05,
  },
  boat: {
    roughness: 0.26,      // Casco náutico em gelcoat/fibra levemente brilhante
    metalness: 0.08,
  },
  building: {
    roughness: 0.86,      // Fachadas de concreto/alvenaria foscas
    metalness: 0.04,
    windowEmissiveColor: 0xffaa44, // Luz quente acesa nas janelas de Monte Carlo ao entardecer
    windowEmissiveIntensity: 1.35,
  },
};

/**
 * Cria e gerencia os materiais principais da cena (Asfalto, Pedra, Terreno e Água),
 * além de armazenar referências aos materiais convertidos dos modelos 3D para que
 * o painel "Materiais" possa inspecionar e alternar mapas em tempo real.
 *
 * @param {Awaited<ReturnType<import('./textures.js').loadSceneTextures>>} textures
 */
export function createSceneMaterials(textures) {
  // 1. MATERIAL DO ASFALTO (Faixa da pista)
  // Se color.jpg existir, usamos cor base branca (0xffffff) para não escurecer os pixels da textura;
  // se não existir, usamos a cor sólida cinza escuro (`solidColor`).
  const asphaltMaterial = new THREE.MeshStandardMaterial({
    name: 'MaterialAsfalto',
    color: textures.asphalt.color ? 0xffffff : MATERIAL_DEFAULTS.asphalt.solidColor,
    map: textures.asphalt.color || null,
    normalMap: textures.asphalt.normal,
    normalScale: new THREE.Vector2(
      MATERIAL_DEFAULTS.asphalt.normalScale,
      MATERIAL_DEFAULTS.asphalt.normalScale
    ),
    roughnessMap: textures.asphalt.roughness,
    roughness: MATERIAL_DEFAULTS.asphalt.roughness,
    metalness: MATERIAL_DEFAULTS.asphalt.metalness,
  });

  // 2. MATERIAL DE PEDRA / CONCRETO (Cais, píeres e calçadas/bordas)
  const stoneMaterial = new THREE.MeshStandardMaterial({
    name: 'MaterialPedraCais',
    color: textures.stone.color ? 0xffffff : MATERIAL_DEFAULTS.stone.solidColor,
    map: textures.stone.color || null,
    normalMap: textures.stone.normal,
    normalScale: new THREE.Vector2(
      MATERIAL_DEFAULTS.stone.normalScale,
      MATERIAL_DEFAULTS.stone.normalScale
    ),
    roughnessMap: textures.stone.roughness,
    roughness: MATERIAL_DEFAULTS.stone.roughness,
    metalness: MATERIAL_DEFAULTS.stone.metalness,
  });

  // 3. MATERIAL DO TERRENO (Solo de Monte Carlo)
  const groundMaterial = new THREE.MeshStandardMaterial({
    name: 'MaterialTerreno',
    color: textures.ground.color ? 0xffffff : MATERIAL_DEFAULTS.ground.solidColor,
    map: textures.ground.color || null,
    normalMap: textures.ground.normal,
    normalScale: new THREE.Vector2(
      MATERIAL_DEFAULTS.ground.normalScale,
      MATERIAL_DEFAULTS.ground.normalScale
    ),
    roughnessMap: textures.ground.roughness,
    roughness: MATERIAL_DEFAULTS.ground.roughness,
    metalness: MATERIAL_DEFAULTS.ground.metalness,
  });

  // 4. MATERIAL DA ÁGUA DO PORTO (Reflexo do ambiente + normalMap animado com dt)
  const waterMaterial = new THREE.MeshStandardMaterial({
    name: 'MaterialAguaPorto',
    color: MATERIAL_DEFAULTS.water.solidColor,
    normalMap: textures.water.normal,
    normalScale: new THREE.Vector2(
      MATERIAL_DEFAULTS.water.normalScale,
      MATERIAL_DEFAULTS.water.normalScale
    ),
    roughness: MATERIAL_DEFAULTS.water.roughness,
    metalness: MATERIAL_DEFAULTS.water.metalness,
    envMapIntensity: MATERIAL_DEFAULTS.water.envMapIntensity,
  });

  // Listas de materiais dos modelos externos (preenchidas durante o carregamento em models.js)
  const carBodyMaterials = [];
  const modelMaterialsWithUV = [];

  // Estado interno dos toggles de cada mapa e modos globais (Visualizar UV / Sem Texturas)
  const mapFlags = {
    uvPreviewMode: false,
    noTexturesMode: false,
    waterScrollMultiplier: MATERIAL_DEFAULTS.water.scrollMultiplier,
    asphalt: { map: true, normalMap: true, roughnessMap: true, normalScale: MATERIAL_DEFAULTS.asphalt.normalScale },
    stone: { map: true, normalMap: true, roughnessMap: true, normalScale: MATERIAL_DEFAULTS.stone.normalScale },
    ground: { map: true, normalMap: true, roughnessMap: true, normalScale: MATERIAL_DEFAULTS.ground.normalScale },
    water: { normalMap: true, normalScale: MATERIAL_DEFAULTS.water.normalScale },
  };

  /**
   * Sincroniza os mapas ativos (`map`, `normalMap`, `roughnessMap`) e a cor de base de
   * cada material levando em conta os toggles individuais, o modo "Visualizar UV" e o
   * modo "Sem Texturas (Cores Sólidas)".
   */
  function syncMaterialMaps() {
    const { uvPreviewMode, noTexturesMode } = mapFlags;

    // --- Asfalto ---
    if (uvPreviewMode) {
      asphaltMaterial.map = textures.asphalt.uvChecker;
      asphaltMaterial.color.setHex(0xffffff);
    } else if (noTexturesMode || !mapFlags.asphalt.map || !textures.asphalt.color) {
      asphaltMaterial.map = null;
      asphaltMaterial.color.setHex(MATERIAL_DEFAULTS.asphalt.solidColor);
    } else {
      asphaltMaterial.map = textures.asphalt.color;
      asphaltMaterial.color.setHex(0xffffff);
    }
    asphaltMaterial.normalMap =
      !noTexturesMode && mapFlags.asphalt.normalMap ? textures.asphalt.normal : null;
    asphaltMaterial.roughnessMap =
      !noTexturesMode && mapFlags.asphalt.roughnessMap ? textures.asphalt.roughness : null;
    asphaltMaterial.normalScale.setScalar(mapFlags.asphalt.normalScale);
    asphaltMaterial.needsUpdate = true;

    // --- Pedra / Cais ---
    if (uvPreviewMode) {
      stoneMaterial.map = textures.stone.uvChecker;
      stoneMaterial.color.setHex(0xffffff);
    } else if (noTexturesMode || !mapFlags.stone.map || !textures.stone.color) {
      stoneMaterial.map = null;
      stoneMaterial.color.setHex(MATERIAL_DEFAULTS.stone.solidColor);
    } else {
      stoneMaterial.map = textures.stone.color;
      stoneMaterial.color.setHex(0xffffff);
    }
    stoneMaterial.normalMap =
      !noTexturesMode && mapFlags.stone.normalMap ? textures.stone.normal : null;
    stoneMaterial.roughnessMap =
      !noTexturesMode && mapFlags.stone.roughnessMap ? textures.stone.roughness : null;
    stoneMaterial.normalScale.setScalar(mapFlags.stone.normalScale);
    stoneMaterial.needsUpdate = true;

    // --- Terreno ---
    if (uvPreviewMode) {
      groundMaterial.map = textures.ground.uvChecker;
      groundMaterial.color.setHex(0xffffff);
    } else if (noTexturesMode || !mapFlags.ground.map || !textures.ground.color) {
      groundMaterial.map = null;
      groundMaterial.color.setHex(MATERIAL_DEFAULTS.ground.solidColor);
    } else {
      groundMaterial.map = textures.ground.color;
      groundMaterial.color.setHex(0xffffff);
    }
    groundMaterial.normalMap =
      !noTexturesMode && mapFlags.ground.normalMap ? textures.ground.normal : null;
    groundMaterial.roughnessMap =
      !noTexturesMode && mapFlags.ground.roughnessMap ? textures.ground.roughness : null;
    groundMaterial.normalScale.setScalar(mapFlags.ground.normalScale);
    groundMaterial.needsUpdate = true;

    // --- Água ---
    if (uvPreviewMode) {
      waterMaterial.map = textures.water.uvChecker;
      waterMaterial.color.setHex(0xffffff);
    } else {
      waterMaterial.map = null;
      waterMaterial.color.setHex(MATERIAL_DEFAULTS.water.solidColor);
    }
    waterMaterial.normalMap =
      !noTexturesMode && mapFlags.water.normalMap ? textures.water.normal : null;
    waterMaterial.normalScale.setScalar(mapFlags.water.normalScale);
    waterMaterial.needsUpdate = true;

    // --- Modelos 3D (Carro, Barcos e Prédios) quando "Visualizar UV" ou "Sem Texturas" muda ---
    modelMaterialsWithUV.forEach((entry) => {
      const { mat, originalMap, originalColorHex } = entry;
      if (uvPreviewMode) {
        mat.map = textures.modelUvChecker;
        mat.color.setHex(0xffffff);
      } else if (noTexturesMode) {
        mat.map = null;
        mat.color.setHex(originalColorHex);
      } else {
        mat.map = originalMap;
        mat.color.setHex(originalColorHex);
      }
      mat.needsUpdate = true;
    });
  }

  /**
   * Atualiza o `repeat` de todas as texturas associadas a um material (`color`, `normal`,
   * `roughness` e `uvChecker`) mantendo a proporção entre largura e comprimento.
   *
   * @param {'asphalt' | 'stone' | 'ground'} surfaceKey
   * @param {number} baseRepeat Novo valor de repeat base
   */
  function updateSurfaceRepeat(surfaceKey, baseRepeat) {
    const texGroup = textures[surfaceKey];
    if (!texGroup) return;

    const rx = baseRepeat;
    const ry = Number((baseRepeat * texGroup.aspectRatio).toFixed(1));
    texGroup.repeatX = rx;
    texGroup.repeatY = ry;

    [texGroup.color, texGroup.normal, texGroup.roughness, texGroup.uvChecker].forEach((tex) => {
      if (tex) {
        tex.repeat.set(rx, ry);
      }
    });
  }

  /**
   * Anima a rolagem do normal map da água a cada frame usando o delta do THREE.Timer.
   *
   * Por que multiplicar por `dt`?
   * Assim como no movimento do carro (M1), `offset += velocidade * dt` garante que as
   * ondas do mar corram na mesma velocidade física em monitores de 30 Hz, 60 Hz ou 144 Hz.
   *
   * @param {number} dt Delta time em segundos
   */
  function updateWaterAnimation(dt) {
    const mult = mapFlags.waterScrollMultiplier;
    const dx = MATERIAL_DEFAULTS.water.scrollSpeedX * mult * dt;
    const dy = MATERIAL_DEFAULTS.water.scrollSpeedY * mult * dt;

    if (textures.water.normal) {
      textures.water.normal.offset.x = (textures.water.normal.offset.x + dx) % 1.0;
      textures.water.normal.offset.y = (textures.water.normal.offset.y + dy) % 1.0;
    }
    if (mapFlags.uvPreviewMode && textures.water.uvChecker) {
      textures.water.uvChecker.offset.x = (textures.water.uvChecker.offset.x + dx) % 1.0;
      textures.water.uvChecker.offset.y = (textures.water.uvChecker.offset.y + dy) % 1.0;
    }
  }

  return {
    asphaltMaterial,
    stoneMaterial,
    groundMaterial,
    waterMaterial,
    carBodyMaterials,
    modelMaterialsWithUV,
    mapFlags,
    textures,
    syncMaterialMaps,
    updateSurfaceRepeat,
    updateWaterAnimation,
  };
}

/**
 * Converte e ajusta os materiais dos modelos carregados (Carro OBJ+MTL, Barco GLB e Prédio GLB)
 * para `THREE.MeshStandardMaterial` no momento do carregamento, ANTES de o diagnóstico do M1
 * salvar o estado original dos materiais.
 *
 * - Carro (OBJ+MTL vem como `MeshPhongMaterial`): converte para `MeshStandardMaterial` preservando
 *   o `map` (com `SRGBColorSpace`), aplicando `metalness ~0.82` e `roughness ~0.28` na carroceria,
 *   vidros lisos (`roughness = 0.08`) e pneus foscos (`roughness = 0.92`).
 * - Barco (GLB): preserva o `map` original e ajusta o casco com leve brilho (`roughness = 0.26`).
 * - Prédio (GLB): preserva o `map` original, deixa as fachadas foscas (`roughness = 0.86`) e
 *   adiciona faixas de janelas emissivas quentes para coerência com o entardecer.
 *
 * @param {THREE.Object3D} root Raiz do modelo carregado
 * @param {'car' | 'boat' | 'building'} modelType Tipo do modelo
 * @param {ReturnType<typeof createSceneMaterials>} materialsSystem Sistema de materiais M3
 */
export function convertModelMaterialsToStandard(root, modelType, materialsSystem) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    const convertSingleMaterial = (oldMat) => {
      // Garante que qualquer mapa de cor vindo de OBJ/MTL ou GLB esteja em SRGBColorSpace
      if (oldMat.map) {
        oldMat.map.colorSpace = THREE.SRGBColorSpace;
      }

      const matName = (oldMat.name || child.name || '').toLowerCase();
      const baseColor = oldMat.color ? oldMat.color.clone() : new THREE.Color(0xffffff);
      const luminance = baseColor.r * 0.299 + baseColor.g * 0.587 + baseColor.b * 0.114;

      let roughness = 0.6;
      let metalness = 0.1;
      let isCarBody = false;

      if (modelType === 'car') {
        // Identifica vidros/cabine, pneus/rodas escuras ou carroceria metálica principal
        const isGlass =
          matName.includes('window') ||
          matName.includes('glass') ||
          matName.includes('vidro') ||
          (baseColor.b > baseColor.r * 1.4 && luminance < 0.35);

        const isTireOrDarkTrim =
          matName.includes('tire') ||
          matName.includes('wheel') ||
          matName.includes('pneu') ||
          matName.includes('rubber') ||
          luminance < 0.14;

        if (isGlass) {
          roughness = MATERIAL_DEFAULTS.carGlass.roughness;
          metalness = MATERIAL_DEFAULTS.carGlass.metalness;
        } else if (isTireOrDarkTrim) {
          roughness = MATERIAL_DEFAULTS.carTire.roughness;
          metalness = MATERIAL_DEFAULTS.carTire.metalness;
        } else {
          roughness = MATERIAL_DEFAULTS.carBody.roughness;
          metalness = MATERIAL_DEFAULTS.carBody.metalness;
          isCarBody = true;
        }
      } else if (modelType === 'boat') {
        roughness = MATERIAL_DEFAULTS.boat.roughness;
        metalness = MATERIAL_DEFAULTS.boat.metalness;
      } else if (modelType === 'building') {
        const isWindow = matName.includes('window') || matName.includes('glass') || matName.includes('janela');
        roughness = isWindow ? 0.15 : MATERIAL_DEFAULTS.building.roughness;
        metalness = isWindow ? 0.2 : MATERIAL_DEFAULTS.building.metalness;
      }

      // Cria um novo MeshStandardMaterial preservando cor, mapa UV e transparência
      const stdMat = new THREE.MeshStandardMaterial({
        name: oldMat.name || `${modelType}_StandardMat`,
        color: baseColor,
        map: oldMat.map || null,
        roughness,
        metalness,
        envMapIntensity: isCarBody ? MATERIAL_DEFAULTS.carBody.envMapIntensity : 1.0,
        transparent: oldMat.transparent || false,
        opacity: oldMat.opacity !== undefined ? oldMat.opacity : 1.0,
        side: oldMat.side !== undefined ? oldMat.side : THREE.FrontSide,
      });

      // Se for janela de prédio identificada pelo nome no GLB, adiciona emissão cálida de pôr do sol
      if (modelType === 'building' && (matName.includes('window') || matName.includes('glass'))) {
        stdMat.emissive = new THREE.Color(MATERIAL_DEFAULTS.building.windowEmissiveColor);
        stdMat.emissiveIntensity = 0.65;
      }

      if (materialsSystem) {
        if (isCarBody) {
          materialsSystem.carBodyMaterials.push(stdMat);
        }
        materialsSystem.modelMaterialsWithUV.push({
          mat: stdMat,
          originalMap: stdMat.map,
          originalColorHex: stdMat.color.getHex(),
        });
      }

      return stdMat;
    };

    if (Array.isArray(child.material)) {
      child.material = child.material.map(convertSingleMaterial);
    } else {
      child.material = convertSingleMaterial(child.material);
    }
  });
}
