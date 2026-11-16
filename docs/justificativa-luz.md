# Justificativa de Iluminação e Sombras — Entrega M2

**Projeto:** Monaco Sunset GP  
**Disciplina:** Computação Gráfica — IFSP São João da Boa Vista  
**Dupla:** Caio Canalli e Davi Beli Rosa

---

## 1. Tabela das Luzes da Cena

Para compor o horário de pôr do sol no circuito de rua de Mônaco, combinamos **três tipos diferentes de luz** (`DirectionalLight`, `SpotLight` e `HemisphereLight`), calibrados em conjunto com `THREE.ACESFilmicToneMapping` (exposição `1.0`) e saída em `THREE.SRGBColorSpace`.

| Luz na Cena | Tipo (`THREE`) | Por que foi escolhida para esta cena | Cor (Hex) | Intensidade | Posição `(X, Y, Z)` | Projeta Sombra? Por quê? |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| **Sol Poente** | `DirectionalLight` | O sol está muito distante da Terra, portanto seus raios chegam paralelos a todos os objetos da cena. Com elevação baixa (`12,5°`) do lado do mar (oeste), cria sombras longas e alaranjadas características do fim de tarde. | `#ffb070` | `3.0` | `(-197.0, 45.5, -28.5)` mirando `(6, 0, 0)` | **Sim.** É a fonte primária dominante da cena exterior; sem a sombra direcional, o carro, os prédios e os barcos pareceriam flutuar sobre a pista e o porto. |
| **Poste 1 (Largada)** | `SpotLight` | Simula o facho cônico direcionado para baixo de uma luminária urbana (`angle ≈ 54,5°`, `penumbra = 0.55`, `decay = 2`, `distance = 34 m`) logo à frente da largada. | `#ffd9a0` | `240 cd` | `(-5.4, 7.0, 7.7)` | **Sim.** Fica no trecho principal de largada, projetando uma sombra local dinâmica quando o carro passa sob o poste. |
| **Poste 2 (Reta do Porto)** | `SpotLight` | Mesma luminária cônica iluminando o trecho norte da reta costeira junto ao cais, acompanhada de malha emissiva no bulbo para parecer acesa. | `#ffd9a0` | `240 cd` | `(-17.1, 7.0, -39.5)` | **Não.** Mantém o cone de luz na pista sem custo extra de passe de profundidade na GPU. |
| **Poste 3 (Curva Norte)** | `SpotLight` | Ilumina o contorno da curva fechada norte (inspirada na Sainte Dévote), guiando visualmente a freada do jogador. | `#ffd9a0` | `240 cd` | `(18.0, 7.0, -90.8)` | **Não.** Poupa shadow maps adicionais em um trecho onde a sombra do sol já define bem o volume. |
| **Poste 4 (Grampo Central)** | `SpotLight` | Destaca o ápice interno da curva mais fechada do circuito (inspirada no Fairmont Hairpin), onde o carro passa em baixa velocidade. | `#ffd9a0` | `240 cd` | `(0.6, 7.0, -2.8)` | **Sim.** Como o carro contorna o grampo lentamente bem debaixo do facho, a sombra projetada valoriza a percepção espacial da manobra. |
| **Poste 5 (Reta Leste-Sul)** | `SpotLight` | Cria contraste de luz branca quente sobre o asfalto escuro ao lado dos prédios de Monte Carlo (sombreados pelo fim de tarde). | `#ffd9a0` | `240 cd` | `(41.9, 7.0, 46.3)` | **Não.** Evita multiplicar passes de renderização da cena. |
| **Poste 6 (Curva Sul)** | `SpotLight` | Fecha o anel de iluminação artificial na curva sul (Rascasse), retornando à reta do porto. | `#ffd9a0` | `240 cd` | `(9.6, 7.0, 92.3)` | **Não.** Mantém o orçamento de apenas 2 spots com sombra no circuito todo. |
| **Preenchimento de Céu** | `HemisphereLight` | Substitui uma `AmbientLight` chapada: ilumina faces voltadas para cima com o tom rosado/laranja da abóbada celeste e faces voltadas para baixo com o azul escuro refletido pelo mar e pelo asfalto. | Céu: `#ff9e7a` <br> Chão: `#1e273c` | `0.45` | `(0, 120, 0)` (direção zenital) | **Não.** O `HemisphereLight` representa luz difusa indireta vinda de todo o céu, não possuindo um ponto focal único para gerar sombra dura. |

