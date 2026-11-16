# Checklist Final de Entrega (Rubrica Oficial × Evidências no Repositório)

Este documento cruza cada critério de avaliação da disciplina de **Computação Gráfica (IFSP São João da Boa Vista — Prof. Gabriel M. Alves)** com a respectiva implementação e documentação no repositório **Monaco Sunset GP**, destacando ao final os únicos itens manuais que dependem exclusivamente dos alunos (**Caio Canalli** e **Davi Beli Rosa**).

---

## 1. Funcionalidade e Pipeline de Visualização (55 pontos)

| Requisito da Disciplina | Status | Evidência Concreta no Repositório (Arquivo e Linhas) | Como Testar / Verificar |
|---|:---:|---|---|
| **Cena 3D autoral explorável com composição coerente** (Circuito de Mônaco ao pôr do sol: porto/mar, cais, pista fechada e quarteirões de Monte Carlo, $\ge 30$ objetos espalhados) | ✅ Completo | [`src/scene/environment.js`](../src/scene/environment.js) (mar, cais, píeres, terreno, guard-rails); [`src/scene/track.js`](../src/scene/track.js) (curva fechada `CatmullRomCurve3` de $431{,}24\text{ m}$); [`src/scene/models.js`](../src/scene/models.js) (40 instâncias entre 24 prédios e 16 barcos). | Rodar `npm run dev` e percorrer o circuito completo. |
| **3 modelos externos em pelo menos 2 formatos distintos**, normalizados com `THREE.Box3` e posicionados sobre o piso | ✅ Completo | [`src/scene/models.js`](../src/scene/models.js) (`normalizeModelToTargetSize` com `Box3.setFromObject`, `car.obj + .mtl`, `boat.glb`, `building.glb` + fallback automático de caixas se ausentes). | Verificar modelos na cena e créditos CC0 em [`CREDITS.md`](../CREDITS.md). |
| **Navegação contínua em 3ª pessoa independente da taxa de quadros (`delta` via `THREE.Timer`)** | ✅ Completo | [`src/main.js`](../src/main.js) (`new THREE.Timer()`, `timer.update(timestamp)`, `Math.min(timer.getDelta(), 0.1)`); [`src/controls/carController.js`](../src/controls/carController.js) (física arcade em $\text{m/s}$ e $\text{rad/s}$, câmera suave $1 - e^{-k \cdot \Delta t}$). | Dirigir com `WASD`/Setas + `Espaço`; testar o botão `Simular dt = 50ms (20 FPS)` na pasta `Jogo` do `lil-gui`. |
| **Modo Diagnóstico interativo com os 5 itens obrigatórios do pipeline** (1: Wireframe, 2: Depth Buffer + `near`/`far`, 3: Back-face Culling, 4: Frustum de 2ª câmera em split-screen, 5: Frustum Culling + contadores `renderer.info`) | ✅ Completo | [`src/debug/diagnostics.js`](../src/debug/diagnostics.js) (teclas `1` a `5` sincronizadas via `.listen()` com o painel `lil-gui`); [`src/main.js`](../src/main.js) (split-screen com `setViewport`/`setScissor` e leitura de `renderer.info.render`). | Pressionar teclas `1`, `2`, `3`, `4` e `5` ou usar a pasta `Diagnóstico (M1)` no `lil-gui`. |
| **Iluminação com pelo menos 2 tipos distintos de luz e sombras configuradas** (DirectionalLight + 6 SpotLights com `decay=2` + HemisphereLight; `PCFShadowMap`, `bias`, `normalBias`, frustum ortográfico justo) | ✅ Completo | [`src/scene/lights.js`](../src/scene/lights.js) (Sol direcional $2048^2$, 6 postes SpotLight onde 2 projetam sombra $512^2$, HemisphereLight); [`src/debug/lightPanel.js`](../src/debug/lightPanel.js) (pasta `Luz (M2)` com helpers ao vivo). | Abrir pasta `Luz (M2)` no `lil-gui`, ativar `Helpers de Luz` e consultar [`docs/justificativa-luz.md`](./justificativa-luz.md). |
| **Materiais PBR, coordenadas UV sem estiramento e mapas de relevo/rugosidade** ($\ge 3$ materiais distintos — 7 implementados; UV por comprimento de arco na pista; `SRGBColorSpace` vs `NoColorSpace`; `Sky` + `PMREMGenerator`) | ✅ Completo | [`src/materials/textures.js`](../src/materials/textures.js) (loader seguro, anisotropia, UV Checker); [`src/materials/materials.js`](../src/materials/materials.js) (7 materiais PBR + ondas animadas); [`src/scene/track.js`](../src/scene/track.js) (UV por comprimento de arco); [`src/debug/materialPanel.js`](../src/debug/materialPanel.js). | Abrir pasta `Materiais (M3)`, testar `Visualizar UV (Checker)` e `Normal Maps`, e ler [`docs/justificativa-materiais.md`](./justificativa-materiais.md). |

