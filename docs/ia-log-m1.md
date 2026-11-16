# Log de Transparência de IA — Entrega M1 (Pipeline de Visualização)

**Projeto:** Monaco Sunset GP  
**Disciplina:** Computação Gráfica (IFSP São João da Boa Vista)  
**Dupla:** Caio Canalli e Davi Beli Rosa

---

## 1. O que foi gerado

A estrutura do marco **M1** foi organizada em módulos independentes em JavaScript puro (ES Modules) com **Three.js (`v0.186.1`)**, **Vite (`v8.3.4`)** e **`lil-gui` (`v0.21.0`)**:

1. **`index.html` e `package.json`**:
   - Configuração do Vite sem frameworks adicionais;
   - HUD em HTML/CSS sobreposto ao canvas WebGL exibindo em tempo real: **FPS**, **Draw Calls (vista 1)**, **Triangles (vista 1)**, estado do **Frustum Culling** e velocidade do carro em `m/s`;
   - Divisória visual (`#split-screen-ui`) que aparece quando o modo de tela dividida (Item 4) é ativado.

2. **`src/main.js` (Inicialização e Loop de Renderização)**:
   - Criação da `THREE.Scene`, `THREE.WebGLRenderer`, câmera principal em 3ª pessoa (`playerCamera`) e câmera aérea de topo (`topCamera`);
   - Controle de tempo com `THREE.Timer` (importado diretamente do core `'three'`, onde reside a partir das versões recentes do Three.js);
   - Chamada única a `timer.update(timestamp)` por quadro executado, seguida de `timer.getDelta()` limitado por `Math.min(rawDelta, 0.1)`.

3. **`src/scene/environment.js` (Ambiente Base e Iluminação Mínima)**:
   - Fundo (`scene.background`) e névoa linear (`THREE.Fog`) alaranjados simulando o entardecer em Mônaco;
   - Iluminação mínima para legibilidade das formas no M1: `THREE.HemisphereLight` (céu quente / chão escuro) + `THREE.DirectionalLight` baixa posicionada do lado do mar (`X = -210, Y = 34, Z = -25`), acompanhada de uma esfera com `MeshBasicMaterial({ fog: false })` representando o sol no horizonte;
   - Separação espacial clara: plano de água azul a oeste (`X < -24`), cais de concreto com 4 píeres no centro (`X ≈ -23`) e terreno urbano a leste (`X > -22`).

4. **`src/scene/track.js` (Circuito Fechado sobre Curva Paramétrica)**:
   - Traçado fechado gerado por `THREE.CatmullRomCurve3` com 13 pontos de controle e parametrização `'centripetal'`, reproduzindo o desenho do documento **M0** (reta do porto, curva Norte Sainte Dévote, grampo central Fairmont Hairpin e curva Sul Rascasse);
   - Geração procedural de `THREE.BufferGeometry` em formato de fita plana (`createRibbonGeometry`): para cada amostra $u \in [0, 1]$, calcula-se o ponto $P(u)$, o vetor tangente unitário $T(u)$ e o vetor lateral perpendicular no plano XZ ($S = T \times \hat{y}$), posicionando os vértices esquerdo e direito a $\pm \text{largura}/2$;
   - Pórtico de largada com faixa suspensa (`PlaneGeometry` simples) para facilitar a demonstração visual do **Back-face Culling (Item 3)**.

5. **`src/scene/models.js` (Loaders, Normalização por `Box3` e 40 Clones)**:
   - Carregamento de 3 formatos/arquivos distintos:
     - `public/models/car/car.obj` (+ `car.mtl` e textura `.png`) via `MTLLoader` e `OBJLoader`;
     - `public/models/boat/boat.glb` via `GLTFLoader`;
     - `public/models/building/building.glb` via `GLTFLoader`.
   - Verificação prévia com `fetch(..., { method: 'HEAD' })` validando `Content-Type` para evitar que o fallback HTML do Vite quebre os loaders quando os arquivos não estiverem presentes, caindo automaticamente em placeholders de caixas coloridas com `console.warn`;
   - Função `normalizeModelByBox3` que mede a caixa envolvente (`THREE.Box3`), aplica escala uniforme para atingir os tamanhos-alvo (`4,5 m` para o carro, `12 m` para o barco e `28 m` base para o prédio), centraliza $X$ e $Z$ em $0$ e apoia a base em $Y = 0$;
   - Instanciação via `.clone(true)` de **14 barcos** no porto e **26 prédios** em Monte Carlo (**40 instâncias** no total, superando o mínimo de 30 objetos).

6. **`src/controls/carController.js` (Movimento e Câmera Independentes de FPS)**:
   - Controle por `WASD` e `Setas` com velocidade linear em `m/s` e rotação em `rad/s`, integradas por `dt`;
   - Restrição de área navegável (`THREE.MathUtils.clamp`) impedindo que o carro caia na água ou saia do terreno;
   - Câmera em 3ª pessoa suavizada com amortecimento exponencial independente de FPS:
     $$\alpha = 1 - e^{-k \cdot \Delta t}$$

7. **`src/debug/diagnostics.js` (Painel `lil-gui` + 5 Itens de Diagnóstico)**:
   - Implementação dos 5 itens na pasta `"Diagnóstico"` e nos atalhos `1` a `5` (além de `H` para ocultar/exibir o painel).