> **Nota sobre unidades físicas nos `SpotLights`:** Na versão instalada do Three.js (`v0.186.1`), luzes pontuais e `SpotLight` operam em unidades físicas (**candelas**, com atenuação quadrática `decay = 2`). Como as luminárias ficam a `~7,0 m` de altura acima do asfalto, uma intensidade de `240 cd` resulta em iluminância $E = I / d^2 \approx 240 / 49 \approx 4,9\text{ lux}$ no centro do cone, suficiente para se destacar sobre o asfalto cinza escuro sem estourar o branco graças ao `ACESFilmicToneMapping`.

---

## 2. Parâmetros de Sombra do Sol (`DirectionalLightShadow`)

- **Tipo de Shadow Map (`THREE.PCFShadowMap` no Three.js `r186`):**  
  Nas versões atuais do Three.js (`r182+` / `v0.186.1`), a constante antiga `PCFSoftShadowMap` foi descontinuada e unificada dentro do próprio `THREE.PCFShadowMap`, que agora realiza filtragem suave por amostragem em **disco de Vogel de 5 amostras** (*Percentage-Closer Filtering* com ruído gradiente intercalado) controlada por `shadow.radius`. No painel `lil-gui`, deixamos um seletor para comparar `PCF (Suave)` com `BasicShadowMap` (sem filtragem, bordas serrilhadas).
- **`mapSize = 2048` (`2048 × 2048` texels):**  
  Foi o melhor equilíbrio entre nitidez e custo de memória/GPU. Em `512 × 512`, a sombra do carro (`4,5 m` de comprimento) fica visivelmente quadriculada; em `2048 × 2048`, cada texel cobre cerca de `12 cm` na horizontal e `8 cm` na vertical, deixando o contorno do carro, dos postes e dos iates bem definido. Já `4096 × 4096` quadruplica o consumo de VRAM e o custo de escrita de fragmentos com ganho visual pequeno na câmera em 3ª pessoa.
- **Limites da `shadow.camera` ortográfica (`left = -125`, `right = 125`, `top = 85`, `bottom = -75`, `near = 55`, `far = 365`):**  
  Como o `DirectionalLight` usa projeção ortográfica para o mapa de sombra, uma caixa grande demais (ex.: `±1000`) desperdiçaria a maior parte da textura `2048 × 2048` fora do mapa, deixando as sombras borradas. Ajustamos o volume ortográfico (visível pelo `Shadow CameraHelper` no painel) exatamente ao redor da área útil da cena: barcos no porto (`X ≈ -80`), pista central e prédios de Monte Carlo (`X ≈ +80`, `Z ∈ [-112, +112]`, altura até `40 m`).
- **`bias = -0.0004` e `normalBias = 0.04`:**  
  Como o sol poente incide em ângulo muito rasante (`12,5°` de elevação), os raios quase tangenciam o plano da pista e do terreno. Sem correção (`bias = 0` e `normalBias = 0`), a imprecisão discreta do buffer de profundidade faz a superfície sombrear a si mesma, criando listras escuras na pista (**shadow acne**). Por outro lado, usar apenas um `bias` negativo exagerado (ex.: `-0.012`) empurra a comparação de profundidade longe demais e faz a sombra "descolar" das rodas do carro (**peter-panning**). Combinar um `bias` mínimo (`-0.0004`) com `normalBias = 0.04` (que desloca o ponto amostrado ao longo da normal da malha) elimina o *shadow acne* mantendo a sombra colada na base do carro.
- **`radius = 2.0`:**  
  Controla o raio de espalhamento das amostras PCF na borda da sombra, suavizando o serrilhado residual e simulando uma leve penumbra de fim de tarde sem borrar objetos pequenos como os postes.

---

## 3. Por que só 2 `SpotLights` projetam sombra e por que o `HemisphereLight` não?

