# Log de Transparência de IA — Entrega M2 (Luz e Modelos de Iluminação)

**Projeto:** Monaco Sunset GP  
**Disciplina:** Computação Gráfica (IFSP São João da Boa Vista)  
**Dupla:** Caio Canalli e Davi Beli Rosa

---

## 1. O que foi gerado e alterado no M2

Mantendo toda a arquitetura, navegação em 3ª pessoa e os 5 itens de diagnóstico do M1 intactos, foram criados dois novos módulos e um documento técnico, além de ajustes pontuais nos arquivos existentes:

1. **`src/scene/lights.js` (Novo módulo de iluminação, sombras e postes)**:
   - Constantes nomeadas no topo (`SUN_CONFIG`, `SUN_SHADOW_CONFIG`, `SPOT_CONFIG`, `HEMI_CONFIG` e `STREET_LAMP_PLACEMENTS`);
   - **`DirectionalLight` (Sol poente)**: cor `#ffb070`, intensidade `3.0`, parametrizado por **elevação (`12,5°`)** e **azimute (`172°`, lado do mar)**, acompanhado da esfera visual do sol no horizonte que se move em sincronia;
   - **Sombra do Sol**: `mapSize = 2048`, câmera ortográfica justa ao mapa (`left = -125, right = 125, top = 85, bottom = -75, near = 55, far = 365`), `bias = -0.0004`, `normalBias = 0.04` e `radius = 2.0`, com função `updateSunShadowMapSize` que descarta (`dispose()`) e recria o *RenderTarget* de sombra ao trocar a resolução;
   - **`SpotLight` nos 6 postes da pista**: posicionados sobre a curva paramétrica `CatmullRomCurve3` da pista (`u = 0.14, 0.25, 0.40, 0.65, 0.80, 0.93`), cor `#ffd9a0`, intensidade física `240 cd`, `distance = 34 m`, `angle ≈ 54,5°`, `penumbra = 0.55`, `decay = 2`, geometria metálica de poste + braço + lâmpada com material emissivo (`emissive: #ffd9a0`), e `castShadow = true` **apenas em 2 postes** (Poste 1 na largada e Poste 4 no grampo central);
   - **`HemisphereLight` de preenchimento**: céu `#ff9e7a`, chão `#1e273c`, intensidade baixa (`0.45`), sem sombra, substituindo qualquer luz ambiente plana.

2. **`src/debug/lightPanel.js` (Nova pasta `"Luz"` no `lil-gui`)**:
   - Integrada à mesma instância `GUI` do M1 sem alterar a pasta `"Diagnóstico"`;
   - Toggle global de sombras (`renderer.shadowMap.enabled`), seletor de filtro (`PCF` vs `Basic`) e controle de exposição (`toneMappingExposure`);
   - Controles individuais de liga/desliga, intensidade e cor para o Sol, Postes e `HemisphereLight`;
   - Sliders de **Elevação (°)** e **Azimute (°)** para demonstrar ao vivo a variação da hora do pôr do sol e o alongamento das sombras;
   - Controles da sombra do sol (`Projetar Sombra`, `mapSize` em `512/1024/2048/4096`, `bias`, `normalBias`, `radius`) + botões rápidos de teste para demonstrar *Shadow Acne*, *Peter-Panning* e *Restaurar Ajuste Ideal*;
   - Toggles para os três helpers exigidos: `DirectionalLightHelper`, `CameraHelper` da `sunLight.shadow.camera` e `SpotLightHelper` dos postes.

3. **Ajustes mínimos nos arquivos do M1**:
   - `src/main.js`: ativação de `renderer.shadowMap.enabled = true`, `renderer.shadowMap.type = THREE.PCFShadowMap`, `renderer.toneMapping = THREE.ACESFilmicToneMapping`, `renderer.toneMappingExposure = 1.0` e `renderer.outputColorSpace = THREE.SRGBColorSpace`; integração de `createLights` e `createLightPanel`;
   - `src/scene/environment.js`: remoção das luzes provisórias do M1 (migradas para `lights.js`), padronização para `MeshStandardMaterial` de cor sólida e definição criteriosa de `receiveShadow` / `castShadow` na água, terreno, cais e píeres;
   - `src/scene/track.js`: padronização dos materiais das zebras, faixas brancas e pórtico para `MeshStandardMaterial` (permitindo que as faixas brancas também recebam sombra e reajam aos cones dos `SpotLights`), além de `receiveShadow = true` na pista e `castShadow = true` no pórtico;
   - `src/scene/models.js`: adição da função `enableModelShadows` com `traverse` nos modelos carregados (carro OBJ, barcos GLB e prédios GLB) para ativar `castShadow = true` e `receiveShadow = true` em todas as sub-malhas;
   - `src/debug/diagnostics.js`: exposição da instância `gui`, proteção dos helpers de luz no toggle de Frustum Culling (`ignoreDiagnostics`) e reaproveitamento dos shadow maps no 2º passe do modo tela dividida (`renderer.shadowMap.autoUpdate = false` apenas durante a câmera aérea).

