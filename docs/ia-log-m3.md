# Log de Transparência de IA — Entrega M3 (Texturas, Materiais e Ambiente)

**Projeto:** Monaco Sunset GP  
**Disciplina:** Computação Gráfica (IFSP São João da Boa Vista)  
**Dupla:** Caio Canalli e Davi Beli Rosa

---

## 1. O que foi gerado e alterado no M3

Preservando integralmente a navegação em 3ª pessoa e os 5 itens de diagnóstico do M1, bem como o sistema de luzes e sombras do M2, foram implementados:

1. **`src/materials/textures.js` (Carregamento, Espaços de Cor e Texturas Procedurais)**:
   - Função `configureTexture`: aplica `THREE.SRGBColorSpace` **exclusivamente** nos mapas de cor (`color.jpg` / `uvChecker`) e `THREE.NoColorSpace` (linear) nos mapas técnicos (`normal.jpg` e `roughness.jpg`), além de `RepeatWrapping`, `anisotropy = renderer.capabilities.getMaxAnisotropy()`, `generateMipmaps = true` e filtragem trilinear (`LinearMipmapLinearFilter`);
   - Carregamento seguro (`loadOptionalTexture`): verifica a existência dos arquivos em `public/textures/{asphalt,stone,ground,water}/` sem quebrar a aplicação caso faltem, emitindo `console.warn`;
   - **Normal map procedural da água (`createProceduralWaterNormalMap`)**: gera um campo de alturas periódico (sem costura nas bordas) em `<canvas>`, calcula as derivadas parciais centrais ($dX, dY$) e converte para vetores normais tangentes no padrão OpenGL (`NormalGL`);
   - **Padrão xadrez numerado (`createUVCheckerTexture`)**: gera uma `CanvasTexture` $512 \times 512$ com células identificadas (`A1..D4` e setas de orientação `↑`) para o modo de inspeção `"Visualizar UV"`.

2. **`src/materials/materials.js` (Criação dos Materiais PBR e Conversão de Modelos)**:
   - Criação dos materiais `MeshStandardMaterial` da cena: **Asfalto**, **Pedra/Cais**, **Terreno** e **Água** (com rolagem do `normalMap` via `texture.offset` multiplicada pelo `dt` do `THREE.Timer`);
   - Função `convertModelMaterialsToStandard`: percorre (`traverse`) os modelos carregados (`car.obj`, `boat.glb` e `building.glb`) **no momento do carregamento e antes de o diagnóstico do M1 salvar o estado original**, convertendo `MeshPhongMaterial` (do `OBJ+MTL`) para `MeshStandardMaterial`, preservando `map` (em `SRGBColorSpace`) e separando a carroceria metálica (`metalness = 0.82, roughness = 0.28`), vidros lisos (`roughness = 0.08`), pneus foscos (`roughness = 0.92`), casco de barco (`roughness = 0.26`), fachadas foscas (`roughness = 0.86`) e janelas emissivas quentes (`#ffaa44`).

3. **`src/scene/environment.js` (Céu Analítico `Sky`, `PMREMGenerator` e `Fog` Coerente)**:
   - Substituição do fundo plano por `Sky` (`three/examples/jsm/objects/Sky.js`) sincronizado em tempo real com a elevação e o azimute do `DirectionalLight` do M2 (`syncSkyWithSun`);
   - Geração do mapa de reflexo (`scene.environment`) com `THREE.PMREMGenerator` a partir do céu (`regenerateEnvironmentMap`), executado **apenas na inicialização e no callback `onFinishChange` dos sliders do sol**, nunca a cada frame;
   - Ajuste das coordenadas UV dos píeres para manter a mesma escala métrica de repetição do cais principal.