1. **Apenas 2 dos 6 `SpotLights` com `castShadow = true`:**  
   No algoritmo de *Shadow Mapping*, cada luz que projeta sombra exige **um passe extra de renderização de profundidade** da geometria a partir do ponto de vista daquela luz a cada quadro, além de alocar uma textura de profundidade dedicada e adicionar leituras extras de textura (`sampler2DShadow`) no *fragment shader* de todos os materiais iluminados. Se os 6 postes projetassem sombra simultaneamente (somados ao sol), teríamos **7 passes de sombra por frame**, aumentando drasticamente os *Draw Calls* e o custo de fragmento para um ganho visual mínimo nos trechos distantes. Escolhemos manter sombra apenas no **Poste 1 (Largada)** e no **Poste 4 (Grampo Central)**, onde a interação próxima com o carro é mais perceptível, usando lâmpadas emissivas nos demais 4 postes para manter a coerência visual.
2. **Por que o `HemisphereLight` não projeta sombra:**  
   Do ponto de vista físico e matemático, o `HemisphereLight` não é uma fonte pontual nem direcional: ele aproxima a irradiância difusa vinda de **todas as direções do hemisfério superior (céu)** e **inferior (chão)** interpolando duas cores pelo produto escalar da normal da superfície com o eixo vertical. Como não existe uma origem ou direção única de raios para montar uma câmera de profundidade (`shadow.camera`), o Three.js não implementa *shadow mapping* para `HemisphereLight`.

---

## 4. O que Testamos (Medições no Painel)

Com o carro parado na posição inicial de largada (`X = -10, Z = 22`, olhando para o Norte `-Z`, Frustum Culling **ON**), medimos no HUD (`renderer.info` da Vista 1) o impacto das sombras nos contadores de renderização:

> **Instrução para a dupla:** Confiram e preencham os valores abaixo no navegador (`http://localhost:5173`) após colocarem os arquivos definitivos `car.obj`, `boat.glb` e `building.glb` da Kenney na pasta `public/models/`, pois o número exato de triângulos depende da malha escolhida em cada kit.

| Cenário Testado no Painel `"Luz"` | Draw Calls (Vista 1) | Triangles (Vista 1) | FPS Médio | Observação Visual e Técnica |
| :--- | :---: | :---: | :---: | :--- |
| **1. Sombras Globais DESLIGADAS** (`Sombras Globais = OFF`) | `A PREENCHER` *(ref. placeholder: ~64)* | `A PREENCHER` *(ref. placeholder: ~3.900)* | `A PREENCHER` | Apenas o passe principal da câmera do jogador é desenhado. O carro e os prédios perdem ancoragem visual com o chão. |
| **2. Só Sombra do Sol LIGADA** (`Sol = ON`, `Sombra 2 Postes = OFF`) | `A PREENCHER` *(ref. placeholder: ~145)* | `A PREENCHER` *(ref. placeholder: ~12.800)* | `A PREENCHER` | Os *Draw Calls* mais que dobram porque a `shadow.camera` ortográfica do sol enxerga praticamente todos os prédios, barcos e postes do mapa para gerar o mapa de profundidade. |
| **3. Sol + 2 Postes com Sombra LIGADOS** (Estado padrão M2) | `A PREENCHER` *(ref. placeholder: ~158)* | `A PREENCHER` *(ref. placeholder: ~14.100)* | `A PREENCHER` | Crescimento moderado em relação ao cenário 2, pois os `SpotLights` têm alcance curto (`distance = 34 m`) e só renderizam no shadow map os poucos objetos dentro de seus cones locais. |
| **4. Sombra do Sol com `mapSize = 512` vs `2048` vs `4096`** | Mesmo nº de *Draw Calls* do cenário 3 | Mesmo nº de *Triangles* do cenário 3 | `512`: `A PREENCHER` <br> `2048`: `A PREENCHER` <br> `4096`: `A PREENCHER` | Mudar `mapSize` **não altera** *Draw Calls* nem *Triangles* (a geometria enviada no vertex shader é a mesma), mas altera o *fill-rate* e a nitidez: em `512` as bordas ficam serrilhadas/blocadas; em `2048` ficam nítidas; em `4096` o ganho visual é sutil frente ao custo 4× maior de pixels na textura de sombra. |