---

## 2. Defesa Individual e Domínio do Código (20 pontos)

| Requisito da Disciplina | Status | Evidência Concreta no Repositório | Ação Recomendada para Caio e Davi |
|---|:---:|---|---|
| **Código simples, modular, legível e comentado em português explicando o *porquê*** | ✅ Completo | Todos os arquivos em [`src/`](../src/) possuem cabeçalhos arquiteturais, constantes no topo e comentários explicativos em português. | Ler [`docs/guia-arguicao.md`](./guia-arguicao.md) (resumo de 3 linhas de cada arquivo + 15 perguntas e respostas de defesa com linhas exatas). |
| **Caso de diagnóstico de profundidade (Z-Fighting) reproduzível ao vivo e documentado** | ✅ Completo (Código + Doc) / ⚠️ Faltam 3 prints | [`src/debug/zFightingPanel.js`](../src/debug/zFightingPanel.js) (pasta `Caso z-fighting`); [`src/scene/track.js`](../src/scene/track.js) (`setZFightingProblemActive`); [`docs/caso-diagnostico.md`](./caso-diagnostico.md). | Tirar os 3 prints (`zfighting-antes.png`, `zfighting-depth.png`, `zfighting-depois.png`) e salvar em `docs/img/`. |

---

## 3. Processo, Entregas Parciais e Documentação (15 pontos)

| Requisito da Disciplina | Status | Evidência Concreta no Repositório | O que Falta Preencher Manualmente |
|---|:---:|---|---|
| **Histórico dos marcos M1, M2, M3 e M4 + Logs de Transparência de IA** | ✅ Completo | [`docs/ia-log-m1.md`](./ia-log-m1.md), [`docs/ia-log-m2.md`](./ia-log-m2.md), [`docs/ia-log-m3.md`](./ia-log-m3.md), [`docs/ia-log-m4.md`](./ia-log-m4.md). | Preencher as colunas manuais da tabela de IA no [`README.md`](../README.md) e realizar commits individuais de ambos os alunos. |
| **`README.md` final estruturado com todas as seções exigidas + `CREDITS.md`** | ✅ Estrutura Completa | [`README.md`](../README.md) (7 seções na ordem exigida) e [`CREDITS.md`](../CREDITS.md) (modelos CC0, texturas CC0, WebAudio procedural e bibliotecas MIT). | Substituir os campos marcados com **`A PREENCHER`** no [`README.md`](../README.md) (divisão de tarefas da dupla, link do vídeo, coluna de validação manual de IA) e em [`CREDITS.md`](../CREDITS.md) (IDs exatos das texturas caso baixem do ambientCG/Poly Haven). |
| **Higiene do repositório e build limpo** (`npm run build` e `npm run test` passando sem erros; sem arquivos $> 50\text{ MB}$; sem `console.log` de debug) | ✅ Completo | [`.gitignore`](../.gitignore), [`package.json`](../package.json), [`tests/driftSystem.test.js`](../tests/driftSystem.test.js) (7 testes automatizados passando). | Nenhuma ação pendente de código. |

---

## 4. Criatividade, Jogabilidade e Acabamento — Camada M4 (10 pontos)

