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

## Fluxo com GeoTIFF direto (sem QGIS/MBTiles) — a partir da versão 1.4
O celular **não lê .tif**; ele lê o pacote de tiles. A central faz a conversão no navegador do PC (a imagem não sai da máquina):

1. Gere o recorte dos dois parques fora do app (QGIS, Earth Engine, gdal etc.), no melhor detalhe disponível.
2. Central → aba **Mapa offline** → card **Importar imagem GeoTIFF dos parques** → escolha o `.tif`.
3. A central mostra tamanho, bandas, bits, sistema de coordenadas, metros/pixel e o zoom nativo. Ajuste o zoom máximo ao detalhe real (zoom acima do nativo só amplia, não ganha nitidez).
4. Marque a confirmação de licença, informe fonte e atribuição, clique em **Converter**. O `.zip` vai para `exportacoes/` da pasta do projeto.
5. Celular: *Mapa → Importar mapa*.

**Requisitos do arquivo**
- GeoTIFF georreferenciado, grade norte-sul (sem rotação), bandas RGB (ou 1 banda em cinza); paleta de cores não é aceita.
- Sistemas aceitos: EPSG:4674 (SIRGAS 2000), 4326 (WGS 84), 31978–31985 (SIRGAS 2000 / UTM, incluindo 31983 = 23S, dos dois parques), 32601–32760 (WGS 84 / UTM) e 3857. Outros: reprojete antes. SIRGAS 2000 e WGS 84 são tratados como iguais (diferença pequena, aceitável para fundo de mapa; não verifiquei o valor oficial, confirme no IBGE), então não há transformação de datum.
- 8 bits é o ideal. Imagens de 16 bits/float são esticadas pelos percentis 2–98 (opção marcada automaticamente); a cor final fica diferente da original.
- Tamanho: o arquivo é lido por janelas (não precisa caber na memória), mas arquivos muito grandes levam minutos. Prefira recorte só dos dois parques com margem de ~300 m, em COG ou GeoTIFF com tiles internos.
- Pixels transparentes/nodata ficam sem imagem; tiles de borda são salvos em PNG, os completos em JPEG (qualidade 0,88).

**Tamanho esperado**: ~25 KB/tile; zoom 17 acumulado ≈ 6.300 tiles ≈ 160 MB para os dois parques com 300 m de margem; zoom 18 ≈ 23.600 tiles ≈ 600 MB. Considere o espaço dos celulares.

**Licença**: a conversão não altera a licença da imagem. CBERS no registro da AWS aparece como CC BY-SA 3.0 e, no registro do INPE para o produto WPM fusionado, CC BY 4.0; confirme qual vale para o produto usado. Dados do Google Earth Engine só em projeto não comercial verificado; trabalho de consultoria pode ser comercial: confirmar com Funbio/IEF. Mantenha a atribuição.
