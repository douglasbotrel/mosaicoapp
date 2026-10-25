# Fluxo das equipes (versão 1.3.0)

Uma equipe por parque (PEBI e PESN). Cada equipe faz sua rotina e envia pacotes à central. Não há servidor: a troca é por arquivo.

## Ciclo
1. **Central, 1ª vez:** aba *Distribuir aos celulares* → carregar a lista de imóveis (CSV/JSON) → *Gerar arquivo Biribiri* ou *Serra Negra* (`mosaico_distribuicao_<PARQUE>_<data>.json`).
2. **Celular:** *Enviar → Importar lista* e escolher o arquivo. O aparelho passa a ser da equipe daquele parque (muda em *Ajustes*), mostra só os imóveis dele e abre em "A fazer".
3. **Campo:** a coleta fica só no celular.
4. **Fim do dia:** *Enviar → Gerar pacote* e mandar o `.zip` à central (WhatsApp, e-mail, cabo, AirDrop).
5. **Central:** arrastar os pacotes. A central junta por imóvel (vence a versão mais recente) e aponta conflito se dois aparelhos mexeram no mesmo imóvel.
6. **Volta ao campo:** a central gera de novo o arquivo do parque (agora com a situação) e o celular o importa. Imóveis concluídos aparecem como "Na central ✓" e saem da fila "A fazer".
7. **Liberar espaço (opcional):** *Enviar → 4. Liberar espaço* remove do celular só as visitas e fotos que a central confirmou na mesma versão (e com o mesmo número de fotos).

## Regras que evitam duplicação
- Identificador único por imóvel (id da lista; imóveis achados em campo recebem id próprio do aparelho).
- Um registro de visita por imóvel; a central mantém a versão com `atualizado` mais recente.
- Abrir um imóvel "Na central" pede confirmação.
- Um aparelho de uma equipe recusa o arquivo do outro parque.
- A central avisa CAR repetido na conferência da lista.

## Limites
- Sem login: o controle é pelo que cada equipe recebe. Login por pessoa e base compartilhada em tempo real exigem servidor (etapa 2, depende da decisão do IEF sobre o banco).
- Dois celulares da mesma equipe no mesmo imóvel antes de enviar: o conflito aparece só na central.
