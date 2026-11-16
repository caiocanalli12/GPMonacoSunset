# Justificativa de Texturas, Materiais e Ambiente — Entrega M3

**Projeto:** Monaco Sunset GP  
**Disciplina:** Computação Gráfica — IFSP São João da Boa Vista  
**Dupla:** Caio Canalli e Davi Beli Rosa

---

## 1. Tabela dos Materiais da Cena

Implementamos **7 materiais distintos** baseados no modelo físico de sombreamento PBR (`THREE.MeshStandardMaterial`), superando a meta de 5 materiais da disciplina:

| Material | Objeto(s) na Cena | Tipo (`THREE`) | Mapas Usados | `roughness` | `metalness` | `normalScale` | Por que esses valores foram escolhidos? |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| **1. Asfalto** | Faixa da pista (`FaixaAsfalto`) | `MeshStandardMaterial` | `map` (cor) + `normalMap` + `roughnessMap` | `1.0` *(multiplicador do mapa)* | `0.0` | `(0.75, 0.75)` | O asfalto é um material dielétrico (`metalness = 0`). Deixamos `roughness = 1.0` para que o `roughnessMap` controle inteiramente a variação microscópica entre os grãos de brita e o piche sob a luz rasante do sol e dos postes. |
| **2. Pedra / Concreto** | Cais principal e 4 píeres (`CaisPrincipal`, `Pier_1..4`) | `MeshStandardMaterial` | `map` (cor) + `normalMap` + `roughnessMap` | `0.88` | `0.04` | `(0.85, 0.85)` | Blocos de pedra/concreto portuário têm superfície áspera e porosa (`roughness = 0.88`) com sulcos nas juntas (`normalScale = 0.85`), que ganham contraste lateral com o sol baixo a `12,5°`. |
| **3. Terreno Urbano** | Solo de Monte Carlo (`TerrenoMonteCarlo`) | `MeshStandardMaterial` | `map` (cor) + `normalMap` + `roughnessMap` | `0.95` | `0.0` | `(0.65, 0.65)` | O solo ao redor dos quarteirões deve espalhar a luz de forma quase totalmente difusa (`roughness = 0.95`) para não competir com o brilho especular da água nem do carro. |
| **4. Água do Porto** | Mar (`MarPorto`) | `MeshStandardMaterial` | `normalMap` animado com `dt` + `envMap` (`scene.environment`) | `0.14` | `0.0` | `(0.16, 0.16)` | A água é dielétrica (`metalness = 0`) e tem rugosidade baixa (`0.14`, dentro da faixa `0.05–0.15`), refletindo suavemente o pôr do sol gerado pelo `PMREMGenerator` com ondulação calma (`normalScale = 0.16`) sem criar faixas serrilhadas. |
| **5. Carro (Carroceria, Vidros e Pneus)** | Veículo do jogador (`CarroJogador`, convertido de `OBJ+MTL`) | `MeshStandardMaterial` | `map` original do modelo + `scene.environment` | Carroceria: `0.28` <br> Vidros: `0.08` <br> Pneus: `0.92` | Carroceria: `0.82` <br> Vidros: `0.15` <br> Pneus: `0.05` | — | Convertido via `traverse` a partir do `MeshPhongMaterial` do `MTLLoader`. A pintura metálica automotiva (`metalness = 0.82`, `roughness = 0.28`) reflete o horizonte alaranjado do skybox; os vidros são altamente polidos (`0.08`) e os pneus de borracha são foscos (`0.92`). |
| **6. Casco dos Barcos** | 14 iates ancorados (`Barco_1..14`, `GLB`) | `MeshStandardMaterial` | `map` original do GLB + `scene.environment` | `0.26` | `0.08` | — | Cascos náuticos de fibra de vidro com pintura *gelcoat* não são metálicos (`0.08`), mas possuem camada de verniz brilhante (`roughness = 0.26`) que reflete a luz solar à beira-mar. |
| **7. Prédios e Janelas Emissivas** | 26 edifícios de Monte Carlo (`Predio_1..26`, `GLB`) | `MeshStandardMaterial` | `map` original do GLB + `emissive` nas janelas (`#ffaa44`) | Fachada: `0.86` <br> Janelas: `0.15` | Fachada: `0.04` <br> Janelas: `0.20` | — | Paredes de concreto/reboco são foscas (`0.86`), enquanto as faixas de janelas são lisas (`0.15`) e possuem emissão quente (`#ffaa44`, intensidade `1.1`) para simular os prédios se acendendo ao entardecer. |

