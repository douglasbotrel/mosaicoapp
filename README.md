# Mosaico · coletor de campo (versão 1.2.1)

Aplicativo de celular, sem internet, para o cadastro e diagnóstico fundiário dos Parques Estaduais do Biribiri (PEBI) e da Serra Negra (PESN) (Carta Convite Funbio nº 208/2026). Mais uma **central** no computador para juntar os dados dos celulares, conferir a qualidade e exportar.

Os dados de exemplo (`exemplos/`) são **fictícios**. Os números de CAR do exemplo foram inventados.

## Pastas
| Pasta | Conteúdo |
|---|---|
| `app/` | Coletor do celular (PWA: abre no navegador, instala na tela inicial, funciona offline) |
| `central/` | Ferramenta do computador: `central.html` (abre direto no navegador, sem instalar nada) |
| `docs/` | `TESTAR.md` (**comece por aqui**: testar no computador e no celular), `ESPECIFICACAO.md`, `AUDITORIA.md`, `MAPA_OFFLINE.md` (fontes de imagem e licenças) |
| `tests/` | Testes automatizados (`tests/rodar_todos.sh`) |
| `tools/` | `servir_local.js`, `sync.sh`, `baixar_mapa.js` (gera pacote de mapa), `mbtiles_para_pacote.py`, `kmz_para_geojson.py` (limites dos parques a partir do KMZ) |
| `exemplos/` | Lista de imóveis fictícia |

## Como usar
**1. Colocar o app no celular (uma vez, com internet)**
O celular só instala e usa câmera/GPS a partir de endereço **https** (ou `localhost`). Duas formas:
- Publicar a pasta `app/` em hospedagem estática com https (GitHub Pages, Netlify ou o servidor do projeto). Só arquivos do programa vão para lá; **os dados ficam no celular**.
- Para teste no próprio computador: `node tools/servir_local.js` e abrir `http://localhost:8080/app/`.

Abra o endereço no Chrome (Android) ou Safari (iPhone), toque em "Adicionar à tela inicial" e abra uma vez com internet. Depois disso funciona sem sinal.

**2. Carregar a lista de imóveis**
No app: aba *Imóveis* → *Importar lista*. Formato CSV ou JSON com colunas `id; parque; nome; car; sigef; matricula; ccir; area_car_ha; municipio; comunidade`. A central tem um modelo e confere CAR repetido ou fora do padrão. A lista não tem limite fixo (testado com 600).

**3. Coletar**
Toque no imóvel. O formulário tem 11 blocos (10 no PEBI; o de comunidade tradicional só aparece na Serra Negra). Salva sozinho a cada alteração. O botão 📷 fica sempre à mão. O limite do imóvel pode ser caminhado com o GPS ligado: o app calcula perímetro e área e preenche a área estimada.

**4. Enviar para o computador**
Aba *Enviar* → *Gerar pacote*. Gera um ou mais `.zip` (100 fotos por arquivo, ajustável), que podem ser compartilhados (WhatsApp, e-mail, Drive) ou copiados por cabo. Pode repetir quantas vezes quiser: a central junta sem duplicar.

**5. Consolidar e exportar**
Abra `central/central.html`, arraste os `.zip`. Abas: Resumo, Visitas, Qualidade, Exportar, Lista para celulares. Exporta Excel, CSV, shapefiles, GeoJSON, fichas PDF, fotos organizadas por imóvel (com GPS gravado na imagem) e um projeto consolidado.

