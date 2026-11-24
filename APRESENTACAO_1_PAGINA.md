# Roteiro de 1 Página para Apresentação do Código (`src/main.js`)

> **Como usar na apresentação:** Deixem apenas o arquivo **[`src/main.js`](./src/main.js)** aberto no VS Code. Ele foi dividido em **Parte 1 (Entregas de Computação Gráfica: M0, M1, M2, M3 e M4-ZFighting)** e **Parte 2 (Motor do Jogo de Drift)**, na ordem exata que o professor cobra.

---

### 1. ENTREGA M0 — Escopo, Cena e Câmeras (`src/main.js` — Linhas 31 a 86)
- **Onde mostrar no código:** Bloco **`[ENTREGA M0]`** (`M0_CONFIG` e função `setupM0SceneAndCameras`).
- **O que falar para o professor:**
  > *"No M0 definimos a cena compacta do circuito de Mônaco ao pôr do sol (mar e barcos de um lado, cais no meio e prédios do outro) e configuramos duas câmeras em `setupM0SceneAndCameras`: a `playerCamera` em 3ª pessoa com `near = 0.5` e `far = 260` — mantendo a razão `far/near` baixa para não perder precisão no Depth Buffer de 24 bits — e a `topCamera` aérea a 235 metros de altura, usada para visualizar o Frustum de cima."*

---

### 2. ENTREGA M1 — Pipeline, Pista, 3 Modelos (`Box3`), `Timer` e 5 Diagnósticos (`src/main.js` — Linhas 88 a 168 e 520 a 562)
- **Onde mostrar no código:** Bloco **`[ENTREGA M1]`** (função `renderM1PipelineFrame`, linhas 121–168) e o loop **`animate` com `THREE.Timer`** (linhas 520–562). *(Se ele pedir para abrir o detalhe do `Box3`, está em `src/scene/models.js` linha 92).*
- **O que falar para o professor:**
  > *"No M1 geramos a pista fechada com `CatmullRomCurve3` criando uma `BufferGeometry` plana a partir da tangente e do vetor lateral (`tangent × Y`). Carregamos 3 modelos externos em formatos diferentes (`car.obj + .mtl`, `boat.glb` e `building.glb`), normalizados com `THREE.Box3` para escala em metros (4,5 m pro carro, 12 m pros barcos) e espalhamos 40 objetos na cena. No loop `animate` (linha 520), usamos `THREE.Timer` com `dt` limitado a `0.1 s` para a velocidade não depender do FPS. E nos 5 itens de diagnóstico (teclas 1 a 5): o item 1 liga `wireframe`; o item 2 aplica `MeshDepthMaterial` para ver o Z-Buffer não-linear; o item 3 alterna o Back-face Culling (`FrontSide` vs `DoubleSide`); o item 4 executa a função `renderM1PipelineFrame` (linha 121), que divide a tela com `setViewport` e `setScissor` mostrando o `CameraHelper` na câmera de topo; e o item 5 desliga o `frustumCulled`, mostrando os Draw Calls e triângulos subindo no `renderer.info`."*

---

### 3. ENTREGA M2 — Luzes (3 Tipos), Tone Mapping e Sombras (`src/main.js` — Linhas 170 a 217)
- **Onde mostrar no código:** Bloco **`[ENTREGA M2]`** (função `configureM2RendererAndLights`). *(Constantes detalhadas em `src/scene/lights.js` linhas 17–85).*
- **O que falar para o professor:**
  > *"No M2 configuramos `ACESFilmicToneMapping` e saída `SRGBColorSpace` para não estourar as cores quentes do pôr do sol, e combinamos 3 tipos de luz: (1) uma `DirectionalLight` baixa a 12,5° de elevação vindo do mar como sol poente; (2) 6 `SpotLights` nos postes da pista com 240 candelas e decaimento físico quadrático (`decay = 2`), onde apenas 2 postes projetam sombra (`512×512`) para economizar passes de profundidade na GPU e todos têm lâmpada emissiva; e (3) uma `HemisphereLight` (céu laranja / chão azul escuro) substituindo luz ambiente plana. Na sombra do sol (`2048×2048`, `PCFShadowMap`), ajustamos a câmera ortográfica exatamente ao tamanho do mapa (`±125 m`) e usamos `bias = -0.0004` com `normalBias = 0.04` para eliminar o Shadow Acne sob luz rasante sem descolar a sombra do carro (Peter-Panning)."*

