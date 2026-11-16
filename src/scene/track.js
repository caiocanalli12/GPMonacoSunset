import * as THREE from 'three';

/**
 * ============================================================================
 * CONFIGURAÇÕES DA PISTA DE ASFALTO (CURVA PARAMÉTRICA FECHADA - M1)
 * ============================================================================
 */
const TRACK_WIDTH = 11.0;               // Largura da faixa de asfalto em metros
const BORDER_WIDTH = 12.4;              // Largura total contando as zebras laterais
const TRACK_SEGMENTS = 260;             // Subdivisões da malha ao longo da curva fechada

// Alturas ligeiramente escalonadas em Y para evitar z-fighting no estado normal
// (No modo diagnóstico Item 2, alterar camera.near para valores altos pode induzir z-fighting propositalmente)
const BORDER_Y_OFFSET = 0.025;
const ASPHALT_Y_OFFSET = 0.05;
const CENTERLINE_Y_OFFSET = 0.075;

const ASPHALT_COLOR = 0x26272b;         // Cinza escuro do asfalto (conforme especificação M1)
const BORDER_COLOR = 0xc83e31;          // Vermelho discreto para a borda externa (zebra)
const LINE_COLOR = 0xe2e8f0;            // Branco acinzentado para traços de pista e largada

/**
 * Pontos de controle da curva CatmullRomCurve3 fechada.
 * O traçado reproduz o diagrama do documento M0:
 * - Reta longa costeando o porto a oeste (X = -10);
 * - Curva fechada Norte (inspirada na Sainte Dévote);
 * - Trecho Leste com grampo fechado central (inspirado no Fairmont Hairpin);
 * - Curva fechada Sul (inspirada na Rascasse) retornando ao porto.
 */
const TRACK_CONTROL_POINTS = [
  new THREE.Vector3(-10, 0, 68),   // 1. Início da reta do porto (Sul)
  new THREE.Vector3(-10, 0, 15),   // 2. Reta do porto (Região da largada)
  new THREE.Vector3(-10, 0, -65),  // 3. Fim da reta do porto (Norte)
  new THREE.Vector3(4, 0, -86),    // 4. Entrada da Curva 1 (Norte)
  new THREE.Vector3(26, 0, -82),   // 5. Saída da Curva 1 (Norte)
  new THREE.Vector3(36, 0, -56),   // 6. Reta de aproximação Leste-Norte
  new THREE.Vector3(34, 0, -30),   // 7. Entrada da Curva 2 (Grampo fechado central)
  new THREE.Vector3(8, 0, -14),    // 8. Ápice interno 1 do grampo
  new THREE.Vector3(8, 0, 10),     // 9. Ápice interno 2 do grampo
  new THREE.Vector3(34, 0, 26),    // 10. Saída do grampo para o trecho Leste-Sul
  new THREE.Vector3(36, 0, 56),    // 11. Reta Leste-Sul
  new THREE.Vector3(24, 0, 84),    // 12. Entrada da Curva 3 (Sul - Rascasse)
  new THREE.Vector3(2, 0, 86),     // 13. Saída da Curva 3 voltando ao porto
];

/**
 * Constrói uma geometria plana de faixa (ribbon BufferGeometry) seguindo uma curva 3D fechada.
 *
 * Por que gerar uma BufferGeometry própria em vez de usar TubeGeometry?
 * Porque TubeGeometry cria um cilindro tubular 3D, enquanto uma pista de corrida precisa
 * ser uma faixa plana sobre o terreno, calculada a partir do vetor tangente e da normal
 * horizontal (perpendicular no plano XZ) em cada amostra da curva.
 *
 * @param {THREE.Curve} curve Curva paramétrica fechada
 * @param {number} width Largura da faixa em metros
 * @param {number} segments Número de subdivisões ao longo da curva
 * @param {number} yOffset Altura Y constante sobre o terreno
 * @returns {THREE.BufferGeometry}
 */
