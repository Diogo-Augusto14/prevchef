# PrevChef

Sistema de gestão de restaurante: prevê a venda de cada prato e a chegada de
gente por hora, cuida do salão e da fila de espera, sequencia a cozinha e
controla o que ainda dá para vender.

> **Nota para quem lê o código:** o histórico de vendas, as fichas técnicas, o
> estoque e o salão saem de um script gerador (`scripts/gerar-dados.mjs`) e não
> vêm de um restaurante real — é um trabalho de faculdade. Reais são a
> **previsão do tempo** (Open-Meteo), a **localização do aparelho** e a
> **análise escrita pela IA**.

Next.js (App Router) + TypeScript + Tailwind. O KNN roda no navegador, em cima
de JSON embutidos no bundle. O código de servidor são dois route handlers:
`/api/analise`, que existe para a chave da IA nunca chegar ao navegador, e
`/api/servico`, que grava o serviço do dia em `data/servico.json` para ele
sobreviver à troca de navegador ou de computador — e para várias telas
abertas ao mesmo tempo enxergarem umas às outras sem uma gravar por cima da
outra.

## Tudo é automático

O gerente escolhe só **o dia**. A partir daí o sistema sozinho:

1. pega a **localização do aparelho** (`navigator.geolocation`) e traduz a
   coordenada em nome de lugar;
2. busca a **previsão do tempo real** na Open-Meteo para aquele ponto;
3. **detecta o feriado** pela data, incluindo os móveis (Carnaval, Sexta-feira
   Santa, Corpus Christi), calculados a partir da Páscoa;
4. roda o **KNN** com esse cenário e prevê cada prato;
5. cruza com a ficha técnica e o estoque e monta a lista de compras;
6. manda tudo para a **IA**, que devolve a leitura do dia e as sugestões.

Não existe chat nem campo de pergunta: mudou o dia ou o lugar, a previsão
recalcula. A leitura da IA sai sozinha na primeira abertura do dia e fica
guardada neste navegador (uma por dia e por lugar); "Gerar de novo" pede outra.

### Localização e privacidade

O navegador só entrega a posição depois que a pessoa autoriza — não há como
contornar isso, e é assim que deve ser. Se ela recusar, o painel cai para uma
lista de cidades e continua funcionando.

A coordenada é **arredondada para 2 casas decimais (~1,1 km) antes de sair do
navegador**, e a posição exata nunca é guardada. Quem recebe essa coordenada
aproximada é a Open-Meteo (para o clima) e a BigDataCloud (para o nome do
lugar). Nenhuma das duas pede chave, e nada disso passa pelo nosso servidor.

## Como rodar

```bash
npm install
cp .env.example .env.local   # e preencha OLLAMA_API_KEY
npm run dados                # (re)gera os JSON em data/
npm run dev                  # http://localhost:3000
```

Sem a chave o app **continua funcionando**: previsão, compras, estoque e
desempenho seguem normais e só o cartão da IA mostra um aviso de configuração.

A previsão do tempo não precisa de chave (a Open-Meteo é aberta).

## Telas

| Rota | O que mostra |
| --- | --- |
| `/` | **Painel** — previsão de venda por prato, curva de chegada por hora, lista de compras, prato do dia, alertas, a leitura da IA e o fechamento do dia (previsto × realizado; o dia fechado volta para o histórico do KNN). Se ainda há mesa ocupada ou pedido em aberto, o fechamento avisa que eles ficam de fora, mas deixa fechar. |
| `/servico` | **Serviço** — mapa do salão com as mesas ocupadas (há quanto tempo e o parcial de cada uma), fila de espera, reservas, lançamento e cancelamento de pedido (por item), fechamento de conta, cardápio do dia (preço e pausa) e a alocação de mesa pré-calculada para grupos de 1 a 6. Grupo maior recebe junção de até 3 mesas — na porta, na fila e nas reservas — e a junção fecha numa conta só. |
| `/cozinha` | **Cozinha** — fila de produção sequenciada por tempo de preparo, numa linha do tempo com a hora do relógio: cada prato na cor do seu posto, a hora em que cada mesa sai inteira, o prazo de 30 min de cada mesa e o motivo quando ela espera (posto cheio). Pedido em preparo desconta o tempo que já passou no fogo; "Adiantar" aparece quando o plano manda esperar. Mais a carga dos postos e o que ainda dá para fazer. |
| `/estoque` | **Estoque** — o que girar primeiro, entrada (lote com validade, custo e fornecedor) e perda (com motivo; maior que o saldo, avisa e lança assim mesmo, e o saldo para em zero), os últimos movimentos e a linha do tempo até vencer. O saldo não é editado à mão: sai do razão de movimentos por lote, e a venda baixa do lote que vence primeiro. |
| `/desempenho` | **Desempenho** — previsto × real no período de teste, a tabela de MAE e por que o sistema usa K = 5. |

