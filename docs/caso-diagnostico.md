# Caso de Diagnóstico — Problema de Profundidade (Z-Fighting nas Faixas Pintadas da Pista)

Este documento descreve, reproduz e justifica tecnicamente o **caso de diagnóstico de profundidade (Z-Fighting)** exigido na Entrega M4 da disciplina de Computação Gráfica (IFSP São João da Boa Vista — Prof. Gabriel M. Alves).

---

## 1. O Problema Observado (Sintoma Visual)

Em uma cena de corrida como o **Monaco Sunset GP**, o circuito possui uma malha principal de asfalto (`trackMesh`) e uma segunda malha de faixas brancas tracejadas e zebras pintadas sobre a pista (`markingsMesh`), ambas geradas proceduralmente ao longo da curva fechada `CatmullRomCurve3` em [`src/scene/track.js`](../src/scene/track.js).

Quando as faixas pintadas são posicionadas **exatamente na mesma altura geométrica do asfalto** ($Y = 0{,}05\text{ m}$) e sem deslocamento de profundidade no rasterizador (`polygonOffset: false`):

1. As faixas brancas **piscam (flickering)** e apresentam padrões serrilhados em formato de "dentes de serra" ou listras diagonais que mudam a cada movimento da câmera ou do carro.
2. O artefato se intensifica drasticamente em **ângulos rasantes** (como a câmera de 3ª pessoa atrás do carro olhando para o horizonte da pista) e quando a razão entre os planos de recorte da câmera ($\text{far} / \text{near}$) aumenta (por exemplo, diminuindo `camera.near` de `0.5` para `0.01`).

---

## 2. Passo a Passo para Reproduzir na Aplicação

A aplicação inclui uma pasta interativa dedicada chamada **`Caso z-fighting`** no painel `lil-gui` (canto superior direito), implementada em [`src/debug/zFightingPanel.js`](../src/debug/zFightingPanel.js), que permite alternar ao vivo entre o estado com defeito e o estado corrigido:

1. Inicie a aplicação (`npm run dev`) e localize a pasta **`Caso z-fighting`** no painel lateral direito (`lil-gui`).
2. Marque o checkbox **`Simular bug (faixas coplanares)`** (ou clique no botão **`1. Ativar bug + agravar near/far`**):
   - O código chama `trackData.setZFightingProblemActive(true)` em [`src/scene/track.js`](../src/scene/track.js), movendo `markingsMesh.position.y` para `0.0 m` (deixando seus vértices em $Y = 0{,}05\text{ m}$, coplanares ao asfalto) e desligando `material.polygonOffset = false`.
   - O botão de agravamento também reduz `camera.near` de `0.5` para `0.02` e eleva `camera.far` para `2000`, degradando a precisão do *Z-Buffer*.
3. Dirija alguns metros ou gire a câmera ao redor do carro: observe as faixas brancas centrais piscando e sendo parcialmente engolidas pelo asfalto escuro.
4. Pressione a tecla **`2`** (ou marque `[2] Visualizar Depth Buffer` na pasta de Diagnóstico M1) para inspecionar o *Z-Buffer* com `MeshDepthMaterial`:
   - Observe que tanto o asfalto quanto as faixas pintadas produzem exatamente o mesmo tom de cinza (mesmo valor de $z_{\text{ndc}}$), evidenciando o empate numérico no teste de profundidade (`GL_LEQUAL`).
5. Desmarque **`Simular bug (faixas coplanares)`** (ou clique em **`2. Aplicar correção (Y + offset)`**):
   - As faixas voltam instantaneamente a ficar estáveis e nítidas em qualquer distância ou ângulo de câmera.

---

## 3. Causa Matemática no Pipeline de Rasterização (Por que acontece?)

Durante a etapa de **rasterização**, a GPU utiliza o **Depth Buffer (Z-Buffer)** — tipicamente com precisão de 24 bits por pixel — para resolver a visibilidade de cada fragmento.

