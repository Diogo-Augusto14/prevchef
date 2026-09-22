# PrevChef

Protótipo de painel para o gerente de um restaurante: prevê quantas porções de
cada prato saem no dia e transforma isso em lista de compras, prato do dia e
alertas de estoque.

> **O histórico é simulado.** Vendas, fichas técnicas e estoque saem de um
> script gerador (`scripts/gerar-dados.mjs`) e não vêm de um restaurante real.
> Só duas coisas são reais: a **previsão do tempo** (Open-Meteo) e a **análise
> escrita pela IA**. O aviso aparece em todas as telas do app.

Next.js (App Router) + TypeScript + Tailwind. O KNN roda no navegador, em cima
de JSON embutidos no bundle. O único código de servidor é um route handler
(`/api/analise`), que existe para a chave da IA nunca chegar ao navegador.

## Tudo é automático

O gerente escolhe só **o dia** e **a praça**. A partir daí o sistema sozinho:

1. busca a **previsão do tempo real** na Open-Meteo (temperatura e chuva);
2. **detecta o feriado** pela data, incluindo os móveis (Carnaval, Sexta-feira
   Santa, Corpus Christi), calculados a partir da Páscoa;
3. roda o **KNN** com esse cenário e prevê cada prato;
4. cruza com a ficha técnica e o estoque e monta a lista de compras;
5. manda tudo para a **IA**, que devolve a leitura do dia e as sugestões.

Não existe chat, nem campo de pergunta, nem botão de "gerar": mudou o dia ou a
cidade, tudo recalcula.

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
| `/` | **Painel** — escolhe dia, clima (quente/ameno/frio, com ou sem chuva) e feriado; o botão *Gerar previsão* traz previsão por prato com faixa, os dias parecidos usados, lista de compras, destaques, prato do dia e alertas. |
| `/estoque` | **Estoque** — quantidade, validade, dias restantes e em que pratos cada ingrediente entra. |
| `/desempenho` | **Desempenho** — gráfico previsto × real no período de teste (Recharts) e tabela de MAE por método. |

## Os dados simulados

`scripts/gerar-dados.mjs` gera 365 dias de vendas de 5 pratos (feijoada, caldo
verde, salada, parmegiana e frango grelhado). Cada dia tem data, dia da semana,
temperatura, chuva, feriado e início do mês. Os padrões embutidos:

- **sábado** é o dia da feijoada (mais que o dobro da média);
- **frio** puxa o caldo verde para cima, **calor** puxa a salada;
- **chuva** reforça prato quente e derruba salada;
- **feriado** (+28%) e **início do mês** (+16%) mexem no movimento da casa;
- fim do mês segura o movimento, há um leve crescimento ao longo do ano e um
  ruído aleatório em cima de tudo.

A aleatoriedade usa semente fixa, então o histórico é reproduzível.

Também são gerados `data/pratos.json` (ficha técnica: quanto de cada ingrediente
sai por porção) e `data/estoque.json` (quantidade, validade e custo unitário).

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
Dia + praça
   ↓
Open-Meteo (clima real) + detecção de feriado        ← entrada automática
   ↓
KNN sobre 365 dias simulados                          ← inteligência (previsão)
   ↓
Ficha técnica − estoque + padrões históricos          ← inteligência (regras)
   ↓
Modelo de linguagem                                   ← inteligência (leitura)
   ↓
Previsão por prato, lista de compras, prato do dia,
alertas e sugestões                                   ← decisão
```

## Limites do protótipo

- Sem banco de dados: não dá para registrar vendas nem editar o estoque pela
  interface. O histórico vem de arquivo.
- Como os dados são gerados com padrões conhecidos, o erro do modelo é otimista
  em relação a um restaurante de verdade.
- O KNN não tem tendência nem sazonalidade explícitas: ele só copia dias
  parecidos do passado.
- A Open-Meteo prevê até 16 dias. Para datas além disso o sistema usa a média
  histórica da época do ano e avisa na tela.
- A IA pode escrever besteira. Os números são do KNN; o texto é interpretação.