| Item Criativo / Jogo de Drift (M4) | Status | Evidência Concreta no Repositório |
|---|:---:|---|
| **Física arcade 2D de drift com decomposição vetorial ($v_{\text{frontal}}, v_{\text{lateral}}$), freio de mão (`Espaço`), *flick* em alta velocidade e câmera *look-ahead* com FOV dinâmico** | ✅ Completo | [`src/controls/carController.js`](../src/controls/carController.js) e [`src/game/config.js`](../src/game/config.js) |
| **Sistema puro de pontuação de drift (zero dependência de Three.js)** com histerese de entrada/saída, anel de 3 s nas retas, multiplicadores `x1..x20`, bônus de transição e bônus de borda `x1.5` | ✅ Completo | [`src/game/driftSystem.js`](../src/game/driftSystem.js) + 7 testes em [`tests/driftSystem.test.js`](../tests/driftSystem.test.js) |
| **Detecção de saída de pista por amostragem de curva (`getSpacedPoints(600)`) e 9 pontos da pegada do carro** + 9 esferas coloridas de debug | ✅ Completo | [`src/game/trackBounds.js`](../src/game/trackBounds.js) + toggle na pasta `Jogo` ([`src/debug/gamePanel.js`](../src/debug/gamePanel.js)) |
| **Estado de vitória `SUPERDRIFT`** ($25.000$ pts pendentes ou $3\text{ s}$ em `x20`, calibrado para $40\text{–}60\text{ s}$) com overlay glitch CSS, camera shake, FOV punch, explosão de confetes 3D e selo persistente | ✅ Completo | [`index.html`](../index.html), [`src/game/hud.js`](../src/game/hud.js), [`src/game/effects.js`](../src/game/effects.js) |
| **Efeitos visuais com zero alocação por frame** (Pool de 300 partículas de fumaça em 1 `THREE.Points` + Ring buffer de 360 segmentos de marcas de pneu em 1 `THREE.Mesh` + 120 confetes em 1 `THREE.Points`) | ✅ Completo | [`src/game/effects.js`](../src/game/effects.js) |
| **Áudio procedural sintetizado via WebAudio API** (motor, cantado de pneu no drift, sino harmônico de multiplicador, alerta de saída de pista e fanfarra `SUPERDRIFT`; tecla `M` para mudo) | ✅ Completo | [`src/game/audio.js`](../src/game/audio.js) |
| **Recordes persistentes em `localStorage`** (Maior Pontuação Total e Maior Sequência Única) | ✅ Completo | [`src/game/driftSystem.js`](../src/game/driftSystem.js) e [`src/game/hud.js`](../src/game/hud.js) |

---

## 5. Resumo do que Caio e Davi Precisam Fazer Antes do `git push` Final

1. **Colocar os assets externos opcionais (se ainda não colocaram)**:
   - Modelos da Kenney em `public/models/car/car.obj` (+ `.mtl`/`.png`), `public/models/boat/boat.glb`, `public/models/building/building.glb`.
   - Texturas 1K JPG em `public/textures/asphalt/`, `stone/`, `ground/` e `water/` (e anotar o ID delas em [`CREDITS.md`](../CREDITS.md)).
2. **Salvar as 3 capturas do Caso de Diagnóstico em `docs/img/`**:
   - `docs/img/zfighting-antes.png`, `docs/img/zfighting-depth.png` e `docs/img/zfighting-depois.png` (seguindo [`docs/caso-diagnostico.md`](./caso-diagnostico.md)).
3. **Preencher os blocos `A PREENCHER` nos documentos**:
   - Em [`README.md`](../README.md): Link do vídeo gravado, tabela de **Divisão do Trabalho** entre Caio e Davi, e as duas colunas manuais da **Nota de Transparência de IA**.
   - Em [`docs/justificativa-luz.md`](./justificativa-luz.md): Os números medidos de FPS/Draw Calls na máquina da dupla (seção 5).
4. **Gravar o vídeo de 60 a 120 segundos** seguindo [`docs/roteiro-video.md`](./roteiro-video.md).
5. **Realizar commits individuais de cada integrante** no repositório Git.
