# Roteiro Cronometrado para o Vídeo de Demonstração (60 a 120 segundos)

Este documento apresenta um roteiro cronometrado (alvo de **95 segundos**, dentro da janela oficial de **60 a 120 s**) para o vídeo de demonstração final do projeto **Monaco Sunset GP**, cobrindo todos os marcos avaliados na disciplina (**M1, M2, M3 e M4**).

---

## 1. Preparação Antes de Gravar (Checklist Rápido)

1. Abra o projeto (`npm run dev`) em `http://localhost:5173`.
2. Deixe o navegador em **tela cheia (`F11`)** com resolução **1920×1080 (1080p)** e zoom em `100%`.
3. Pressione cualquier tecla (`W`) uma vez para fechar o card de boas-vindas e ativar o sintetizador WebAudio, depois pressione **`R`** para posicionar o carro alinhado na largada.
4. Deixe o painel `lil-gui` visível no canto superior direito, com a pasta **`Diagnóstico`** aberta e as demais recolhidas (você abrirá uma por vez durante o vídeo).

---

## 2. Roteiro Cronometrado (Bloco a Bloco — 1 min 35 s)

| Tempo | O que fazer na tela (Ação) | O que falar / Legenda sugerida |
|---|---|---|
| **0:00 – 0:12** *(12 s)* | Mostre a visão geral da largada ao pôr do sol (mar e iates à esquerda, prédios iluminados de Monte Carlo à direita, HUD de telemetria e drift). | *"Olá! Somos Caio Canalli e Davi Beli Rosa. Este é o **Monaco Sunset GP**, nosso mundo explorável e jogo arcade de drift em Three.js, inspirado no circuito de rua de Mônaco ao entardecer."* |
| **0:12 – 0:30** *(18 s)* | Acelere (`W`), entre na 1ª curva usando o freio de mão (`Espaço`) ou *flick*, faça fumaça e marcas de pneu, mostre o multiplicador subindo (`x2`, `x3`), o bônus **`BORDA x1.5`** e o anel de 3 s nas retas curtas. Depois, force uma saída da pista para mostrar o aviso **`FORA DA PISTA!`** e pressione `R`. | *"No Marco 4 implementamos um modelo arcade de carro com decomposição de velocidade frontal e lateral, fumaça e marcas de pneu em buffer circular sem alocação por frame. O sistema puro de pontuação detecta o ângulo de deriva com histerese, aplica multiplicadores até x20, bônus de borda e penaliza saídas de pista monitorando 9 pontos do chassi."* |
| **0:30 – 0:46** *(16 s)* | Pressione em sequência as teclas **`1`** (Wireframe), **`2`** (Depth Buffer — mexa rapidamente no slider `Câmera Near`), **`3`** (Back-face Culling), **`4`** (Split-screen com câmera de topo e `CameraHelper`) e **`5`** (desligue e ligue o Frustum Culling apontando para os contadores `Draw Calls` e `Triangles` no HUD). | *"Do Marco 1, preservamos os 3 modelos externos normalizados via Box3 e os 5 itens de diagnóstico do pipeline: Wireframe (tecla 1), Depth Buffer não-linear (tecla 2), Back-face Culling (tecla 3), visualização do Frustum em tela dividida (tecla 4) e o impacto do Frustum Culling nos Draw Calls e triângulos renderizados (tecla 5)."* |
| **0:46 – 1:00** *(14 s)* | Abra a pasta **`Luz (M2)`** no `lil-gui`. Ligue `Helpers de Luz` para mostrar o frustum ortográfico justo do sol e os cones dos 6 postes (`SpotLight`). Desligue e religue `Sombra do Sol` e mexa brevemente na `Elevação (°)` do sol. | *"No Marco 2, combinamos três tipos de luz com Tone Mapping ACES Filmic: sol direcional poente com sombra PCF suave e câmera ortográfica justa à cena, 6 postes SpotLight com decaimento quadrático — onde apenas 2 projetam sombra por custo de GPU — e HemisphereLight atmosférico."* |
| **1:00 – 1:14** *(14 s)* | Abra a pasta **`Materiais (M3)`**. Marque **`Visualizar UV (Checker)`** mostrando que os quadrados na curva da pista não esticam; desmarque e alterne **`Normal Maps`** (liga/desliga) dando zoom ou olhando o relevo do asfalto e as ondas animadas da água com reflexo PMREM. | *"No Marco 3, aplicamos 7 materiais PBR com mapas sRGB para cor e lineares para Normal e Roughness. A pista calcula coordenadas UV pelo comprimento de arco acumulado da curva Catmull-Rom, evitando distorção, e o céu analítico gera um mapa PMREM que ilumina a água e a pintura metálica do carro."* |
| **1:14 – 1:24** *(10 s)* | Abra a pasta **`Caso z-fighting`**. Clique em **`1. Ativar bug + agravar near/far`** para mostrar as faixas brancas piscando sobre o asfalto; em seguida clique em **`2. Aplicar correção (Y + offset)`**. | *"Como caso de diagnóstico, demonstramos o Z-Fighting nas faixas coplanares da pista quando a razão far/near degrada o Z-Buffer, e nossa solução combinando deslocamento geométrico de 2,5 cm com polygonOffset."* |
| **1:24 – 1:35** *(11 s)* | Abra a pasta **`Jogo`** e clique em **`Forçar SUPERDRIFT (teste)`** (ou complete a sequência na pista) para disparar o efeito glitch colorido **`SUPERDRIFT`**, explosão de confetes 3D, camera shake, fanfarra sonora e selo persistente no HUD. | *"Ao atingir 25 mil pontos na mesma sequência ou sustentar x20, o jogador conquista o estado **SUPERDRIFT**, com explosão de partículas, camera shake e áudio procedural via WebAudio. Obrigado!"* |

---

## 3. Dicas de Gravação e Hospedagem

- **Software de gravação recomendado**:
  - **OBS Studio** (gratuito, grave em `.mp4` ou `.mkv` a `60 FPS`, bitrate `12.000 kbps`) ou a barra nativa do Windows (**`Win + G`** — Xbox Game Bar).
  - Certifique-se de ativar a **captura de áudio do sistema (Desktop Audio)** para que o ronco do motor, o cantado de pneu e a fanfarra do `SUPERDRIFT` apareçam claramente no fundo da narração.
- **Hospedagem e Link no `README.md`**:
  - Suba o vídeo no **YouTube (como Não Listado / Público)** ou no **Google Drive institucional (IFSP)** com permissão *"Qualquer pessoa com o link pode ver"*.
  - Cole o link final na seção **1. Descrição do Projeto** do arquivo [`README.md`](../README.md) antes da entrega.
