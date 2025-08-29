import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useProducts } from "@/hooks/useProducts";
import { Trash2, Pencil, MoreHorizontal, Plus } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate, useSearchParams } from "react-router-dom";
import { normalizeImageUrl } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Tipos básicos
// Removidos tipos e função não utilizados

export default function Products() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    products,
    categories,
    loading,
    error,
    filters,
    updateFilters,
    resetFilters,
    totalProducts,
    filteredCount,
    deleteProduct,
    toggleProductStatus,
  } = useProducts({ initialFilters: { search: "", categoryId: undefined, activeOnly: false, inactiveOnly: false } });

  useEffect(() => {
    const q = (searchParams.get("q") || "").trim();
    if (q && q !== (filters.search || "")) {
      updateFilters({ search: q });
    }
  }, [searchParams]);
  const { toast } = useToast();

  // Loading por item
  const [busyId, setBusyId] = useState<number | null>(null);

  const handleEdit = (id: number) => {
    navigate(`/produtos/${id}/editar`);
  };

  // Formata moeda BRL
  const formatBRL = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
      value || 0
    );

  const handleToggle = async (id: number) => {
    setBusyId(id);
    const res = await toggleProductStatus(id);
    setBusyId(null);
    if (res.success) {
      toast({ title: "Status atualizado", description: res.message || "O status foi alterado com sucesso." });
    } else {
      toast({ title: "Erro ao alterar status", description: res.message, variant: "destructive" as any });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir este produto?")) return;
    setBusyId(id);
    const res = await deleteProduct(id);
    setBusyId(null);
    if (res.success) {
      toast({ title: "Produto excluído", description: res.message || "O produto foi removido." });
    } else {
      toast({ title: "Erro ao excluir", description: res.message, variant: "destructive" as any });
    }
  };

  // Exclusividade: se marcar ativos, desmarca inativos e vice-versa
  const onToggleActiveOnly = (v: boolean) => {
    updateFilters({ activeOnly: v, inactiveOnly: v ? false : filters.inactiveOnly });
  };
  const onToggleInactiveOnly = (v: boolean) => {
    updateFilters({ inactiveOnly: v, activeOnly: v ? false : filters.activeOnly });
  };

  const onResetFilters = () => {
    resetFilters();
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Produtos</h1>
          <p className="text-sm text-muted-foreground">
            {filteredCount} de {totalProducts} itens
          </p>
        </div>
        <Button onClick={() => navigate('/produtos/novo')}>
          <Plus className="h-4 w-4 mr-2" /> Novo
        </Button>
      </div>

      <div className="mt-3 flex w-full flex-col gap-2 md:flex-row md:items-end">
        {/* Busca */}
        <div className="w-full md:w-64">
          <Input
            placeholder="Buscar por nome, descrição ou categoria"
            value={filters.search || ""}
            onChange={(e) => updateFilters({ search: e.target.value })}
          />
        </div>

        {/* Categoria */}
        <Select
          value={filters.categoryId ?? "all"}
          onValueChange={(value) =>
            updateFilters({ categoryId: value === "all" ? undefined : value })
          }
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Todas as categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Ativos */}
        <div className="flex items-center gap-2">
          <Switch
            id="ativos"
            checked={!!filters.activeOnly}
            onCheckedChange={onToggleActiveOnly}
            className="data-[state=checked]:bg-status-on data-[state=unchecked]:bg-status-off"
          />
          <label htmlFor="ativos" className="text-sm text-muted-foreground select-none">
            Ativos
          </label>
        </div>

        {/* Inativos */}
        <div className="flex items-center gap-2">
          <Switch
            id="inativos"
            checked={!!filters.inactiveOnly}
            onCheckedChange={onToggleInactiveOnly}
            className="data-[state=checked]:bg-status-on data-[state=unchecked]:bg-status-off"
          />
          <label htmlFor="inativos" className="text-sm text-muted-foreground select-none">
            Inativos
          </label>
        </div>

        <Button variant="outline" onClick={onResetFilters}>Limpar filtros</Button>
      </div>

      {/* Erro */}
      {error && (
        <div className="mt-3 text-sm text-red-600">{error}</div>
      )}

      <div className="mt-4 overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Nenhum produto encontrado
                </TableCell>
              </TableRow>
            ) : (
              products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {p.image_url ? (
                        <img
                          src={normalizeImageUrl((p as any).image_url)}
                          alt={p.name}
                          className="h-10 w-10 rounded object-cover border"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted" />
                      )}
                      <div>
                        <div className="font-medium">{p.name}</div>
                        {p.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {p.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{p.category_name || "-"}</TableCell>
                  <TableCell>{formatBRL(p.price)}</TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Switch
                        checked={!!p.active}
                        onCheckedChange={() => handleToggle(p.id)}
                        aria-label="Alternar status do produto"
                        className="data-[state=checked]:bg-status-on data-[state=unchecked]:bg-status-off"
                      />
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
                        {/* Ação de ativar/desativar removida: agora feita pelo Switch na coluna Status */}
                        <DropdownMenuItem onClick={() => handleEdit(p.id)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          <span>Editar</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem disabled={busyId === p.id} className="text-red-600 focus:text-red-700" onClick={() => handleDelete(p.id)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          <span>Excluir</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}