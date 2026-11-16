import * as THREE from 'three';

/**
 * ============================================================================
 * CAMINHOS E CONSTANTES DE TEXTURAS — ENTREGA M3
 * ============================================================================
 * Os arquivos abaixo podem ser baixados de fontes CC0 (ambientCG ou Poly Haven,
 * versão 1K JPG e NormalGL/OpenGL) e colocados nas respectivas pastas.
 */
export const TEXTURE_PATHS = {
  asphalt: {
    color: './textures/asphalt/color.jpg',
    normal: './textures/asphalt/normal.jpg',
    roughness: './textures/asphalt/roughness.jpg',
  },
  stone: {
    color: './textures/stone/color.jpg',
    normal: './textures/stone/normal.jpg',
    roughness: './textures/stone/roughness.jpg',
  },
  ground: {
    color: './textures/ground/color.jpg',
    normal: './textures/ground/normal.jpg',
    roughness: './textures/ground/roughness.jpg',
  },
  water: {
    normal: './textures/water/normal.jpg',
  },
};

// Escalas de repetição inicial (quantas vezes a textura se repete na malha)
export const TEXTURE_REPEAT_DEFAULTS = {
  asphaltWidthRepeats: 2.0,  // 2 repetições nos 11 m de largura (~5,5 m por bloco); comprimento usa comprimento de arco
  stoneRepeatX: 3.0,         // Repetição transversal no cais/calçada
  stoneRepeatY: 45.0,        // Repetição longitudinal nos 320 m de cais (~7 m por bloco)
  groundRepeatX: 24.0,       // 180 m de largura / 24 = 7,5 m por repetição no terreno
  groundRepeatY: 42.0,       // 320 m de compr. / 42 ≈ 7,6 m por repetição no terreno
  waterRepeatX: 7.0,         // Ondas largas e suaves no porto (evita compressão/serrilhado nos reflexos)
  waterRepeatY: 10.0,
};

/**
 * Verifica se um arquivo de textura existe na pasta `public/textures/` antes de carregar.
 * Evita que o fallback SPA do Vite devolva `index.html` (text/html) como se fosse imagem.
 *
 * @param {string} url Caminho da textura
 * @returns {Promise<boolean>}
 */
async function checkTextureExists(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) return false;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/html')) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Aplica os parâmetros de amostragem, repetição, filtro anisotrópico, mipmaps e espaço de cor.
 *
 * Justificativa técnica de cada parâmetro (Importante para a defesa):
 * 1. `colorSpace`:
 *    - Mapas de cor (`map` / albedo) são salvos com curva gama sRGB para visualização humana,
 *      então DEVEM usar `THREE.SRGBColorSpace` para que a GPU linearize os valores antes das
 *      equações de iluminação física (PBR).
 *    - Mapas técnicos (`normalMap` e `roughnessMap`) guardam vetores matemáticos XYZ ou coeficientes
 *      escalares lineares [0..1]. Se aplicássemos sRGB neles, a conversão gama alteraria a direção
 *      das normais e distorceria a rugosidade! Por isso ficam em `THREE.NoColorSpace` (linear).
 * 2. `wrapS` e `wrapT = THREE.RepeatWrapping`:
 *    - Permite que coordenadas UV maiores que 1.0 repitam o ladrilho periodicamente sem esticar a borda.
 * 3. `anisotropy = maxAnisotropy`:
 *    - O filtro anisotrópico amostra múltiplos texels alongados quando olhamos uma superfície em
 *      ângulo rasante (como a pista de asfalto vista da câmera baixa em 3ª pessoa), evitando que a
 *      pista fique borrada a poucos metros à frente do carro.
 * 4. `generateMipmaps = true` e `LinearMipmapLinearFilter`:
 *    - Cria a pirâmide de resoluções reduzidas (mipmaps) e interpola trilinearmente entre níveis,
 *      eliminando o serrilhado cintilante (*aliasing/moiré*) nos objetos distantes e reduzindo
 *      o tráfego de memória de textura na GPU.
 *
 * @param {THREE.Texture} texture Textura a configurar
 * @param {{ isColorMap: boolean, repeatX: number, repeatY: number, maxAnisotropy: number }} options
 * @returns {THREE.Texture}
 */
