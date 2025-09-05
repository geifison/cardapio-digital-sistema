import { useEffect, useState } from "react";
import { useCategories } from "@/hooks/useCategories";
import type { Category } from "@/hooks/useCategories";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, Plus, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { normalizeImageUrl } from "@/lib/utils";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function CategoriesPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    categories,
    loading,
    error,
    filters,
    updateFilters,
    resetFilters,
    refetch,
    deleteCategory,
    toggleCategoryStatus,
    reorderCategories,
    totalCategories,
    filteredCount,
  } = useCategories({ initialFilters: { search: "", activeOnly: false, inactiveOnly: false } });

  useEffect(() => {
    const q = (searchParams.get("q") || "").trim();
    if (q && q !== (filters.search || "")) {
      updateFilters({ search: q });
    }
  }, [searchParams]);
  const [, setBusyId] = useState<number | null>(null);
  const [orderIds, setOrderIds] = useState<number[]>([]);
  const [reordering, setReordering] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const isReorderEnabled = !filters.activeOnly && !filters.inactiveOnly && !(filters.search && filters.search.trim());

  useEffect(() => {
    // Sincroniza IDs quando a lista muda
    setOrderIds(categories.map((c) => c.id));
  }, [categories]);

  const displayList: Category[] = isReorderEnabled && orderIds.length
    ? (orderIds.map((id) => categories.find((c) => c.id === id)).filter(Boolean) as Category[])
    : categories;

  const onToggleActiveOnly = (v: boolean) => updateFilters({ activeOnly: v, inactiveOnly: v ? false : filters.inactiveOnly });
  const onToggleInactiveOnly = (v: boolean) => updateFilters({ inactiveOnly: v, activeOnly: v ? false : filters.activeOnly });

  const handleToggle = async (id: number) => {
    setBusyId(id);
    const res = await toggleCategoryStatus(id);
    setBusyId(null);
    if (res.success) toast({ title: "Status atualizado" });
    else toast({ title: "Erro ao alterar status", description: res.message, variant: "destructive" as any });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir esta categoria?")) return;
    setBusyId(id);
    const res = await deleteCategory(id);
    setBusyId(null);
    if (res.success) toast({ title: "Categoria excluída" });
    else toast({ title: "Erro ao excluir", description: res.message, variant: "destructive" as any });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!isReorderEnabled) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = orderIds.indexOf(Number(active.id));
    const to = orderIds.indexOf(Number(over.id));
    if (from === -1 || to === -1) return;
    const next = arrayMove(orderIds, from, to);
    setOrderIds(next);
    setReordering(true);
    const orders = next.map((id, idx) => ({ id, display_order: idx + 1 }));
    const res = await reorderCategories(orders);
    setReordering(false);
    if (res.success) toast({ title: "Ordem salva" });
    else {
      toast({ title: "Erro ao reordenar", description: res.message, variant: "destructive" as any });
      refetch();
    }
  };

  const Row = ({ c }: { c: Category }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id, disabled: !isReorderEnabled });
    const style: any = { transform: CSS.Transform.toString(transform), transition };
    return (
      <TableRow ref={setNodeRef as any} style={style} className={isDragging ? "bg-accent/40" : undefined}>
        <TableCell>
          <div className="flex items-center gap-2">
            {isReorderEnabled && (
              <button className="cursor-grab p-1 text-muted-foreground hover:text-foreground" aria-label="Arrastar" {...attributes} {...listeners} disabled={reordering}>
                <GripVertical className="h-4 w-4" />
              </button>
            )}
            {c.image_url ? (
              <img src={normalizeImageUrl(c.image_url)} alt={c.name} className="h-10 w-10 rounded object-cover border" />
            ) : (
              <div className="h-10 w-10 rounded bg-muted" />
            )}
            <div>
              <div className="font-medium">{c.name}</div>
              {c.description && <div className="text-xs text-muted-foreground line-clamp-1">{c.description}</div>}
            </div>
          </div>
        </TableCell>
        <TableCell>{c.active_count ?? '-'}</TableCell>
        <TableCell>{c.inactive_count ?? '-'}</TableCell>
        <TableCell>
          <div className="flex items-center">
            <Switch checked={!!c.active} onCheckedChange={() => handleToggle(c.id)} aria-label="Alternar status da categoria" className="data-[state=checked]:bg-status-on data-[state=unchecked]:bg-status-off" />
          </div>
        </TableCell>
        <TableCell className="text-right">
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" aria-label="Ações">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Mais ações</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>Ações</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate(`/produtos/categorias/${c.id}/editar`)} className="cursor-pointer">
                <Pencil className="h-4 w-4 mr-2" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDelete(c.id)} className="text-red-600 focus:text-red-600 cursor-pointer">
                <Trash2 className="h-4 w-4 mr-2" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Categorias</h1>
          <p className="text-sm text-muted-foreground">{filteredCount} de {totalCategories} itens</p>
        </div>
        <Button onClick={() => navigate('/produtos/categorias/nova')}>
          <Plus className="h-4 w-4 mr-2" /> Nova
        </Button>
      </div>

      <div className="mt-3 flex w-full flex-col gap-2 md:flex-row md:items-end">
        <div className="w-full md:w-64">
          <Input placeholder="Buscar por nome ou descrição" value={filters.search || ""} onChange={(e) => updateFilters({ search: e.target.value })} />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="ativos" checked={!!filters.activeOnly} onCheckedChange={onToggleActiveOnly} className="data-[state=checked]:bg-status-on data-[state=unchecked]:bg-status-off" />
          <label htmlFor="ativos" className="text-sm text-muted-foreground select-none">Ativos</label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="inativos" checked={!!filters.inactiveOnly} onCheckedChange={onToggleInactiveOnly} className="data-[state=checked]:bg-status-on data-[state=unchecked]:bg-status-off" />
          <label htmlFor="inativos" className="text-sm text-muted-foreground select-none">Inativos</label>
        </div>
        <Button variant="outline" onClick={() => resetFilters()}>Limpar filtros</Button>
      </div>

      {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      {isReorderEnabled ? (
        <div className="mt-2 text-xs text-muted-foreground">Arraste as linhas para reordenar. Mudanças são salvas automaticamente.</div>
      ) : (
        <div className="mt-2 text-xs text-muted-foreground">Reordenação desabilitada ao usar busca ou filtros.</div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="mt-4 overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead>Ativos</TableHead>
                <TableHead>Inativos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Carregando...</TableCell>
                </TableRow>
              ) : categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Nenhuma categoria encontrada</TableCell>
                </TableRow>
              ) : isReorderEnabled ? (
                <SortableContext items={orderIds} strategy={verticalListSortingStrategy}>
                  {displayList.map((c) => (
                    <Row key={c.id} c={c} />
                  ))}
                </SortableContext>
              ) : (
                categories.map((c) => <Row key={c.id} c={c} />)
              )}
            </TableBody>
          </Table>
        </div>
      </DndContext>
      
    </div>
  );
}