4. **`src/scene/track.js` (UV da Pista por Comprimento de Arco)**:
   - Cálculo da distância acumulada real $s_i = \sum \|P_k - P_{k-1}\|$ ao longo das `260` subdivisões da `CatmullRomCurve3` ($L_{\text{total}} = 431,24\text{ m}$), definindo $U \in [0, 1]$ na largura e $V_i = s_i / L_{\text{total}}$ no comprimento;
   - As faixas pintadas sobre a pista foram mantidas exatamente na mesma configuração para preservar o caso de diagnóstico do M4.

5. **`src/debug/materialPanel.js` + HUD (`index.html` e `src/debug/diagnostics.js`)**:
   - Nova pasta `"Materiais"` no `lil-gui` (ao lado de `"Diagnóstico"` e `"Luz"`) com toggles individuais de `map`, `normalMap`, `roughnessMap`, sliders de `normalScale`, `roughness`, `metalness`, `Repeat`, velocidade da água, `environmentIntensity`, `"Visualizar UV (Xadrez)"` e `"Sem Texturas (Sólido)"`;
   - Exibição de `renderer.info.memory.textures` no overlay HUD (`Textures (GPU)`).

6. **Documentação (`docs/justificativa-materiais.md` e `CREDITS.md`)**:
   - Documento completo com tabela dos 7 materiais, explicação matemática dos UVs por comprimento de arco, espaços de cor, normal map vs bump map, coerência de ambiente, tabela de testes, lista de capturas e atualização do `CREDITS.md`.

---

## 2. Decisões Técnicas Importantes (Para Explicar na Defesa)

1. **Ordem de inicialização entre M3 e M1 (`src/main.js`)**:
   - Os modelos externos são carregados e convertidos para `MeshStandardMaterial` **antes** da chamada a `diagnostics.reapplyMaterialStates()`. Assim, quando o M1 guarda `mat.userData.originalWireframe` e `mat.userData.originalSide`, ele já opera sobre os materiais PBR definitivos do M3, garantindo que as teclas `1` (Wireframe), `2` (Profundidade) e `3` (Back-face Culling) funcionem perfeitamente.

2. **Por que o `PMREMGenerator` roda apenas no `onFinishChange` e usa `showSunDisc = 0` na cena auxiliar?**
   - Chamar `pmremGenerator.fromScene()` exige renderizar um cubemap e rodar passes de convolução GGX; fazer isso a cada frame derrubaria o FPS. Além disso, usamos uma cena auxiliar contendo apenas o `Sky` com `showSunDisc = 0` (recomendação oficial do próprio `Sky.js`) para evitar pontos estourados (*fireflies*) no mapa de reflexo e impedir que prédios próximos apareçam refletidos em objetos distantes.

3. **Proteção da cúpula `Sky` nos diagnósticos do M1**:
   - Como `Sky` herda de `THREE.Mesh` com uma caixa de escala `4500` e `side: THREE.BackSide`, marcamos `sky.userData.ignoreDiagnostics = true` e ocultamos `sky` temporariamente quando o **Item 2 (Profundidade)** é ligado, evitando que a caixa do céu bloqueie a visualização do `MeshDepthMaterial`.

---

## 3. O que Caio e Davi Devem Revisar e Preencher

- [ ] **Colocar os arquivos `.jpg` (`1K`, `NormalGL`) em `public/textures/`**:
  - `public/textures/asphalt/` (`color.jpg`, `normal.jpg`, `roughness.jpg`)
  - `public/textures/stone/` (`color.jpg`, `normal.jpg`, `roughness.jpg`)
  - `public/textures/ground/` (`color.jpg`, `normal.jpg`, `roughness.jpg`)
  - `public/textures/water/` (`normal.jpg` — opcional, pois já possui o gerador procedural de ondas em canvas).
- [ ] **Completar os campos `A PREENCHER` em `CREDITS.md` e `docs/justificativa-materiais.md`**:
  - Em `CREDITS.md`: anotar o nome e link exato de cada textura baixada no ambientCG ou Poly Haven.
  - Em `docs/justificativa-materiais.md` (Seção 6): anotar os números medidos no HUD (`Textures (GPU)` e `FPS`) e tirar as 4 capturas de tela da Seção 7.
