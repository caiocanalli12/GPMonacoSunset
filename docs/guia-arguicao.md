# Guia de Arguição e Defesa Individual — Monaco Sunset GP

Este documento foi preparado para que **Caio Canalli** e **Davi Beli Rosa** possam responder com segurança a qualquer pergunta sobre qualquer trecho do código durante a arguição individual da disciplina.

---

## Parte 1 — Resumo de 3 Linhas de Cada Arquivo em `src/`

### 1. [`src/main.js`](../src/main.js)
1. **O que faz**: Inicializa a `THREE.Scene`, o `WebGLRenderer` (com `ACESFilmicToneMapping`, `SRGBColorSpace` e `PCFShadowMap`), as duas câmeras (`playerCamera` e `topCamera`) e integra todos os subsistemas (M1 a M4).
2. **Como funciona o loop**: Usa `THREE.Timer` (`timer.update(timestamp)`) com `delta` limitado a `0.1 s` (linhas 239–268) para atualizar em sequência a física do carro, limites da pista, sistema de drift, efeitos visuais, áudio e renderização (simples ou split-screen).
3. **Por que foi desenhado assim**: Centraliza a orquestração do frame em um único ponto sem colocar lógica de negócio dentro do loop principal, facilitando isolar e explicar cada marco.

### 2. [`src/scene/environment.js`](../src/scene/environment.js)
1. **O que faz**: Constrói a base geográfica de Mônaco (mar a oeste, muro do cais, píeres, terreno de Monte Carlo a leste e guard-rails), a névoa (`THREE.Fog`), o céu analítico (`Sky.js`) e o mapa de reflexo (`PMREMGenerator`).
2. **Como funciona**: Ajusta os *uniforms* do shader Preetham (`turbidity`, `rayleigh`, `mieCoefficient`) sincronizados à posição do sol e gera `scene.environment` apenas quando o usuário solta o slider (`onFinishChange`).
3. **Por que foi desenhado assim**: Preserva a estética de meia-luz do pôr do sol (sem estourar o céu para branco) e evita recriar cubemaps a cada frame, mantendo `60 FPS`.

### 3. [`src/scene/track.js`](../src/scene/track.js)
1. **O que faz**: Gera a pista fechada a partir de uma `THREE.CatmullRomCurve3` (`centripetal`) com 13 pontos de controle (431,24 m de extensão), incluindo zebra, faixa de asfalto, 65 traços centrais e pórtico de largada.
2. **Como funciona**: A função `createRibbonGeometry` (linhas 60–133) constrói uma `BufferGeometry` plana calculando tangente e vetor lateral ($\text{tangent} \times \vec{Y}$) e atribuindo $U \in [0,1]$ na largura e $V$ proporcional ao comprimento de arco acumulado.
3. **Por que foi desenhado assim**: `TubeGeometry` criaria um cilindro 3D e o parâmetro bruto $t$ esticaria a textura nas retas; o comprimento de arco garante quadrados perfeitos no UV Checker, e `setZFightingProblemActive` (linhas 277–296) permite demonstrar o Z-Fighting ao vivo.

### 4. [`src/scene/lights.js`](../src/scene/lights.js)
1. **O que faz**: Configura os 3 tipos de luz da Entrega M2: `HemisphereLight` (céu/mar), `DirectionalLight` (sol poente a `12,5°` com sombra $2048^2$) e 6 postes com `SpotLight` (`240 cd`, `decay = 2`).
2. **Como funciona**: Posiciona os 6 postes ao longo da curva da pista (linhas 68–77); apenas os postes 1 e 4 têm `castShadow = true` ($512^2$), enquanto todos possuem um bulbo com material emissivo (`castShadow = false`).
3. **Por que foi desenhado assim**: Equilibra fidelidade visual (sombras longas do sol + cones quentes dos postes) e orçamento de GPU (evitando 4 shadow maps extras de SpotLights distantes).

