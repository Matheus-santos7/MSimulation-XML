import type { Metadata } from "next";
// import { AvancoCdForm } from "@/components/avanco-cd-form";
import { PageHeader } from "@/components/fiscal-ui";
// import { UnidadesLogisticasImportForm } from "@/components/unidades-logisticas-import-form";
import { UnidadesLogisticasTable } from "@/components/unidades-logisticas-table";
import { isAdminRole } from "@/lib/auth/roles";
import { getAuthMe } from "@/lib/auth/session";
import { listProducts, listUnidadesLogisticas } from "@/lib/fiscal-api";

// Define a tag <title> do HTML gerado pelo Next.js para SEO e aba do navegador
export const metadata: Metadata = { title: "Unidades Logísticas" };

// A partir do Next.js 15, os searchParams (query string da URL) são Assíncronos (Promises)
type Props = {
  searchParams: Promise<{ q?: string; cnpj?: string }>;
};

// Como é um Server Component, a função pode ser 'async' para buscar dados diretamente
export default async function UnidadesLogisticasPage({ searchParams }: Props) {
  // Aguarda a resolução dos parâmetros da URL.
  // 'q' é o texto de busca (nome/código) e 'cnpj' é a busca específica por empresa
  const { q, cnpj } = await searchParams;

  // Promise.all executa as três buscas ao mesmo tempo. 
  // Isso reduz o tempo de resposta pela métrica da requisição mais demorada, em vez da soma de todas.
  const [unidades, products, me] = await Promise.all([
    listUnidadesLogisticas({
      q: q?.trim() || undefined,
      cnpj: cnpj?.trim() || undefined,
      ativa: true, // Traz apenas unidades em funcionamento
    }),
    listProducts(),
    getAuthMe(), // Pega os dados do usuário autenticado no cookie/sessão atual
  ]);

  // Verifica as permissões de quem está acessando a página
  const isAdmin = isAdminRole(me?.role);

  // Procura na lista de unidades (que já vêm do banco com a flag 'padrao') 
  // qual delas é o Centro de Distribuição oficial selecionado por esta empresa.
  const padrao = unidades.find((u) => u.padrao);

  return (
    <div className="p-6 space-y-4">
      {/* Cabeçalho padrão da UI */}
      <PageHeader
        title="Unidades Logísticas"
        subtitle="Catálogo global Meli Full — cada empresa define o CD padrão para remessas"
      />

      {/* Banner de aviso (Alerta). 
        Se existir um CD padrão, fica sutil e com cores de sucesso (accent).
        Se não existir, fica cinza (muted) alertando o usuário sobre a necessidade de definir um.
      */}
      <div
        className={`rounded-lg border px-4 py-3 text-sm ${
          padrao ? "border-accent/30 bg-accent/5" : "border-border bg-muted/30"
        }`}
      >
        {padrao ? (
          <p>
            <span className="text-muted-foreground">CD padrão de remessa da sua empresa: </span>
            <span className="font-medium">
              {padrao.codigo} — {padrao.nome} ({padrao.endereco.municipio}/{padrao.endereco.uf})
            </span>
          </p>
        ) : (
          <p className="text-muted-foreground">
            Nenhum CD padrão definido. Clique em &quot;Usar como padrão&quot; na unidade que sua empresa
            utiliza — será o destino das remessas automáticas de produtos.
          </p>
        )}
      </div>

      {/* Renderização condicional: Botão/Form de importar planilhas só aparece para Super Admins */}
      {/* {isAdmin ? <UnidadesLogisticasImportForm /> : null} */}

      {/* Formulário para avançar o estoque/produtos para os CDs */}
      {/* <AvancoCdForm products={products} unidades={unidades} /> */}

      <div className="space-y-3">
        {/* Formulário de Busca.
          Ele não tem evento onSubmit, action ou chamadas de API do lado do cliente (use client).
          Como é um form nativo do HTML sem 'action', quando o usuário clica em "Filtrar"
          o navegador faz um GET para a URL atual adicionando os inputs como query string.
          Ex: /unidades-logisticas?q=Cajamar&cnpj=
          Isso recarrega o Server Component com os novos dados. Padrão excelente!
        */}
        <form className="flex flex-wrap gap-2 items-end">
          <label className="flex-1 min-w-[200px] space-y-1">
            <span className="text-xs text-muted-foreground">Buscar código, nome ou UF</span>
            {/* O defaultValue mantém o que o usuário digitou após a página recarregar com o filtro */}
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Ex.: SP02, Cajamar, SC"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex-1 min-w-[200px] space-y-1">
            <span className="text-xs text-muted-foreground">CNPJ</span>
            <input
              name="cnpj"
              defaultValue={cnpj ?? ""}
              placeholder="Ex.: 12.345.678/0001-99"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm font-mono"
            />
          </label>
          <button
            type="submit"
            className="rounded border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            Filtrar
          </button>
        </form>

        {/* Repassa as unidades processadas pelo backend para a tabela de listagem */}
        <UnidadesLogisticasTable unidades={unidades} />
      </div>
    </div>
  );
}