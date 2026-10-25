/* Esquema do formulário (fonte única para o coletor e para a central).
   Base: TdR 2026.0429.00032-0 / 00037-0, Produtos 3.1, 4.1 e 4.2; Portaria IEF 27/2021.
   Tipos de campo: text, textarea, number, select, multi, bool3, date, time, gps, track, repeat.
   Chaves de dados: "<bloco>.<campo>". Mudou o esquema? Aumente SCHEMA_VERSION. */
(function (root) {
  var SCHEMA_VERSION = 1;
  var SN = [['sim', 'Sim'], ['nao', 'Não'], ['ns', 'Não sei']];
  var NIVEL = [['nenhum', 'Nenhum'], ['baixo', 'Baixo'], ['medio', 'Médio'], ['alto', 'Alto']];
  var BLOCOS = [
    { id: 'b0', titulo: 'Visita', icone: '1', ajuda: 'Dados da visita. O imóvel já vem da lista.', campos: [
      { id: 'situacao_visita', rot: 'Situação da visita', t: 'select', req: true, opts: [['completa', 'Realizada, completa'], ['parcial', 'Realizada, parcial'], ['nao_localizado', 'Imóvel não localizado'], ['ausente', 'Ocupante ausente'], ['recusa', 'Recusou a visita'], ['inviavel', 'Acesso inviável']] },
      { id: 'equipe', rot: 'Equipe', t: 'text', req: true, ph: 'Ex.: Equipe Biribiri' },
      { id: 'data_visita', rot: 'Data', t: 'date', req: true, auto: 'hoje' },
      { id: 'responsavel_campo', rot: 'Quem fez a visita', t: 'text', req: true, ph: 'Nomes da equipe' },
      { id: 'acompanhante_uc', rot: 'Acompanhante da UC', t: 'text', ph: 'Servidor da UC, se houve' },
      { id: 'car_numero', rot: 'Nº do CAR', t: 'text', fmt: 'car', ph: 'MG-0000000-…', auto: 'imovel.car' },
      { id: 'sigef_parcela', rot: 'Parcela SIGEF/INCRA', t: 'text', auto: 'imovel.sigef' },
      { id: 'matricula', rot: 'Matrícula', t: 'text', auto: 'imovel.matricula' },
      { id: 'ccir', rot: 'CCIR', t: 'text', auto: 'imovel.ccir' }
    ] },
    { id: 'b1', titulo: 'Acesso', icone: '2', ajuda: 'Como se chega ao imóvel.', campos: [
      { id: 'ponto_acesso', rot: 'Ponto de acesso (porteira ou entrada)', t: 'gps' },
      { id: 'tipo_via', rot: 'Tipo de via até o imóvel', t: 'select', opts: [['pavimentada', 'Pavimentada'], ['vicinal_boa', 'Vicinal boa'], ['vicinal_ruim', 'Vicinal ruim'], ['trilha', 'Trilha'], ['sem_via', 'Sem via']] },
      { id: 'acesso_com', rot: 'Chega-se com', t: 'select', opts: [['4x2', 'Carro 4x2'], ['4x4', 'Só 4x4'], ['moto', 'Moto'], ['a_pe', 'Só a pé']] },
      { id: 'dist_estrada_km', rot: 'Distância da estrada principal', t: 'number', un: 'km', min: 0, max: 100, step: '0.1' },
      { id: 'caminhada_min', rot: 'Tempo de caminhada', t: 'number', un: 'min', min: 0, max: 600, show: { f: 'b1.acesso_com', eq: 'a_pe' } },
      { id: 'obs_acesso', rot: 'Observações do acesso', t: 'textarea' }
    ] },
    { id: 'b2', titulo: 'Limites e área', icone: '3', ajuda: 'Caminhe o limite com o GPS ligado, ou marque pontos.', campos: [
      { id: 'limite', rot: 'Limite do imóvel (trilha GPS)', t: 'track' },
      { id: 'elementos_limite', rot: 'O que marca o limite', t: 'multi', opts: [['cerca_arame', 'Cerca de arame'], ['cerca_madeira', 'Cerca de madeira'], ['muro', 'Muro'], ['estrada', 'Estrada'], ['curso_agua', 'Curso d\'água'], ['crista', 'Crista de relevo'], ['vegetacao', 'Vegetação'], ['marco', 'Marco'], ['outro', 'Outro'], ['nenhum', 'Nada visível']] },
      { id: 'area_estimada_ha', rot: 'Área estimada', t: 'number', un: 'ha', min: 0, max: 100000, step: '0.01', req: true, fromTrack: 'b2.limite' },
      { id: 'area_car_ha', rot: 'Área no CAR', t: 'number', un: 'ha', min: 0, max: 100000, step: '0.01', auto: 'imovel.area_car_ha' },
      { id: 'compat_car', rot: 'Limite confere com o CAR?', t: 'select', opts: [['sim', 'Confere'], ['parcial', 'Confere em parte'], ['nao', 'Não confere'], ['sem_car', 'Não há CAR'], ['nao_avaliado', 'Não avaliado']] },
      { id: 'obs_limites', rot: 'Observações dos limites', t: 'textarea' }
    ] },
    { id: 'b3', titulo: 'Ocupantes', icone: '4', ajuda: 'Leia o texto de consentimento antes de perguntar.', campos: [
      { id: 'consentimento', rot: 'Consentimento do entrevistado', t: 'select', req: true, consent: true, opts: [['sim', 'Aceitou responder'], ['parcial', 'Aceitou em parte'], ['nao', 'Não quis responder']],
        texto: 'Estamos fazendo um levantamento a pedido do Funbio e do IEF, nos parques estaduais. Vou anotar dados sobre o imóvel e sobre quem mora aqui. Responder é voluntário e o senhor(a) pode pular qualquer pergunta. Este levantamento não negocia nem decide nada em nome do IEF. Posso começar?' },
      { id: 'responsavel_nome', rot: 'Nome do responsável', t: 'text', sens: true },
      { id: 'telefone', rot: 'Telefone', t: 'text', fmt: 'tel', sens: true, inputmode: 'tel' },
      { id: 'cpf', rot: 'CPF (só se necessário)', t: 'text', fmt: 'cpf', sens: true, inputmode: 'numeric' },
      { id: 'vinculo', rot: 'Vínculo com o imóvel', t: 'select', opts: [['proprietario', 'Proprietário com registro'], ['posseiro', 'Posseiro'], ['herdeiro', 'Herdeiro'], ['arrendatario', 'Arrendatário'], ['caseiro', 'Caseiro ou funcionário'], ['sem_titulo', 'Ocupante sem título'], ['outro', 'Outro']] },
      { id: 'tempo_moradia_anos', rot: 'Há quanto tempo mora ou usa o imóvel', t: 'number', un: 'anos', min: 0, max: 120 },
      { id: 'ocupacao_anterior_uc', rot: 'Ocupação anterior à criação do parque?', t: 'select', opts: SN },
      { id: 'ano_inicio', rot: 'Ano em que começou a ocupação', t: 'number', min: 1700, max: 2100, step: '1' },
      { id: 'historico_uso', rot: 'Histórico de uso e ocupação, como relatado', t: 'textarea' }
    ] },
    { id: 'b4', titulo: 'Documentos', icone: '5', ajuda: 'Fotografe cada documento na aba Fotos, categoria Documento.', campos: [
      { id: 'docs_existentes', rot: 'Documentos que o ocupante mostrou', t: 'multi', opts: [['matricula', 'Matrícula'], ['certidao', 'Certidão'], ['escritura', 'Escritura'], ['ccir', 'CCIR'], ['itr', 'ITR'], ['compra_venda', 'Recibo ou contrato de compra e venda'], ['arrendamento', 'Contrato de arrendamento'], ['declaracao_posse', 'Declaração de posse'], ['car', 'Recibo do CAR'], ['outro', 'Outro'], ['nenhum', 'Nenhum']] },
      { id: 'georref', rot: 'Há memorial ou georreferenciamento?', t: 'select', opts: SN },
      { id: 'obs_docs', rot: 'Observações sobre os documentos', t: 'textarea' }
    ] },
    { id: 'b5', titulo: 'Uso do solo', icone: '6', ajuda: 'O que se vê e o que o ocupante conta.', campos: [
      { id: 'usos', rot: 'Usos do solo', t: 'multi', opts: [['pecuaria', 'Pecuária'], ['subsistencia', 'Lavoura de subsistência'], ['perene', 'Lavoura permanente'], ['silvicultura', 'Silvicultura'], ['extrativismo', 'Extrativismo'], ['turismo', 'Turismo ou hospedagem'], ['comercio', 'Comércio'], ['moradia', 'Só moradia'], ['mineracao', 'Mineração'], ['outro', 'Outro'], ['sem_uso', 'Sem uso']] },
      { id: 'area_consolidada_ha', rot: 'Área de uso consolidado', t: 'number', un: 'ha', min: 0, max: 100000, step: '0.01' },
      { id: 'vegetacao', rot: 'Vegetação nativa', t: 'multi', opts: [['mata', 'Mata'], ['mata_ciliar', 'Mata ciliar'], ['cerrado', 'Cerrado'], ['campo_rupestre', 'Campo rupestre'], ['vereda', 'Vereda'], ['outro', 'Outra'], ['nenhuma', 'Nenhuma']] },
      { id: 'area_vegetacao_ha', rot: 'Área de vegetação nativa', t: 'number', un: 'ha', min: 0, max: 100000, step: '0.01' },
      { id: 'benfeitorias', rot: 'Benfeitorias', t: 'repeat', item: 'benfeitoria', campos: [
        { id: 'tipo', rot: 'Tipo', t: 'select', req: true, opts: [['casa', 'Casa'], ['galpao', 'Galpão'], ['curral', 'Curral'], ['acude', 'Açude ou barragem'], ['cerca', 'Cerca'], ['acesso', 'Estrada ou acesso'], ['poco', 'Poço ou cisterna'], ['horta', 'Horta ou pomar'], ['outro', 'Outro']] },
        { id: 'ano', rot: 'Ano estimado de instalação', t: 'number', min: 1700, max: 2100, step: '1' },
        { id: 'estado', rot: 'Estado', t: 'select', opts: [['bom', 'Bom'], ['regular', 'Regular'], ['ruim', 'Ruim'], ['ruina', 'Em ruína']] },
        { id: 'ponto', rot: 'Localização', t: 'gps' },
        { id: 'obs', rot: 'Observação', t: 'text' }
      ] }
    ] },
    { id: 'b6', titulo: 'Socioeconômico', icone: '7', ajuda: 'Só pergunte se houve consentimento. Qualquer pergunta pode ser pulada.', needsConsent: true, campos: [
      { id: 'n_moradores', rot: 'Pessoas que moram no imóvel', t: 'number', min: 0, max: 60, step: '1', sens: true },
      { id: 'faixa_predominante', rot: 'Faixa etária predominante', t: 'select', sens: true, opts: [['0_17', 'Até 17 anos'], ['18_29', '18 a 29'], ['30_59', '30 a 59'], ['60_mais', '60 ou mais']] },
      { id: 'n_60mais', rot: 'Moradores com 60 anos ou mais', t: 'number', min: 0, max: 60, step: '1', sens: true },
      { id: 'escolaridade', rot: 'Escolaridade predominante', t: 'select', sens: true, opts: [['nenhuma', 'Sem escolaridade'], ['fund_inc', 'Fundamental incompleto'], ['fund', 'Fundamental completo'], ['medio', 'Médio'], ['superior', 'Superior']] },
      { id: 'atividades', rot: 'Principais atividades e ocupações', t: 'multi', sens: true, opts: [['agropecuaria', 'Agropecuária'], ['extrativismo', 'Extrativismo'], ['servicos', 'Serviços'], ['comercio', 'Comércio'], ['assalariado', 'Trabalho assalariado fora'], ['aposentado', 'Aposentadoria ou benefício'], ['outro', 'Outra']] },
      { id: 'renda_suficiente', rot: 'A renda cobre as necessidades básicas?', t: 'select', sens: true, opts: [['sim', 'Sim'], ['parcial', 'Em parte'], ['nao', 'Não']] },
      { id: 'moradia_propria', rot: 'A moradia é própria?', t: 'select', opts: [['propria', 'Própria'], ['cedida', 'Cedida'], ['alugada', 'Alugada'], ['funcionario', 'De empregador']] },
      { id: 'material_moradia', rot: 'Material da moradia', t: 'select', opts: [['alvenaria', 'Alvenaria'], ['madeira', 'Madeira'], ['pau_a_pique', 'Pau a pique'], ['misto', 'Misto'], ['outro', 'Outro']] },
      { id: 'agua', rot: 'Água para beber', t: 'select', opts: [['rede', 'Rede'], ['poco', 'Poço'], ['nascente', 'Nascente'], ['cisterna', 'Cisterna'], ['rio', 'Rio ou córrego'], ['pipa', 'Caminhão-pipa'], ['sem', 'Sem fonte']] },
      { id: 'saneamento', rot: 'Esgoto', t: 'select', opts: [['rede', 'Rede'], ['fossa_septica', 'Fossa séptica'], ['fossa_rud', 'Fossa rudimentar'], ['ceu_aberto', 'Céu aberto'], ['nenhum', 'Nenhum']] },
      { id: 'recursos', rot: 'Usa recursos naturais do parque?', t: 'multi', opts: [['agua', 'Água'], ['lenha', 'Lenha'], ['pastagem', 'Pastagem nativa'], ['extrat_veg', 'Extrativismo vegetal'], ['caca_pesca', 'Caça ou pesca'], ['medicinais', 'Plantas medicinais'], ['outro', 'Outro'], ['nenhum', 'Nenhum']] },
      { id: 'doenca_grave', rot: 'Algum morador com doença grave? (Portaria 27/2021)', t: 'select', sens: true, opts: [['sim', 'Sim'], ['nao', 'Não']] }
    ] },
    { id: 'b7', titulo: 'Comunidade tradicional', icone: '8', ajuda: 'Só na Serra Negra. Combine a abordagem com a gestão da UC. Não negocie nada em nome do IEF.', parque: 'PESN', needsConsent: true, campos: [
      { id: 'nome_comunidade', rot: 'Nome da comunidade', t: 'text' },
      { id: 'reconhecimento', rot: 'Reconhecimento', t: 'select', opts: [['palmares', 'Certificada (Fundação Palmares)'], ['em_processo', 'Em processo'], ['auto', 'Autodeclarada'], ['sem_info', 'Sem informação']] },
      { id: 'n_familias', rot: 'Famílias', t: 'number', min: 0, max: 5000, step: '1' },
      { id: 'n_pessoas', rot: 'Pessoas', t: 'number', min: 0, max: 20000, step: '1' },
      { id: 'area_uso_ha', rot: 'Área de uso consolidado', t: 'number', un: 'ha', min: 0, max: 100000, step: '0.01' },
      { id: 'limite_uso', rot: 'Limite da área de uso (trilha GPS)', t: 'track' },
      { id: 'organizacao', rot: 'Organização', t: 'multi', opts: [['associacao', 'Associação'], ['cooperativa', 'Cooperativa'], ['lideranca', 'Liderança reconhecida'], ['informal', 'Grupo informal'], ['nenhuma', 'Nenhuma']] },
      { id: 'lideranca', rot: 'Liderança (nome)', t: 'text', sens: true },
      { id: 'recursos_importantes', rot: 'Recursos importantes para a comunidade', t: 'multi', opts: [['agua', 'Água'], ['terra', 'Terra'], ['floresta', 'Floresta'], ['pesca', 'Pesca'], ['plantas', 'Plantas'], ['outro', 'Outro']] },
      { id: 'metodos', rot: 'Métodos participativos usados', t: 'multi', opts: [['drp', 'Diagnóstico Rápido Participativo'], ['linha_tempo', 'Linha do tempo'], ['fofa', 'Matriz FOFA'], ['roda', 'Roda de conversa'], ['entrevista', 'Entrevista'], ['outro', 'Outro']] },
      { id: 'problemas', rot: 'Problemas ambientais citados', t: 'multi', opts: [['falta_agua', 'Falta de água'], ['desmatamento', 'Desmatamento'], ['contaminacao', 'Contaminação'], ['queimadas', 'Queimadas'], ['outro', 'Outro'], ['nenhum', 'Nenhum']] },
      { id: 'protocolo', rot: 'Abordagem combinada com a gestão da UC?', t: 'bool3' },
      { id: 'notas', rot: 'Notas da atividade', t: 'textarea' }
    ] },
    { id: 'b8', titulo: 'Impactos e conflitos', icone: '9', ajuda: 'O que se vê e o que se ouve.', campos: [
      { id: 'impacto', rot: 'Impacto ambiental da ocupação', t: 'select', opts: NIVEL },
      { id: 'tipos_impacto', rot: 'Tipos de impacto', t: 'multi', show: { f: 'b8.impacto', in: ['baixo', 'medio', 'alto'] }, opts: [['desmatamento', 'Desmatamento'], ['queimada', 'Queimada'], ['erosao', 'Erosão'], ['captacao', 'Captação de água'], ['residuos', 'Resíduos'], ['caca_pesca', 'Caça ou pesca'], ['pastoreio', 'Pastoreio em área sensível'], ['mineracao', 'Mineração'], ['outro', 'Outro']] },
      { id: 'conflito', rot: 'Conflito com vizinhos ou com a UC', t: 'select', opts: NIVEL },
      { id: 'descricao_conflito', rot: 'Descrição do conflito', t: 'textarea', show: { f: 'b8.conflito', in: ['baixo', 'medio', 'alto'] } },
      { id: 'tc_vigente', rot: 'Há Termo de Compromisso vigente?', t: 'select', opts: SN },
      { id: 'tc_numero', rot: 'Nº do Termo de Compromisso', t: 'text', show: { f: 'b8.tc_vigente', eq: 'sim' } }
    ] },
    { id: 'b9', titulo: 'Classificação', icone: '10', ajuda: 'Avaliação da equipe, ao fim da visita.', campos: [
      { id: 'consolidacao', rot: 'Grau de consolidação da ocupação', t: 'select', opts: [['baixo', 'Baixo'], ['medio', 'Médio'], ['alto', 'Alto']] },
      { id: 'nivel_conflito', rot: 'Nível de conflito', t: 'select', opts: NIVEL },
      { id: 'impacto_class', rot: 'Impacto ambiental', t: 'select', opts: NIVEL },
      { id: 'viabilidade', rot: 'Viabilidade de solução negociada', t: 'select', opts: [['alta', 'Alta'], ['media', 'Média'], ['baixa', 'Baixa']] },
      { id: 'tipologia', rot: 'Tipologia de encaminhamento', t: 'multi', opts: [['desapropriacao', 'Prioritário para desapropriação'], ['risco_socioamb', 'Alto risco socioambiental'], ['risco_juridico', 'Alto risco jurídico'], ['nenhuma', 'Nenhuma ainda']] },
      { id: 'portaria27', rot: 'Critérios da Portaria IEF 27/2021', t: 'multi', opts: [['idoso_doenca', 'Idade 60+ ou doença grave'], ['infra_uc', 'Área para infraestrutura da UC'], ['concessao', 'Interesse para concessão'], ['impacto', 'Ocupação com impacto'], ['tc', 'Termo de Compromisso firmado'], ['dividas', 'Dívidas com o Estado'], ['excepcional', 'Razão excepcional']] },
      { id: 'justificativa', rot: 'Justificativa', t: 'textarea' }
    ] },
    { id: 'b10', titulo: 'Fotos e fechamento', icone: '11', ajuda: 'Confira as fotos e marque o que ficou pendente.', campos: [
      { id: 'drone_arquivos', rot: 'Arquivos de drone ligados a este imóvel', t: 'text', ph: 'Ex.: DJI_0123 a DJI_0140' },
      { id: 'pendencias', rot: 'Pendências', t: 'multi', opts: [['docs', 'Voltar para ver documentos'], ['foto', 'Falta foto'], ['gps', 'Falta ponto ou limite GPS'], ['entrevista', 'Falta entrevistar morador'], ['uc', 'Combinar com a gestão da UC'], ['outro', 'Outra']] },
      { id: 'observacoes', rot: 'Observações gerais', t: 'textarea' }
    ] }
  ];
  var FOTO_CATS = [['limite', 'Limite'], ['area_interna', 'Área interna'], ['benfeitoria', 'Benfeitoria'], ['acesso', 'Acesso'], ['documento', 'Documento'], ['impacto', 'Impacto ambiental'], ['outro', 'Outra']];
  var PARQUES = [['PEBI', 'PE do Biribiri'], ['PESN', 'PE da Serra Negra']];
  var api = { SCHEMA_VERSION: SCHEMA_VERSION, BLOCOS: BLOCOS, FOTO_CATS: FOTO_CATS, PARQUES: PARQUES, SN: SN };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MOSAICO_SCHEMA = api;
})(typeof self !== 'undefined' ? self : this);