export function configureTexture(texture, { isColorMap, repeatX, repeatY, maxAnisotropy }) {
  texture.colorSpace = isColorMap ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = maxAnisotropy;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Tenta carregar uma textura externa via `THREE.TextureLoader`.
 * Se o arquivo não existir, emite um `console.warn` claro e retorna `null` sem quebrar a aplicação.
 *
 * @param {THREE.TextureLoader} loader Instância do loader
 * @param {string} url Caminho do arquivo
 * @param {{ isColorMap: boolean, repeatX: number, repeatY: number, maxAnisotropy: number }} config
 * @returns {Promise<THREE.Texture | null>}
 */
async function loadOptionalTexture(loader, url, config) {
  const exists = await checkTextureExists(url);
  if (!exists) {
    console.warn(
      `[Texturas M3] Arquivo "${url}" não encontrado. ` +
      `Mantendo cor sólida / fallback procedural sem interromper a aplicação.`
    );
    return null;
  }

  try {
    const tex = await loader.loadAsync(url);
    return configureTexture(tex, config);
  } catch (err) {
    console.warn(`[Texturas M3] Erro ao carregar "${url}" (${err.message}). Usando fallback.`);
    return null;
  }
}

/**
 * Gera um Normal Map procedural contínuo (tileable) em Canvas para a água (Fallback exigido no item 1).
 *
 * Como funciona a conversão de ruído de altura em Normal Map (padrão OpenGL / NormalGL):
 * 1. Avaliamos um campo de alturas periódico H(x, y) combinando ondas senoidais cruzadas em várias
 *    frequências (garantindo continuidade nas bordas 0 e `size` para o `RepeatWrapping` não ter costura);
 * 2. Calculamos as derivadas parciais por diferenças finitas centrais:
 *    dX = H(x + 1, y) - H(x - 1, y)  e  dY = H(x, y + 1) - H(x, y - 1);
 * 3. O vetor normal no espaço tangente OpenGL é N = normalize(-dX * força, -dY * força, 1.0);
 * 4. Mapeamos cada componente de [-1, +1] para [0, 255]: R = (Nx * 0.5 + 0.5) * 255,
 *    G = (Ny * 0.5 + 0.5) * 255, B = (Nz * 0.5 + 0.5) * 255.
 *
 * @param {number} size Resolução quadrada do canvas (ex.: 256)
 * @param {{ repeatX: number, repeatY: number, maxAnisotropy: number }} config
 * @returns {THREE.CanvasTexture}
 */
export function createProceduralWaterNormalMap(size = 512, { repeatX, repeatY, maxAnisotropy }) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  // Passo 1: Campo escalar de alturas periódico H(x, y) com ondulações de baixa frequência
  // (evita harmônicos agudos que causam serrilhado/aliasing especular em ângulo rasante)
  const heights = new Float32Array(size * size);
  const twoPi = Math.PI * 2;

  for (let y = 0; y < size; y++) {
    const ny = (y / size) * twoPi;
    for (let x = 0; x < size; x++) {
      const nx = (x / size) * twoPi;

      // Ondas suaves de porto abrigado (frequências inteiras baixas garantem tile perfeito sem costura)
      const w1 = Math.sin(nx * 2.0 + ny * 1.0) * 0.48;
      const w2 = Math.cos(nx * 3.0 - ny * 2.0) * 0.32;
      const w3 = Math.sin(nx * 4.0 + ny * 3.0 + Math.cos(nx - ny)) * 0.20;

      heights[y * size + x] = w1 + w2 + w3;
    }
  }

  // Passo 2 e 3: Diferenças finitas centrais -> vetor normal tangente (NormalGL)
  // Força moderada (0.55) combinada com resolução 512x512 evita degraus de quantização de 8 bits
  const strength = 0.55;

  for (let y = 0; y < size; y++) {
    const yPrev = (y - 1 + size) % size;
    const yNext = (y + 1) % size;

    for (let x = 0; x < size; x++) {
      const xPrev = (x - 1 + size) % size;
      const xNext = (x + 1) % size;

      const dX = heights[y * size + xNext] - heights[y * size + xPrev];
      const dY = heights[yNext * size + x] - heights[yPrev * size + x];

      let nx = -dX * strength;
      let ny = -dY * strength;
      let nz = 1.0;

      const invLen = 1.0 / Math.hypot(nx, ny, nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;

      const idx = (y * size + x) * 4;
      data[idx] = Math.round((nx * 0.5 + 0.5) * 255);     // Canal R = eixo tangente X
      data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255); // Canal G = eixo bitangente Y (OpenGL +Y)
      data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255); // Canal B = eixo normal Z (+Z para fora)
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const normalTex = new THREE.CanvasTexture(canvas);
  normalTex.name = 'ProceduralWaterNormalMap';
  return configureTexture(normalTex, {
    isColorMap: false, // Normal map SEMPRE em espaço linear (NoColorSpace)
    repeatX,
    repeatY,
    maxAnisotropy,
  });
}

/**
 * Gera mapas procedurais leves de Normal e Roughness em Canvas para Asfalto, Pedra e Terreno
 * usados APENAS como fallback caso os arquivos `.jpg` ainda não tenham sido colocados em `public/textures/`.
 * Nota: O mapa de cor (`map`) permanece `null` quando o arquivo falta para preservar a cor sólida atual,
 * enquanto os mapas de relevo/rugosidade de fallback permitem testar os sliders do painel imediatamente.
 *
 * @param {'asphalt' | 'stone' | 'ground'} preset Tipo de superfície
 * @param {{ repeatX: number, repeatY: number, maxAnisotropy: number }} config
 * @returns {{ normal: THREE.CanvasTexture, roughness: THREE.CanvasTexture }}
 */
function createProceduralSurfaceFallbackMaps(preset, { repeatX, repeatY, maxAnisotropy }) {
  const size = 128;
  const heights = new Float32Array(size * size);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const roughCtx = roughCanvas.getContext('2d');
  const roughImg = roughCtx.createImageData(size, size);

  // Função hash determinística para gerar granulação sem depender de bibliotecas externas
  const hash = (x, y) => {
    const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return h - Math.floor(h);
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hVal = hash(x, y);

      // Para pedra/cais, adiciona juntas de blocos retangulares
      if (preset === 'stone') {
        const mortarX = x % 32 < 2;
        const mortarY = (y + (Math.floor(x / 32) % 2) * 16) % 32 < 2;
        if (mortarX || mortarY) {
          hVal = 0.08;
        } else {
          hVal = 0.55 + hVal * 0.35;
        }
      }

      heights[y * size + x] = hVal;

      // Rugosidade alta e uniforme (0.86 a 0.96) para preservar o aspecto fosco limpo do M2
      const roughByte = Math.round((0.86 + (1.0 - hVal) * 0.10) * 255);
      const rIdx = (y * size + x) * 4;
      roughImg.data[rIdx] = roughByte;
      roughImg.data[rIdx + 1] = roughByte;
      roughImg.data[rIdx + 2] = roughByte;
      roughImg.data[rIdx + 3] = 255;
    }
  }
  roughCtx.putImageData(roughImg, 0, 0);

  // Converte o campo de alturas `heights` em NormalGL sutil para não esbranquiçar o asfalto/terreno
  const normCanvas = document.createElement('canvas');
  normCanvas.width = size;
  normCanvas.height = size;
  const normCtx = normCanvas.getContext('2d');
  const normImg = normCtx.createImageData(size, size);
  const bumpStrength = preset === 'stone' ? 0.45 : 0.20;

  for (let y = 0; y < size; y++) {
    const yPrev = (y - 1 + size) % size;
    const yNext = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xPrev = (x - 1 + size) % size;
      const xNext = (x + 1) % size;

      const dX = heights[y * size + xNext] - heights[y * size + xPrev];
      const dY = heights[yNext * size + x] - heights[yPrev * size + x];

      let nx = -dX * bumpStrength;
      let ny = -dY * bumpStrength;
      let nz = 1.0;
      const inv = 1.0 / Math.hypot(nx, ny, nz);
      nx *= inv;
      ny *= inv;
      nz *= inv;

      const idx = (y * size + x) * 4;
      normImg.data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      normImg.data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      normImg.data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      normImg.data[idx + 3] = 255;
    }
  }
  normCtx.putImageData(normImg, 0, 0);

  const normal = configureTexture(new THREE.CanvasTexture(normCanvas), {
    isColorMap: false,
    repeatX,
    repeatY,
    maxAnisotropy,
  });
  const roughness = configureTexture(new THREE.CanvasTexture(roughCanvas), {
    isColorMap: false,
    repeatX,
    repeatY,
    maxAnisotropy,
  });

  return { normal, roughness };
}