### 5. [`src/scene/models.js`](../src/scene/models.js)
1. **O que faz**: Carrega os 3 modelos externos em formatos distintos (`car.obj + .mtl`, `boat.glb` e `building.glb`), normaliza suas dimensões reais com `THREE.Box3` e espalha 40 instâncias (24 prédios + 16 barcos).
2. **Como funciona**: A função `normalizeModelByBox3` (linhas 92–133) mede a `Box3` do modelo, aplica escala uniforme (`targetSize / referenceMeasure`), centraliza $X/Z$ na origem e apoia a base em $Y = 0$ (`position.y -= finalBox.min.y`).
3. **Por que foi desenhado assim**: Garante que modelos de pacotes diferentes fiquem na escala exata em metros ($4{,}5\text{ m}$ para o carro, $12\text{ m}$ para barcos) e aciona placeholders de caixas caso algum arquivo não exista.

### 6. [`src/materials/textures.js`](../src/materials/textures.js)
1. **O que faz**: Carrega com fallback seguro os conjuntos de texturas PBR (`asphalt`, `stone`, `ground`, `water`), gera o normal map procedural da água (`512×512`) e a textura `uvCheckerTexture`.
2. **Como funciona**: A função `configureTextureParams` (linhas 72–97) aplica `SRGBColorSpace` exclusivamente em mapas de cor (`color.jpg`) e `NoColorSpace` (linear) em mapas de `normal` e `roughness`, além de `RepeatWrapping` e anisotropia máxima.
3. **Por que foi desenhado assim**: Evita que a GPU aplique correção gama ($x^{2,2}$) sobre vetores normais $(X,Y,Z)$ ou valores escalares de rugosidade, o que entortaria o relevo da pista.

### 7. [`src/materials/materials.js`](../src/materials/materials.js)
1. **O que faz**: Cria e gerencia os 7 materiais `MeshStandardMaterial` da cena (asfalto, pedra, terreno, água, carroceria metálica, cascos de barcos e fachadas de prédios com janelas emissivas).
2. **Como funciona**: Desloca o `normalMap.offset` da água a cada frame proporcionalmente a `delta` (linhas 237–244) e permite alternar ao vivo os mapas de cor, normal, rugosidade e o modo `UV Checker` (linhas 251–295).
3. **Por que foi desenhado assim**: Mantém todos os parâmetros físicos (`roughness`, `metalness`, `normalScale`, `envMapIntensity`) nomeados no topo e preserva as UVs originais dos modelos ao converter `MeshPhongMaterial` para `MeshStandardMaterial`.

### 8. [`src/controls/carController.js`](../src/controls/carController.js)
1. **O que faz**: Implementa o modelo arcade 2D do carro (decomposição de velocidade em frontal e lateral, atrito exponencial, freio de mão `Espaço` e *flick*) e a câmera de 3ª pessoa com *look-ahead* e FOV dinâmico.
2. **Como funciona**: Em `update(dt)` (linhas 195–352), projeta $\vec{v}$ nos vetores unitários $\vec{f}$ e $\vec{r}$ do carro, amortece a velocidade lateral por $\exp(-\text{grip} \cdot \Delta t)$, calcula $\text{slip} = \text{atan2}(v_{\text{lat}}, |v_{\text{fwd}}|)$ e move a câmera com $\alpha = 1 - \exp(-k \cdot \Delta t)$.
3. **Por que foi desenhado assim**: Permite derrapagens controladas sem biblioteca externa de física e garante que carro e câmera se comportem de forma idêntica em `20 FPS`, `60 FPS` ou `144 FPS`.

### 9. [`src/game/config.js`](../src/game/config.js)
1. **O que faz**: Reúne todas as constantes numéricas ajustáveis da camada de jogo (M4) em cinco blocos congelados (`CAR_PHYSICS_CONFIG`, `TRACK_BOUNDS_CONFIG`, `DRIFT_SCORE_CONFIG`, `EFFECTS_CONFIG`, `AUDIO_CONFIG`).
2. **Como funciona**: Exporta limiares de velocidade, ângulo de deriva, histerese, degraus de multiplicador `[1, 2, 3, 5, 8, 12, 20]`, meta de `25.000` pontos do `SUPERDRIFT` e tamanhos dos pools de partículas.
3. **Por que foi desenhado assim**: Facilita calibrar o jogo (para que o `SUPERDRIFT` ocorra em 40–60 s) e permite que a dupla altere qualquer parâmetro em um único arquivo durante a defesa.

