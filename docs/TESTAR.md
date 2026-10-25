# Como testar o Mosaico: no computador e no celular

## Parte 1. No computador (10 minutos)
1. Instale o Node.js (versão 20 ou mais nova) em nodejs.org, se ainda não tiver.
2. Abra um terminal na pasta `mosaicoapp` e rode: `node tools/servir_local.js`
3. No Chrome abra `http://localhost:8080/app/` (o coletor) e, em outra aba, `http://localhost:8080/central/central.html` (a central).
4. Para ver como fica no celular: no coletor aperte F12, depois Ctrl+Shift+M (modo celular) e escolha um modelo (ex.: Pixel 7).
5. GPS falso: no F12, menu ⋮ → *More tools* → *Sensors* → *Location*. Escolha uma cidade ou digite latitude/longitude (ex.: -18.24, -43.61 para o Biribiri). Mude a posição de tempos em tempos para simular o deslocamento.
6. Roteiro sugerido:
   - Aba *Imóveis* → *Importar lista* → `exemplos/imoveis_exemplo.csv`.
   - Aba *Ajustes*: preencha seu nome, R$/km do carro e valor da diária (valores de teste).
   - Aba *Dia* → *Iniciar jornada*. Mude o GPS falso algumas vezes. Abra um imóvel, preencha, marque ponto, caminhe o limite (mude o GPS em 4 cantos), tire uma foto (no computador o app abre o seletor de arquivos). Conclua a visita.
   - Aba *Dia* → *Encerrar jornada* (informe o hodômetro final). Confira o custo do dia.
   - Aba *Enviar* → *Gerar pacote*. O `.zip` vai para a pasta Downloads.
   - Na central: arraste o `.zip`. Veja Resumo, Qualidade, Custos e roteiro, Exportar.
7. Teste offline: no F12 → *Network* → marque *Offline* e recarregue. O app deve abrir normalmente.
8. Testes automáticos (opcional): `cd tests && npm i playwright && npx playwright install chromium && ./rodar_todos.sh`

## Parte 2. Mapa de satélite offline
1. Na central → aba *Mapa offline*. Escolha os parques, o zoom e a fonte da imagem.
2. **Antes de baixar, confirme a licença da imagem** (veja `docs/MAPA_OFFLINE.md`). Zoom 12 a 16 dá cerca de 1.700 tiles (~45 MB).
3. Clique em *Baixar e gerar pacote*. Sai um `mapa_offline_….zip`.
4. No celular: aba *Mapa* → *Importar mapa* → escolha o `.zip`.
5. Alternativa sem navegador: `node tools/baixar_mapa.js --help` (veja o cabeçalho do arquivo).

## Parte 3. No celular Android

### 3A. Teste rápido com cabo USB (sem publicar nada)
Fonte: [Chrome DevTools, port forwarding](https://developer.chrome.com/docs/devtools/remote-debugging/local-server).
1. No celular: *Configurações → Sobre o telefone* → toque 7 vezes em *Número da versão* → *Opções do desenvolvedor* → ligue *Depuração USB*.
2. Conecte o cabo. No Chrome do computador abra `chrome://inspect/#devices`, marque *Discover USB devices*, clique em *Port forwarding*, ative e adicione `8080` → `localhost:8080`.
3. No computador, deixe `node tools/servir_local.js` rodando.
4. No Chrome do celular abra `localhost:8080/app/`. Como é `localhost`, o Chrome libera GPS, câmera e modo offline.
5. Menu ⋮ → *Instalar app* (ou *Adicionar à tela inicial*). Abra o app instalado, importe a lista, faça um imóvel.
6. Desconecte o cabo, ligue o modo avião e abra o app de novo: deve funcionar com os dados.

### 3B. Teste de verdade em campo (precisa de endereço https)
1. Publique **somente a pasta `app/`** em hospedagem estática com https. Exemplo com GitHub Pages: crie um repositório, envie o conteúdo de `app/` para a raiz, vá em *Settings → Pages*, escolha a branch e salve. O endereço será `https://SEU-USUARIO.github.io/NOME-DO-REPO/`. Netlify e Cloudflare Pages servem também.
2. **Não coloque no repositório** a lista de imóveis, pacotes `.zip` nem dados coletados. Só o programa vai para a hospedagem; os dados ficam no celular.
3. No Chrome do celular abra o endereço, com internet, e instale (*Instalar app*). Importe o pacote de mapa e a lista de imóveis.
4. Faça um piloto de meio dia: jornada completa, 3 imóveis, fotos, limite caminhado, pacote ao fim do dia, central no computador.

### Checklist do piloto
- [ ] GPS pega sinal em campo aberto (precisão ±5 m) e sob mata (anote a precisão).
- [ ] Limite caminhado de um imóvel conhecido: compare com a área do CAR.
- [ ] Trajeto do dia: km do app × hodômetro do carro.
- [ ] Bateria: quanto gastou em 4 horas com tela ligada.
- [ ] Mapa offline abre sem sinal e mostra a posição.
- [ ] Pacote chega ao computador (cabo, WhatsApp, Drive) e a central lê.
- [ ] Custos do dia conferem com os comprovantes.

## Parte 4. iPhone (se um dia precisar)
Safari → Compartilhar → *Adicionar à Tela de Início*. Funciona, mas com limites (veja README, seção "APK e iPhone"). Use só como reserva.