## Decisões e cuidados
- **Datum: SIRGAS 2000 (EPSG:4674).** Os shapefiles saem com `.prj` SIRGAS 2000, e o pacote registra o datum. O GPS do celular entrega WGS 84; o [IBGE informa](https://www.ibge.gov.br/en/geosciences/geodetic-positioning/sirgas-en/19191-geodetic-reference-system-change-project.html) que não há parâmetros de transformação entre SIRGAS 2000 e WGS 84 (praticamente idênticos), então nenhuma conversão é feita. O GeoJSON segue o padrão do formato (WGS 84, na prática o mesmo).
- **Dados pessoais (LGPD):** a visita tem texto de consentimento, opção "prefere não informar" e campos pessoais exportados em aba separada, só quando marcado.
- **Perda de dados:** o navegador do celular guarda tudo localmente. Gere o pacote **ao fim de cada dia**. No iPhone, instale na tela inicial e não use aba anônima.
- **Conflitos:** se dois celulares editarem o mesmo imóvel, vence a edição mais recente e a central registra o conflito na aba Qualidade.
- **Fotos:** reduzidas a 1600 px. A coordenada da foto é a posição do aparelho no momento em que a foto foi salva no app (a câmera do celular pode ter gravado a dela, mas o app recompõe a imagem).

## Jornada do dia e custos (novo na 1.1)
Aba **Dia**: *Iniciar jornada* (veículo, pessoas, hodômetro inicial). O app registra o trajeto enquanto estiver aberto com a tela ligada, soma os km, e marca uma **parada** a cada visita aberta e a cada foto. Ao *Encerrar* (hodômetro final), lança sozinho o **custo do veículo** (km × R$/km do Ajustes; usa o hodômetro se informado, senão o GPS), e as **diárias** (pessoas × valor). Gastos extras (combustível, alimentação, hospedagem, pedágio, manutenção, material, outros) são lançados à mão, com foto de comprovante opcional. O painel do dia mostra o total e o custo por visita trabalhada. Na central, aba **Custos e roteiro**: totais por categoria, jornadas, R$/visita, R$/km, e roteiros em GeoJSON/shapefile.
- Os valores de R$/km e diária **não têm padrão**: cadastre os do projeto em Ajustes.
- **Limite do navegador:** com a tela apagada ou o app em segundo plano, o navegador pausa o GPS. O app avisa "lacunas" e o km por GPS fica menor que o real; por isso o hodômetro é o dado preferido para custo.

## Mapa (novo na 1.1)
Aba **Mapa**: limites dos parques (do KMZ), imóveis coletados (verde = concluído, laranja = em andamento), acessos, benfeitorias, trajeto do dia, sua posição. A **imagem de satélite offline** é um pacote de tiles gerado na central (aba *Mapa offline*) só dentro dos parques. Veja `docs/MAPA_OFFLINE.md`: **a licença da imagem precisa ser confirmada antes de baixar**, e o pacote real ainda não foi gerado (o ambiente de desenvolvimento não alcança servidores de imagem).

## APK e iPhone
- **Android (principal): não precisa de APK.** O Chrome instala o app pelo menu ⋮ → *Instalar app*: ícone na tela inicial, tela cheia, funciona offline. Não depende de loja nem de cabo.
- **iPhone:** instala por *Adicionar à Tela de Início*, mas o Safari tem limites (sem rastreio em segundo plano; a [política de armazenamento do WebKit](https://webkit.org/?p=14403) permite remover dados de sites sem uso, com proteção maior para apps instalados na tela inicial). Use só como reserva e envie pacotes com frequência.
- **APK, se quiser:** dá para empacotar o mesmo app como APK com [Bubblewrap/Trusted Web Activity](https://developer.chrome.com/docs/android/trusted-web-activity/lay-of-the-land) (exige o app publicado em https e assinatura). Isso muda só a embalagem: continua rodando no Chrome, com as mesmas limitações de GPS em segundo plano. Para gravar o trajeto com a tela apagada seria preciso um app nativo (ex.: Capacitor com plugin de geolocalização em segundo plano), trabalho maior que não foi feito.

## Testes
`tests/rodar_todos.sh` (precisa de Node, Playwright e Python com Pillow/pyshp/openpyxl). Resultados e limites: `docs/AUDITORIA.md`.