---

### 4. ENTREGA M3 — Texturas (`sRGB` vs Linear), UV por Arco, 7 Materiais PBR e Água (`src/main.js` — Linhas 219 a 272)
- **Onde mostrar no código:** Bloco **`[ENTREGA M3]`** (função `setupM3TexturesMaterialsAndModels` e linha 547 `updateWaterAnimation(dt)`). *(UV por arco em `src/scene/track.js` linha 69; texturas em `src/materials/textures.js` linha 72).*
- **O que falar para o professor:**
  > *"No M3 carregamos as texturas CC0 com fallback seguro aplicando `SRGBColorSpace` somente nos mapas de cor (`color.jpg`) e mantendo `normal.jpg` e `roughness.jpg` em espaço linear (`NoColorSpace`), para a curva gama não distorcer os vetores normais, além de `RepeatWrapping` e anisotropia máxima. Para a textura do asfalto não esticar nas curvas, calculamos a coordenada `V` do UV pelo comprimento de arco acumulado da spline (`431,24 m`), o que pode ser provado ligando o `UV Checker` na GUI. Criamos 7 materiais `MeshStandardMaterial` (asfalto, pedra, terreno, água com `normalMap` animado por `dt`, carroceria metálica refletindo o céu analítico `Sky + PMREMGenerator`, barcos e prédios com janelas emissivas)."*

---

### 5. ENTREGA M4 (Parte CG) — Caso de Diagnóstico: Z-Fighting (`src/main.js` — Linhas 274 a 296)
- **Onde mostrar no código:** Bloco **`[ENTREGA M4 — CASO DE DIAGNÓSTICO]`** e pasta **`Caso z-fighting`** na tela.
- **O que falar para o professor:**
  > *"Nosso caso de diagnóstico demonstra o Z-Fighting entre o asfalto e as faixas brancas pintadas. Como a precisão do Z-Buffer é proporcional a `1/z`, quando ativamos o botão de bug na GUI as faixas ficam coplanares ao asfalto (`Y = 0,05 m`), sem `polygonOffset` e com razão `far/near` alta, fazendo as faixas piscarem por erro de arredondamento de ponto flutuante. Nossa correção combina `near/far` enxuto (`0.5` e `260`), elevação de `2,5 cm` (`Y = 0,075 m`) e `polygonOffset: true` no material, que resolve o empate direto no rasterizador."*

---

### 6. PARTE 2 — Motor do Jogo de Drift (Separado da CG) (`src/main.js` — Linhas 299 a 440)
- **Onde mostrar no código:** Bloco **`PARTE 2 — MOTOR DO JOGO DE DRIFT`** (função `setupDriftGameEngine`).
- **O que falar para o professor:**
  > *"Separamos toda a lógica do jogo na Parte 2 (`setupDriftGameEngine`) para não misturar com o pipeline de CG. A cada frame, `updateGameFrame(dt)` (linha 373) executa 5 passos: (1) física arcade 2D do carro, que decompõe a velocidade em frontal e lateral e reduz o atrito lateral com `exp(-grip * dt)` ao usar o freio de mão; (2) verificação de saída de pista testando 9 pontos do chassi contra 600 pontos da curva; (3) máquina de estados em JS puro de pontuação com histerese, janela de 3 segundos nas retas, multiplicador até `x20` e estado `SUPERDRIFT` aos 25.000 pontos; (4) fumaça e marcas de pneu usando Object Pooling e Ring Buffer sem alocar memória por frame; e (5) atualização do HUD e do áudio procedural WebAudio."*
