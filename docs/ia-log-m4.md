# Registro de Uso de IA — Entrega M4 (Integração, Jogo de Drift e Caso de Diagnóstico)

**Projeto:** Monaco Sunset GP  
**Disciplina:** Computação Gráfica — IFSP São João da Boa Vista  
**Docente:** Prof. Gabriel M. Alves  
**Dupla:** Caio Canalli e Davi Beli Rosa

---

## 1. O que foi solicitado e gerado com apoio de IA no Marco M4

Na Entrega M4, o assistente de IA foi utilizado para integrar a camada criativa do **jogo arcade de drift** sobre a base já funcional dos marcos M1 (pipeline e diagnóstico), M2 (iluminação e sombras) e M3 (texturas PBR e ambiente), sem quebrar nenhum requisito anterior, além de estruturar o caso de diagnóstico de profundidade (*Z-Fighting*) e os materiais de apoio para o vídeo e a arguição:

1. **Configuração Centralizada ([`src/game/config.js`](../src/game/config.js))**:
   - Criação das constantes ajustáveis de física do carro (`CAR_PHYSICS_CONFIG`), limites da pista (`TRACK_BOUNDS_CONFIG`), pontuação e histerese de drift (`DRIFT_SCORE_CONFIG`), pools de partículas (`EFFECTS_CONFIG`) e síntese sonora (`AUDIO_CONFIG`).
2. **Modelo Arcade 2D de Drift e Câmera Dinâmica ([`src/controls/carController.js`](../src/controls/carController.js))**:
   - Extensão do controlador do M1 com decomposição do vetor velocidade 2D em componente frontal ($v_{\text{fwd}}$) e lateral ($v_{\text{lat}}$), amortecimento lateral exponencial $\exp(-\text{grip} \cdot dt)$, redução de aderência por freio de mão (`Espaço`) ou *flick* em alta velocidade, arrasto aumentado fora da pista e cálculo do ângulo de deriva $\text{slip} = \text{atan2}(v_{\text{lat}}, |v_{\text{fwd}}|)$.
   - Câmera de 3ª pessoa com *look-ahead* suave na direção do vetor velocidade ($1 - \exp(-k \cdot dt)$), abertura dinâmica de FOV com a velocidade e efeito de *camera shake* + *FOV punch* ao disparar o `SUPERDRIFT`.
3. **Sistema Puro de Pontuação de Drift ([`src/game/driftSystem.js`](../src/game/driftSystem.js)) e Testes ([`tests/driftSystem.test.js`](../tests/driftSystem.test.js))**:
   - Máquina de estados sem dependência de Three.js com histerese de entrada (`0,25 s` acima de `13°` e `7,5 m/s`) e de saída (`0,20 s` abaixo de `8°`), janela de 3 segundos nas retas (`graceRemaining`), progressão de multiplicadores `[1, 2, 3, 5, 8, 12, 20]` por tempo acumulado (`[2, 5, 9, 14, 20, 27] s`) e bônus de `+1` degrau em transições rápidas (`< 1,5 s`), bônus de borda `x1.5`, perda de pontos pendentes fora da pista, estado de vitória `SUPERDRIFT` (`25.000` pts pendentes ou `3 s` em `x20`) e persistência de recordes em `localStorage`.
   - Suíte automatizada com 7 testes em `node:test`, incluindo uma simulação de pilotagem contínua que comprovou o disparo do `SUPERDRIFT` em **`46,5 s`** (dentro da meta de `40 a 60 s`).
4. **Detecção de Saída de Pista por 9 Pontos ([`src/game/trackBounds.js`](../src/game/trackBounds.js))**:
   - Pré-amostragem de 600 pontos equidistantes (`curve.getSpacedPoints(600)`) e verificação dos 9 pontos da pegada do carro (4 cantos, 4 meios, 1 centro). Quando $\ge 5$ pontos ultrapassam a meia-largura ($5{,}5\text{ m}$), sinaliza saída de pista. Inclui 9 esferas coloridas inspecionáveis pela pasta `Jogo` do `lil-gui`.