### 10. [`src/game/driftSystem.js`](../src/game/driftSystem.js)
1. **O que faz**: Máquina de estados em JavaScript puro (zero dependência de Three.js) que detecta o drift com histerese, calcula pontos pendentes e totais, gerencia a janela de 3 s, multiplicadores até `x20`, penalidade fora da pista, `SUPERDRIFT` e recordes em `localStorage`.
2. **Como funciona**: Recebe `{ dt, speed, slipRad, isOnTrack, distanceToEdge }` em `update()` (linhas 150–316), acumula pontos segundo $R_{\text{base}} \cdot \text{fatorVel} \cdot \text{fatorÂngulo} \cdot \text{bônusBorda} \cdot \text{mult} \cdot \Delta t$ e emite eventos para o HUD e o áudio.
3. **Por que foi desenhado assim**: Por não importar o Three.js, pode ser testado diretamente no Node.js via `npm run test` ([`tests/driftSystem.test.js`](../tests/driftSystem.test.js)) e explicado de forma puramente algorítmica.

### 11. [`src/game/trackBounds.js`](../src/game/trackBounds.js)
1. **O que faz**: Verifica a cada frame se o carro está dentro da pista, perto da borda (bônus `x1.5`) ou fora da pista ($\ge 5$ de 9 pontos da pegada além de $5{,}5\text{ m}$ do eixo central).
2. **Como funciona**: Pré-amostra 600 pontos equidistantes na `CatmullRomCurve3` (`getSpacedPoints(600)`) na inicialização (linhas 51–60) e calcula a menor distância no plano $XZ$ de cada um dos 9 pontos locais do carro (4 cantos, 4 meios, 1 centro) até a polilinha, atualizando 9 esferas coloridas de debug.
3. **Por que foi desenhado assim**: A busca espacial em 600 pontos 2D custa menos de `0,05 ms` por frame, dispensa raycasting pesado na malha de triângulos e permite visualizar exatamente quais rodas saíram da pista.

### 12. [`src/game/hud.js`](../src/game/hud.js)
1. **O que faz**: Atualiza a interface HTML/CSS sobreposta ao canvas (`index.html`): placar Total, pontos Pendentes, badge do multiplicador (`x1` a `x20`), anel circular SVG de 3 s, velocímetro em `km/h`, barra de ângulo de deriva e tela `SUPERDRIFT`.
2. **Como funciona**: Lê `driftState` e a fila `events` a cada frame (linhas 118–232), ajustando `strokeDashoffset` do círculo SVG proporcionalmente a `graceRemaining / 3.0` e disparando animações CSS de glitch e vinheta vermelha.
3. **Por que foi desenhado assim**: Manipula apenas propriedades leves de DOM/SVG quando valores mudam, mantendo o HUD nítido em qualquer resolução sem custo de draw calls no WebGL.

### 13. [`src/game/effects.js`](../src/game/effects.js)
1. **O que faz**: Renderiza a fumaça dos pneus traseiros, as marcas de pneu no asfalto (skid marks) e a explosão de confetes do `SUPERDRIFT` com **zero alocação de memória ou geometria por frame**.
2. **Como funciona**: Pré-aloca na inicialização 1 `THREE.Points` com 300 partículas para a fumaça (linhas 72–145), 1 `THREE.Mesh` com buffer circular de 360 quads para as marcas de pneu (`polygonOffset`, `depthWrite: false`, linhas 151–226) e 1 `THREE.Points` com 120 partículas para o `SUPERDRIFT`.
3. **Por que foi desenhado assim**: Nunca chama `new THREE.Mesh` ou `scene.add` durante o loop `animate()`, adicionando no máximo 3 Draw Calls constantes à cena inteira e evitando pausas de *Garbage Collector*.

