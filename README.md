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
de JSON embutidos no bundle. O único código de servidor é um route handler
(`/api/analise`), que existe para a chave da IA nunca chegar ao navegador.

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

Não existe chat, nem campo de pergunta, nem botão de "gerar": mudou o dia ou o
lugar, tudo recalcula.

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
| `/` | **Painel** — previsão de venda por prato, curva de chegada por hora, lista de compras, prato do dia, alertas e a leitura da IA. |
| `/servico` | **Serviço** — mapa do salão, fila de espera, reservas, lançamento de pedido, fechamento de conta e a alocação de mesa pré-calculada para grupos de 1 a 6. |
| `/cozinha` | **Cozinha** — fila de produção sequenciada por tempo de preparo, carga dos postos e o que ainda dá para fazer. |
| `/estoque` | **Estoque** — quantidade, validade e a linha do tempo até vencer. |
| `/desempenho` | **Desempenho** — previsto × real no período de teste e a tabela de MAE. |

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
sai por porção) e `data/estoque.json` (quantidade, validade e custo unitário).

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

1. quem já está na fila recebe as mesas livres, por ordem de chegada;
2. uma mesa com reserva chegando fica guardada a partir de uma refeição antes
   (55 min) — entregá-la a quem chega agora estouraria o horário marcado;
3. o que sobra é o que a recepção pode oferecer na porta.

Por isso a resposta para "entrou um grupo de 6" muda sozinha quando alguém
entra na fila ou marca uma mesa. A reserva é devolvida 20 min depois do
horário, se não aparecerem.

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
mesmo dia da semana". Nos dados simulados o KNN erra cerca de 40% menos que
essa régua.

`lib/previsao.ts` — o que o gerente realmente lê: lista de compras
(previsão × ficha técnica − estoque, descartando o que está vencido na data),
destaques, prato do dia (escolhido pelo ingrediente mais perto de vencer) e
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
renderiza em cartões.

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

- Sem banco de dados: o serviço do dia (mesas, pedidos, fila, reservas e
  contas) vive no `localStorage` do navegador. Fecha a aba num computador e
  abre em outro, o serviço não vai junto.
- As contas fechadas não voltam para o histórico: o `data/vendas.json` continua
  sendo o passado de onde o KNN aprende.
- Como os dados são gerados com padrões conhecidos, o erro do modelo é otimista
  em relação a um restaurante de verdade.
- O KNN não tem tendência nem sazonalidade explícitas: ele só copia dias
  parecidos do passado.
- A Open-Meteo prevê até 16 dias. Para datas além disso o sistema usa a média
  histórica da época do ano e avisa na tela.
- A IA pode escrever besteira. Os números são do KNN; o texto é interpretação.