---

## 2. UV e Repetição de Textura (Por que usar Comprimento de Arco na Pista?)

### Cálculo dos UVs da Pista (`src/scene/track.js`)
A malha da pista é gerada proceduralmente ao longo de uma curva fechada `THREE.CatmullRomCurve3` com `260` subdivisões e largura $W = 11,0\text{ m}$.  
Se tivéssemos definido a coordenada longitudinal $V$ usando apenas o índice da fatia ou o parâmetro bruto $t$ da spline, os ladrilhos da textura ficariam **comprimidos nas curvas fechadas** (como no grampo central, onde os pontos de controle são próximos) e **esticados nas retas longas** (como na reta do porto).

Para evitar qualquer distorção, calculamos o **comprimento de arco acumulado real** ($s_i$, em metros) somando a distância euclidiana entre cada amostra consecutiva $P_i$:

$$s_0 = 0, \qquad s_i = \sum_{k=1}^{i} \|P_k - P_{k-1}\|, \qquad L_{\text{total}} = s_{260} = 431,24\text{ m}$$

Em cada fatia $i$ da geometria, gravamos:
- **$U \in [0, 1]$ no sentido da largura:** $U = 0$ na borda esquerda e $U = 1$ na borda direita;
- **$V \in [0, 1]$ no sentido do comprimento:** $V_i = \frac{s_i}{L_{\text{total}}}$, diretamente proporcional à distância percorrida em metros.

Em seguida, configuramos o `repeat` da textura do asfalto mantendo a razão exata $\frac{L_{\text{total}}}{W} = \frac{431,24}{11,0} \approx 39,20$:
- Com `repeat.x = 2.0` (2 repetições na largura de `11 m`, ou seja, **$5,5\text{ m}$ por ladrilho**), definimos automaticamete `repeat.y = 2.0 × 39.20 = 78.4` ($431,24\text{ m} / 78,4 = \mathbf{5,5\text{ m}}$ por ladrilho no comprimento).
- Assim, cada ladrilho de textura na pista é um **quadrado perfeito de $5,5\text{ m} \times 5,5\text{ m}$** tanto nas retas quanto no grampo fechado, o que pode ser verificado ligando o toggle **`Visualizar UV (Xadrez)`** no painel.

### Repetição nas demais superfícies
- **Pedra / Cais (`4 m × 320 m`):** `repeat = (3, 45)` ($\approx 7,1\text{ m}$ por repetição longitudinal). Nos 4 píeres transversais (`36 m` de comprimento), escalamos os atributos UV na proporção $36/320$ para que os blocos de pedra tenham exatamente o mesmo tamanho físico do cais principal.
- **Terreno (`180 m × 320 m`):** `repeat = (24, 42)` ($\approx 7,5\text{ m} \times 7,6\text{ m}$ por repetição).
- **Água (`220 m × 320 m`):** `repeat = (18, 26)` com deslocamento contínuo `texture.offset += velocidade * dt` para simular o movimento das ondas independente da taxa de quadros.

---

## 3. Espaços de Cor (`SRGBColorSpace` vs `NoColorSpace`)

No pipeline PBR do Three.js, os cálculos de iluminação nos shaders acontecem em **espaço de cor linear** (onde dobrar o número de fótons dobra exatamente o valor numérico da radiância).