### 14. [`src/game/audio.js`](../src/game/audio.js)
1. **O que faz**: Sintetiza proceduralmente via **WebAudio API** o ronco do motor, o chiado de pneu na derrapagem, o sino harmônico de subida de multiplicador, o alerta grave de saída de pista e a fanfarra de acorde maior do `SUPERDRIFT`.
2. **Como funciona**: Cria o `AudioContext` apenas no primeiro input do jogador (`initOnFirstInteraction`, linhas 46–128), modulando a frequência de osciladores `sawtooth`/`triangle` pela velocidade do carro e o ganho de um buffer de ruído branco filtrado (`bandpass`) pelo ângulo de deriva.
3. **Por que foi desenhado assim**: Dispensa arquivos `.mp3`/`.wav` externos, respeita a política de autoplay dos navegadores e consome zero banda de rede.

### 15. [`src/debug/diagnostics.js`](../src/debug/diagnostics.js)
1. **O que faz**: Implementa a pasta **`Diagnóstico (M1)`** no `lil-gui` e os atalhos de teclado `1` a `5` e `H` para inspecionar as etapas do pipeline gráfico em tempo real.
2. **Como funciona**: Controla `wireframe` (Item 1), `scene.overrideMaterial = MeshDepthMaterial` + sliders `near`/`far` (Item 2), `material.side` entre `FrontSide` e `DoubleSide` (Item 3), split-screen com `CameraHelper` (Item 4) e `mesh.frustumCulled` com contadores `renderer.info` (Item 5).
3. **Por que foi desenhado assim**: Salva o estado original de cada material em um `WeakMap` antes de alterá-lo, garantindo que os modos de diagnóstico nunca corrompam os materiais PBR do M3 nem os pools de partículas do M4.

### 16. [`src/debug/lightPanel.js`](../src/debug/lightPanel.js), [`src/debug/materialPanel.js`](../src/debug/materialPanel.js), [`src/debug/gamePanel.js`](../src/debug/gamePanel.js) e [`src/debug/zFightingPanel.js`](../src/debug/zFightingPanel.js)
1. **O que fazem**: Criam as pastas **`Luz (M2)`**, **`Materiais (M3)`**, **`Jogo`** e **`Caso z-fighting`** dentro da mesma instância do `lil-gui`.
2. **Como funcionam**: Expõem controles ao vivo para sombras/helpers (M2), mapas de cor/normal/roughness e UV Checker (M3), esferas de 9 pontos da pista, botão `Forçar SUPERDRIFT` e simulação de `dt = 50ms` (M4), além do toggle de coplanaridade das faixas (`Caso z-fighting`).
3. **Por que foram desenhados assim**: Mantêm a interface de inspeção modular (um arquivo por entrega/requisito) e permitem demonstrar qualquer item da rubrica em menos de 5 segundos durante a banca.

---

## Parte 2 — 15 Perguntas Prováveis de Defesa com Respostas Diretas (Arquivo e Linha)