---

## 2. Decisões Técnicas Importantes (Por que foi feito assim?)

1. **Importação do `THREE.Timer` do pacote principal (`'three'`)**:
   - A partir das versões recentes do Three.js (no projeto foi instalada a `0.186.1`), a classe `Timer` deixou de ficar em `three/addons/misc/Timer.js` e passou a integrar o núcleo (`import * as THREE from 'three'`).

2. **Por que usar $\alpha = 1 - e^{-k \cdot \Delta t}$ na câmera em vez de `lerp(alvo, 0.1)`?**
   - Um fator fixo por frame (ex.: `0.1`) depende de quantas vezes por segundo `requestAnimationFrame` roda: em um monitor de 144 Hz a câmera alcançaria o carro muito mais rápido do que em 30 Hz. A equação exponencial resolve a equação diferencial contínua de decaimento do erro, mantendo exatamente o mesmo comportamento temporal em qualquer taxa de quadros.

3. **Como evitamos que o `renderer.info` acumule valores errados no Split-Screen (Itens 4 e 5)?**
   - Definimos `renderer.info.autoReset = false`.
   - No início de cada frame, chamamos `renderer.info.reset()` manualmente.
   - Renderizamos primeiro a câmera do jogador (`playerCamera`) e **lemos `renderer.info.render.calls` e `renderer.info.render.triangles` imediatamente após esse primeiro `renderer.render(scene, playerCamera)`**, antes de executar a segunda renderização da câmera de topo (`topCamera`). Assim, o HUD sempre mostra os números reais da câmera do jogador.

4. **Por que desativamos `scene.fog` temporariamente no Item 2 (Profundidade)?**
   - Quando `scene.overrideMaterial` recebe `THREE.MeshDepthMaterial`, a presença de um `THREE.Fog` colorido na cena pode misturar a cor alaranjada do fog ao gradiente em tons de cinza do buffer de profundidade. Removendo `scene.fog` enquanto o Item 2 está ativo (e restaurando ao desligar), o efeito dos sliders `near` e `far` fica totalmente visível.

---

## 3. Pontos que Caio e Davi Devem Revisar para a Arguição

- [ ] **Explicação do Pipeline de Transformações e Frustum (`Caio` e `Davi`)**:
  - Saber explicar em `src/debug/diagnostics.js` como `renderer.setViewport(x, y, w, h)` e `renderer.setScissor(x, y, w, h)` dividem o canvas em duas regiões independentes no Item 4, e por que `cameraHelper.visible` precisa ser `false` no Passe 1 (jogador) e `true` no Passe 2 (topo).
- [ ] **Explicação da Geometria da Pista (`Caio`)**:
  - Revisar a função `createRibbonGeometry` em `src/scene/track.js`: como o produto vetorial `crossVectors(tangent, upVector)` gera o vetor perpendicular horizontal para abrir a largura da faixa de asfalto a partir da `CatmullRomCurve3`.
- [ ] **Explicação da Normalização com `THREE.Box3` (`Davi`)**:
  - Revisar `normalizeModelByBox3` em `src/scene/models.js`: como `new THREE.Box3().setFromObject(rawObject)` mede o tamanho original do ativo importado, aplica `scaleFactor = targetSize / referenceMeasure` e usa `finalBox.min.y` para apoiar a base do modelo em $Y = 0$.
- [ ] **Ajuste de Orientação ao Colocar os Arquivos da Kenney (`Davi`)**:
  - Quando colocarem o arquivo `car.obj` na pasta `public/models/car/`, confiram se a frente do carro escolhido aponta para a frente do movimento. Caso o modelo específico aponte para o lado oposto, basta alterar a constante `CAR_FORWARD_ROTATION_Y` no topo de `src/scene/models.js` (de `Math.PI` para `0` ou `Math.PI / 2`).
- [ ] **Demonstração Prática dos 5 Itens de Diagnóstico na Defesa (`Caio` e `Davi`)**:
  1. **Tecla `1` (Wireframe)**: mostrar a subdivisão da pista, da água e dos modelos.
  2. **Tecla `2` (Profundidade)**: mover os sliders `Câmera Near` e `Câmera Far` (e combinar com a **Tecla `4`** para mostrar a pirâmide do frustum encolhendo/crescendo na vista da direita enquanto o gradiente de profundidade muda na esquerda!).
  3. **Tecla `3` (Back-face Culling)**: passar pelo pórtico de largada e olhar para trás, ou aproximar a câmera de um objeto aumentando o `Câmera Near` para entrar dentro da malha e ver as faces internas sumirem (`FrontSide`) ou aparecerem (`DoubleSide`).
  4. **Tecla `4` (Frustum 2ª Câmera)**: dirigir pela pista mostrando na tela da direita o `CameraHelper` acompanhando o carro.
  5. **Tecla `5` (Frustum Culling + `renderer.info`)**: alternar a tecla `5` e apontar para os números de **Draw Calls** e **Triangles** no HUD: com o Frustum Culling desligado, todas as malhas da cena são enviadas para a GPU (~125 calls); com o Frustum Culling ligado, apenas os objetos dentro da pirâmide de visão da câmera do jogador são desenhados.
