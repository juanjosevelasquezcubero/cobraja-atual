import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { registrarPagamento } from "./server";

export function useRegistrarPagamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (parcelaId: number) => registrarPagamento({ data: { parcelaId } }),
    onSuccess: () => {
      void qc.invalidateQueries();
      toast.success("Pagamento registrado");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Não foi possível registrar.");
    },
  });
}