/**
 * Gera uma textura xadrez numerada (`CanvasTexture`) para o modo "Visualizar UV" (Item 5 do M3).
 * Cada célula exibe sua coordenada na grade (A1..D4) para comprovar na defesa que os UVs da
 * pista não esticam nas curvas e que os repeats mantêm proporção métrica correta.
 *
 * @param {number} repeatX Repetição horizontal U
 * @param {number} repeatY Repetição vertical V
 * @param {number} maxAnisotropy Anisotropia máxima do renderer
 * @returns {THREE.CanvasTexture}
 */
export function createUVCheckerTexture(repeatX, repeatY, maxAnisotropy) {
  const size = 512;
  const cells = 4;
  const cellSize = size / cells;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const rowLabels = ['A', 'B', 'C', 'D'];
  const paletteEven = ['#1e293b', '#0f766e', '#1d4ed8', '#4338ca'];
  const paletteOdd = ['#f8fafc', '#fef08a', '#fed7aa', '#e2e8f0'];

  for (let row = 0; row < cells; row++) {
    for (let col = 0; col < cells; col++) {
      const isEven = (row + col) % 2 === 0;
      ctx.fillStyle = isEven ? paletteEven[row % 4] : paletteOdd[col % 4];
      ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);

      // Moldura interna da célula
      ctx.strokeStyle = isEven ? 'rgba(255,255,255,0.25)' : 'rgba(15,23,42,0.25)';
      ctx.lineWidth = 3;
      ctx.strokeRect(col * cellSize + 1.5, row * cellSize + 1.5, cellSize - 3, cellSize - 3);

      // Rótulo alfanumérico (ex.: A1, B2) + seta indicando sentido +V
      ctx.fillStyle = isEven ? '#f8fafc' : '#0f172a';
      ctx.font = 'bold 34px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = `${rowLabels[row]}${col + 1}↑`;
      ctx.fillText(label, (col + 0.5) * cellSize, (row + 0.5) * cellSize);
    }
  }

  const checkerTex = new THREE.CanvasTexture(canvas);
  checkerTex.name = 'UVCheckerCanvasTexture';
  return configureTexture(checkerTex, {
    isColorMap: true, // É um mapa visual de cor -> SRGBColorSpace
    repeatX,
    repeatY,
    maxAnisotropy,
  });
}