### Roteiro rápido das medições que a dupla deve fazer:
1. Abrir o projeto sem mexer no carro (posição inicial) e anotar `Draw Calls`, `Triangles` e `FPS` no estado padrão (**Cenário 3**).
2. Desmarcar `Sombra (2 Postes)` na pasta `Luz -> Postes da Pista` e anotar os valores (**Cenário 2**).
3. Desmarcar `Sombras Globais` no topo da pasta `Luz` e anotar os valores (**Cenário 1**).
4. Religar `Sombras Globais` e `Sombra (2 Postes)`, trocar `mapSize (Resolução)` entre `512`, `2048` e `4096`, observar a sombra do carro no asfalto e registrar o FPS (**Cenário 4**).

---

## 5. Lista de Capturas de Tela para o Relatório / Apresentação

Na pasta **`Luz -> Sombra do Sol`** do painel `lil-gui`, incluímos três botões de teste rápido para facilitar a captura padronizada das imagens exigidas:

- [ ] **Captura 1 — Sem Sombra (`docs/prints/m2-1-sem-sombra.png`):** Desmarcar `Sombras Globais` no topo da pasta `Luz`, mostrando como o carro, o pórtico e os prédios parecem "soltos" sobre o terreno.
- [ ] **Captura 2 — Com *Shadow Acne* (`docs/prints/m2-2-shadow-acne.png`):** Religar `Sombras Globais` e clicar no botão **`Teste: Shadow Acne (0)`** (`bias = 0`, `normalBias = 0`), evidenciando os padrões listrados de auto-sombreamento no asfalto e no terreno sob o sol baixo.
- [ ] **Captura 3 — Com *Peter-Panning* (`docs/prints/m2-3-peter-panning.png`):** Clicar no botão **`Teste: Peter-Panning`** (`bias = -0.012`, `normalBias = 0`), aproximando ou olhando para o carro e os postes para mostrar a sombra deslocada/descolada da base dos objetos.
- [ ] **Captura 4 — Ajuste Final Calibrado (`docs/prints/m2-4-ajuste-final.png`):** Clicar em **`Restaurar Ajuste Ideal`** (`bias = -0.0004`, `normalBias = 0.04`, `radius = 2.0`, `mapSize = 2048`), mostrando sombras limpas, sem acne e coladas na base do carro e sob o cone do Poste 1.
- [ ] *(Opcional recomendada)* **Captura 5 — Helpers Ativos (`docs/prints/m2-5-helpers.png`):** Ligar `Shadow CameraHelper (Sol)` e `SpotLightHelpers (Postes)` (combinado com a Tecla `4` da vista aérea) para ilustrar na defesa que o volume ortográfico do sol envolve o mapa sem desperdício de resolução.

---

## 6. Parágrafo Pronto para a Seção "Decisões Técnicas" do `README.md`

> **Iluminação e Sombras (M2):** A cena de pôr do sol combina três tipos distintos de luz calibrados com `ACESFilmicToneMapping` e saída `SRGBColorSpace`: um `DirectionalLight` quente (`#ffb070`) em baixa elevação (`12,5°`) vindo do lado do mar como fonte primária de sombras longas; seis `SpotLights` brancos quentes (`#ffd9a0`, `240 cd`, `decay = 2`) nos postes ao longo do circuito com lâmpadas emissivas, dos quais apenas dois projetam sombra (`512×512`) para equilibrar realismo local e custo de passes extras de profundidade; e um `HemisphereLight` suave (`#ff9e7a` / `#1e273c`, intensidade `0.45`) como preenchimento atmosférico indireto em substituição a uma luz ambiente plana. Na sombra do sol, utilizamos filtragem `PCFShadowMap` suave (`radius = 2.0`) em `2048×2048` com câmera ortográfica ajustada sob medida aos limites do mapa (`[-125, 125] × [-75, 85]`) para maximizar a densidade de texels, combinando `bias = -0.0004` e `normalBias = 0.04` para eliminar o *shadow acne* sob luz rasante sem provocar *peter-panning* na base do carro.