A transformação de projeção perspectiva mapeia a coordenada de profundidade no espaço da câmera $z_e \in [\text{near}, \text{far}]$ para o espaço de dispositivo normalizado $z_{\text{ndc}} \in [-1, 1]$ (ou $[0, 1]$ no buffer de profundidade) através de uma **função racional não-linear** proporcional a $1 / z_e$:

$$z_{\text{buffer}}(z_e) = \frac{\text{far}}{\text{far} - \text{near}} \left( 1 - \frac{\text{near}}{z_e} \right)$$

Dessa equação decorrem duas propriedades fundamentais que explicam o *Z-Fighting*:

1. **Coplanaridade exata ($z_{\text{asfalto}} = z_{\text{faixa}}$)**:
   Quando dois triângulos de malhas distintas ocupam o mesmo plano no espaço do mundo ($Y = 0{,}05\text{ m}$), mas possuem vértices em posições $(X, Z)$ diferentes, a interpolação baricêntrica em ponto flutuante (IEEE 754) na GPU sofre pequenos erros de arredondamento da ordem de $10^{-7}$. Em um pixel, $z_{\text{faixa}}$ resulta ligeiramente menor que $z_{\text{asfalto}}$ (a faixa vence); no pixel vizinho, ocorre o inverso (o asfalto vence).
2. **Perda de precisão logarítmica com a razão $\text{far}/\text{near}$**:
   Derivando $z_{\text{buffer}}$ em relação a $z_e$, verifica-se que a densidade de valores representáveis no *Z-Buffer* é proporcional a $\frac{\text{near}}{z_e^2}$.
   - Com `near = 0.5` e `far = 450` (razão $900:1$), a maior parte dos 24 bits já está concentrada nos primeiros metros próximos à câmera.
   - Se reduzirmos `near` para `0.01` e subirmos `far` para `2000` (razão $200.000:1$), mais de $99\%$ dos valores do *Z-Buffer* ficam comprimidos nos primeiros centímetros à frente da lente, restando pouquíssimos bits para distinguir superfícies a $15\text{ m}$ ou $30\text{ m}$ de distância.

---

## 4. Comparação das Soluções Possíveis

| Solução Candidata | Como Funciona | Vantagens | Desvantagens / Limitações |
|---|---|---|---|
| **1. Ajustar `camera.near` e `camera.far` (`near = 0.5`, `far = 450`)** | Mantém a razão $\text{far}/\text{near}$ baixa ($900:1$), preservando bits de precisão no *Z-Buffer* para distâncias médias. | Custo zero de GPU; melhora a precisão de profundidade na cena inteira. | **Não resolve sozinho superfícies estritamente coplanares** ($Y = 0{,}05\text{ m}$), pois os dois triângulos continuam tendo a mesma profundidade matemática. |
| **2. Deslocamento geométrico em Y ($\Delta Y = +0{,}025\text{ m}$)** | Eleva os vértices das faixas pintadas para $Y = 0{,}075\text{ m}$ (`MARKINGS_Y_OFFSET = 0.075` vs. `TRACK_Y_OFFSET = 0.05`). | Separação física real no espaço do mundo; simples e previsível. | Em distâncias grandes ($> 80\text{ m}$) e ângulos muito rasantes, $\Delta Y = 2{,}5\text{ cm}$ ainda pode cair na mesma faixa de quantização se $\text{far}/\text{near}$ for alto; se $\Delta Y$ for exagerado, a faixa parece flutuar. |
| **3. `polygonOffset` no material (`polygonOffsetFactor`, `polygonOffsetUnits`)** | Instrui o hardware (`glPolygonOffset`) a somar um viés de profundidade proporcional à inclinação do polígono ($\text{factor} \times DZ$) e à menor unidade do *Z-Buffer* ($\text{units} \times r$) **apenas durante o teste de profundidade**, sem mover o vértice na tela. | Resolve o empate mesmo em ângulos rasantes porque o termo `polygonOffsetFactor` escala com a derivada de profundidade do triângulo na tela ($DZ$). | Precisa ser configurado por material sobreposto (`markingsMat` e marcas de pneu `skidMesh`). |
| **4. `logarithmicDepthBuffer: true` no `WebGLRenderer`** | Substitui a distribuição $1/z$ por uma distribuição logarítmica no *Fragment Shader*, gravando `gl_FragDepth` manualmente. | Excelente para cenas em escala planetária ($\text{near} = 0{,}001$, $\text{far} = 10^9$). | Desativa otimizações de hardware de *Early-Z Test* na GPU (porque altera `gl_FragDepth` no fragment shader) e continua não resolvendo dois planos com distância exatamente idêntica. |