/**
 * Carrega todas as texturas do M3 (Asfalto, Pedra/Cais, Terreno e Água) e prepara os
 * padrões de visualização de UV.
 *
 * @param {THREE.WebGLRenderer} renderer Renderizador para consultar `getMaxAnisotropy()`
 * @param {number} trackLengthoverWidthRatio Razão (Comprimento de arco da pista / Largura da pista)
 */
export async function loadSceneTextures(renderer, trackLengthOverWidthRatio) {
  const loader = new THREE.TextureLoader();
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

  const asphaltRepeatX = TEXTURE_REPEAT_DEFAULTS.asphaltWidthRepeats;
  const asphaltRepeatY = Number((asphaltRepeatX * trackLengthOverWidthRatio).toFixed(1));

  const stoneRepeatX = TEXTURE_REPEAT_DEFAULTS.stoneRepeatX;
  const stoneRepeatY = TEXTURE_REPEAT_DEFAULTS.stoneRepeatY;

  const groundRepeatX = TEXTURE_REPEAT_DEFAULTS.groundRepeatX;
  const groundRepeatY = TEXTURE_REPEAT_DEFAULTS.groundRepeatY;

  const waterRepeatX = TEXTURE_REPEAT_DEFAULTS.waterRepeatX;
  const waterRepeatY = TEXTURE_REPEAT_DEFAULTS.waterRepeatY;

  // Carrega todos os mapas externos em paralelo (com fallback se ausentes)
  const [
    asphaltColor,
    asphaltNormal,
    asphaltRoughness,
    stoneColor,
    stoneNormal,
    stoneRoughness,
    groundColor,
    groundNormal,
    groundRoughness,
    waterNormalFile,
  ] = await Promise.all([
    loadOptionalTexture(loader, TEXTURE_PATHS.asphalt.color, {
      isColorMap: true,
      repeatX: asphaltRepeatX,
      repeatY: asphaltRepeatY,
      maxAnisotropy,
    }),
    loadOptionalTexture(loader, TEXTURE_PATHS.asphalt.normal, {
      isColorMap: false,
      repeatX: asphaltRepeatX,
      repeatY: asphaltRepeatY,
      maxAnisotropy,
    }),
    loadOptionalTexture(loader, TEXTURE_PATHS.asphalt.roughness, {
      isColorMap: false,
      repeatX: asphaltRepeatX,
      repeatY: asphaltRepeatY,
      maxAnisotropy,
    }),

    loadOptionalTexture(loader, TEXTURE_PATHS.stone.color, {
      isColorMap: true,
      repeatX: stoneRepeatX,
      repeatY: stoneRepeatY,
      maxAnisotropy,
    }),
    loadOptionalTexture(loader, TEXTURE_PATHS.stone.normal, {
      isColorMap: false,
      repeatX: stoneRepeatX,
      repeatY: stoneRepeatY,
      maxAnisotropy,
    }),
    loadOptionalTexture(loader, TEXTURE_PATHS.stone.roughness, {
      isColorMap: false,
      repeatX: stoneRepeatX,
      repeatY: stoneRepeatY,
      maxAnisotropy,
    }),

    loadOptionalTexture(loader, TEXTURE_PATHS.ground.color, {
      isColorMap: true,
      repeatX: groundRepeatX,
      repeatY: groundRepeatY,
      maxAnisotropy,
    }),
    loadOptionalTexture(loader, TEXTURE_PATHS.ground.normal, {
      isColorMap: false,
      repeatX: groundRepeatX,
      repeatY: groundRepeatY,
      maxAnisotropy,
    }),
    loadOptionalTexture(loader, TEXTURE_PATHS.ground.roughness, {
      isColorMap: false,
      repeatX: groundRepeatX,
      repeatY: groundRepeatY,
      maxAnisotropy,
    }),

    loadOptionalTexture(loader, TEXTURE_PATHS.water.normal, {
      isColorMap: false,
      repeatX: waterRepeatX,
      repeatY: waterRepeatY,
      maxAnisotropy,
    }),
  ]);

  // Fallbacks procedurais caso os arquivos .jpg ainda não estejam nas pastas
  const asphaltFallback = createProceduralSurfaceFallbackMaps('asphalt', {
    repeatX: asphaltRepeatX,
    repeatY: asphaltRepeatY,
    maxAnisotropy,
  });
  const stoneFallback = createProceduralSurfaceFallbackMaps('stone', {
    repeatX: stoneRepeatX,
    repeatY: stoneRepeatY,
    maxAnisotropy,
  });
  const groundFallback = createProceduralSurfaceFallbackMaps('ground', {
    repeatX: groundRepeatX,
    repeatY: groundRepeatY,
    maxAnisotropy,
  });

  // Se `public/textures/water/normal.jpg` não existir, gera o normal map procedural suave em canvas (512x512)
  const waterNormal =
    waterNormalFile ||
    createProceduralWaterNormalMap(512, {
      repeatX: waterRepeatX,
      repeatY: waterRepeatY,
      maxAnisotropy,
    });

  // Texturas xadrez numeradas para o toggle "Visualizar UV" de cada superfície
  const uvCheckers = {
    asphalt: createUVCheckerTexture(asphaltRepeatX, asphaltRepeatY, maxAnisotropy),
    stone: createUVCheckerTexture(stoneRepeatX, stoneRepeatY, maxAnisotropy),
    ground: createUVCheckerTexture(groundRepeatX, groundRepeatY, maxAnisotropy),
    water: createUVCheckerTexture(waterRepeatX, waterRepeatY, maxAnisotropy),
    model: createUVCheckerTexture(2, 2, maxAnisotropy),
  };

  return {
    asphalt: {
      color: asphaltColor, // null se ausente -> usa a cor sólida atual do asfalto
      normal: asphaltNormal || asphaltFallback.normal,
      roughness: asphaltRoughness || asphaltFallback.roughness,
      repeatX: asphaltRepeatX,
      repeatY: asphaltRepeatY,
      aspectRatio: trackLengthOverWidthRatio,
      uvChecker: uvCheckers.asphalt,
    },
    stone: {
      color: stoneColor,
      normal: stoneNormal || stoneFallback.normal,
      roughness: stoneRoughness || stoneFallback.roughness,
      repeatX: stoneRepeatX,
      repeatY: stoneRepeatY,
      aspectRatio: stoneRepeatY / stoneRepeatX,
      uvChecker: uvCheckers.stone,
    },
    ground: {
      color: groundColor,
      normal: groundNormal || groundFallback.normal,
      roughness: groundRoughness || groundFallback.roughness,
      repeatX: groundRepeatX,
      repeatY: groundRepeatY,
      aspectRatio: groundRepeatY / groundRepeatX,
      uvChecker: uvCheckers.ground,
    },
    water: {
      normal: waterNormal,
      repeatX: waterRepeatX,
      repeatY: waterRepeatY,
      uvChecker: uvCheckers.water,
    },
    modelUvChecker: uvCheckers.model,
  };
}
