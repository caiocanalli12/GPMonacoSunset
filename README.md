# Monaco Sunset GP

**Disciplina:** Computação Gráfica — IFSP São João da Boa Vista  
**Docente:** Prof. Gabriel M. Alves  
**Integrantes da Dupla:** Caio Canalli e Davi Beli Rosa

---

## 1. Descrição do Projeto e do Tema

**Monaco Sunset GP** é um mundo 3D explorável e um jogo arcade de drift em 3ª pessoa desenvolvido em **Three.js** (JavaScript puro + Vite), inspirado em uma versão compacta do circuito de rua de Mônaco ao pôr do sol. De um lado do circuito ficam o porto, o mar refletindo o entardecer e 16 iates/barcos ancorados; do outro, o cais de pedra e os quarteirões urbanos de Monte Carlo com 24 edifícios de janelas iluminadas e 6 postes de luz ao longo do traçado.

Sobre a base completa dos três primeiros marcos da disciplina — pipeline de visualização com modo diagnóstico interativo (**M1**), iluminação híbrida com sombras calibradas (**M2**) e materiais PBR com coordenadas UV por comprimento de arco e céu analítico (**M3**) — a entrega final (**M4**) adiciona uma camada criativa de **jogo de drift**:

- O jogador conduz o carro pelo circuito acumulando pontos pendentes em derrapagens controladas (via freio de mão `Espaço` ou *flick* em alta velocidade), mantendo a sequência viva entre curvas através de uma janela regressiva de **3 segundos**, subindo o multiplicador até **`x20`** e ganhando bônus de **`x1.5`** ao raspar na borda da pista sem sair dela.
- Se **5 ou mais dos 9 pontos monitorados do chassi** saírem do asfalto, toda a pontuação pendente da sequência é perdida.
- Ao atingir **25.000 pontos pendentes** na mesma sequência (ou sustentar `x20` por 3 segundos), o jogador conquista o estado especial **`SUPERDRIFT`**, com explosão de partículas, *camera shake*, efeito *glitch* no HUD e fanfarra sonora procedural, podendo continuar dirigindo para bater seu recorde salvo em `localStorage`.

### Vídeo de Demonstração (60 a 120 segundos)
- **Link do Vídeo (YouTube):** https://www.youtube.com/watch?v=mjOaUnsM0TY
- **Repositório no GitHub:** https://github.com/caiocanalli12/GPMonacoSunset
- **Roteiro utilizado:** [`docs/roteiro-video.md`](./docs/roteiro-video.md)

---

## 2. Instruções de Execução e Controles

### Pré-requisitos e Comandos

Certifique-se de ter o **Node.js** (versão 18 ou superior) instalado. No terminal, na raiz do repositório:

```bash
# 1. Instalar as dependências (three, lil-gui e vite)
npm install

# 2. Iniciar o servidor de desenvolvimento interativo
npm run dev

# 3. Executar a suíte de testes automatizados do sistema de drift (Node Test Runner)
npm run test

# 4. Gerar e validar o build de produção
npm run build
```

Após executar `npm run dev`, acesse no navegador o endereço exibido no terminal (por padrão, `http://localhost:5173/`).

### Lista Completa de Controles

#### Condução e Jogo de Drift (M1 + M4)
| Tecla | Ação |
| :---: | :--- |
| `W` ou `Seta ↑` | Acelerar para frente |
| `S` ou `Seta ↓` | Frear / Marcha à ré |
| `A` ou `Seta ←` | Esterçar à esquerda |
| `D` ou `Seta →` | Esterçar à direita |
| `Espaço` | **Freio de mão** (reduz a aderência lateral para iniciar e alongar o drift) |
| `R` | **Reposicionar carro** na largada e reiniciar a partida atual |
| `P` | **Pausar / Retomar** a simulação |
| `M` | **Silenciar / Ativar áudio** procedural (WebAudio) |

