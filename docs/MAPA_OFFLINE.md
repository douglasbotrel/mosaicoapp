# Mapa de satélite offline: fontes e licenças

**Limites dos parques:** vêm do KMZ fornecido (`ide_2010_mg_unidades_conservacao_estaduais_pol`, IDE-Sisema/MG). Biribiri ≈ 16.900 ha; Serra Negra ≈ 13.090 ha (calculado sobre o polígono; confira com o ato de criação). Os tiles são baixados só dentro desses polígonos mais uma margem de 300 m.

**Tamanho (margem de 300 m, os dois parques):** até zoom 15: 512 tiles; 16: 1.732; 17: 6.252; 18: 23.578 (acumulado). Satélite pesa algo como 15 a 30 KB por tile. Para o celular, zoom 16 (~45 MB) é um bom equilíbrio; zoom 17 (~160 MB) só se precisar enxergar cercas e construções, e talvez só em um parque.

## Qual imagem usar: o que pude verificar
A decisão de licença é sua e do IEF/Funbio. O que encontrei em fontes oficiais:

| Fonte | O que verifiquei | Consequência |
|---|---|---|
| **Imagem que o IEF/Funbio já licenciou** (ortomosaico, drone, Planet etc.) | Não verifiquei: depende do contrato deles | **Melhor opção.** Pergunte ao IEF. Se vier como GeoTIFF/MBTiles, gere os tiles no QGIS e converta com `tools/mbtiles_para_pacote.py` |
| **Sentinel-2 cloudless (EOX)**, ~10 m | Página de licença da EOX: uso não comercial = CC BY-NC-SA 4.0; uso comercial exige "EOX Commercial Attribution-RestrictedUse 1.2 License" (paga); atribuição obrigatória e visível. A página não trata de cache offline | Serviço consultoria paga é provavelmente uso comercial: exigiria licença. A resolução de 10 m também não mostra cercas |
| **Esri World Imagery** | Não consegui ler os termos de uso (a página não trouxe o texto) e não confirmei se cache offline é permitido | Não use para cache offline sem confirmar com a Esri/IEF |
| **Planet NICFI (Brasil)** | Comunidade Planet: programa estendido até jan/2025, mosaicos PlanetScope saíram do programa; acesso depois de abril/2025 incerto | Não conte com ele sem confirmar |
| **Google, Bing, Mapbox** | Não verifiquei, mas os termos públicos costumam proibir cópia offline em massa | Evitar |
| **IDE-Sisema (MG)** | Metadados dos dados que consultei dizem "o acesso ao dado é livre" (sem licença formal) e há serviço WMS em `geoserver.meioambiente.mg.gov.br/IDE/wms`. Não consegui acessar o servidor daqui para ver se há ortofoto/satélite de boa resolução | Vale abrir o *GetCapabilities* no navegador e perguntar à SEMAD/IEF sobre imagens de alta resolução |
| **Sentinel-2 (Copernicus) bruto** | Dados abertos; não li aqui a nota legal. Exige montar o mosaico (QGIS) | Alternativa gratuita, mas 10 m |

A central e o script `tools/baixar_mapa.js` **só baixam depois que você confirma a licença** e mantêm o texto de atribuição no pacote e no mapa.

## Fluxo com imagem própria (QGIS)
1. QGIS: *Processamento → Caixa de ferramentas → Gerar tiles XYZ (MBTiles)*; extensão = camada dos parques; zoom 12–17; formato JPG.
2. `python3 tools/mbtiles_para_pacote.py saida.mbtiles mapa_parques.zip "Nome da fonte" "Atribuição"`
3. No app: *Mapa → Importar mapa*.