1. **Por que apenas os mapas de cor (`color.jpg` / `map`) usam `THREE.SRGBColorSpace`?**  
   Imagens fotográficas e texturas de cor são salvas com compressão gama sRGB ($\gamma \approx 2,2$) porque o olho humano é mais sensível a tons escuros. Ao marcar `texture.colorSpace = THREE.SRGBColorSpace`, instruímos a GPU a **desfazer a curva gama** ($C_{\text{linear}} \approx C_{\text{sRGB}}^{2,2}$) ao ler o texel no shader, antes de multiplicá-lo pela luz. Se deixássemos um mapa de cor em espaço linear, as cores ficariam esbranquiçadas e lavadas.
2. **Por que `normalMap` e `roughnessMap` DEVEM ficar em `THREE.NoColorSpace` (linear)?**  
   Esses arquivos **não representam cores**, mas sim **dados matemáticos gravados nos canais de uma imagem**:
   - No `normalMap`, os canais $(R, G, B) \in [0, 255]$ codificam linearmente as componentes $(N_x, N_y, N_z) \in [-1, +1]$ do vetor normal unitário através da fórmula $N = 2 \cdot \text{texel} - 1$. Um vetor normal reto para cima $(0, 0, 1)$ corresponde a $(0.5, 0.5, 1.0)$ (o tom azul-lilás `#8080ff`). Se aplicássemos `SRGBColorSpace` num normal map, a decodificação gama transformaria $0.5$ em $0.5^{2,2} \approx 0.217$, entortando todas as normais da superfície para o lado!
   - No `roughnessMap`, o canal armazena diretamente o escalar físico de rugosidade $\alpha \in [0, 1]$; aplicar curva gama tornaria superfícies médias artificialmente lisas e brilhantes.

---

## 4. Normal Map × Bump Map

| Característica | Bump Map (`bumpMap`) | Normal Map (`normalMap` — Padrão OpenGL / NormalGL) |
| :--- | :--- | :--- |
| **O que armazena** | Apenas **1 canal (escala de cinza)** representando a altura relativa (elevação/depressão) de cada texel. | **3 canais (RGB)** representando diretamente a direção do vetor normal $(N_x, N_y, N_z)$ no espaço tangente da superfície. |
| **Como funciona no shader** | O fragment shader precisa amostrar vizinhos para estimar a inclinação (derivada numérica) em tempo de execução. | O shader lê o vetor 3D pronto em uma única amostragem de textura e o transforma pela matriz **TBN** (*Tangent-Bitangent-Normal*). |
| **Vantagem visual** | Simples de criar a partir de qualquer imagem P&B, mas menos preciso em chanfros e vincos direcionais. | Muito mais preciso: consegue representar a orientação exata de cada micro-faceta em X, Y e Z sob luz rasante. |

**O que escolhemos e por quê:**  
Utilizamos **Normal Maps no padrão OpenGL (`NormalGL`, canal verde $+Y$ apontando para cima)** em todas as quatro superfícies principais (asfalto, pedra do cais, terreno e água). Como a nossa cena se passa ao pôr do sol com o `DirectionalLight` em elevação muito baixa (`12,5°`), a luz incide quase paralelamente ao chão: o produto escalar $\max(\vec{N} \cdot \vec{L}, 0)$ varia intensamente com pequenas inclinações de $\vec{N}$ no `normalMap`, criando a sensação convincente de pedriscos no asfalto, juntas nos blocos do cais e marolas na água **sem adicionar nenhum triângulo extra à geometria**.

---

## 5. Ambiente Coerente (`Sky`, `PMREMGenerator`, `Fog` e `Tone Mapping`)

Para que o céu, o sol, a névoa, a água e os materiais metálicos pareçam pertencer ao mesmo mundo físico:

