# Créditos, Licenças e Referências — Monaco Sunset GP

Todos os modelos 3D e texturas utilizados neste projeto estão sob a licença **CC0 1.0 Universal (Public Domain Dedication — Domínio Público)**, e os efeitos sonoros são gerados proceduralmente em tempo real via **WebAudio API** (sem arquivos de áudio externos).

---

## 1. Modelos 3D Externos (Marco M1 — Kenney.nl)

| Modelo na Cena | Caminho no Projeto | Formato | Pacote Original | Autor | Licença | Link Oficial |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Carro de corrida** (veículo controlável em 3ª pessoa) | `public/models/car/car.obj` (`+ .mtl` e `.png`) | OBJ + MTL + PNG | **Kenney — Racing Kit** | Kenney.nl | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | https://kenney.nl/assets/racing-kit |
| **Barco / Iate** (16 instâncias ancoradas no porto) | `public/models/boat/boat.glb` | GLB (glTF 2.0) | **Kenney — Watercraft Kit** | Kenney.nl | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | https://kenney.nl/assets/watercraft-kit |
| **Prédio comercial** (24 instâncias em Monte Carlo) | `public/models/building/building.glb` | GLB (glTF 2.0) | **Kenney — City Kit (Commercial)** | Kenney.nl | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | https://kenney.nl/assets/city-kit-commercial |

---

## 2. Texturas PBR (Marco M3 — ambientCG / Poly Haven + Procedural)

> **Instrução para a dupla:** Substituam os campos `A PREENCHER` abaixo com o código exato do pacote baixado (por exemplo, `Asphalt012` do ambientCG ou `asphalt_02` do Poly Haven) e a respectiva URL.

| Superfície na Cena | Arquivos em `public/textures/` | Nome do Asset Original | Fonte (ambientCG / Poly Haven) | Licença | Link Direto do Asset |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Asfalto da Pista** | `asphalt/color.jpg`, `normal.jpg`, `roughness.jpg` | `A PREENCHER` *(ex.: Asphalt012 1K-JPG)* | `A PREENCHER` *(ambientCG ou Poly Haven)* | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `A PREENCHER` *(ex.: https://ambientcg.com/view?id=Asphalt012)* |
| **Pedra / Concreto (Cais e Píeres)** | `stone/color.jpg`, `normal.jpg`, `roughness.jpg` | `A PREENCHER` *(ex.: PavingStones131 1K-JPG)* | `A PREENCHER` *(ambientCG ou Poly Haven)* | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `A PREENCHER` *(ex.: https://ambientcg.com/view?id=PavingStones131)* |
| **Terreno Urbano (Monte Carlo)** | `ground/color.jpg`, `normal.jpg`, `roughness.jpg` | `A PREENCHER` *(ex.: Ground054 1K-JPG)* | `A PREENCHER` *(ambientCG ou Poly Haven)* | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `A PREENCHER` *(ex.: https://ambientcg.com/view?id=Ground054)* |
| **Água do Porto (Normal Map)** | `water/normal.jpg` *(ou fallback procedural 512×512 em `src/materials/textures.js`)* | `A PREENCHER` *(ou Procedural Canvas)* | `A PREENCHER` *(ambientCG / Poly Haven / Próprio)* | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `A PREENCHER` |

---

## 3. Efeitos Sonoros (Marco M4 — Síntese Procedural WebAudio)

| Som / Efeito | Caminho no Projeto | Autor / Origem | Licença |
| :--- | :--- | :--- | :--- |
| **Motor, Pneu Cantando, Sino de Multiplicador, Alerta de Pista e Fanfarra `SUPERDRIFT`** | [`src/game/audio.js`](./src/game/audio.js) *(gerado em tempo real via `AudioContext`, sem arquivos externos)* | Autoral (Caio Canalli e Davi Beli Rosa) | MIT / Domínio Público |

---

## 4. Bibliotecas e Ferramentas de Software

| Biblioteca / Ferramenta | Versão | Uso no Projeto | Licença | Link Oficial |
| :--- | :--- | :--- | :--- | :--- |
| **Three.js** (`three` + addons `Sky`, `GLTFLoader`, `OBJLoader`, `MTLLoader`) | `^0.186.1` | Motor de renderização WebGL, iluminação, materiais PBR e carregadores | MIT | https://threejs.org/ |
| **lil-gui** | `^0.21.0` | Painel de diagnóstico e inspeção em tempo real (pastas M1 a M4) | MIT | https://lil-gui.georgealways.com/ |
| **Vite** | `^8.3.4` | Servidor de desenvolvimento ES Modules e bundler de produção | MIT | https://vite.dev/ |
