# Central no computador do coordenador (versão 1.3.0)

A central é uma página que roda no navegador do computador. Não há servidor nem conta: o que ela recebe fica na **pasta do projeto** que você escolhe.

## Abrir
- **Pela web (mais simples):** `https://douglasbotrel.github.io/mosaicoapp/central/central.html`, no **Chrome ou Edge**. A página é só o programa; os dados ficam na sua pasta.
- **Sem internet:** `node tools/servir_local.js` e abrir `http://localhost:8080/central/central.html`.
- Firefox e Safari não deixam gravar em pasta: neles a central funciona, mas sem a gravação automática.

## Primeira vez
1. Aba **Pasta do projeto** → *Escolher pasta do projeto* e aponte uma pasta (por exemplo `D:\Douglas Trabalhos\Mosaico_dados`). Aceite o pedido de permissão do navegador.
2. Arraste a lista de imóveis (CSV/JSON) e depois os pacotes `.zip` dos celulares.
3. A central grava sozinha após cada carga. Em *Distribuir aos celulares*, gere o arquivo de cada parque; ele é gravado na pasta e vai para as equipes.

## Nos outros dias
Abra a central. Ela reabre a pasta e carrega o projeto sozinha. Se o navegador pedir permissão de novo, use o botão *Reconectar pasta e abrir o projeto* (um clique).

## Como a pasta fica organizada
```
recebidos/PEBI/2026-10-26/   pacotes originais dos celulares (nunca alterados; repetidos ganham -2, -3)
recebidos/PESN/…
lista/                       listas de imóveis carregadas
projeto/projeto_consolidado.zip   base consolidada, regravada a cada carga
projeto/registro.json        histórico de pacotes, conflitos e alertas
projeto/historico/           uma cópia por dia
distribuicao/                arquivos enviados às equipes
exportacoes/2026-10-26/      planilhas, shapefiles, GeoJSON, PDF, fotos
```
Com a pasta ativa, os botões de exportação gravam em `exportacoes/<data>/` em vez de baixar pelo navegador.

## Cuidados
- A pasta guarda dados pessoais de moradores (LGPD): local protegido e **cópia de segurança** (HD externo ou nuvem autorizada). A central não guarda outra cópia.
- Não edite nem apague arquivos da pasta com a central aberta.
- O projeto salvo só é lido ao abrir; se a leitura falhar, a central avisa e **não sobrescreve** nada.
- O navegador lembra da pasta neste perfil do Chrome/Edge. Em outro computador, escolha a pasta de novo (ou copie a pasta e escolha-a).