function createRibbonGeometry(curve, width, segments, yOffset) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  const halfWidth = width * 0.5;
  const upVector = new THREE.Vector3(0, 1, 0);

  // Passo 1 (M3): Amostra os pontos ao longo da curva e acumula o comprimento de arco real (s_i)
  // em metros. Usar a distância acumulada real (em vez do parâmetro bruto t da spline) garante
  // que a coordenada V cresça na razão exata dos metros percorridos, evitando que a textura
  // comprima no grampo fechado ou estique na reta longa do porto.
  const sampledPoints = [];
  const cumulativeLengths = [0];
  let totalArcLength = 0;

  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const pt = curve.getPointAt(u);
    sampledPoints.push(pt);
    if (i > 0) {
      totalArcLength += pt.distanceTo(sampledPoints[i - 1]);
      cumulativeLengths.push(totalArcLength);
    }
  }

  for (let i = 0; i <= segments; i++) {
    const u = i / segments;

    // Posição e tangente unitária no ponto paramétrico u (0.0 até 1.0)
    const point = sampledPoints[i];
    const tangent = curve.getTangentAt(u).normalize();

    // Vetor lateral (normal no plano XZ): produto vetorial entre tangente e eixo Y
    const sideVector = new THREE.Vector3().crossVectors(tangent, upVector).normalize();

    // Vértice esquerdo e vértice direito da pista naquele ponto
    const leftVertex = point.clone().addScaledVector(sideVector, -halfWidth);
    const rightVertex = point.clone().addScaledVector(sideVector, halfWidth);

    positions.push(leftVertex.x, yOffset, leftVertex.z);
    positions.push(rightVertex.x, yOffset, rightVertex.z);

    // Normais apontando para cima (+Y) para receber a iluminação direcional e hemisférica corretamente
    normals.push(0, 1, 0);
    normals.push(0, 1, 0);

    // Coordenadas UV (M3):
    // - u = 0 na margem esquerda e u = 1 na margem direita (sentido da largura);
    // - v = s_i / L_total (0.0 a 1.0 proporcional ao comprimento de arco acumulado).
    // A escala em metros é controlada por `texture.repeat.set(repeatU, repeatU * (L_total / largura))`.
    const vCoord = cumulativeLengths[i] / Math.max(totalArcLength, 0.001);
    uvs.push(0, vCoord);
    uvs.push(1, vCoord);

    // Monta os dois triângulos (quad) que conectam a fatia atual (i) à próxima fatia (i + 1)
    if (i < segments) {
      const baseIndex = i * 2;
      // Triângulo 1 (sentido anti-horário visto de cima -> face frontal voltada para +Y)
      indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
      // Triângulo 2
      indices.push(baseIndex + 1, baseIndex + 3, baseIndex + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);

  return geometry;
}

/**
 * Cria o circuito completo (faixa de asfalto, borda/zebra, traços centrais e pórtico de largada).
 *
 * @param {THREE.Scene} scene Cena principal
 * @returns {{
 *   curve: THREE.CatmullRomCurve3,
 *   trackGroup: THREE.Group,
 *   startPosition: THREE.Vector3,
 *   startRotationY: number
 * }}
 */
export function createTrack(scene) {
  const trackGroup = new THREE.Group();
  trackGroup.name = 'GrupoPista';

  // Curva fechada do tipo 'centripetal' para evitar auto-interseções (loops indesejados) nas curvas fechadas
  const curve = new THREE.CatmullRomCurve3(TRACK_CONTROL_POINTS, true, 'centripetal');

  // 1. Base de borda/zebra (um pouco mais larga e levemente abaixo do asfalto)
  const borderGeo = createRibbonGeometry(curve, BORDER_WIDTH, TRACK_SEGMENTS, BORDER_Y_OFFSET);
  const borderMat = new THREE.MeshStandardMaterial({
    color: BORDER_COLOR,
    roughness: 0.82,
    metalness: 0.05,
  });
  const borderMesh = new THREE.Mesh(borderGeo, borderMat);
  borderMesh.receiveShadow = true;
  borderMesh.castShadow = false;
  borderMesh.name = 'BordaZebraPista';
  trackGroup.add(borderMesh);

  // 2. Faixa principal de asfalto cinza escuro
  const asphaltGeo = createRibbonGeometry(curve, TRACK_WIDTH, TRACK_SEGMENTS, ASPHALT_Y_OFFSET);
  const asphaltMat = new THREE.MeshStandardMaterial({
    color: ASPHALT_COLOR,
    roughness: 0.88,
    metalness: 0.05,
  });
  const asphaltMesh = new THREE.Mesh(asphaltGeo, asphaltMat);
  asphaltMesh.receiveShadow = true; // Pista recebe sombras do carro, postes, pórtico e prédios
  asphaltMesh.castShadow = false;
  asphaltMesh.name = 'FaixaAsfalto';
  trackGroup.add(asphaltMesh);

  // 3. Traços tracejados ao longo do centro da pista (ajudam na sensação de velocidade do carro)
  // Usamos MeshStandardMaterial com receiveShadow = true para que as faixas brancas pintadas
  // escureçam naturalmente sob as sombras e reajam aos cones dos SpotLights!
  const dashCount = 65;
  const dashGeo = new THREE.PlaneGeometry(0.32, 2.2);
  dashGeo.rotateX(-Math.PI / 2);
  const dashMat = new THREE.MeshStandardMaterial({
    color: LINE_COLOR,
    roughness: 0.72,
    metalness: 0.02,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const dashMeshes = [];
  for (let i = 0; i < dashCount; i++) {
    const u = i / dashCount;
    const pos = curve.getPointAt(u);
    const tangent = curve.getTangentAt(u);

    const dashMesh = new THREE.Mesh(dashGeo, dashMat);
    dashMesh.position.set(pos.x, CENTERLINE_Y_OFFSET, pos.z);
    // Orienta o traço na direção tangente da pista no plano XZ
    dashMesh.rotation.y = Math.atan2(tangent.x, tangent.z);
    dashMesh.receiveShadow = true;
    dashMesh.castShadow = false;
    dashMesh.name = `TracoPista_${i}`;
    trackGroup.add(dashMesh);
    dashMeshes.push(dashMesh);
  }

  // 4. Pórtico de Largada na Reta do Porto (X = -10, Z = 12)
  // Inclui uma faixa suspensa (PlaneGeometry de face única por padrão) que serve de excelente
  // caso visual para demonstrar o Item 3 do Diagnóstico (Back-face Culling: FrontSide vs DoubleSide):
  // olhando o pórtico por trás, a faixa some com FrontSide e aparece com DoubleSide!
  const gantryGroup = new THREE.Group();
  gantryGroup.position.set(-10, 0, 12);
  gantryGroup.name = 'PorticoLargada';

  const pillarGeo = new THREE.CylinderGeometry(0.28, 0.28, 6.2, 10);
  const pillarMat = new THREE.MeshStandardMaterial({
    color: 0xdbe2ef,
    roughness: 0.55,
    metalness: 0.35,
  });

  const leftPillar = new THREE.Mesh(pillarGeo, pillarMat);
  leftPillar.position.set(-TRACK_WIDTH * 0.55, 3.1, 0);
  leftPillar.castShadow = true;
  leftPillar.receiveShadow = true;
  gantryGroup.add(leftPillar);

  const rightPillar = new THREE.Mesh(pillarGeo, pillarMat);
  rightPillar.position.set(TRACK_WIDTH * 0.55, 3.1, 0);
  rightPillar.castShadow = true;
  rightPillar.receiveShadow = true;
  gantryGroup.add(rightPillar);

  // Faixa de largada no chão
  const startLineGeo = new THREE.PlaneGeometry(TRACK_WIDTH, 1.4);
  startLineGeo.rotateX(-Math.PI / 2);
  const startLineMesh = new THREE.Mesh(startLineGeo, dashMat);
  startLineMesh.position.set(0, CENTERLINE_Y_OFFSET + 0.005, 0);
  startLineMesh.receiveShadow = true;
  startLineMesh.castShadow = false;
  gantryGroup.add(startLineMesh);

  // Banner superior do pórtico (plano vertical voltado para +Z, visível ao largar rumo a -Z)
  const bannerGeo = new THREE.PlaneGeometry(TRACK_WIDTH * 1.1, 1.5, 4, 2);
  const bannerMat = new THREE.MeshStandardMaterial({
    color: 0xff9f1c,
    roughness: 0.65,
    metalness: 0.05,
    side: THREE.FrontSide,       // Começa com FrontSide para demonstrar Back-face culling (M1)
    shadowSide: THREE.DoubleSide // Garante projeção de sombra independente do azimute solar (M2)
  });
  const bannerMesh = new THREE.Mesh(bannerGeo, bannerMat);
  bannerMesh.position.set(0, 5.4, 0);
  bannerMesh.castShadow = true;
  bannerMesh.receiveShadow = true;
  bannerMesh.name = 'BannerLargada_TesteBackFace';
  gantryGroup.add(bannerMesh);

  trackGroup.add(gantryGroup);
  scene.add(trackGroup);

  // Ponto inicial do carro: na reta do porto, antes do pórtico de largada, apontando para -Z (Norte)
  const startPosition = new THREE.Vector3(-10, 0, 22);
  const startRotationY = 0; // Rotação 0 faz a frente do carro (-Z) apontar para o Norte da reta

  const totalLength = curve.getLength();
  const trackLengthOverWidthRatio = totalLength / TRACK_WIDTH;

  /**
   * Alterna entre o estado COM o problema de Z-Fighting (faixas pintadas exatamente
   * coplanares ao asfalto em Y = 0.05 m e sem polygonOffset) e o estado CORRIGIDO
   * (deslocamento físico em Y = 0.075 m + polygonOffset ativo no material).
   *
   * @param {boolean} zFightingProblemActive true = reproduz o bug coplanar; false = corrigido
   */
  function setZFightingProblemActive(zFightingProblemActive) {
    const targetY = zFightingProblemActive ? ASPHALT_Y_OFFSET : CENTERLINE_Y_OFFSET;

    for (let i = 0; i < dashMeshes.length; i++) {
      dashMeshes[i].position.y = targetY;
    }
    startLineMesh.position.y = zFightingProblemActive
      ? ASPHALT_Y_OFFSET
      : CENTERLINE_Y_OFFSET + 0.005;

    dashMat.polygonOffset = !zFightingProblemActive;
    dashMat.polygonOffsetFactor = zFightingProblemActive ? 0 : -1;
    dashMat.polygonOffsetUnits = zFightingProblemActive ? 0 : -1;
    dashMat.needsUpdate = true;
  }

  return {
    curve,
    trackGroup,
    asphaltMesh,
    dashMeshes,
    startLineMesh,
    totalLength,
    trackLengthOverWidthRatio,
    startPosition,
    startRotationY,
    setZFightingProblemActive,
  };
}