4. **`docs/justificativa-luz.md`**:
   - Tabela completa das luzes, explicação detalhada dos parâmetros de sombra e *trade-offs*, justificativa de apenas 2 spots com sombra e do `HemisphereLight`, tabela de medições de `renderer.info`, roteiro de capturas de tela e parágrafo pronto para o `README.md`.

---

## 2. Decisões Técnicas Importantes (Atenção para a Versão do Three.js!)

1. **`PCFShadowMap` vs `PCFSoftShadowMap` no Three.js `v0.186.1`**:
   - Verificamos diretamente no código-fonte instalado do `three@0.186.1` que `THREE.PCFSoftShadowMap` foi **removido/unificado** e emite um aviso de depreciação no console (`WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead.`).
   - Na versão atual, o próprio `THREE.PCFShadowMap` já executa filtragem PCF suave com **5 amostras em disco de Vogel** e respeita nativamente `light.shadow.radius`. Por isso configuramos `renderer.shadowMap.type = THREE.PCFShadowMap`, garantindo sombras suaves e zero avisos no console.

2. **Intensidade em candelas (`cd`) nos `SpotLights` (`decay = 2`)**:
   - No Three.js atual, `SpotLight` usa atenuação física quadrática ($E = I / d^2$). Como as luminárias estão a cerca de `7,0 m` do chão ($d^2 \approx 49$), valores antigos como `intensity = 1` ficariam invisíveis (`0.02 lux`). Ajustamos para `240 cd` (`~4,9 lux` no asfalto), calibrado com `ACESFilmicToneMapping`.

3. **Recompilação imediata de materiais (`mat.needsUpdate = true`) e descarte de Shadow Map (`dispose()`)**:
   - No WebGLRenderer, ligar/desligar sombras globais ou `castShadow`, bem como trocar `PCFShadowMap` por `BasicShadowMap`, altera `#defines` internos dos shaders dos materiais. Por isso `lightPanel.js` percorre os materiais marcando `needsUpdate = true`.
   - Ao mudar `mapSize` (`512/1024/2048/4096`), `lights.js` chama `sunLight.shadow.map.dispose()` e atribui `null`, forçando o Three.js a alocar uma nova textura de profundidade na resolução escolhida já no quadro seguinte.

4. **Lâmpada emissiva com `castShadow = false`**:
   - Cada poste possui uma esfera achatada com `emissive = #ffd9a0` para parecer acesa mesmo nos 4 postes sem sombra. Definimos `bulbMesh.castShadow = false` e posicionamos a origem do `SpotLight` imediatamente abaixo dela para evitar que a própria malha da lâmpada bloqueie a saída da luz!

---

## 3. O que Caio e Davi Devem Revisar e Fazer Antes de Commitar

- [ ] **Preencher os números reais em `docs/justificativa-luz.md` (Seção 4)**:
  - Assim que colocarem os modelos definitivos da Kenney em `public/models/`, abram `http://localhost:5173`, leiam os valores de `Draw Calls`, `Triangles` e `FPS` nos 4 cenários descritos na tabela da Seção 4 de `docs/justificativa-luz.md` e substituam os campos `A PREENCHER`.
- [ ] **Tirar as 4 capturas de tela listadas na Seção 5 de `docs/justificativa-luz.md`**:
  - Usem os botões **`Teste: Shadow Acne (0)`**, **`Teste: Peter-Panning`** e **`Restaurar Ajuste Ideal`** na pasta `Luz -> Sombra do Sol` para gerar os prints comparativos rapidamente.
- [ ] **Revisar perguntas clássicas para a arguição**:
  1. *Por que precisamos usar `traverse` nos modelos carregados para ativar sombras?* (Porque `castShadow` no `THREE.Group` pai não se propaga automaticamente para os `THREE.Mesh` filhos no Three.js).
  2. *O que acontece se aumentarmos muito a caixa `left/right/top/bottom` da `shadow.camera` do sol?* (A mesma textura `2048×2048` passa a cobrir uma área enorme vazia, reduzindo a densidade de texels por metro e deixando as sombras serrilhadas/borradas).
  3. *Qual a diferença prática entre `bias` e `normalBias`?* (`bias` desloca na direção do raio de luz/profundidade Z; `normalBias` desloca o vértice/ponto ao longo da normal da superfície, sendo muito mais eficaz em ângulos rasantes como o pôr do sol sem causar *peter-panning* severo).
  4. *Por que `mapSize = 4096` não muda o número de Draw Calls nem Triangles no `renderer.info`?* (Porque a quantidade de objetos e triângulos enviados ao Vertex Shader é idêntica; o que quadruplica é o número de pixels/texels rasterizados no Fragment/Depth buffer e o consumo de memória de vídeo).