---

## 5. Solução Adotada e Justificativa

Adotamos uma **solução combinada em três camadas** (sem `logarithmicDepthBuffer`, preservando o *Early-Z* da GPU):

1. **Razão $\text{far}/\text{near}$ enxuta na câmera principal** ([`src/main.js`](../src/main.js)):
   - `CAMERA_NEAR = 0.5` e `CAMERA_FAR = 450` ($\text{far}/\text{near} = 900$). Como o carro fica a $8{,}5\text{ m}$ da câmera em 3ª pessoa e a cena inteira cabe em um raio de $\sim 220\text{ m}$, `near = 0.5` nunca corta o veículo e garante alta resolução de *Z-Buffer* em toda a pista.
2. **Pequena separação geométrica ($\Delta Y = 2{,}5\text{ cm}$)** ([`src/scene/track.js`](../src/scene/track.js)):
   - O asfalto fica em `TRACK_Y_OFFSET = 0.05` e as faixas pintadas em `MARKINGS_Y_OFFSET = 0.075`. Essa diferença de $2{,}5\text{ cm}$ é imperceptível como degrau, mas elimina a coplanaridade matemática a curta e média distância.
3. **`polygonOffset` ativo nos materiais sobrepostos à pista** ([`src/scene/track.js`](../src/scene/track.js) e [`src/game/effects.js`](../src/game/effects.js)):
   - Nas faixas brancas da pista: `polygonOffset: true`, `polygonOffsetFactor: -1`, `polygonOffsetUnits: -1`.
   - Nas marcas de pneu do drift (`skidMesh`): `polygonOffset: true`, `polygonOffsetFactor: -2`, `polygonOffsetUnits: -2` e `depthWrite: false`.
   - Isso garante uma hierarquia determinística no *Z-Buffer* (Asfalto $\rightarrow$ Faixas Brancas $\rightarrow$ Marcas de Pneu), mesmo a $150\text{ m}$ de distância e em ângulos rasantes.

---

## 6. Capturas de Tela de Evidência (`docs/img/`)

> **Instrução para a dupla (Caio e Davi)**: Com `npm run dev` aberto, usem a pasta **`Caso z-fighting`** do `lil-gui` para salvar as 3 capturas abaixo na pasta `docs/img/`:

1. **`docs/img/zfighting-antes.png`**:
   - Clique no botão **`1. Ativar bug + agravar near/far`** na pasta `Caso z-fighting`. Capture a tela mostrando as faixas brancas piscando/serrilhadas sobre o asfalto e o painel `lil-gui` aberto com `Simular bug` marcado.
2. **`docs/img/zfighting-depth.png`**:
   - Com o bug ainda ativo, pressione a tecla **`2`** (`[2] Profundidade`) e capture a visualização do *Depth Buffer*, onde o asfalto e as faixas disputam o mesmo tom de cinza.
3. **`docs/img/zfighting-depois.png`**:
   - Pressione **`2`** novamente para sair do modo de profundidade e clique em **`2. Aplicar correção (Y + offset)`**. Capture a mesma vista com as faixas brancas contínuas e estáveis.