5. **HUD de Jogo, Efeitos Zero-Allocation e WebAudio ([`index.html`](../index.html), [`src/game/hud.js`](../src/game/hud.js), [`src/game/effects.js`](../src/game/effects.js), [`src/game/audio.js`](../src/game/audio.js))**:
   - HUD HTML/CSS com pontos pendentes/totais, recordes, anel circular SVG de 3 s, velocímetro em `km/h`, barra de ângulo de deriva, vinheta vermelha fora da pista e tela `SUPERDRIFT` com efeito glitch CSS.
   - Efeitos 3D com zero alocação por frame: 1 `THREE.Points` (pool de 300 partículas de fumaça), 1 `THREE.Mesh` (ring buffer de 360 quads de marcas de pneu com `polygonOffset` e `depthWrite = false`) e 1 `THREE.Points` (explosão de 120 confetes no `SUPERDRIFT`).
   - Sintetizador procedural WebAudio (motor, pneu cantando, sino harmônico de multiplicador, alerta de saída de pista e fanfarra `SUPERDRIFT`).
6. **Caso de Diagnóstico de Z-Fighting ([`src/debug/zFightingPanel.js`](../src/debug/zFightingPanel.js), [`src/scene/track.js`](../src/scene/track.js) e [`docs/caso-diagnostico.md`](./caso-diagnostico.md))**:
   - Pasta interativa `Caso z-fighting` no `lil-gui` que alterna as faixas brancas da pista entre o modo defeituoso coplanar ($Y = 0{,}05\text{ m}$, `polygonOffset = false`) e o modo corrigido ($Y = 0{,}075\text{ m}$, `polygonOffset = true`), além de botões para agravar e restaurar `camera.near`/`far`.

---

## 2. Problemas encontrados durante o desenvolvimento do M4 e como foram corrigidos

1. **Calibração inicial do tempo até o `SUPERDRIFT` (`23,9 s` $\rightarrow$ `39,1 s` $\rightarrow$ `46,5 s`)**:
   - **Problema**: Na primeira versão de `driftSystem.js`, os degraus ganhos por transições rápidas (`transitionBonusSteps`) eram somados a cada frame sobre o índice calculado pelos limiares de tempo `[2, 5, 9, 14, 20, 27]`. Com isso, bastavam 3 transições nos primeiros 14 segundos para atingir `x20` precocemente e disparar o `SUPERDRIFT` em `23,9 s` no teste automatizado.
   - **Correção**: Alteramos a progressão para que os limiares de tempo e as transições avancem um único cursor de degrau (`stepIndex`), adicionamos um cooldown de `10 s` entre bônus de transição, exigimos pelo menos `27 s` de sequência antes de contar os `3 s` de sustentação em `x20` e ajustamos `basePointsPerSecond` de `76.0` para `66.0`. Com isso, a simulação realista atingiu `25.000` pontos exatamente aos **`46,5 s`** (dentro da janela pedida de `40 a 60 s`).
2. **Interferência dos modos de diagnóstico do M1 sobre as partículas e marcas de pneu do M4**:
   - **Problema**: Ao ligar e desligar o modo `[1] Wireframe` ou `[3] Back-face Culling` do M1, `scene.traverse` poderia alterar propriedades dos materiais transparentes de fumaça (`PointsMaterial`) ou das marcas de pneu.
   - **Correção**: Como `diagnostics.js` ignora objetos que não são `Mesh` para wireframe/culling e armazena o estado original de cada `Mesh` em um `WeakMap` (`diagnostics.reapplyMaterialStates()`), garantimos que `skidMesh` seja registrado na inicialização e preserve `polygonOffset: true` e `depthWrite: false`.

---

## 3. O que a dupla (Caio e Davi) revisou e validou manualmente

> **Instrução para a dupla**: Preencham ou ajustem os itens abaixo com as validações práticas feitas por vocês antes da entrega final:
- **Sensação de direção e calibragem do drift**: `[A PREENCHER PELA DUPLA — ex.: testamos o início do drift com Espaço e por flick na curva do porto e no grampo central, validando se o tempo de 3s na reta permite emendar as curvas]`.
- **Capturas de tela do Caso de Diagnóstico (`docs/img/`)**: `[A PREENCHER PELA DUPLA — confirmação da geração dos arquivos zfighting-antes.png, zfighting-depth.png e zfighting-depois.png]`.
- **Gravação do vídeo final (60–120 s)**: `[A PREENCHER PELA DUPLA — link do vídeo e observações da gravação]`.
