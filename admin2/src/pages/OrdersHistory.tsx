import { useEffect, useMemo, useState } from "react";
import { useOrders } from "@/hooks/useOrders";
import type { Order, OrderStatus } from "@/hooks/useOrders";
import { useToast } from "@/hooks/use-toast";
import { formatCurrencyBRL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
// filtros e UI
import { Calendar as CalendarIcon, Search as SearchIcon, CheckCircle2, XCircle, ListOrdered, Banknote } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
// (removido) import da paginação antiga
import { format, addDays } from "date-fns";
import type { DateRange } from "react-day-picker";

// Tipos de filtro
type PresetKey = "personalizado" | "hoje" | "ontem" | "ultimos7" | "ultimos14" | "ultimos30";

const presetLabels: Record<PresetKey, string> = {
  personalizado: "Personalizado",
  hoje: "Hoje",
  ontem: "Ontem",
  ultimos7: "Últimos 7 dias",
  ultimos14: "Últimos 14 dias",
  ultimos30: "Últimos 30 dias",
};

export default function OrdersHistoryPage() {
  const { toast } = useToast();

  // Define estado inicial: HOJE com finalizado e cancelado
  const today = new Date();
  const todayStr = format(new Date(today.getFullYear(), today.getMonth(), today.getDate()), "yyyy-MM-dd");

  const { orders, loading, error, filters, updateFilters, refetch } = useOrders({
    initialFilters: {
      dateFrom: todayStr,
      dateTo: todayStr,
      allowedStatuses: ["finalizado", "cancelado"] as OrderStatus[],
    },
  });


  useEffect(() => {
    if (error) {
      toast({ variant: "destructive", title: "Erro", description: error });
    }
  }, [error, toast]);

  // Estado de presets e intervalo personalizado
  const [preset, setPreset] = useState<PresetKey>("hoje");
  const [range, setRange] = useState<DateRange | undefined>(undefined);

  // Aplica o preset selecionado
  const applyPreset = async (key: PresetKey) => {
    setPreset(key);
    let start: Date;
    let end: Date;
    const base = new Date();

    switch (key) {
      case "hoje": {
        start = new Date(base.getFullYear(), base.getMonth(), base.getDate());
        end = start;
        updateFilters({
          status: undefined,
          allowedStatuses: ["finalizado", "cancelado"] as OrderStatus[],
          dateFrom: format(start, "yyyy-MM-dd"),
          dateTo: format(end, "yyyy-MM-dd"),
          date: undefined,
        });
        break;
      }
      case "ontem": {
        end = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 1);
        start = end;
         updateFilters({
          status: undefined,
          allowedStatuses: ["finalizado", "cancelado"] as OrderStatus[],
          dateFrom: format(start, "yyyy-MM-dd"),
          dateTo: format(end, "yyyy-MM-dd"),
          date: undefined,
        });
        break;
      }
      case "ultimos7": {
        end = new Date(base.getFullYear(), base.getMonth(), base.getDate());
        start = addDays(end, -6);
        updateFilters({
          status: undefined,
          allowedStatuses: ["finalizado", "cancelado"] as OrderStatus[],
          dateFrom: format(start, "yyyy-MM-dd"),
          dateTo: format(end, "yyyy-MM-dd"),
          date: undefined,
        });
        break;
      }
      case "ultimos14": {
        end = new Date(base.getFullYear(), base.getMonth(), base.getDate());
        start = addDays(end, -13);
        updateFilters({
          status: undefined,
          allowedStatuses: ["finalizado", "cancelado"] as OrderStatus[],
          dateFrom: format(start, "yyyy-MM-dd"),
          dateTo: format(end, "yyyy-MM-dd"),
          date: undefined,
        });
        break;
      }
      case "ultimos30": {
        end = new Date(base.getFullYear(), base.getMonth(), base.getDate());
        start = addDays(end, -29);
        updateFilters({
          status: undefined,
          allowedStatuses: ["finalizado", "cancelado"] as OrderStatus[],
          dateFrom: format(start, "yyyy-MM-dd"),
          dateTo: format(end, "yyyy-MM-dd"),
          date: undefined,
        });
        break;
      }
      case "personalizado":
      default: {
        // Não altera filtros até o usuário escolher o range e clicar em Aplicar
        break;
      }
    }
    await refetch();
  };

  // Quando range personalizado muda, aplicamos filtros somente ao confirmar (botão Aplicar)
  useEffect(() => {
    // sem efeito automático
  }, [preset, range?.from, range?.to]);

  // paginação
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const totalItems = orders.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageOrders = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return orders.slice(startIdx, startIdx + pageSize);
  }, [orders, currentPage, pageSize]);

  // Número de página central editável
  const [pageInput, setPageInput] = useState<string>("1");
  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const commitPageInput = () => {
    const n = Math.max(1, Math.min(totalPages, Number(pageInput) || currentPage));
    setPage(n);
    setPageInput(String(n));
  };

  useEffect(() => {
    setPage(1);
  }, [filters.search, filters.status, (filters as any).date, (filters as any).dateFrom, (filters as any).dateTo, (filters as any).allowedStatuses]);

  const statusColor = (s: Order["status"]) => {
    switch (s) {
      case "novo": return "bg-blue-100 text-blue-800";
      case "aceito": return "bg-amber-100 text-amber-800";
      case "producao": return "bg-purple-100 text-purple-800";
      case "entrega": return "bg-cyan-100 text-cyan-800";
      case "finalizado": return "bg-green-100 text-green-800";
      case "cancelado": return "bg-red-100 text-red-800";
      default: return "";
    }
  };

  // helpers de tipo (iguais aos usados no Kanban)
  // const typeColor = (t?: string | null) => {
  //   const v = (t || "delivery").toLowerCase();
  //   switch (v) {
  //     case "delivery": return "bg-cyan-100 text-cyan-800";
  //     case "retirada": return "bg-emerald-100 text-emerald-800";
  //     case "balcao":
  //     case "balcão": return "bg-indigo-100 text-indigo-800";
  //     default: return "bg-slate-100 text-slate-800";
  //   }
  // };
  const typeLabel = (t?: string | null) => {
    const v = (t || "delivery").toLowerCase();
    if (v === "delivery") return "DELIVERY";
    if (v === "retirada") return "RETIRADA";
    if (v === "balcao" || v === "balcão") return "BALCÃO";
    return String(t || "").toUpperCase();
  };
  // const typeLabel = (t?: string | null) => {
  //   const v = (t || "delivery").toLowerCase();
  //   if (v === "delivery") return "DELIVERY";
  //   if (v === "retirada") return "RETIRADA";
  //   if (v === "balcao" || v === "balcão") return "BALCÃO";
  //   return String(t || "").toUpperCase();
  // };

  const titleSuffix = useMemo(() => (loading ? "(carregando...)" : `(${orders.length})`), [loading, orders.length]);

  const metrics = useMemo(() => {
    const total = orders.length;
    const countFinalizado = orders.filter((o) => o.status === "finalizado").length;
    const countCancelado = orders.filter((o) => o.status === "cancelado").length;
    const totalFinalizado = orders.reduce((acc, o) => acc + (o.status === "finalizado" ? (o.total_amount || 0) : 0), 0);
    return { total, countFinalizado, countCancelado, totalFinalizado };
  }, [orders]);

  // Limpar filtros
  const onClear = async () => {
    setRange(undefined);
    updateFilters({ search: "" });
    await applyPreset("hoje");
  };

  return (
    <div className="space-y-6">
      <header className="mb-2">
        <h1 className="text-2xl font-semibold">Histórico de Pedidos</h1>
        <p className="text-muted-foreground">Consulte pedidos finalizados e cancelados.</p>
      </header>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {/* Presets */}
            <div className="md:col-span-2 flex flex-wrap gap-2">
              {(Object.keys(presetLabels) as PresetKey[]).map((k) => (
                <Button key={k} type="button" variant={preset === k ? "default" : "outline"} onClick={() => applyPreset(k)}>
                  {presetLabels[k]}
                </Button>
              ))}
            </div>

            {/* Busca */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Buscar</label>
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  className="pl-9"
                  placeholder="Telefone, nome, endereço ou status (finalizado/cancelado)"
                  title="Filtre por período, telefone, nome do cliente ou parte do endereço."
                  value={filters.search || ""}
                  onChange={(e) => updateFilters({ search: e.target.value })}
                />
              </div>
            </div>

            {/* Calendário de range somente para Personalizado */}
            {preset === "personalizado" && (
              <div className="md:col-span-4">
                <label className="block text-sm font-medium mb-1">Período</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-start">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {range?.from && range?.to ? (
                        <span>
                          {format(range.from, "dd/MM/yyyy")} — {format(range.to, "dd/MM/yyyy")}
                        </span>
                      ) : (
                        <span>Selecione um período</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-2" align="start">
                    <Calendar
                      mode="range"
                      selected={range}
                      onSelect={(r: DateRange | undefined) => setRange(r)}
                      numberOfMonths={2}
                      fixedWeeks
                      initialFocus
                    />
                    <div className="mt-2 flex gap-2">
                      <Button type="button" size="sm" onClick={() => setRange(undefined)} variant="secondary">Limpar</Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={async () => {
                          if (!range?.from || !range?.to) return;
                          const dateFrom = format(range.from, "yyyy-MM-dd");
                          const dateTo = format(range.to, "yyyy-MM-dd");
                          updateFilters({ status: undefined, allowedStatuses: ["finalizado", "cancelado"] as OrderStatus[], dateFrom, dateTo, date: undefined });
                          await refetch();
                        }}
                        disabled={!range?.from || !range?.to}
                      >
                        Aplicar
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <div className="md:col-span-4 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={onClear}>Limpar Tudo</Button>
              <Button type="button" variant="outline" onClick={() => refetch()} disabled={loading}>Atualizar</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Resumo do período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            <Card className="bg-card hover:bg-accent/40 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">Válidos (finalizados)</div>
                    <div className="mt-1 text-2xl font-semibold">{metrics.countFinalizado}</div>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card hover:bg-accent/40 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">Cancelados</div>
                    <div className="mt-1 text-2xl font-semibold">{metrics.countCancelado}</div>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                    <XCircle className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card hover:bg-accent/40 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">Total de pedidos</div>
                    <div className="mt-1 text-2xl font-semibold">{metrics.total}</div>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <ListOrdered className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card hover:bg-accent/40 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">Valor total - Pedidos finalizados</div>
                    <div className="mt-1 text-2xl font-semibold">{formatCurrencyBRL(metrics.totalFinalizado)}</div>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                    <Banknote className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pedidos {titleSuffix}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageOrders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.order_number}</TableCell>
                    <TableCell>
                      <div className="font-medium">{o.customer_name}</div>
                      <div className="text-xs text-muted-foreground">{o.customer_phone}</div>
                      {o.customer_address && <div className="text-xs text-muted-foreground">{o.customer_address}</div>}
                    </TableCell>
                    <TableCell>{typeLabel(o.order_type)}</TableCell>
                    <TableCell>
                      <div className="text-xs uppercase">{o.payment_method || ""}</div>
                      {o.payment_value != null && <div className="text-xs text-muted-foreground">{formatCurrencyBRL(o.payment_value)}</div>}
                    </TableCell>
                    <TableCell>{formatCurrencyBRL(o.total_amount)}</TableCell>
                    <TableCell>
                      {o.status === "cancelado" ? (
                        <div className="flex flex-wrap gap-1">
                          <Badge className={statusColor("finalizado" as Order["status"]) }>finalizado</Badge>
                          <Badge className={statusColor("cancelado")}>cancelado</Badge>
                        </div>
                      ) : (
                        <Badge className={statusColor(o.status)}>{o.status}</Badge>
                      )}
                    </TableCell>
                    <TableCell>{o.created_at ? new Date(o.created_at).toLocaleString() : ""}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">Detalhes</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Pedido {o.order_number}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-3">
                            <div>
                              <div className="text-sm">Cliente: <span className="font-medium">{o.customer_name}</span></div>
                              <div className="text-sm">Telefone: {o.customer_phone}</div>
                              {o.customer_address && <div className="text-sm">Endereço: {o.customer_address}</div>}
                              {o.customer_neighborhood && <div className="text-sm">Bairro: {o.customer_neighborhood}</div>}
                              {o.customer_reference && <div className="text-sm">Ref.: {o.customer_reference}</div>}
                              {o.notes && <div className="text-sm">Obs.: {o.notes}</div>}
                            </div>
                            <div>
                              <div className="font-medium">Itens</div>
                              <div className="space-y-2">
                                {o.items?.map((it, idx) => (
                                  <div key={idx} className="flex justify-between text-sm">
                                    <div>{it.quantity}x {it.product_name}</div>
                                    <div>{formatCurrencyBRL(it.subtotal)}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="flex justify-between font-medium">
                              <span>Total</span>
                              <span>{formatCurrencyBRL(o.total_amount)}</span>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && orders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">Nenhum pedido encontrado.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

           {/* Paginação: número central editável e páginas adjacentes */}
           <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
             <div className="text-sm text-muted-foreground">
               Mostrando {(currentPage - 1) * pageSize + Math.min(1, pageOrders.length)}–{(currentPage - 1) * pageSize + pageOrders.length} de {totalItems}
             </div>
             <div className="flex items-center gap-2">
               {/* Esquerda: duas páginas anteriores */}
               {[2, 1].map((delta) => {
                 const p = currentPage - delta;
                 return p >= 1 ? (
                   <Button key={`prev-${delta}`} variant="outline" size="sm" onClick={() => setPage(p)}>
                     {p}
                   </Button>
                 ) : null;
               })}
               {/* Centro: número editável */}
               <Input
                 type="number"
                 min={1}
                 max={totalPages}
                 className="w-16 text-center"
                 value={pageInput}
                 onChange={(e) => setPageInput(e.target.value)}
                 onBlur={commitPageInput}
                 onKeyDown={(e) => {
                   if (e.key === "Enter") {
                     e.preventDefault();
                     commitPageInput();
                   }
                 }}
               />
               {/* Direita: duas páginas seguintes */}
               {[1, 2].map((delta) => {
                 const p = currentPage + delta;
                 return p <= totalPages ? (
                   <Button key={`next-${delta}`} variant="outline" size="sm" onClick={() => setPage(p)}>
                     {p}
                   </Button>
                 ) : null;
               })}
             </div>
           </div>
        </CardContent>
      </Card>
    </div>
  );
}