#### Modo Diagnóstico do Pipeline e Inspeção (`Teclado` + Painel `lil-gui`)
| Atalho | Item / Pasta no `lil-gui` | O que faz |
| :---: | :--- | :--- |
| `1` | **Diagnóstico → `[1] Wireframe`** | Alterna `wireframe` em todas as malhas da cena, restaurando o estado original ao desligar. |
| `2` | **Diagnóstico → `[2] Profundidade`** | Aplica `THREE.MeshDepthMaterial` em `scene.overrideMaterial` para inspecionar o *Z-Buffer* não-linear em conjunto com os sliders `Câmera Near` e `Câmera Far`. |
| `3` | **Diagnóstico → `[3] Back-face Culling`** | Alterna `side` entre `THREE.FrontSide` (culling ativo) e `THREE.DoubleSide` (visível no banner do pórtico de largada visto por trás). |
| `4` | **Diagnóstico → `[4] Frustum 2ª Câmera`** | Divide a tela ao meio (`setViewport`/`setScissor`): câmera do jogador à esquerda e visão aérea com `THREE.CameraHelper` à direita. |
| `5` | **Diagnóstico → `[5] Frustum Culling`** | Liga/desliga `obj.frustumCulled` nas malhas para observar a diferença imediata nos contadores **Draw Calls** e **Triangles** do `renderer.info`. |
| `H` | **Mostrar / Esconder Painel** | Oculta ou exibe o painel `lil-gui` completo no canto superior direito. |
| *(GUI)* | **Pasta `Luz (M2)`** | Liga/desliga Sol, Postes e HemisphereLight, controla sombras, `bias`, `normalBias`, `mapSize`, elevação/azimute do sol e `Helpers de Luz`. |
| *(GUI)* | **Pasta `Materiais (M3)`** | Liga/desliga Mapas de Cor, Normal Maps, Roughness Maps, modo **`Visualizar UV (Checker)`** e velocidade das ondas da água. |
| *(GUI)* | **Pasta `Jogo` (M4)** | Exibe as **9 esferas dos pontos da pista** sobre o carro, botão **`Forçar SUPERDRIFT (teste)`**, simulação de **`dt = 50ms (20 FPS)`** e limpeza de marcas/recordes. |
| *(GUI)* | **Pasta `Caso z-fighting` (M4)** | Alterna ao vivo entre o estado com bug (faixas coplanares em $Y = 0{,}05\text{ m}$ sem `polygonOffset`) e o estado corrigido ($Y = 0{,}075\text{ m}$ + `polygonOffset`). |

---

## 3. Créditos, Licenças e Referências

Todos os detalhes de autoria, pacotes originais e links diretos encontram-se documentados em [`CREDITS.md`](./CREDITS.md):

- **Modelos 3D Externos (CC0 1.0 — Domínio Público, Kenney.nl):**
  - Carro (`public/models/car/car.obj` + `.mtl` + `.png`): *Kenney Racing Kit*.
  - Barco/Iate (`public/models/boat/boat.glb`): *Kenney Watercraft Kit*.
  - Prédio Comercial (`public/models/building/building.glb`): *Kenney City Kit (Commercial)*.
  - *Nota:* Caso algum arquivo não esteja presente em `public/models/`, [`src/scene/models.js`](./src/scene/models.js) gera automaticamente placeholders geométricos normalizados pelo mesmo algoritmo de `THREE.Box3`.
- **Texturas PBR (CC0 1.0 — Domínio Público, ambientCG / Poly Haven):**
  - Conjuntos 1K JPG (`color.jpg`, `normal.jpg` padrão OpenGL / NormalGL e `roughness.jpg`) em `public/textures/asphalt/`, `stone/`, `ground/` e `water/`, com fallback automático para cores sólidas e normal map procedural 512×512 para a água em [`src/materials/textures.js`](./src/materials/textures.js).