As telas de operação contam a partir da data de hoje, pelo relógio do
aparelho: o painel abre no dia de hoje, e serviço, cozinha e estoque calculam
previsão, disponibilidade e validade para hoje. O desempenho é a exceção: ele
avalia sempre o mesmo período de teste, para a nota do modelo não mudar com o
calendário. O trilho de cada tela (o dia, os
alertas, as ações) rola junto com a página em vez de ficar preso à janela,
para o fim dele nunca ficar escondido.

## Os dados simulados

`scripts/gerar-dados.mjs` gera 365 dias de vendas de 5 pratos (feijoada, caldo
verde, salada, parmegiana e frango grelhado). Cada dia tem data, dia da semana,
temperatura, chuva, feriado e início do mês. Os padrões embutidos:

- **sábado** é o dia da feijoada (mais que o dobro da média);
- **frio** puxa o caldo verde para cima, **calor** puxa a salada;
- **chuva** reforça prato quente e derruba salada;
- **feriado** (+28%) e **início do mês** (+16%) mexem no movimento da casa;
- fim do mês segura o movimento, há um leve crescimento ao longo do ano e um
  ruído aleatório em cima de tudo;
- cada dia guarda também a **chegada de pessoas por hora**, derivada do total de
  porções daquele dia, para o histórico ficar coerente consigo mesmo. Dia útil
  tem pico de almoço curto e forte; fim de semana almoça mais tarde e estica a
  tarde; chuva segura o jantar.

A aleatoriedade usa semente fixa, então o histórico é reproduzível.

Também são gerados `data/pratos.json` (ficha técnica: quanto de cada ingrediente
sai por porção), `data/estoque.json` (quantidade, validade e custo unitário) e
`data/restaurante.json` (mesas, postos da cozinha, horas de serviço e tempo
médio de refeição).

As validades de `data/estoque.json` contam a partir do dia em que os dados
foram gerados (`GERADO_EM`, em `lib/dados.ts`) e andam com o calendário: um
lote da carga inicial que vencia 3 dias depois da geração continua vencendo 3
dias depois de hoje, então o estoque não vence parado entre uma apresentação e
outra. O lote que entra pela tela `/estoque` guarda a validade digitada.

## As quatro inteligências

O projeto não usa um tipo só de IA. Cada problema pede o método certo:

| Camada | Técnica | Onde |
| --- | --- | --- |
| Previsão de demanda | KNN de regressão | venda por prato e chegada por hora |
| Otimização | sequenciamento com restrição de capacidade | fila da cozinha |
| Sistema de regras | melhor encaixe, teto de estoque, janela de reserva | mesas, fila e disponibilidade |
| Linguagem | modelo generativo | leitura do dia |

### Uma mesa livre nem sempre está disponível

Ocupação, fila de espera e reserva entram no **mesmo** cálculo, nesta ordem:

1. quem já está na fila recebe as mesas livres, por ordem de chegada —
   juntando até 3 quando nenhuma sozinha comporta o grupo, ou prevendo qual
   junção fecha primeiro entre as mesas que vão vagar;
2. uma mesa com reserva chegando fica guardada a partir de uma refeição antes
   (55 min) — entregá-la a quem chega agora estouraria o horário marcado;
3. o que sobra é o que a recepção pode oferecer na porta.

Por isso a resposta para "entrou um grupo de 6" muda sozinha quando alguém
entra na fila ou marca uma mesa. A reserva é devolvida 20 min depois do
horário, se não aparecerem.