1. **Céu Analítico (`Sky.js`) calibrado para Crepúsculo / Meia-Luz:** Substituímos a cor de fundo estática pelo `Sky` (`turbidity = 4.5`, `rayleigh = 3.6`, `mieDirectionalG = 0.86`, `cloudCoverage = 0.0`). Como o modelo analítico padrão de Preetham usa uma constante solar interna muito alta (`EE = 1000.0`) que estoura para branco em `12,5°` de elevação sob `ACESFilmicToneMapping`, atenuamos a luminância bruta no shader do `Sky` e modulamos o gradiente crepuscular (`#d96b43` terracota no horizonte -> púrpura -> `#262c4f` azul-noite no zênite, mais a auréola dourada `#ecb74f` na direção `cosTheta` do sol) e escurecemos o hemisfério inferior (`direction.y < 0`) para eliminar reflexos brancos na água. Quando mudamos a **Elevação** ou o **Azimute** do sol na pasta `"Luz"`, o disco solar, a auréola atmosférica e a direção das sombras continuam sincronizados.
2. **Mapa de Reflexo com `PMREMGenerator` (`scene.environment`):**  
   Materiais metálicos (como a carroceria do carro com `metalness = 0.82`) têm refletância difusa quase nula e dependem de refletir o ambiente ao redor (*Image-Based Lighting*). Usamos `THREE.PMREMGenerator` para pré-filtrar a cúpula do `Sky` em diferentes níveis de rugosidade (*mipmaps GGX*) e atribuímos o resultado a `scene.environment` com `scene.environmentIntensity = 0.26` (e `envMapIntensity` mais alto apenas no carro e na água) para que a cena mantenha a meia-luz dramática do M2 e o destaque dos postes `SpotLight` sem lavar as sombras.  
   **Cuidado de desempenho:** Gerar o mapa PMREM envolve renderizar 6 faces de cubemap e aplicar filtros de convolução. Por isso, `regenerateEnvironmentMap()` é chamado **apenas uma vez na inicialização e no callback `.onFinishChange()` dos sliders do sol**, nunca dentro do loop de animação por frame.
3. **Integração com `Fog` e `ACESFilmicToneMapping`:**  
   A cor da névoa (`#d96b43`, `near = 75`, `far = 295`) foi calibrada com a cor exata da faixa do horizonte produzida pelo `Sky` em baixa elevação, dissolvendo a borda distante do mar e do terreno sem linha divisória aparente. Já o `ACESFilmicToneMapping` (`exposure = 0.88`) preserva a atmosfera de fim de tarde sem estourar os canais RGB.

---

## 6. O que Testamos (Medições no Painel `"Materiais"`)

> **Instrução para a dupla:** Após colocarem as texturas definitivas (`1K` ou `2K`) em `public/textures/` e os modelos em `public/models/`, confiram e preencham os valores medidos no HUD (`Textures (GPU)` e `FPS`) na tabela abaixo.

| Teste Realizado na Pasta `"Materiais"` | `Textures (GPU)` (`renderer.info.memory.textures`) | FPS Médio | Efeito Visual Observado |
| :--- | :---: | :---: | :--- |
| **1. Modo "Sem Texturas (Sólido)" LIGADO** | `A PREENCHER` *(ref. fallback: ~16)* | `A PREENCHER` | Todos os mapas (`map`, `normalMap`, `roughnessMap`) são desconectados. A pista, o cais e a água ficam lisos e chapados, perdendo a sensação de escala e micro-relevo. |
| **2. Apenas Mapa de Cor (`map` ON, `normalMap` OFF, `roughnessMap` OFF)** | `A PREENCHER` | `A PREENCHER` | A cor das superfícies aparece, mas o brilho especular na pista e no cais é uniforme como plástico liso, sem relevo sob a luz rasante. |
| **3. Adicionando `normalMap` ON (`normalScale = 1.1` a `1.3`)** | `A PREENCHER` | `A PREENCHER` | Surgem imediatamente as micro-sombras dos grãos do asfalto, das juntas de pedra do cais e das ondas na água, sem aumentar a contagem de `Triangles` no HUD! |
| **4. Completo (`map` + `normalMap` + `roughnessMap` ON)** | `A PREENCHER` | `A PREENCHER` | O `roughnessMap` quebra o reflexo especular de maneira irregular (partes foscas vs partes levemente polidas no asfalto e na pedra), dando aspecto realista sob o sol poente. |
| **5. Comparação de Resolução de Texturas (`1K` vs `2K`)** | Mesmo nº de objetos `WebGLTexture` | `1K`: `A PREENCHER` <br> `2K`: `A PREENCHER` | Texturas `2K` (`2048×2048`) consomem **4× mais memória de vídeo (VRAM)** por arquivo do que `1K` (`1024×1024`). Como usamos `RepeatWrapping` com filtro anisotrópico e mipmaps, `1K` já entrega excelente nitidez próxima ao carro com carregamento mais leve. |

