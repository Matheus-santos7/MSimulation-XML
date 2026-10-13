"use client";

import { useEffect } from "react";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppError({ error, reset }: Props) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const isUnavailable =
    /indispon|unavailable|timeout|ETIMEDOUT/i.test(error.message) ||
    error.message === "Banco de dados indisponível";

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-sm w-full text-center space-y-4">
        <h2 className="text-base font-semibold">
          {isUnavailable ? "Serviço temporariamente indisponível" : "Erro ao carregar a página"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isUnavailable
            ? "O banco de dados está acordando. Aguarde alguns segundos e tente novamente."
            : "Ocorreu um erro inesperado. Tente recarregar a página."}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
