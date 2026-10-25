# Auditoria e testes: Mosaico 1.1.0 (25/10/2026)

Ambiente: Chromium (Playwright) com perfil de celular (Pixel 7) e GPS simulado; Node 22; conferência independente das saídas com Pillow (EXIF), pyshp (shapefile), openpyxl (Excel), pdftotext/pdfinfo (PDF), `zipfile` (ZIP).

## O que foi testado e resultado
| Área | Teste | Resultado |
|---|---|---|
| Geodésia | Área de quadrado de 100 m; distância de 1° de latitude; média de leituras GPS com ponto discrepante; simplificação de trilha | Passou (erro de área < 0,6%) |
| Validações | CPF (dígitos), telefone, CAR, caixa de coordenadas da região | Passou |
| ZIP | Escrita própria lida por `zipfile` do Python (CRC íntegro) e relida pelo app | Passou |
| EXIF | Coordenadas gravadas no JPEG e lidas por Pillow (valores conferem) | Passou |
| Shapefile | `.shp/.shx/.dbf/.prj/.cpg` lidos por pyshp: tipo, bbox, atributos com acentos, área igual à do app | Passou |
| Esquema | 79 campos: chaves únicas, opções sem duplicata, condições `show` válidas, regras de bloco | 12 testes, passaram |
| Fluxo no celular | Importar lista, buscar, abrir imóvel, ponto GPS, caminhar limite (área 1,05 ha para quadrado de ~1 ha), foto, preencher blocos, revisar erros, concluir | Passou |
| Persistência | Recarregar página mantém dados; apagar tudo e restaurar do pacote recupera visita e foto | Passou |
| Offline | Service worker instalado; recarga com rede desligada abre o app | Passou |
| Escala | 600 imóveis: importação 0,13 s; busca 0,17 s; 80 linhas por página | Passou |
| Exportação grande | 285 visitas + 285 fotos: 3 pacotes (100/100/85 fotos), 3 s, todas as fotos presentes | Passou |
| Central | Mescla de 2 pacotes (conflito detectado: 2 imóveis editados em aparelhos diferentes), XLSX, CSV, shapefiles, GeoJSON, PDF, fotos, projeto consolidado | Passou |
| Central com carga | 600 visitas, 660 fotos (80 MB): carga 0,6 s; XLSX 0,5 s; PDF 12 s (3,8 MB); fotos 0,9 s | Passou |
| Layout | Tela de 360 px: nenhum estouro horizontal em lista e nos 11 blocos; nenhum alvo de toque < 40 px; menor fonte 15 px; modo escuro | Passou |
| Acessibilidade | axe-core (WCAG 2 A/AA) na lista e no bloco socioeconômico: 0 violações (após corrigir rótulos de campo) | Passou |
| Privacidade | Campos pessoais fora da aba principal; incluídos só ao marcar; PDF omite quando desmarcado | Passou |

Correções feitas durante os testes: filtro de busca vazio escondia a lista; barra de navegação sobrepunha campos; campos sem rótulo associado (acessibilidade); seleções com até 8 opções viraram botões em vez de menu suspenso.

## Acrescentado na 1.1
| Área | Teste | Resultado |
|---|---|---|
| Datum | `.prj` SIRGAS 2000 em todos os shapefiles; polilinha lida por pyshp | Passou |
| Jornada | Trajeto simulado de 2,1 km medido em 2,1 km pelo app; km por hodômetro (3,4 km) prevalece | Passou |
| Custos | Km × R$/km (R$ 5,10) + 2 diárias (R$ 200) + gasto manual (R$ 48,50) = R$ 253,60; sobrevive a pacote, apagar e restaurar | Passou |
| Central | Aba Custos e roteiro; XLSX com abas Jornadas e Custos; shapefile `trajetos_dia` | Passou |
| Mapa | Limites do KMZ desenhados; pacote de tiles (de servidor de teste) importado, desenhado **sem rede**, posição do GPS; central e script geram o pacote | Passou (com tiles falsos) |
| Acessibilidade/layout | 5 abas em 360 px sem estouro, axe sem violações | Passou |

## Limites desta auditoria (não verificado)
1. **Aparelhos reais.** Nenhum teste em celular físico, nem em iPhone/Safari. Câmera nativa, precisão do GPS sob mata, `capture` da câmera, Web Share e comportamento de memória variam por aparelho. **Faça um piloto de campo de meio dia antes da campanha.**
2. **Armazenamento no iPhone.** O Safari pode limpar dados de sites pouco usados; a mitigação (instalar na tela inicial, gerar pacote diário) está no README, mas a política atual do iOS deve ser conferida em fonte oficial da Apple.
3. **Precisão.** GPS de celular tem erro típico de alguns metros, pior sob dossel. O app grava a precisão de cada ponto e avisa acima de 30 m, mas **não substitui** levantamento georreferenciado com GNSS para fins de certificação (SIGEF/INCRA).
4. **Questionário.** Os campos socioeconômicos e de comunidades tradicionais seguem o TdR, mas o questionário final e o texto de consentimento precisam ser validados por quem conduzirá a pesquisa (e, se exigido, por comitê/IEF).
5. **Formato do banco do IEF.** O TdR diz que o IEF define o formato no Plano de Trabalho. As saídas (XLSX, shapefile, GeoJSON) são formatos abertos, mas pode ser necessário um conversor.
6. **Sem mapa de fundo offline** e sem sincronização em nuvem (fora do escopo da fase 1).
7. **Segurança.** Os dados no celular não são criptografados pelo app (dependem do bloqueio de tela do aparelho). Pacotes `.zip` contêm dados pessoais quando coletados: trate como informação sensível.
8. **Imagem de satélite real não foi baixada nem testada**: o ambiente de desenvolvimento só alcança repositórios de pacotes e GitHub. O mapa foi testado com tiles falsos; o primeiro download real será no seu computador.
9. **Rastreio com a tela apagada** não funciona em navegador (limite da plataforma); medido só com a tela ligada, GPS simulado.
10. **Custos:** não há valores padrão de R$/km nem de diária; o cálculo depende do que for cadastrado. A "visita trabalhada" é a visita com alteração naquele dia.
