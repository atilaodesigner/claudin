> **Outros projetos neste repositório:** [`ovni-brasil/`](ovni-brasil/): jogo web em Three.js, *OVNI BRASIL — ABDUÇÃO TOTAL*.

# Balanço do Barco: color grading

Color completo do clipe **"Balanço do Barco"** (Kamika-Z Produtora): 4K UHD, 23.976 fps, 2:57, Rec.709.

```
original/Balanco_do_Barco_ORIGINAL.mp4      <- o arquivo que veio do Drive (sem mexer)
entrega/Balanco_do_Barco_COLOR_4K.mp4       <- MASTER gradado 4K (H.264 High, Rec.709, áudio original)
entrega/Balanco_do_Barco_COLOR_1080p.mp4    <- versão leve p/ aprovação / redes
entrega/antes_depois_*.jpg                  <- comparativos por take
color/tabela.md                             <- decupagem de color take a take (valores de cada node)
color/luts/                                 <- LUTs .cube 33pt: look geral + 1 LUT por take
color/pipeline/                             <- código que gerou o grade (reproduzível)
```

> Os vídeos estão no **Git LFS**. No GitHub é só clicar no arquivo e em *Download*.

---

## O diagnóstico

O clipe mistura 3 "materiais" que não conversavam entre si:

| Material | Problema | Scopes (antes) |
|---|---|---|
| **Live-action: cabine** | Lavado, cara de log sem conversão, cinza-esverdeado | preto ~35/255, branco ~110/255, sat 0.10 |
| **Live-action: deck dia/noite** | Chapado, frio, rosto do artista afundado contra o céu | preto ~15–45, rosto 1–1.5 stop abaixo do fundo |
| **Planos IA / CG** (barco, jacaré, fogo, relógio) | Já contrastados, preto no 0, ciano muito saturado | outro "filme" dentro do clipe |

Cortar de uma cabine lavada pra um plano de IA super contrastado dava um salto na cara. O trabalho foi colocar tudo **no mesmo filme**.

## O look

**Teal & amber com densidade de película.** Sombras puxam pra teal/navy, altas e pele pra âmbar dourado, a cabine é madeira quente, o rio é teal frio e o fogo é laranja (não amarelo-limão). Preto denso mas não esmagado, com um piso navy de ~3/255. As altas têm roll-off suave, com halation nas luzes quentes e grão fino por cima de tudo.

## Árvore de nodes (por take)

Os nodes 1 a 8 são por pixel e viraram uma **LUT 3D por take**, exata pra fonte de 8 bits (256³). Os nodes 9 a 13 são espaciais e rodam por frame.

| Node | O que faz |
|---|---|
| **1. Levels / black balance** | Tira o preto levantado **por canal** (mata a dominante nas sombras) e expande o branco até o alvo do grupo |
| **2. Gamma de meio-tom** | Põe a mediana no alvo do grupo (cabine 0.25, deck conforme a luz) |
| **3. WB por neutros** | Mede só os pixels de baixa croma (paredes, camisa bege, papel) e leva pro neutro alvo do grupo (cabine levemente tungstênio, deck levemente frio), com limite de ±12% |
| **4. Contraste log** | Contraste com pivô em 18% cinza, trabalhando em stops |
| **5. Split-tone (Oklab)** | Sombras em teal/navy, altas em âmbar |
| **6. Hue vs Hue / Hue vs Sat** | Pele puxada pro *skin line*, verdes → oliva e dessaturados, cianos → teal controlado, vermelhos → levemente pro laranja |
| **7. Sat + gamut compress + densidade** | Saturação por grupo, teto suave de croma e escurecimento das cores saturadas (densidade de película) |
| **8. Film shoulder + black floor** | Roll-off das altas e piso de preto navy |
| **9. Power window de rosto (tracking)** | Rosto detectado frame a frame e suavizado no tempo, elipse com feather, **presa à silhueta segmentada do artista** (evita halo no céu). Deck +0.40 stop, cabine +0.22, noite +0.18 |
| **10. Sujeito × fundo (máscara de segmentação)** | Deck: sujeito +0.12. Cabine: fundo −0.18 (profundidade). Noite: sujeito +0.08 e fundo −0.10 |
| **11. Degradê de céu** | Deck −0.35 stop no topo, segura o céu estourado |
| **12. Vinheta** | −0.2 a −0.45 stop conforme o grupo |
| **13. Halation + grão** | Halo quente nas luzes (fogo, lampião, janelas) e grão de luma fino, mais forte nos meios-tons |

As transições que não são corte seco (foto → flashback, deck → drone) têm a LUT **misturada em 8 frames**, pra não "pular" a cor.

## Grupos (shot matching)

| Grupo | Estratégia |
|---|---|
| **Cabine** (23 takes) | Reconstrução total: preto no chão, branco em 0.84, WB tungstênio, sat ×1.30. Vira a "casa quente" do clipe |
| **Deck dia** (16) | Contraste ×1.08, água teal, rosto levantado com tracking, céu segurado |
| **Deck noite** (7) | Preto profundo navy, pele/roupa bege quente, fumaça preservada |
| **IA / CG** (27) | Toque leve: preto alinhado, ciano domado (sat ×0.92), mesmo split-tone. Entram no filme sem perder o acabamento |
| **Fogo** | Âmbar devolvido às chamas, halation mais forte |
| **P&B** (garoto) | Mantido mono, mesma curva e toning bem sutil |
| **Flashback** | Memória quente e levemente *fade*, se destaca do presente |
| **FX / transições** | Look a 70%, sem normalização (efeito intencional preservado) |
| **Créditos** | Intocado (preto puro) |

A tabela completa com os valores de cada take tá em [`color/tabela.md`](color/tabela.md).

## Usando as LUTs no DaVinci Resolve

1. Copia `color/luts/` pra pasta de LUTs do Resolve (*Project Settings → Color Management → Open LUT Folder*) e dá *Update Lists*.
2. **Look geral:** `00_LOOK_Balanco_do_Barco.cube` num node no fim da árvore, *depois* da sua correção primária.
3. **Por take:** `take_XX_*.cube` já tem primária + match + look daquele take. Aplica no clipe correspondente (a tabela tem o timecode).
4. Entrada e saída das LUTs são Rec.709 / gamma 2.4, igual ao arquivo original.

As máscaras (nodes 9 a 13) não cabem em LUT. Pra refinar no Resolve, os valores de cada window estão na tabela.