Mesas juntadas viram **um grupo só**: as mesas levam a mesma marca e fecham
numa conta única, com as pessoas somadas, os pedidos lançados em qualquer uma
delas e o horário de quem sentou primeiro. Tocar qualquer mesa da junção abre
o grupo inteiro; a cozinha vê a mesa onde cada pedido foi lançado, que é para
onde o prato vai.

### Várias telas, um serviço só

O caixa, a cozinha e o celular do salão podem estar abertos ao mesmo tempo.
Cada tela sabe em que versão do serviço ela se baseia e guarda as ações que
ainda não subiram. Ao gravar, diz ao servidor "parti da versão tal"; se outra
tela gravou antes, o servidor recusa e devolve a versão nova. A tela então
**refaz as próprias ações por cima** e grava de novo — cada ação confere outra
vez as condições (a mesa ainda está livre? o grupo ainda é o mesmo? o pedido
ainda está na cozinha? a conta ainda dá o total que o caixa confirmou?), e a
que não cabe mais cai, com um aviso que fica na tela até alguém ler. Ninguém
apaga o que o outro lançou. Cada ação leva um id, e o servidor lembra os
últimos: se a gravação chegou mas a resposta se perdeu, a tela não refaz a
mesma ação em dobro.

Outra aba do mesmo navegador aparece na hora (o `localStorage` avisa as
outras abas); outro aparelho aparece em até 5 segundos, quando a tela pergunta
ao servidor se algo mudou. Quem está operando é de cada aba: dá para deixar o
caixa numa e a cozinha na outra.

**Só a última chama um modelo de linguagem, e uma vez por dia.** Pedido, mesa e
estoque são aritmética: precisam ser exatos, instantâneos e dar o mesmo
resultado sempre. Se um modelo decidisse quantas porções ainda dá para fazer,
poderia errar a conta e liberar a venda de um prato que não existe.

## O modelo

`lib/knn.ts` — KNN de regressão rodando no navegador:

- atributos normalizados de 0 a 1 (temperatura pelo mínimo/máximo do histórico;
  chuva, feriado e início do mês como 0/1);
- **dia da semana entra como igual/diferente** (0 ou 1), não como número;
- distância euclidiana, **K = 5** por padrão;
- devolve a previsão (média dos vizinhos), a **faixa** (menor e maior venda
  entre eles) e **os 5 dias usados**, que a tela mostra numa tabela.

`lib/mae.ts` — avaliação honesta: treino nos 10 primeiros meses, teste nos 2
últimos, e o MAE do KNN com K = 3, 5 e 7 contra a régua "média histórica do
mesmo dia da semana". Nos dados simulados a régua erra 7,89 porções por prato
por dia, e o KNN erra 5,26 com K = 3 (33% menos), 5,50 com K = 5 (cerca de 30%
menos) e 5,41 com K = 7. O sistema usa **K = 5**: a diferença para o K = 3 é
pequena (0,24 porção) e, com mais vizinhos, um dia atípico pesa menos na média
e a previsão fica mais estável. A tela `/desempenho` mostra o melhor K e o K do
sistema, cada um com o seu ganho sobre a régua. Se `npm run dados` for rodado
de novo, confira os números outra vez.

`lib/previsao.ts` — o que o gerente realmente lê: lista de compras
(previsão × ficha técnica − estoque, descartando o que está vencido na data),
prato do dia (escolhido pelo ingrediente mais perto de vencer) e
alertas.

`lib/padroes.ts` — reconhecimento de padrões: média por dia da semana, por
faixa de temperatura, com e sem chuva, em feriado e no início do mês. É o
"o que é comum vender" que a IA recebe para justificar as sugestões.

## A camada de IA

`app/api/analise/route.ts` — route handler que chama o **Ollama Cloud**
(`gpt-oss:20b-cloud`). Ele **não é um chatbot**: não existe mensagem do
usuário. O painel envia sozinho um pacote com o clima real, a previsão do KNN,
os padrões históricos e a situação do estoque, e o modelo devolve **JSON
estruturado** (`resumo`, `clima`, `padrao`, `sugestoes[]`, `atencao`) que a tela
mostra num cartão.

Cuidados embutidos:

- a chave fica só no servidor, em `.env.local`, fora do Git;
- o prompt proíbe inventar números — a previsão vem do KNN, a IA só interpreta;
- o prompt diz que o histórico é simulado, para a IA não afirmar o contrário;
- a resposta é parseada com tolerância (o modelo às vezes embrulha o JSON em
  crases) e, se vier fora do formato, a tela mostra erro em vez de quebrar;
- o cartão avisa na interface que aquele texto foi escrito por um modelo e pode
  errar.

## Fluxo (entrada → inteligência → decisão)

```
Dia (único campo)
   ↓
Localização do aparelho → Open-Meteo (clima real)
       + detecção de feriado                         ← entrada automática
   ↓
KNN sobre 365 dias de histórico                       ← inteligência (previsão)
       venda por prato + chegada por hora
   ↓
Ficha técnica − estoque + padrões históricos          ← inteligência (regras)
   ↓
Modelo de linguagem                                   ← inteligência (leitura)
   ↓
Previsão por prato, lista de compras, prato do dia,
alertas e sugestões                                   ← decisão
```

## Limites do protótipo

- Sem banco de dados: o serviço do dia (mesas, pedidos, fila, reservas, contas
  e cardápio) é um arquivo JSON gravado pelo servidor do app
  (`data/servico.json`, fora do Git), com o `localStorage` de cópia local para
  quando o servidor não responde. É um servidor e um arquivo: com dois
  servidores do app rodando, cada um teria o seu.
- Outro aparelho aparece em até 5 segundos, não na hora. Sem servidor, a tela
  segue funcionando e sobe o que fez quando ele volta, refazendo por cima do
  que as outras gravaram. Só se ela for recarregada ainda sem servidor, o que
  fez vira uma cópia parada no `localStorage`; aí, se outra tela gravou nesse
  meio-tempo, vale a versão do servidor, essa cópia se perde e a tela avisa.
- A junção é decidida na chegada do grupo (na porta, na fila ou na reserva):
  não dá para juntar uma mesa livre a um grupo que já sentou, nem separar a
  conta do grupo depois.
- Um lote vencido que ainda está na câmara faz o ingrediente inteiro contar
  como vencido, mesmo o saldo dos lotes bons, até a perda desse lote ser
  lançada em `/estoque`.
- Para voltar ao serviço de exemplo (antes de uma demonstração, por exemplo),
  o gerente usa **Recomeçar com o serviço de exemplo**, no trilho de
  `/servico`: troca tudo pelo exemplo, inclusive estoque, dias fechados e
  cardápio de hoje, e dá para desfazer. Sem o app aberto, dá para fazer à mão:
  feche as outras abas do app, apague **os dois**: o `data/servico.json` e a
  chave `prevchef:operacao:v2` do `localStorage` (no console do navegador,
  `localStorage.removeItem("prevchef:operacao:v2")`), e recarregue. Se só um
  for apagado, o outro devolve o estado. Isso também descarta os dias fechados.
- Sem login nem senha: quem está operando é escolhido no cabeçalho, e o papel
  (gerente, caixa, salão, cozinha) limita o que a tela deixa fazer — só o
  gerente movimenta estoque, mexe no cardápio e fecha o dia; só gerente e caixa
  fecham conta. É separação de função, não segurança: qualquer um troca de
  operador. Cada pedido, conta fechada e movimento de estoque guarda quem fez.
- O botão **Desfazer**, no cabeçalho, volta a última ação (pedido, cozinha,
  conta, estoque, salão, cardápio ou fechamento do dia) e mostra o nome dela.
  Só aparece para quem tem o papel que aquela ação pede. Guarda até 25 passos,
  só enquanto a página está aberta: recarregar zera a pilha, e ela também zera
  quando outra tela muda o serviço — voltar a um estado de antes apagaria o
  que a outra fez.
- O `data/vendas.json` é só a carga inicial simulada: fechar o dia apura o
  serviço real e devolve o registro para o histórico que o KNN consulta.
- Como os dados são gerados com padrões conhecidos, o erro do modelo é otimista
  em relação a um restaurante de verdade.
- O KNN não tem tendência nem sazonalidade explícitas: ele só copia dias
  parecidos do passado.
- A Open-Meteo prevê até 16 dias. Para datas além disso o sistema usa a média
  histórica da época do ano e avisa na tela.
- A IA pode escrever besteira. Os números são do KNN; o texto é interpretação.
