import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useOrders } from "@/hooks/useOrders";
import type { Order, OrderStatus, PaymentMethod } from "@/hooks/useOrders";
import { useToast } from "@/hooks/use-toast";
import { formatCurrencyBRL, cn, assetUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
// Removido: import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ClockIcon, DotsHorizontalIcon, Pencil2Icon, TrashIcon } from "@radix-ui/react-icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { httpClient } from "@/lib/http";

// ----- Helpers -----
function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatTimeHHMM(iso?: string) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function pmLabel(pm?: PaymentMethod | null) {
  if (!pm) return "";
  switch (pm) {
    case "pix": return "PIX";
    case "dinheiro": return "DINHEIRO";
    case "cartao": return "CARTÃO";
    default: return String(pm).toUpperCase();
  }
}
function statusLabel(s: OrderStatus) {
  switch (s) {
    case "novo": return "Novo";
    case "aceito": return "Aceito";
    case "producao": return "Produção";
    case "entrega": return "Entrega";
    case "finalizado": return "Finalizado";
    case "cancelado": return "Cancelado";
    default: return s;
  }
}

function statusColor(s: OrderStatus) {
  switch (s) {
    case "novo": return "bg-blue-100 text-blue-800";
    case "aceito": return "bg-amber-100 text-amber-800";
    case "producao": return "bg-purple-100 text-purple-800";
    case "entrega": return "bg-cyan-100 text-cyan-800";
    case "finalizado": return "bg-green-100 text-green-800";
    case "cancelado": return "bg-red-100 text-red-800";
    default: return "";
  }
}

// adiciona cor e rótulo para o tipo de pedido
function typeColor(t?: string | null) {
  const v = (t || "delivery").toLowerCase();
  switch (v) {
    case "delivery": return "bg-cyan-100 text-cyan-800";
    case "retirada": return "bg-emerald-100 text-emerald-800";
    case "balcao":
    case "balcão": return "bg-indigo-100 text-indigo-800";
    default: return "bg-slate-100 text-slate-800";
  }
}
function typeLabel(t?: string | null) {
  const v = (t || "delivery").toLowerCase();
  if (v === "delivery") return "DELIVERY";
  if (v === "retirada") return "RETIRADA";
  if (v === "balcao" || v === "balcão") return "BALCÃO";
  return String(t || "").toUpperCase();
}
type ColumnKey = "novos" | "producao" | "entrega" | "finalizados";

function getColumnKey(o: Order): ColumnKey {
  if (o.status === "producao" || o.status === "aceito") return "producao";
  if (o.status === "entrega") return "entrega";
  if (o.status === "finalizado" || o.status === "cancelado") return "finalizados";
  return "novos"; // inclui apenas "novo"
}

// function allowedTransition(order: Order, target: ColumnKey): { allowed: boolean; newStatus?: OrderStatus } {
//   const s = order.status;
//   if (target === "novos") return { allowed: false };
//   if (target === "producao") {
//     if (s === "novo" || s === "aceito") return { allowed: true, newStatus: "producao" };
//     return { allowed: false };
//   }
//   if (target === "entrega") {
//     if (s === "producao" || s === "aceito") return { allowed: true, newStatus: "entrega" };
//     return { allowed: false };
//   }
//   if (target === "finalizados") {
//     if (s === "entrega") return { allowed: true, newStatus: "finalizado" };
//     return { allowed: false };
//   }
//   return { allowed: false };
// }

// ----- DnD Components -----
function DroppableColumn(props: { id: string; className?: string; children: any }) {
  // Removido DnD: apenas um wrapper simples
  const { className, children } = props;
  return (
    <div className={cn(className)}>{children}</div>
  );
}

function SortableCard({ order, disabled, onDetails, onCancel, onAdvance, currentTime, onPrint, busy, onConfirmPayment }: { order: Order; disabled?: boolean; onDetails: () => void; onCancel: (order: Order) => void; onAdvance: (order: Order) => void; currentTime: number; onPrint: (order: Order, type: "kitchen" | "customer") => void; busy?: boolean; onConfirmPayment?: (order: Order) => void }) {
  // Removido DnD: refs e estilos de arraste
  const style: React.CSSProperties = {};

  const styleBy = {
    novo: "bg-yellow-300/40 border-yellow-300/50",
    aceito: "bg-green-400/40 border-green-400/50",
    producao: "bg-green-400/60 border-green-400/60",
    entrega: "bg-sky-400/40 border-sky-400/50",
    finalizado: "bg-gray-300/40 border-gray-300/50",
    cancelado: "bg-red-500/40 border-red-500/50",
  } as const;

  let statusTs: number | null = null;
  if (order.status === "producao") {
    const tsStr = order.production_started_at || order.accepted_at || order.updated_at || order.created_at;
    if (tsStr) statusTs = Date.parse(tsStr);
  }
  const elapsedSec = statusTs ? Math.floor((currentTime - statusTs) / 1000) : 0;
  const elapsedLabel = statusTs ? `${String(Math.floor(elapsedSec / 60)).padStart(2, "0")}:${String(elapsedSec % 60).padStart(2, "0")}` : null;
  const arrivalLabel = order.created_at ? formatTimeHHMM(order.created_at) : null;

  let cardStyle = "";
  switch (order.status) {
    case "novo": cardStyle = styleBy.novo; break;
    case "aceito": cardStyle = styleBy.aceito; break;
    case "producao": cardStyle = styleBy.producao; break;
    case "entrega": cardStyle = styleBy.entrega; break;
    case "finalizado": cardStyle = styleBy.finalizado; break;
    case "cancelado": cardStyle = styleBy.cancelado; break;
  }

  const isCanceled = order.status === "cancelado";
  const isFinal = order.status === "finalizado" || order.status === "cancelado";

  return (
    <div style={style} onClick={() => onDetails()} className={cn("rounded-md border p-3 shadow-sm hover:shadow transition", disabled ? "opacity-70" : "", cardStyle)}>
      <div className="flex items-center justify-between">
        <div className="font-semibold">#{order.order_number}</div>
        <div className="flex items-center gap-2">
          {isCanceled && (
            <Badge className={statusColor("cancelado")}>Cancelado</Badge>
          )}
          {!isCanceled && order.status === "novo" && arrivalLabel && (
            <div className="flex items-center gap-1 text-xs font-medium">
              <ClockIcon className="h-4 w-4" />
              <span>{arrivalLabel}</span>
            </div>
          )}
          {!isCanceled && order.status === "producao" && elapsedLabel && (
            <div className="flex items-center gap-1 text-xs font-semibold">
              <ClockIcon className="h-4 w-4" />
              <span>{elapsedLabel}</span>
            </div>
          )}
        </div>
      </div>
      <div className="mt-1 text-sm">
        <div className="font-medium">{order.customer_name}</div>
        <div className="text-muted-foreground">{order.customer_phone}</div>
        {order.customer_address && <div className="text-muted-foreground">{order.customer_address}</div>}
      </div>
      <div className="mt-2 text-sm text-muted-foreground" style={{ display: "-webkit-box", WebkitLineClamp: 2 as any, WebkitBoxOrient: "vertical" as any, overflow: "hidden" }}>
        {(order.items || []).map((it) => `${it.quantity}x ${it.product_name}`).join(", ")}
      </div>
      <div className="mt-2 flex items-center justify-start text-sm">
        <div className="flex items-center gap-2">
          <Badge className={typeColor(order.order_type)}>{typeLabel(order.order_type)}</Badge>
          {order.payment_method ? <Badge variant="secondary" className="uppercase">{pmLabel(order.payment_method)}</Badge> : null}
          {order.payment_status === 1 ? <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">Pago</Badge> : null}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div className="font-semibold">{formatCurrencyBRL(order.total_amount)}</div>
        <div className="flex items-center justify-end gap-1">
          {order.status !== "novo" && (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); }}
                      disabled={busy}
                      aria-label="Imprimir"
                    >
                      <img src={assetUrl("/icons/printer.svg")} alt="Imprimir" className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Imprimir</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Imprimir</DropdownMenuLabel>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onPrint(order, "kitchen"); }}>Comanda da cozinha</DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onPrint(order, "customer"); }}>Recibo do cliente</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {order.status === "novo" && !isFinal && (
            <Tooltip>
              <TooltipTrigger asChild>
                 <Button
                   variant="ghost"
                   size="icon"
                   className="h-7 w-7"
                   onClick={(e) => { e.stopPropagation(); onAdvance(order); }}
                   disabled={busy}
                   aria-label="Aceitar pedido"
                 >
                   <img src={assetUrl("/icons/check-circle.svg")} alt="Aceitar" className="h-4 w-4" />
                 </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Aceitar pedido
              </TooltipContent>
            </Tooltip>
          )}
          {!isFinal && order.status !== "novo" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => { e.stopPropagation(); onAdvance(order); }}
                  disabled={busy}
                  aria-label="Avançar status"
                >
                  <img src={assetUrl("/icons/check-circle.svg")} alt="Avançar" className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Avançar status</TooltipContent>
            </Tooltip>
          )}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => e.stopPropagation()}
                    disabled={busy}
                    aria-label="Mais ações"
                  >
                    <DotsHorizontalIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Mais ações</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-44" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuLabel>Ações</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {!isCanceled && order.payment_status !== 1 && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onConfirmPayment?.(order); }}>
                  <img src={assetUrl("/icons/coin.svg")} alt="Confirmar pagamento" className="mr-2 h-4 w-4" />
                  Confirmar pagamento
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDetails(); }}>
                <Pencil2Icon className="mr-2 h-4 w-4" /> Editar
              </DropdownMenuItem>
              {!isCanceled && (
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={(e) => { e.stopPropagation(); onCancel(order); }}>
                  <TrashIcon className="mr-2 h-4 w-4" /> Cancelar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const { toast } = useToast();
  const today = useMemo(() => todayISO(), []);
  const { orders, loading, error, refetch, updateOrderStatus, cancelOrder, nextStatusMap, updateOrder } = useOrders({
    initialFilters: { date: today },
  });

  const [busyId, setBusyId] = useState<number | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  // tick para atualizar timers dos cards
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const deferredRefetchRef = useRef(false);

  const safeRefetch = useCallback(async () => {
    if (selectedOrder) {
      deferredRefetchRef.current = true;
      return;
    }
    await refetch();
  }, [selectedOrder, refetch]);
  useEffect(() => {
    if (!selectedOrder && deferredRefetchRef.current) {
      deferredRefetchRef.current = false;
      refetch();
    }
  }, [selectedOrder, refetch]);

  useEffect(() => {
    if (error) {
      toast({ variant: "destructive", title: "Erro", description: error });
    }
  }, [error, toast]);

  // Usa dados mais recentes do pedido selecionado (após refetch), mantendo a seleção estável
  const selectedOrderFresh = useMemo(() => {
    if (!selectedOrder) return null;
    return orders.find((o) => o.id === selectedOrder.id) || selectedOrder;
  }, [orders, selectedOrder]);

  // Integração com POS (Balcão): ouvir atualizações de novos pedidos/edições
  useEffect(() => {
    // BroadcastChannel (funciona apenas se mesma origem)
    let ch: BroadcastChannel | null = null;
    try {
      ch = new BroadcastChannel("pos-orders");
      ch.onmessage = (ev: MessageEvent) => {
        const data: any = (ev as any).data;
        if (data?.type === "posOrderCreated" || data?.type === "posOrderUpdated") {
          safeRefetch();
          const n = data?.payload?.orderNumber;
          toast({ title: "Pedidos atualizados", description: n ? `Pedido ${n} sincronizado.` : "Sincronizado com POS." });
        }
      };
    } catch (_) {
      // ignorar: BroadcastChannel indisponível (origens diferentes)
    }

    // Fallback cross-origin via postMessage
    const onMsg = (ev: MessageEvent) => {
      const data: any = (ev as any).data;
      if (data?.type === "posOrderCreated" || data?.type === "posOrderUpdated") {
        safeRefetch();
        const n = data?.payload?.orderNumber;
        toast({ title: "Pedidos atualizados", description: n ? `Pedido ${n} sincronizado.` : "Sincronizado com POS." });
      }
    };
    window.addEventListener("message", onMsg);

    return () => {
      window.removeEventListener("message", onMsg);
      try { ch && ch.close(); } catch {}
    };
  }, [refetch, toast]);

  // Abrir POS em nova aba
  const handleNewOrder = () => {
    const url = "http://localhost/cardapio-digital-sistema/pos.html?pos=1";
    const win = window.open(url, "_blank");
    if (!win || win.closed) {
      toast({ variant: "destructive", title: "Não foi possível abrir o POS", description: "Verifique o bloqueador de pop-ups e tente novamente." });
    }
  };

  // Dados da empresa para impressão
  const [companyName, setCompanyName] = useState<string>("");
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string>("");
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res: any = await httpClient.get("/settings/company");
        if (mounted && res && res.success !== false && res.data) {
          if (res.data.name) setCompanyName(String(res.data.name));
          if (res.data.logo_url) setCompanyLogoUrl(String(res.data.logo_url));
        }
      } catch {
        // silencioso
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Impressão: geradores de HTML e rotina de impressão (espelha admin antigo)
  const generateCustomerReceiptHtml = useCallback((order: Order) => {
    const createdAt = order.created_at ? new Date(order.created_at).toLocaleString("pt-BR") : new Date().toLocaleString("pt-BR");
    const itemsSubtotal = Array.isArray(order.items)
      ? order.items.reduce((sum, it) => sum + (typeof it.subtotal === "number" ? it.subtotal : (it.product_price || 0) * (it.quantity || 0)), 0)
      : 0;
    const tipo = (order.customer_name || "").toLowerCase().includes("mesa")
      ? "MESA"
      : ((order.customer_address && order.customer_address.trim() !== "") || (order.delivery_fee && order.delivery_fee > 0))
        ? "ENTREGA"
        : "RETIRADA";

    const statusText = statusLabel(order.status);
    const logoUrl = companyLogoUrl || "";
    const businessName = companyName || "Comanda";

    const itemsHtml = (order.items || []).map((item) => {
      const notesList = (item.notes ? item.notes.split(/\n|;|,|\r/).map(s => s.trim()).filter(Boolean) : []);
      const unit = formatCurrencyBRL(item.product_price || 0);
      const sub = formatCurrencyBRL(typeof item.subtotal === "number" ? item.subtotal : (item.product_price || 0) * (item.quantity || 0));
      return `
        <div class="item-section">
          <h2>${item.quantity}x ${item.product_name}</h2>
          ${notesList.length ? `
            <ul class="item-details">
              ${notesList.map(s => `<li>${s.toUpperCase()}</li>`).join("")}
            </ul>
          ` : ""}
          <ul class="item-details" style="margin-top:4px;">
            <li><strong>Unitário:</strong> ${unit}</li>
            <li><strong>Subtotal:</strong> ${sub}</li>
          </ul>
        </div>
      `;
    }).join("");

    const descontos = (itemsSubtotal + (order.delivery_fee || 0)) - (order.total_amount || 0);

    const obsList = order.notes ? order.notes.split(/\n|;|\r/).map(s => s.trim()).filter(Boolean) : [];

    return `
    <div class="receipt">
      <div class="header">
        ${logoUrl ? `<img src="${logoUrl}" class="logo" alt="Logo" />` : `<h1>${businessName}</h1>`}
        <p>${createdAt}</p>
      </div>
      <div class="order-details">
        <p><strong>PEDIDO:</strong> #${order.order_number || order.id || '-'}</p>
        <p><strong>STATUS:</strong> ${statusText}</p>
        <p><strong>TIPO:</strong> ${tipo}</p>
      </div>
      <div class="order-details" style="margin-top:6px;">
        <p><strong>CLIENTE:</strong> ${order.customer_name || '-'}</p>
        <p><strong>TELEFONE:</strong> ${order.customer_phone || '-'}</p>
        ${order.customer_address ? `<p><strong>ENDEREÇO:</strong> ${order.customer_address}</p>` : ''}
        ${order.customer_neighborhood ? `<p><strong>BAIRRO:</strong> ${order.customer_neighborhood}</p>` : ''}
        ${order.customer_reference ? `<p><strong>REFERÊNCIA:</strong> ${order.customer_reference}</p>` : ''}
      </div>
      <div class="separator"></div>
      ${itemsHtml}
      <div class="separator"></div>
      <div class="order-details">
        <p><strong>Subtotal Itens:</strong> ${formatCurrencyBRL(itemsSubtotal)}</p>
        <p><strong>Descontos:</strong> ${formatCurrencyBRL(descontos)}</p>
        <p><strong>Entrega:</strong> ${formatCurrencyBRL(order.delivery_fee || 0)}</p>
        <p><strong>Total:</strong> ${formatCurrencyBRL(order.total_amount || 0)}</p>
      </div>
      <div class="order-details" style="margin-top:6px;">
        <p><strong>Pagamento:</strong> ${pmLabel(order.payment_method)}</p>
        ${order.payment_status === 1 ? `<p><strong>Status do pagamento:</strong> Pago</p>` : ''}
        ${order.payment_value ? `<p><strong>Valor pago:</strong> ${formatCurrencyBRL(order.payment_value)}</p>` : ''}
        ${(order.change_amount || 0) > 0 ? `<p><strong>Troco:</strong> ${formatCurrencyBRL(order.change_amount || 0)}</p>` : ''}
        ${order.estimated_delivery_time ? `<p><strong>Tempo estimado:</strong> ${order.estimated_delivery_time} min</p>` : ''}
      </div>
      ${obsList.length ? `
        <div class="obs-section">
          <h2>*** OBSERVAÇÕES ***</h2>
          <ul>
            ${obsList.map(s => `<li>- ${s.toUpperCase()}</li>`).join("")}
          </ul>
        </div>
      ` : ''}
      <div class="separator"></div>
    </div>`;
  }, [companyLogoUrl, companyName]);

  const generateKitchenTicketHtml = useCallback((order: Order) => {
    const createdAt = order.created_at ? new Date(order.created_at).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const logoUrl = companyLogoUrl || "";
    const businessName = companyName || "Cozinha";

    const itemsHtml = (order.items || []).map((item) => {
      const notesList = (item.notes ? item.notes.split(/\n|;|,|\r/).map(s => s.trim()).filter(Boolean) : []);
      return `
        <div class="item-section">
          <h2>${item.quantity}x ${item.product_name}</h2>
          ${notesList.length ? `
            <ul class="item-details">
              ${notesList.map(s => `<li><strong>•</strong> ${s.toUpperCase()}</li>`).join("")}
            </ul>
          ` : ''}
        </div>
      `;
    }).join("");

    const obsList = order.notes ? order.notes.split(/\n|;|\r/).map(s => s.trim()).filter(Boolean) : [];

    return `
    <div class="receipt">
      <div class="header">
        ${logoUrl ? `<img src="${logoUrl}" class="logo" alt="Logo" />` : `<h1>${businessName}</h1>`}
        <p>${createdAt}</p>
      </div>
      <div class="order-details">
        <p><strong>PEDIDO: #${order.order_number}</strong></p>
        ${order.customer_name ? `<p><strong>CLIENTE:</strong> ${order.customer_name}</p>` : ''}
      </div>
      <div class="separator"></div>
      ${itemsHtml}
      ${obsList.length ? `
        <div class="obs-section">
          <h2>*** OBSERVAÇÕES ***</h2>
          <ul>
            ${obsList.map(s => `<li>- ${s.toUpperCase()}</li>`).join("")}
          </ul>
        </div>
      ` : ''}
      <div class="separator"></div>
    </div>`;
  }, [companyLogoUrl, companyName]);

  const printDocument = useCallback((content: string) => {
    const title = companyName ? `Impressão - ${companyName}` : 'Impressão - Cardápio Digital';
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title}</title>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <link href="https://fonts.googleapis.com/css2?family=Inconsolata:wght@400;700&display=swap" rel="stylesheet">
            <style>
                @media print {
                    body * { visibility: hidden; }
                    #print-area, #print-area * { visibility: visible; }
                    #print-area { position: absolute; left: 0; top: 0; width: 100%; }
                    .no-print { display: none; }
                    @page { margin: 0.5cm; size: 80mm auto; }
                }

                body { font-family: 'Inconsolata', monospace; background: #fff; margin: 0; padding: 10px; }
                .receipt { width: 302px; background: #fff; color: #000; padding: 15px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .receipt h1, .receipt h2, .receipt p, .receipt li { margin: 0; padding: 0; }
                .header { text-align: center; margin-bottom: 10px; }
                .header h1 { font-size: 1.5rem; font-weight: 700; text-transform: uppercase; }
                .logo { display: block; max-width: 160px; max-height: 60px; margin: 0 auto 6px; }
                .order-details p { font-size: 0.9rem; line-height: 1.4; }
                .separator { border-top: 1px dashed #000; margin: 10px 0; }
                .item-section h2 { text-align: center; font-size: 1.4rem; font-weight: 700; margin-bottom: 5px; text-transform: uppercase; }
                .item-details { font-size: 1.1rem; margin-left: 5px; list-style: none; }
                .item-details li { margin-bottom: 3px; }
                .obs-section { border: 2px solid #000; padding: 10px; margin-top: 10px; }
                .obs-section h2 { text-align: center; font-size: 1.2rem; font-weight: 700; margin-bottom: 5px; text-transform: uppercase; }
                .obs-section ul { font-size: 1.1rem; font-weight: 700; list-style: none; padding-left: 0; }
            </style>
        </head>
        <body>
            <div id="print-area">${content}</div>
            <script>
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                        setTimeout(function() {
                            window.close();
                        }, 500);
                    }, 100);
                }
            <\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
  }, [companyName]);

  const handlePrint = (order: Order, type: "kitchen" | "customer") => {
    try {
      const html = type === "kitchen" ? generateKitchenTicketHtml(order) : generateCustomerReceiptHtml(order);
      printDocument(html);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Falha na impressão", description: e?.message || "Erro ao gerar documento" });
    }
  };

  // Congela a grid enquanto o modal estiver aberto para evitar flicker visual no backdrop
  const lastOrdersRef = useRef<Order[]>(orders);
  useEffect(() => {
    if (!selectedOrder) {
      lastOrdersRef.current = orders;
    }
  }, [orders, selectedOrder]);

  const ordersForGrid = selectedOrder ? lastOrdersRef.current : orders;

  // Particiona pedidos (usando fonte congelada quando modal aberto)
  const columns = useMemo(() => {
    const grupos: Record<ColumnKey, Order[]> = { novos: [], producao: [], entrega: [], finalizados: [] };
    ordersForGrid.forEach((o) => {
      grupos[getColumnKey(o)].push(o);
    });
    return grupos;
  }, [ordersForGrid]);

  // Removido DnD: sensores e handleDragEnd

  const handleAdvance = async (order: Order) => {
    const next = nextStatusMap[order.status];
    if (!next) return;
    try {
      setBusyId(order.id);
      const res = await updateOrderStatus(order.id, next);
      if (res.success) {
        toast({ title: "Status atualizado", description: `Pedido ${order.order_number} -> ${statusLabel(next)}` });
      } else {
        toast({ variant: "destructive", title: "Falha ao atualizar status", description: res.message });
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleStatusAction = async (order: Order) => {
    // Regra 2: Não avançar automaticamente para produção.
    // Nesta tela: Novo -> Aceito; Aceito -> Entrega; Produção -> Entrega; Entrega -> Finalizado.
    if (order.status === "novo") {
      setBusyId(order.id);
      try {
        const r1 = await updateOrderStatus(order.id, "aceito");
        if (r1.success) {
          toast({ title: "Status atualizado", description: `Pedido ${order.order_number} -> ${statusLabel("aceito")}` });
        } else {
          toast({ variant: "destructive", title: "Falha ao aceitar", description: r1.message });
        }
      } finally {
        setBusyId(null);
      }
      return;
    }

    if (order.status === "aceito") {
      setBusyId(order.id);
      try {
        const r = await updateOrderStatus(order.id, "entrega");
        if (r.success) {
          toast({ title: "Status atualizado", description: `Pedido ${order.order_number} -> ${statusLabel("entrega")}` });
        } else {
          toast({ variant: "destructive", title: "Falha ao avançar para entrega", description: r.message });
        }
      } finally {
        setBusyId(null);
      }
      return;
    }

    await handleAdvance(order);
  };

  const handleConfirmPayment = async (order: Order) => {
    if (!confirm(`Confirmar pagamento do pedido ${order.order_number}?`)) return;
    try {
      setBusyId(order.id);
      const res = await updateOrder(order.id, { payment_status: 1 });
      if (res.success) {
        toast({ title: "Pagamento confirmado", description: `Pedido ${order.order_number} marcado como pago.` });
      } else {
        toast({ variant: "destructive", title: "Falha ao confirmar pagamento", description: res.message || "Erro ao atualizar pagamento." });
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (order: Order) => {
    if (!confirm(`Cancelar o pedido ${order.order_number}?`)) return;
    const reason = prompt("Informe o motivo do cancelamento (opcional)") || undefined;
    try {
      setBusyId(order.id);
      const res = await cancelOrder(order.id, reason);
      if (res.success) {
        toast({ title: "Pedido cancelado", description: `Pedido ${order.order_number} foi cancelado.${reason ? ` Motivo: ${reason}` : ""}` });
      } else {
        toast({ variant: "destructive", title: "Falha ao cancelar", description: res.message });
      }
    } finally {
      setBusyId(null);
    }
  };

  // UI: Kanban
  const Column = ({ title, id, items }: { title: string; id: ColumnKey; items: Order[] }) => (
    <DroppableColumn id={`col-${id}`} className="rounded-lg bg-muted/30 p-2">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      <div className="space-y-2 min-h-[60px]">
        {items.map((o) => (
          <div key={o.id}>
            <SortableCard
              order={o}
              disabled={o.status === "finalizado" || o.status === "cancelado"}
              onDetails={() => setSelectedOrder(o)}
              onCancel={() => handleCancel(o)}
              onAdvance={() => handleStatusAction(o)}
              currentTime={currentTime}
              onPrint={handlePrint}
              busy={busyId === o.id}
              onConfirmPayment={() => handleConfirmPayment(o)}
            />
          </div>
        ))}
      </div>
    </DroppableColumn>
  );

  return (
    <div className="space-y-4">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gestor de pedidos</h1>
        <div className="flex items-center gap-2">
          <Button onClick={handleNewOrder}>Novo Pedido</Button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        <Column id="novos" title="Novos" items={columns.novos} />
        <Column id="producao" title="Produção" items={columns.producao} />
        <Column id="entrega" title="Entrega" items={columns.entrega} />
        <Column id="finalizados" title="Concluídos" items={columns.finalizados} />
      </div>

      {!loading && orders.length === 0 && (
        <div className="text-sm text-muted-foreground">Nenhum pedido hoje.</div>
      )}

      {/* Dialog de detalhes controlado por estado para evitar flicker */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => { if (!open) setSelectedOrder(null); }}>
        <DialogContent
          className="max-w-2xl transition-none"
          forceMount
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Pedido {selectedOrderFresh?.order_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <div className="text-sm">Cliente: <span className="font-medium">{selectedOrder?.customer_name}</span></div>
              <div className="text-sm">Telefone: {selectedOrder?.customer_phone}</div>
              {selectedOrder?.customer_address && <div className="text-sm">Endereço: {selectedOrder?.customer_address}</div>}
              {selectedOrder?.customer_neighborhood && <div className="text-sm">Bairro: {selectedOrder?.customer_neighborhood}</div>}
              {selectedOrder?.customer_reference && <div className="text-sm">Ref.: {selectedOrder?.customer_reference}</div>}
              {selectedOrder?.notes && <div className="text-sm">Obs.: {selectedOrder?.notes}</div>}
            </div>
            <div>
              <div className="font-medium">Itens</div>
              <div className="space-y-2">
                {selectedOrder?.items?.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <div>{it.quantity}x {it.product_name}</div>
                    <div>{formatCurrencyBRL(it.subtotal)}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-between font-medium">
              <span>Total</span>
              <span>{selectedOrder ? formatCurrencyBRL(selectedOrder.total_amount) : null}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}