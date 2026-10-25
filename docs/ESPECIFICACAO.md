# Mosaico: especificação do coletor de campo

Projeto: Carta Convite Funbio nº 208/2026 (COPAÍBAS; IEF-MG). Parques: PE do Biribiri (PEBI) e PE da Serra Negra (PESN).

## Objetivo
Registrar em campo, no celular e sem internet, dados técnicos, sociais e ambientais de cada imóvel, com coordenadas e fotos. Depois descarregar no computador e extrair planilha, shapefile, PDF e pacote de fotos.

## Requisitos vindos do TdR (Produtos 3.1, 4.1, 4.2; seção 7)
- Limites observados, elementos físicos, área estimada, compatibilidade com o CAR.
- Ocupantes e histórico de uso. Uso consolidado, vegetação nativa, benfeitorias (tipo e data estimada).
- Fotos: limites, áreas internas, benfeitorias, acessos.
- Impactos, conflitos, Termos de Compromisso.
- Questionário socioeconômico (pessoas, idade, escolaridade, atividades, moradia, água, saneamento, recursos naturais).
- Módulo de comunidade tradicional (somente PESN): DRP, linha do tempo, matriz FOFA.
- Classificação de campo: consolidação, conflito, impacto, viabilidade; tipologias; critérios da Portaria IEF 27/2021.
- Formatos de entrega: .xlsx, .docx, shapefile, geodatabase, .jpeg georreferenciado. O IEF define o banco no Plano de Trabalho. Por isso a central exporta formatos abertos e o esquema é versionado.

## Princípios de uso no celular
- Uma mão, luz do sol: fonte de 17 px ou mais, alvos de toque de 48 px ou mais, alto contraste, tema claro e escuro.
- Um bloco por tela, barra fixa inferior com Anterior/Próximo, progresso visível.
- Seleções por toque (botões grandes), teclado numérico onde couber, datas e hora automáticas.
- Salvamento automático a cada alteração. Nada se perde se o navegador fechar.
- Campos opcionais claros; "prefere não informar" nas perguntas pessoais.
- Funciona 100% offline depois da primeira abertura.

## Capacidade
Projetado para centenas de imóveis (meta mínima: 285, pelo número de CAR: 51 PEBI + 234 PESN). Lista com busca e filtro, sem limite fixo. Teste de carga com 600.

## Dados
- Imóvel (da lista importada): id, parque, nome, CAR, SIGEF, matrícula, CCIR, área CAR.
- Visita: um registro por imóvel (campos do esquema), com status (rascunho, concluída), horários e versão do esquema.
- Mídia: foto (JPEG reduzido, categoria, GPS, hora) guardada separada.
- GPS: ponto único com média de leituras e precisão; trilha com área e perímetro geodésicos.
- Datum: GPS do celular é WGS84. Exportações em WGS84 (EPSG:4326). A conversão para SIRGAS 2000 (EPSG:4674) é praticamente equivalente na escala do projeto (diferença de ordem de 1 m). Decisão a confirmar com o IEF.

## Privacidade (LGPD, Lei 13.709/2018)
Bloco de consentimento antes das perguntas pessoais. Campos sensíveis marcados e exportados em aba separada. Dados ficam no aparelho até o descarregamento.

## Fora do escopo desta fase
Mapa base offline, sincronização em nuvem, aplicativo nativo, GNSS externo de precisão.