- **Áudio Procedural (Autoral — WebAudio API):**
  - Gerado matematicamente em tempo real em [`src/game/audio.js`](./src/game/audio.js), sem arquivos externos.
- **Bibliotecas:** [`three`](https://threejs.org/) (`^0.186.1`), [`lil-gui`](https://lil-gui.georgealways.com/) (`^0.21.0`) e [`vite`](https://vite.dev/) (`^8.3.4`), todas sob licença **MIT**.

---

## 4. Decisões Técnicas

1. **Iluminação e Sombras (Marco M2 — detalhes em [`docs/justificativa-luz.md`](./docs/justificativa-luz.md)):**
   - Combinamos três tipos de luz sob `ACESFilmicToneMapping` (`exposure = 0.88`) e `SRGBColorSpace`: um `DirectionalLight` quente (`#ffb070`) a `12,5°` de elevação vindo do mar com sombra ortográfica justa (`[-125, 125] × [-75, 85]`, `2048×2048`, `PCFShadowMap` com `radius = 2.0`, `bias = -0.0004` e `normalBias = 0.04`); seis `SpotLights` nos postes da pista (`#ffd9a0`, `240 cd`, `decay = 2`), onde apenas 2 projetam sombra (`512×512`, na largada e no grampo central) para poupar passes de profundidade na GPU; e um `HemisphereLight` (`#ff9e7a` / `#1e273c`, intensidade `0.45`) como preenchimento atmosférico.
2. **Texturas, Materiais PBR e Ambiente Coerente (Marco M3 — detalhes em [`docs/justificativa-materiais.md`](./docs/justificativa-materiais.md)):**
   - Implementamos 7 materiais `MeshStandardMaterial` distintos (asfalto, pedra do cais, terreno urbano, água com ondas animadas no `normalMap` por `delta`, pintura metálica do carro, barcos e prédios com janelas emissivas). Garantimos `SRGBColorSpace` exclusivamente nos mapas de cor e `NoColorSpace` nos mapas de `normal` e `roughness`, com `RepeatWrapping` e anisotropia máxima. Na pista (`CatmullRomCurve3` de $431{,}24\text{ m}$), a coordenada $V$ das UVs é calculada pelo **comprimento de arco acumulado**, eliminando estiramento nas curvas. O céu analítico `Sky.js` e o mapa de reflexo `PMREMGenerator` foram calibrados para manter a estética de meia-luz do entardecer e regeneram o cubemap apenas no evento `onFinishChange` da GUI.
3. **Navegação Independente de FPS, Física Arcade e Câmera (Marcos M1 e M4):**
   - O loop em [`src/main.js`](./src/main.js) usa `THREE.Timer` com `dt` limitado a `0,1 s`. Em [`src/controls/carController.js`](./src/controls/carController.js), a velocidade 2D é decomposta nos eixos frontal e lateral do carro; a componente lateral decai por $\exp(-\text{grip} \cdot dt)$, permitindo iniciar drifts tanto pelo freio de mão (`Espaço`) quanto por *flick* em alta velocidade. A câmera de 3ª pessoa usa amortecimento exponencial $\alpha = 1 - \exp(-k \cdot dt)$, antecipa o olhar na direção do vetor velocidade (*look-ahead*) e abre o FOV dinamicamente conforme a velocidade.
4. **Arquitetura do Jogo de Drift e Zero Alocação por Frame (Marco M4):**
   - A lógica de detecção e pontuação de drift foi isolada em JavaScript puro em [`src/game/driftSystem.js`](./src/game/driftSystem.js) (sem importar Three.js) e validada por 7 testes unitários e de simulação em [`tests/driftSystem.test.js`](./tests/driftSystem.test.js) (`SUPERDRIFT` calibrado em `~46,5 s`). A verificação de limites da pista em [`src/game/trackBounds.js`](./src/game/trackBounds.js) amostra 600 pontos da curva central e testa 9 pontos do chassi a cada frame. Para preservar os `60 FPS`, a fumaça dos pneus (`1 THREE.Points` com 300 partículas), as marcas de pneu no asfalto (`1 THREE.Mesh` em *ring buffer* de 360 quads) e os confetes do `SUPERDRIFT` (`1 THREE.Points` com 120 partículas) em [`src/game/effects.js`](./src/game/effects.js) reciclam vértices em `BufferGeometry` pré-alocada, com **zero alocação de memória ou criação de objetos por frame**.

---

## 5. Caso de Diagnóstico — Problema de Profundidade (Z-Fighting)

O estudo completo com a dedução matemática do *Z-Buffer* não-linear ($1/z_e$) e a tabela comparativa de soluções está em [`docs/caso-diagnostico.md`](./docs/caso-diagnostico.md).

- **Causa:** Quando as faixas brancas pintadas da pista são posicionadas exatamente no mesmo plano geométrico do asfalto ($Y = 0{,}05\text{ m}$), erros de arredondamento de ponto flutuante na interpolação baricêntrica fazem ora a faixa, ora o asfalto vencer o teste de profundidade (`GL_LEQUAL`). O problema se agrava em ângulos rasantes e quando a razão $\text{far}/\text{near}$ da câmera é alta (ex.: `near = 0.02`, `far = 2000`), pois quase todos os bits do *Z-Buffer* de 24 bits ficam concentrados nos primeiros centímetros à frente da câmera.
- **Como Reproduzir ao Vivo:** Abra a pasta **`Caso z-fighting`** no painel `lil-gui` ([`src/debug/zFightingPanel.js`](./src/debug/zFightingPanel.js)) e clique em **`1. Ativar bug + agravar near/far`** (ou marque `Simular bug (faixas coplanares)`). Pressione a tecla **`2`** para visualizar o empate de profundidade no *Depth Buffer*. Em seguida, clique em **`2. Aplicar correção (Y + offset)`** para restaurar a estabilidade.
- **Solução Adotada:** Combinamos três medidas sem desativar o *Early-Z* da GPU: (1) razão $\text{far}/\text{near}$ enxuta na câmera principal (`near = 0.5`, `far = 260`); (2) separação geométrica mínima de $\Delta Y = 2{,}5\text{ cm}$ (`ASPHALT_Y_OFFSET = 0.05` vs. `CENTERLINE_Y_OFFSET = 0.075`); e (3) `polygonOffset: true` (`factor = -1, units = -1` nas faixas brancas e `factor = -2, units = -2` com `depthWrite = false` nas marcas de pneu).
- **Capturas de Evidência (`docs/img/`):**
  - Antes (bug coplanar ativo): [`docs/img/zfighting-antes.png`](./docs/img/zfighting-antes.png) *(A PREENCHER / salvar print)*
  - Visualização no Depth Buffer (`[2]`): [`docs/img/zfighting-depth.png`](./docs/img/zfighting-depth.png) *(A PREENCHER / salvar print)*
  - Depois (correção aplicada): [`docs/img/zfighting-depois.png`](./docs/img/zfighting-depois.png) *(A PREENCHER / salvar print)*

---

## 6. Divisão do Trabalho entre os Integrantes

> **Instrução para a dupla:** Preencham a tabela abaixo com as responsabilidades reais exercidas por cada integrante ao longo dos marcos M1 a M4 e nos commits do repositório.

| Integrante | Marcos / Módulos sob Responsabilidade Principal | Contribuições Específicas e Testes Realizados |
| :--- | :--- | :--- |
| **Caio Canalli** | **M1** (Câmera, cena e diagnóstico), **M2** (Luz e sombras) e **M4** (Integração e jogo de drift) | Projeto base com Vite e Three.js; cena, terreno, água e pista; câmera em 3ª pessoa e movimento independente de frame rate (`THREE.Timer`); modo diagnóstico (wireframe, profundidade, culling, frustum com `CameraHelper`, `renderer.info`); luzes e sombras com justificativa; física arcade do carro, HUD e vídeo/revisão final. |
| **Davi Beli Rosa** | **M1** (Modelos carregados), **M3** (Texturas, materiais e ambiente) e **M4** (Integração e caso de diagnóstico) | Carregamento e integração dos 3 modelos (`OBJ` e `GLB`) com normalização via `Box3`; posicionamento dos barcos e prédios no cenário; materiais PBR, UV por comprimento de arco, normal/roughness maps; ambiente do pôr do sol (céu `Sky.js`, `PMREM`, névoa); caso de diagnóstico de *Z-Fighting* documentado; pontuação, efeitos e vídeo/revisão final. |

---

## 7. Nota de Transparência de IA

Os registros detalhados de cada marco encontram-se em [`docs/ia-log-m1.md`](./docs/ia-log-m1.md), [`docs/ia-log-m2.md`](./docs/ia-log-m2.md), [`docs/ia-log-m3.md`](./docs/ia-log-m3.md) e [`docs/ia-log-m4.md`](./docs/ia-log-m4.md).

> **Instrução para a dupla:** As duas últimas colunas abaixo (*"O que foi validado/alterado manualmente"* e *"O que foi descartado"*) devem ser preenchidas por vocês com base na revisão prática do grupo.

| Marco | O que foi pedido / gerado com apoio de IA | O que foi validado / alterado manualmente pela dupla | O que foi descartado ou refeito |
| :--- | :--- | :--- | :--- |
| **M1 — Pipeline e Diagnóstico** | Estrutura base Three.js + Vite, geometria da pista por `CatmullRomCurve3`, carregamento/normalização `Box3` dos 3 modelos (`.obj+.mtl` e `.glb`), 40 instâncias no cenário, navegação em 3ª pessoa com `THREE.Timer` e painel `lil-gui` com os 5 itens de diagnóstico (`src/debug/diagnostics.js`). | `A PREENCHER PELA DUPLA` | `A PREENCHER PELA DUPLA` |
| **M2 — Luzes e Sombras** | Sistema com `DirectionalLight` (sol poente a `12,5°` com sombra ortográfica justa `2048×2048`, `bias` e `normalBias`), 6 postes `SpotLight` (`240 cd`, `decay = 2`, 2 com sombra `512×512` e 4 sem sombra + bulbo emissivo), `HemisphereLight`, `ACESFilmicToneMapping`, pasta `Luz (M2)` com helpers e [`docs/justificativa-luz.md`](./docs/justificativa-luz.md). | `A PREENCHER PELA DUPLA` | `A PREENCHER PELA DUPLA` |
| **M3 — Texturas, Materiais e Ambiente** | Loader com fallback seguro, distinção `SRGBColorSpace` vs `NoColorSpace`, UVs da pista por comprimento de arco acumulado, 7 materiais `MeshStandardMaterial`, normal map procedural da água animado por `delta`, céu `Sky.js` + `PMREMGenerator` recalibrados para preservar o pôr do sol e [`docs/justificativa-materiais.md`](./docs/justificativa-materiais.md). | `A PREENCHER PELA DUPLA` | `A PREENCHER PELA DUPLA` |
| **M4 — Jogo de Drift e Integração** | Física arcade 2D de drift (`src/controls/carController.js`), sistema puro de pontuação e histerese (`src/game/driftSystem.js`) + 7 testes automatizados, detecção de pista por 9 pontos (`src/game/trackBounds.js`), HUD com anel SVG de 3 s e overlay `SUPERDRIFT`, pools de fumaça e marcas de pneu sem alocação por frame (`src/game/effects.js`), áudio WebAudio (`src/game/audio.js`), painel `Caso z-fighting` e guias de defesa/vídeo. | `A PREENCHER PELA DUPLA` | `A PREENCHER PELA DUPLA` |
