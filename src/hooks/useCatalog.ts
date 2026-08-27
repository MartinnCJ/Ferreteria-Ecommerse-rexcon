import { queryOptions } from "@tanstack/react-query";
import { listCatalog } from "@/lib/catalog.functions";

export const catalogQueryOptions = () =>
  queryOptions({
    queryKey: ["catalog"],
    queryFn: () => listCatalog(),
    staleTime: 60_000,
  });
