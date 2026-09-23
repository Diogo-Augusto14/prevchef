import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

/**
 * O serviço do dia gravado no servidor.
 *
 * Até aqui o estado morava só no localStorage: trocou de computador, o
 * serviço ficava para trás. Agora quem serve o app também guarda o serviço,
 * num arquivo JSON ao lado dos dados simulados. É persistência de protótipo:
 * um restaurante, um arquivo, sem banco e sem conta de usuário, mas o serviço
 * sobrevive ao navegador.
 *
 * Várias telas gravam no mesmo arquivo — duas abas, o caixa e o celular do
 * salão. Para uma não apagar o que a outra lançou, cada gravação leva a
 * `revisao` em que a tela se baseou. Se o arquivo já andou desde então, a
 * gravação é recusada (409) com a versão nova, e a tela refaz as ações dela
 * por cima antes de mandar de novo.
 *
 * O arquivo não entra no Git (é operação, não código) e não é importado por
 * ninguém. O `app/globals.css` tira `data/` da leitura do Tailwind: sem
 * isso, o `next dev` refazia o CSS a cada gravação e recarregava as telas.
 */

export const runtime = "nodejs";

const ARQUIVO = path.join(process.cwd(), "data", "servico.json");

type Gravado = Record<string, unknown> & { revisao?: unknown };

async function lerGravado(): Promise<Gravado | null> {
  try {
    const lido = JSON.parse(await fs.readFile(ARQUIVO, "utf8")) as Gravado;
    // Fora do formato conta como sem arquivo: a próxima gravação conserta,
    // em vez de toda tela levar 409 com um estado que ela não consegue ler.
    return Array.isArray(lido?.ocupacoes) && Array.isArray(lido?.pedidos) ? lido : null;
  } catch {
    // Primeiro uso (sem arquivo) ou conteúdo inválido: sem estado salvo.
    return null;
  }
}

const revisaoDe = (gravado: Gravado | null) =>
  typeof gravado?.revisao === "number" ? gravado.revisao : 0;

/**
 * Quantos ids de ação o arquivo lembra. Serve para uma tela, ao refazer as
 * ações dela por cima da versão nova, pular as que já entraram — a resposta
 * de uma gravação que se perdeu no caminho, por exemplo.
 */
const ACOES_LEMBRADAS = 300;

const soTextos = (lista: unknown): string[] =>
  Array.isArray(lista) ? lista.filter((x): x is string => typeof x === "string") : [];

/*
 * Ler a revisão, comparar e gravar precisa acontecer sem outra gravação no
 * meio — senão duas telas leem a mesma revisão e as duas passam. As
 * gravações entram numa fila e rodam uma de cada vez.
 */
let fila: Promise<unknown> = Promise.resolve();

function umaDeCadaVez<T>(tarefa: () => Promise<T>): Promise<T> {
  const resultado = fila.then(tarefa, tarefa);
  fila = resultado.catch(() => {});
  return resultado;
}

export async function GET(request: NextRequest) {
  const gravado = await lerGravado();

  // As telas perguntam de tempos em tempos "mudou desde a revisão N?".
  // Não mudou: responde curto, sem mandar o serviço inteiro de novo. Revisão
  // diferente, mesmo menor (o arquivo foi trocado por uma cópia antiga), vale
  // como mudança.
  const desde = request.nextUrl.searchParams.get("desde");
  if (desde !== null && revisaoDe(gravado) === Number(desde)) {
    return NextResponse.json({ mudou: false });
  }

  return NextResponse.json({ estado: gravado });
}

export async function PUT(request: NextRequest) {
  let corpo: Gravado & {
    revisaoBase?: unknown;
    acoes?: unknown;
    ocupacoes?: unknown;
    pedidos?: unknown;
  };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  // A mesma conferência de forma que o cliente faz ao ler o localStorage.
  if (!corpo || !Array.isArray(corpo.ocupacoes) || !Array.isArray(corpo.pedidos)) {
    return NextResponse.json({ error: "Estado fora do formato." }, { status: 400 });
  }

  return umaDeCadaVez(async () => {
    const gravado = await lerGravado();
    const revisaoAtual = revisaoDe(gravado);
    const { revisaoBase, acoes, ...estado } = corpo;

    // Sem arquivo (primeiro uso, ou apagado à mão) qualquer tela pode criar.
    // Com arquivo, só quem partiu da versão que está nele.
    if (gravado && revisaoBase !== revisaoAtual) {
      return NextResponse.json({ estado: gravado }, { status: 409 });
    }

    // A revisão é o relógio do servidor e nunca volta: nem apagar o arquivo
    // faz uma tela aberta achar que a versão nova é velha.
    const base = typeof revisaoBase === "number" ? revisaoBase : 0;
    const revisao = Math.max(Date.now(), revisaoAtual + 1, base + 1);
    const aplicadas = [...soTextos(gravado?.aplicadas), ...soTextos(acoes)].slice(
      -ACOES_LEMBRADAS
    );

    try {
      // Grava num temporário e troca: no disco fica o novo inteiro ou o antigo.
      const temporario = `${ARQUIVO}.tmp`;
      await fs.writeFile(
        temporario,
        JSON.stringify({ ...estado, revisao, aplicadas }, null, 2),
        "utf8"
      );
      await fs.rename(temporario, ARQUIVO);
    } catch {
      return NextResponse.json(
        { error: "Não deu para gravar o serviço no disco." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, revisao });
  });
}