### Roteiro de medições para a dupla:
1. Observar no HUD o contador **`Textures (GPU)`** e o **`FPS`** com todas as texturas ativas.
2. Na pasta `"Materiais"`, marcar **`Sem Texturas (Sólido)`** e comparar visualmente o asfalto, o cais e a água.
3. Desmarcar `"Sem Texturas"`, abrir a subpasta **`1. Asfalto (Pista)`** e ligar/desligar individualmente `Mapa de Cor (map)`, `Normal Map` e `Roughness Map`, movendo também o slider `normalScale` de `0.0` até `2.5`.
4. Marcar **`Visualizar UV (Xadrez)`** e dirigir pela curva norte e pelo grampo central para verificar que os quadrados numerados `A1..D4` mantêm proporção quadrada constante sem esticar.

---

## 7. Lista de Capturas de Tela para o Relatório / Defesa

- [ ] **Captura 1 — Com e Sem Normal Map (`docs/prints/m3-1-sem-normal.png` e `m3-1-com-normal.png`):** Na subpasta `1. Asfalto (Pista)` e `2. Pedra (Cais)`, tirar um print com `Normal Map` desligado e outro com `Normal Map` ligado (`normalScale = 1.3`), mostrando o relevo sob o sol baixo.
- [ ] **Captura 2 — Roughness Baixa vs. Alta (`docs/prints/m3-2-roughness-baixa.png` e `m3-2-roughness-alta.png`):** Na subpasta `4. Água` ou `5. Carroceria`, comparar `roughness = 0.05` (reflexo espelhado nítido do pôr do sol) contra `roughness = 0.90` (superfície fosca/difusa).
- [ ] **Captura 3 — Visualização de UV (`docs/prints/m3-3-visualizar-uv.png`):** Ligar o toggle **`Visualizar UV (Xadrez)`** no topo da pasta `Materiais`, mostrando o padrão xadrez numerado alinhado sem distorção ao longo da curva da pista e do cais.
- [ ] **Captura 4 — Antes e Depois do Ambiente/Texturas (`docs/prints/m3-4-antes-solido.png` e `m3-4-depois-completo.png`):** Comparar o toggle **`Sem Texturas (Sólido)`** ligado (e `Reflexo Env = 0`) com o estado completo do M3 (texturas PBR + `Sky` + reflexo PMREM na água e no carro).

---

## 8. Parágrafo Pronto para a Seção "Decisões Técnicas" do `README.md`

> **Texturas, Materiais PBR e Ambiente Coerente (M3):** Evoluímos a cena para sete materiais distintos baseados em `MeshStandardMaterial`: asfalto, pedra portuária e terreno com mapas de cor (`SRGBColorSpace`), relevo (`normalMap` OpenGL em `NoColorSpace`) e rugosidade (`roughnessMap` em `NoColorSpace`), configurados com `RepeatWrapping`, mipmaps trilineares e filtragem anisotrópica máxima; água marítima de baixa rugosidade (`0.09`) com `normalMap` animado em função do `delta` do `THREE.Timer`; carroceria metálica (`metalness = 0.82`, `roughness = 0.28`), barcos e prédios convertidos via `traverse` preservando os mapas UV originais, com janelas emissivas quentes para o entardecer. Para evitar estiramento da textura nas curvas fechadas da pista, calculamos a coordenada $V$ proporcional ao comprimento de arco acumulado da `CatmullRomCurve3` ($431,24\text{ m}$). O fundo plano foi substituído pelo céu analítico `Sky` sincronizado à elevação e ao azimute do sol, gerando um mapa de reflexo via `PMREMGenerator` (`scene.environment`, atualizado apenas em `onFinishChange`) que unifica a temperatura de cor entre céu, `Fog`, água e pintura metálica do carro.