### 1. Como vocês garantem que a velocidade do carro e o movimento da câmera não dependem da taxa de quadros (FPS)?
- **Onde está**: [`src/main.js`](../src/main.js#L239-L268) e [`src/controls/carController.js`](../src/controls/carController.js#L195-L352).
- **Resposta**: Usamos `THREE.Timer` no loop principal, limitando `dt = Math.min(timer.getDelta(), 0.1)`. Todas as grandezas físicas estão em unidades por segundo ($\text{m/s}$, $\text{m/s}^2$, $\text{rad/s}$) multiplicadas por `dt`. Tanto o atrito lateral ($\exp(-\text{grip} \cdot dt)$) quanto a interpolação da câmera ($\alpha = 1 - \exp(-k \cdot dt)$) usam decaimento exponencial contínuo no tempo, que é matematicamente invariante à taxa de quadros.

### 2. Como o carro inicia e mantém um drift sem usar uma engine de física como Cannon.js ou Rapier?
- **Onde está**: [`src/controls/carController.js`](../src/controls/carController.js#L211-L298).
- **Resposta**: A cada frame, decompomos o vetor velocidade 2D $(v_x, v_z)$ nos eixos locais do carro: componente frontal $v_{\text{fwd}} = \vec{v} \cdot \vec{f}$ e componente lateral $v_{\text{lat}} = \vec{v} \cdot \vec{r}$. Em condução normal, `grip = 8.5` amortece $v_{\text{lat}}$ rapidamente via $v_{\text{lat}} \leftarrow v_{\text{lat}} \cdot e^{-\text{grip} \cdot dt}$. Quando o jogador aperta `Espaço` (`handbrakeGrip = 1.35`) ou faz um *flick* em alta velocidade com esterço máximo (`flickGrip = 2.05`), o `grip` cai drasticamente, permitindo que a componente lateral se mantenha alta enquanto o carro gira o `yaw`.

### 3. Como é calculado o ângulo de deriva (slip angle) e por que existe histerese na detecção do drift?
- **Onde está**: [`src/controls/carController.js`](../src/controls/carController.js#L291-L298) e [`src/game/driftSystem.js`](../src/game/driftSystem.js#L180-L216).
- **Resposta**: O ângulo de deriva é $\theta_{\text{slip}} = \text{atan2}(v_{\text{lateral}}, |v_{\text{frontal}}|)$. Para não ligar e desligar o drift a cada oscilação rápida do volante, aplicamos **histerese temporal e angular**: para **entrar** em drift, o carro precisa manter $|\theta_{\text{slip}}| > 13^\circ$ e velocidade $> 7{,}5\text{ m/s}$ por `0,25 s` seguidos; para **sair**, o ângulo precisa cair abaixo de $8^\circ$ por `0,20 s`.

### 4. Como funciona a janela de 3 segundos entre curvas e a progressão do multiplicador até `x20`?
- **Onde está**: [`src/game/driftSystem.js`](../src/game/driftSystem.js#L218-L295) e [`src/game/config.js`](../src/game/config.js#L58-L90).
- **Resposta**: Quando o jogador sai de um drift em uma reta curta, os pontos continuam em `pendingScore` e um cronômetro regressivo de `3,0 s` (`graceRemaining`) começa a rodar (exibido no anel SVG do HUD). Se ele iniciar outro drift antes de zerar os `3,0 s`, a sequência continua e o multiplicador avança pelos degraus `[1, 2, 3, 5, 8, 12, 20]` conforme o tempo acumulado em drift (`[2, 5, 9, 14, 20, 27] s`) ou ganha `+1` degrau ao inverter o sinal de $\theta_{\text{slip}}$ em menos de `1,5 s` (transição). Se os `3,0 s` acabarem na pista, `pendingScore` é somado com segurança ao `totalScore`.

### 5. Como o jogo sabe se o carro saiu da pista ou se está ganhando o bônus de borda (`x1.5`)?
- **Onde está**: [`src/game/trackBounds.js`](../src/game/trackBounds.js#L48-L162).
- **Resposta**: Na inicialização, amostramos 600 pontos equidistantes ao longo da `CatmullRomCurve3` com `curve.getSpacedPoints(600)`. A cada frame, transformamos 9 pontos locais da pegada do chassi (4 cantos, 4 pontos médios das laterais e 1 centro) para coordenadas de mundo e medimos a distância de cada ponto ao segmento mais próximo da curva. Como a meia-largura da pista é $5{,}5\text{ m}$, se **5 ou mais dos 9 pontos** tiverem $d > 5{,}5\text{ m}$, o carro é considerado fora da pista e perde os pontos pendentes; se estiver na pista e a borda do carro ficar a menos de $1{,}05\text{ m}$ do limite, ativa o bônus `BORDA x1.5`.

### 6. Como vocês implementaram a fumaça e as marcas de pneu sem alocar memória a cada frame?
- **Onde está**: [`src/game/effects.js`](../src/game/effects.js#L72-L226).
- **Resposta**: Usamos **Object Pooling em BufferGeometry pré-alocada**. Para a fumaça, criamos um único `THREE.Points` com 300 vértices no `init()`; quando o pneu derrapa, reciclamos o índice circular `smokeCursor`, posicionamos o vértice na roda traseira e fazemos `positions.needsUpdate = true`. Para as marcas de pneu, criamos um único `THREE.Mesh` com 360 quads (1.440 vértices) em um **ring buffer**: a cada deslocamento de `0,38 m` das rodas traseiras em drift, sobrescrevemos o segmento mais antigo no buffer de posições, mantendo o custo fixo em 1 Draw Call para a fumaça e 1 Draw Call para todas as marcas de pneu.

### 7. Como foi gerada a geometria da pista e como evitaram que a textura de asfalto esticasse nas curvas?
- **Onde está**: [`src/scene/track.js`](../src/scene/track.js#L60-L133).
- **Resposta**: Construímos uma `BufferGeometry` em faixa plana (`createRibbonGeometry`). Para cada fatia $i$ da `CatmullRomCurve3`, calculamos o vetor lateral perpendicular no plano $XZ$ via produto vetorial $\vec{s} = \text{normalize}(\vec{t} \times \vec{Y})$ e criamos os vértices esquerdo e direito. Para a coordenada $V$ do UV, não usamos o parâmetro $t$ da curva; calculamos o **comprimento de arco acumulado real** $s_i = \sum \|\mathbf{p}_k - \mathbf{p}_{k-1}\|$ e definimos $v_i = s_i / L_{\text{total}}$, aplicando `repeat.y = repeat.x * (L_total / largura)`.

### 8. Como funciona a normalização de escala e posição dos 3 modelos externos?
- **Onde está**: [`src/scene/models.js`](../src/scene/models.js#L92-L133).
- **Resposta**: A função `normalizeModelByBox3` envolve o modelo carregado em um `THREE.Group`, calcula sua caixa envolvente com `new THREE.Box3().setFromObject(rawObject)`, obtém o vetor de tamanho `getSize()`, aplica o fator de escala uniforme `scaleFactor = targetSize / referenceMeasure` ($4{,}5\text{ m}$ para o carro, $12\text{ m}$ para o barco e $28\text{ m}$ base para os prédios), recalcula a `Box3` escalada e subtrai `finalCenter.x`, `finalCenter.z` e `finalBox.min.y` para centralizar o pivô horizontalmente e apoiar a sola dos pneus/base exatamente em $Y = 0$.

### 9. Como funciona o Frustum Culling (Item 5) e o que muda nos contadores quando ele é desligado?
- **Onde está**: [`src/debug/diagnostics.js`](../src/debug/diagnostics.js#L244-L261) e [`src/main.js`](../src/main.js#L316-L350).
- **Resposta**: Quando `frustumCulled = true` (padrão), o Three.js testa a `boundingSphere` de cada `Mesh` contra os 6 planos do frustum da câmera na CPU antes de enviar o comando `gl.drawElements` para a GPU. Como espalhamos 40 instâncias de prédios e barcos além de 6 postes e 65 faixas, olhar para o mar descarta todos os prédios atrás da câmera. Ao apertar a tecla `5` (`frustumCulled = false`), a CPU envia todas as malhas da cena para a GPU mesmo fora do campo de visão, fazendo `renderer.info.render.calls` (Draw Calls) e `triangles` subirem imediatamente no HUD.

### 10. Como funciona o modo de tela dividida (Split-Screen) do Item 4 do diagnóstico?
- **Onde está**: [`src/main.js`](../src/main.js#L316-L347).
- **Resposta**: Quando o Item 4 está ativo, habilitamos `renderer.setScissorTest(true)`. No primeiro passe (metade esquerda da tela, `0` até `width/2`), ocultamos o `CameraHelper` para não poluir a visão do motorista e chamamos `renderer.render(scene, playerCamera)`. No segundo passe (metade direita, `width/2` até `width`), tornamos o `CameraHelper` visível, desligamos a névoa temporariamente para a visão aérea ficar limpa e chamamos `renderer.render(scene, topCamera)`.

### 11. Por que apenas 2 dos 6 postes `SpotLight` projetam sombra na cena?
- **Onde está**: [`src/scene/lights.js`](../src/scene/lights.js#L68-L77).
- **Resposta**: Cada luz que projeta sombra exige um passe extra de renderização da cena inteira para gerar seu *Shadow Map* de profundidade. Com 1 `DirectionalLight` ($2048\times2048$) + 2 `SpotLights` ($512\times512$ nos pontos críticos: Largada e Grampo Central), temos 3 passes de sombra por frame, mantendo `60 FPS` estáveis. Os outros 4 postes iluminam o asfalto com decaimento quadrático (`decay = 2`) e possuem lâmpada com material emissivo, mas com `castShadow = false` para poupar 4 passes de profundidade na GPU.

### 12. Qual é o papel do `bias` e do `normalBias` na sombra do sol poente?
- **Onde está**: [`src/scene/lights.js`](../src/scene/lights.js#L28-L45).
- **Resposta**: Como o sol poente está em ângulo muito rasante (`12,5°` de elevação), os texels do *Shadow Map* projetam-se de forma oblíqua sobre o asfalto, gerando listras falsas de auto-sombreamento (*Shadow Acne*). Em vez de usar um `bias` negativo grande (que causaria *Peter-Panning*, fazendo o carro parecer flutuar longe da própria sombra), usamos um `bias` mínimo (`-0.0004`) combinado com `normalBias = 0.04`, que desloca o ponto amostrado ao longo da normal da superfície antes de comparar a profundidade.

### 13. Por que usamos `SRGBColorSpace` apenas nos mapas de cor (`color.jpg`) e `NoColorSpace` nos mapas de `normal` e `roughness`?
- **Onde está**: [`src/materials/textures.js`](../src/materials/textures.js#L72-L97).
- **Resposta**: Fotografias e texturas de cor/albedo são salvas com compressão gama sRGB ($\approx x^{1/2,2}$) para aproveitar a sensibilidade do olho humano; o shader PBR precisa linearizá-las antes de multiplicar pela luz física. Já um `normalMap` armazena componentes vetoriais $(N_x, N_y, N_z)$ codificadas em RGB onde `(128, 128, 255)` representa o vetor $(0, 0, 1)$, e o `roughnessMap` armazena um escalar linear de microfacetas. Se marcássemos `normal.jpg` como sRGB, a GPU aplicaria $x^{2,2}$, alterando a direção das normais e distorcendo toda a iluminação especular.

### 14. Qual é a causa matemática do Z-Fighting nas faixas da pista e por que nossa solução combina $\Delta Y$ com `polygonOffset`?
- **Onde está**: [`src/scene/track.js`](../src/scene/track.js#L185-L192), [`src/scene/track.js`](../src/scene/track.js#L277-L296) e [`src/debug/zFightingPanel.js`](../src/debug/zFightingPanel.js).
- **Resposta**: O *Z-Buffer* mapeia a profundidade de forma não-linear proporcional a $1/z_e$, concentrando quase toda a precisão de 24 bits perto de `camera.near`. Quando as faixas brancas ficam exatamente coplanares ao asfalto ($Y = 0{,}05\text{ m}$), erros de arredondamento de ponto flutuante na interpolação baricêntrica fazem ora a faixa, ora o asfalto vencer o teste de profundidade. Nossa correção eleva as faixas em $\Delta Y = 2{,}5\text{ cm}$ ($Y = 0{,}075\text{ m}$) e ativa `polygonOffset: true` (`factor: -1, units: -1`), que adiciona um viés de profundidade proporcional à inclinação do triângulo na tela ($DZ$) diretamente no hardware rasterizador.

### 15. Como o som do motor e da derrapagem funciona sem nenhum arquivo de áudio na pasta `public/`?
- **Onde está**: [`src/game/audio.js`](../src/game/audio.js#L46-L246).
- **Resposta**: Usamos síntese procedural em tempo real com a **WebAudio API** nativa do navegador. No primeiro comando do usuário, criamos um `AudioContext` com dois osciladores (`sawtooth` e `triangle`) passando por um filtro passa-baixa (`BiquadFilterNode`) cuja frequência sobe de `55 Hz` a `195 Hz` conforme a velocidade do carro. Para o cantado de pneu, geramos um buffer de ruído branco de 2 segundos em memória e passamos por um filtro passa-faixa (`bandpass` em `950 Hz`, `Q = 6.5`), modulando seu volume pelo ângulo de deriva $\theta_{\text{slip}}$.
