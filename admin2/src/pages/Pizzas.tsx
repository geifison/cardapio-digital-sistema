import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { httpClient } from "@/lib/http";
import { usePizza } from "@/hooks/usePizza";
import type { PizzaSize, PizzaFlavor, PizzaBorder, PizzaExtra } from "@/hooks/usePizza";
import { CurrencyMask } from "@/lib/currency-mask";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

export default function PizzasPage() {
  const { sizes, flavors, borders, extras, error, refetch } = usePizza();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"sizes" | "flavors" | "borders" | "extras">("sizes");

  // Busca e filtros (debounce 300ms)
  const [sizeSearch, setSizeSearch] = useState("");
  const [debouncedSizeSearch, setDebouncedSizeSearch] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebouncedSizeSearch(sizeSearch), 300); return () => clearTimeout(t); }, [sizeSearch]);
  // Filtros de status (mutuamente exclusivos por seção)
  const [sizeActiveOnly, setSizeActiveOnly] = useState(false);
  const [sizeInactiveOnly, setSizeInactiveOnly] = useState(false);
  const [flavorActiveOnly, setFlavorActiveOnly] = useState(false);
  const [flavorInactiveOnly, setFlavorInactiveOnly] = useState(false);
  const [borderActiveOnly, setBorderActiveOnly] = useState(false);
  const [borderInactiveOnly, setBorderInactiveOnly] = useState(false);
  const [extraActiveOnly, setExtraActiveOnly] = useState(false);
  const [extraInactiveOnly, setExtraInactiveOnly] = useState(false);

  // Listas filtradas com status + busca
  const sizesFiltered = useMemo(() => {
    let base = sizes;
    if (sizeActiveOnly) base = base.filter((s) => !!s.active);
    if (sizeInactiveOnly) base = base.filter((s) => !s.active);
    if (debouncedSizeSearch.trim()) {
      const q = debouncedSizeSearch.toLowerCase();
      base = base.filter((s) => (s.name || "").toLowerCase().includes(q));
    }
    return base;
  }, [sizes, debouncedSizeSearch, sizeActiveOnly, sizeInactiveOnly]);

  const [flavorSearch, setFlavorSearch] = useState("");
  const [debouncedFlavorSearch, setDebouncedFlavorSearch] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebouncedFlavorSearch(flavorSearch), 300); return () => clearTimeout(t); }, [flavorSearch]);
  const flavorsFiltered = useMemo(() => {
    let base = flavors;
    if (flavorActiveOnly) base = base.filter((f) => !!f.active);
    if (flavorInactiveOnly) base = base.filter((f) => !f.active);
    if (debouncedFlavorSearch.trim()) {
      const q = debouncedFlavorSearch.toLowerCase();
      base = base.filter((f) => {
        const name = (f.name || "").toLowerCase();
        const category = (f.category || "").toLowerCase();
        return name.includes(q) || category.includes(q);
      });
    }
    return base;
  }, [flavors, debouncedFlavorSearch, flavorActiveOnly, flavorInactiveOnly]);

  const [borderSearch, setBorderSearch] = useState("");
  const [debouncedBorderSearch, setDebouncedBorderSearch] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebouncedBorderSearch(borderSearch), 300); return () => clearTimeout(t); }, [borderSearch]);
  const bordersFiltered = useMemo(() => {
    let base = borders;
    if (borderActiveOnly) base = base.filter((b) => !!b.active);
    if (borderInactiveOnly) base = base.filter((b) => !b.active);
    if (debouncedBorderSearch.trim()) {
      const q = debouncedBorderSearch.toLowerCase();
      base = base.filter((b) => (b.name || "").toLowerCase().includes(q));
    }
    return base;
  }, [borders, debouncedBorderSearch, borderActiveOnly, borderInactiveOnly]);

  const [extraSearch, setExtraSearch] = useState("");
  const [debouncedExtraSearch, setDebouncedExtraSearch] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebouncedExtraSearch(extraSearch), 300); return () => clearTimeout(t); }, [extraSearch]);
  const extrasFiltered = useMemo(() => {
    let base = extras;
    if (extraActiveOnly) base = base.filter((e) => !!e.active);
    if (extraInactiveOnly) base = base.filter((e) => !e.active);
    if (debouncedExtraSearch.trim()) {
      const q = debouncedExtraSearch.toLowerCase();
      base = base.filter((e) => (e.name || "").toLowerCase().includes(q));
    }
    return base;
  }, [extras, debouncedExtraSearch, extraActiveOnly, extraInactiveOnly]);

  // Estados para Size
  const [openSize, setOpenSize] = useState(false);
  const [editingSize, setEditingSize] = useState<PizzaSize | null>(null);
  const [sizeForm, setSizeForm] = useState<Partial<PizzaSize>>({ name: "", slices: 8, max_flavors: 2, price: 0, description: "", display_order: 0, active: 1 });
  useEffect(() => { if (editingSize) setSizeForm(editingSize); }, [editingSize]);

  // Estados para Flavor
  const [openFlavor, setOpenFlavor] = useState(false);
  const [editingFlavor, setEditingFlavor] = useState<PizzaFlavor | null>(null);
  const [flavorForm, setFlavorForm] = useState<Partial<PizzaFlavor>>({ name: "", category: "", category_value: 0, description: "", ingredients: "", image_url: "", display_order: 0, active: 1, is_vegan: 0, is_gluten_free: 0, is_spicy: 0 });
  useEffect(() => { if (editingFlavor) setFlavorForm(editingFlavor); }, [editingFlavor]);

  // Estados para Border
  const [openBorder, setOpenBorder] = useState(false);
  const [editingBorder, setEditingBorder] = useState<PizzaBorder | null>(null);
  const [borderForm, setBorderForm] = useState<Partial<PizzaBorder>>({ name: "", price: 0, description: "", display_order: 0, active: 1 });
  useEffect(() => { if (editingBorder) setBorderForm(editingBorder); }, [editingBorder]);

  // Estados para Extra
  const [openExtra, setOpenExtra] = useState(false);
  const [editingExtra, setEditingExtra] = useState<PizzaExtra | null>(null);
  const [extraForm, setExtraForm] = useState<Partial<PizzaExtra>>({ name: "", category: "", price: 0, description: "", display_order: 0, active: 1 });
  useEffect(() => { if (editingExtra) setExtraForm(editingExtra); }, [editingExtra]);

  const resetSizeForm = () => setSizeForm({ name: "", slices: 8, max_flavors: 2, price: 0, description: "", display_order: 0, active: 1 });
  const resetFlavorForm = () => setFlavorForm({ name: "", category: "", category_value: 0, description: "", ingredients: "", image_url: "", display_order: 0, active: 1, is_vegan: 0, is_gluten_free: 0, is_spicy: 0 });
  const resetBorderForm = () => setBorderForm({ name: "", price: 0, description: "", display_order: 0, active: 1 });
  const resetExtraForm = () => setExtraForm({ name: "", category: "", price: 0, description: "", display_order: 0, active: 1 });

  // CRUD Sizes
  const saveSize = async () => {
    try {
      if (!sizeForm.name) { toast({ title: "Nome obrigatório", variant: "destructive" as any }); return; }
      if (editingSize) {
        await httpClient.put(`/pizza/sizes/${editingSize.id}`, sizeForm);
        toast({ title: "Tamanho atualizado" });
      } else {
        await httpClient.post(`/pizza/sizes`, sizeForm);
        toast({ title: "Tamanho criado" });
      }
      setOpenSize(false); setEditingSize(null); resetSizeForm();
      await refetch();
    } catch (e: any) {
      toast({ title: "Erro ao salvar tamanho", description: e.message || "", variant: "destructive" as any });
    }
  };
  const deleteSize = async (id: number) => {
    try {
      await httpClient.delete(`/pizza/sizes/${id}`);
      toast({ title: "Tamanho excluído" });
      await refetch();
    } catch (e: any) {
      toast({ title: "Erro ao excluir tamanho", description: e.message || "", variant: "destructive" as any });
    }
  };
  const toggleSize = async (size: PizzaSize, active: boolean) => {
    try {
      await httpClient.put(`/pizza/sizes/${size.id}`, { ...size, active: active ? 1 : 0 });
      await refetch();
    } catch (e: any) {
      toast({ title: "Erro ao alterar status do tamanho", description: e.message || "", variant: "destructive" as any });
    }
  };

  // CRUD Flavors
  const saveFlavor = async () => {
    try {
      if (!flavorForm.name) { toast({ title: "Nome obrigatório", variant: "destructive" as any }); return; }
      if (editingFlavor) {
        await httpClient.put(`/pizza/flavors/${editingFlavor.id}`, flavorForm);
        toast({ title: "Sabor atualizado" });
      } else {
        await httpClient.post(`/pizza/flavors`, flavorForm);
        toast({ title: "Sabor criado" });
      }
      setOpenFlavor(false); setEditingFlavor(null); resetFlavorForm();
      await refetch();
    } catch (e: any) {
      toast({ title: "Erro ao salvar sabor", description: e.message || "", variant: "destructive" as any });
    }
  };
  const deleteFlavor = async (id: number) => {
    try {
      await httpClient.delete(`/pizza/flavors/${id}`);
      toast({ title: "Sabor excluído" });
      await refetch();
    } catch (e: any) {
      toast({ title: "Erro ao excluir sabor", description: e.message || "", variant: "destructive" as any });
    }
  };
  const toggleFlavor = async (flavor: PizzaFlavor, active: boolean) => {
    try {
      await httpClient.put(`/pizza/flavors/${flavor.id}`, { ...flavor, active: active ? 1 : 0 });
      await refetch();
    } catch (e: any) {
      toast({ title: "Erro ao alterar status do sabor", description: e.message || "", variant: "destructive" as any });
    }
  };

  // CRUD Borders
  const saveBorder = async () => {
    try {
      if (!borderForm.name) { toast({ title: "Nome obrigatório", variant: "destructive" as any }); return; }
      if (editingBorder) {
        await httpClient.put(`/pizza/borders/${editingBorder.id}`, borderForm);
        toast({ title: "Borda atualizada" });
      } else {
        await httpClient.post(`/pizza/borders`, borderForm);
        toast({ title: "Borda criada" });
      }
      setOpenBorder(false); setEditingBorder(null); resetBorderForm();
      await refetch();
    } catch (e: any) {
      toast({ title: "Erro ao salvar borda", description: e.message || "", variant: "destructive" as any });
    }
  };
  const deleteBorder = async (id: number) => {
    try {
      await httpClient.delete(`/pizza/borders/${id}`);
      toast({ title: "Borda excluída" });
      await refetch();
    } catch (e: any) {
      toast({ title: "Erro ao excluir borda", description: e.message || "", variant: "destructive" as any });
    }
  };
  const toggleBorder = async (border: PizzaBorder, active: boolean) => {
    try {
      await httpClient.put(`/pizza/borders/${border.id}`, { ...border, active: active ? 1 : 0 });
      await refetch();
    } catch (e: any) {
      toast({ title: "Erro ao alterar status da borda", description: e.message || "", variant: "destructive" as any });
    }
  };

  // CRUD Extras
  const saveExtra = async () => {
    try {
      if (!extraForm.name) { toast({ title: "Nome obrigatório", variant: "destructive" as any }); return; }
      if (editingExtra) {
        await httpClient.put(`/pizza/extras/${editingExtra.id}`, extraForm);
        toast({ title: "Adicional atualizado" });
      } else {
        await httpClient.post(`/pizza/extras`, extraForm);
        toast({ title: "Adicional criado" });
      }
      setOpenExtra(false); setEditingExtra(null); resetExtraForm();
      await refetch();
    } catch (e: any) {
      toast({ title: "Erro ao salvar adicional", description: e.message || "", variant: "destructive" as any });
    }
  };
  const deleteExtra = async (id: number) => {
    try {
      await httpClient.delete(`/pizza/extras/${id}`);
      toast({ title: "Adicional excluído" });
      await refetch();
    } catch (e: any) {
      toast({ title: "Erro ao excluir adicional", description: e.message || "", variant: "destructive" as any });
    }
  };
  const toggleExtra = async (extra: PizzaExtra, active: boolean) => {
    try {
      await httpClient.put(`/pizza/extras/${extra.id}`, { ...extra, active: active ? 1 : 0 });
      await refetch();
    } catch (e: any) {
      toast({ title: "Erro ao alterar status do adicional", description: e.message || "", variant: "destructive" as any });
    }
  };

  // Filtros status exclusivos
  const onToggleSizeActiveOnly = (v: boolean) => { setSizeActiveOnly(v); if (v) setSizeInactiveOnly(false); };
  const onToggleSizeInactiveOnly = (v: boolean) => { setSizeInactiveOnly(v); if (v) setSizeActiveOnly(false); };
  const onToggleFlavorActiveOnly = (v: boolean) => { setFlavorActiveOnly(v); if (v) setFlavorInactiveOnly(false); };
  const onToggleFlavorInactiveOnly = (v: boolean) => { setFlavorInactiveOnly(v); if (v) setFlavorActiveOnly(false); };
  const onToggleBorderActiveOnly = (v: boolean) => { setBorderActiveOnly(v); if (v) setBorderInactiveOnly(false); };
  const onToggleBorderInactiveOnly = (v: boolean) => { setBorderInactiveOnly(v); if (v) setBorderActiveOnly(false); };
  const onToggleExtraActiveOnly = (v: boolean) => { setExtraActiveOnly(v); if (v) setExtraInactiveOnly(false); };
  const onToggleExtraInactiveOnly = (v: boolean) => { setExtraInactiveOnly(v); if (v) setExtraActiveOnly(false); };

  return (
    <div className="p-4 md:p-6">

      {error && <div className="text-sm text-red-600 mb-3">{String(error)}</div>}

      {/* Cabeçalho global */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold">Pizzas</h1>
          <p className="text-sm text-muted-foreground">Gerencie tamanhos, sabores, bordas e adicionais</p>
        </div>
        {activeTab === "sizes" && (
          <Button onClick={() => setOpenSize(true)}>
            <Plus className="h-4 w-4 mr-2" /> Novo Tamanho
          </Button>
        )}
        {activeTab === "flavors" && (
          <Button onClick={() => setOpenFlavor(true)}>
            <Plus className="h-4 w-4 mr-2" /> Novo Sabor
          </Button>
        )}
        {activeTab === "borders" && (
          <Button onClick={() => setOpenBorder(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nova Borda
          </Button>
        )}
        {activeTab === "extras" && (
          <Button onClick={() => setOpenExtra(true)}>
            <Plus className="h-4 w-4 mr-2" /> Novo Adicional
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "sizes" | "flavors" | "borders" | "extras")}>
        <TabsList>
          <TabsTrigger value="sizes">Tamanhos</TabsTrigger>
          <TabsTrigger value="flavors">Sabores</TabsTrigger>
          <TabsTrigger value="borders">Bordas</TabsTrigger>
          <TabsTrigger value="extras">Adicionais</TabsTrigger>
        </TabsList>

        {/* Sizes */}
        <TabsContent value="sizes" className="mt-4">
          <div className="flex items-center gap-4 mb-2">
            <Input placeholder="Buscar tamanho..." value={sizeSearch} onChange={(e) => setSizeSearch(e.target.value)} className="max-w-xs" />
            <div className="flex items-center gap-2">
              <Switch
                id="sizes-ativos"
                checked={!!sizeActiveOnly}
                onCheckedChange={onToggleSizeActiveOnly}
                className="data-[state=checked]:bg-status-on data-[state=unchecked]:bg-status-off"
              />
              <label htmlFor="sizes-ativos" className="text-sm text-muted-foreground select-none">Ativos</label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="sizes-inativos"
                checked={!!sizeInactiveOnly}
                onCheckedChange={onToggleSizeInactiveOnly}
                className="data-[state=checked]:bg-status-on data-[state=unchecked]:bg-status-off"
              />
              <label htmlFor="sizes-inativos" className="text-sm text-muted-foreground select-none">Inativos</label>
            </div>
          </div>

          <Dialog open={openSize} onOpenChange={(o) => { setOpenSize(o); if (!o) { setEditingSize(null); resetSizeForm(); } }}>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingSize ? "Editar Tamanho" : "Novo Tamanho"}</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-1">
                  <Label htmlFor="size-name">Nome</Label>
                  <Input id="size-name" placeholder="Nome" value={sizeForm.name as any} onChange={(e) => setSizeForm({ ...sizeForm, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="grid gap-1">
                    <Label htmlFor="size-slices">Fatias</Label>
                    <Input id="size-slices" type="number" placeholder="Fatias" value={sizeForm.slices as any} onChange={(e) => setSizeForm({ ...sizeForm, slices: Number(e.target.value) })} />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="size-maxflavors">Máx. Sabores</Label>
                    <Input id="size-maxflavors" type="number" placeholder="Máx. Sabores" value={sizeForm.max_flavors as any} onChange={(e) => setSizeForm({ ...sizeForm, max_flavors: Number(e.target.value) })} />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="size-price">Preço base</Label>
                    <Input
                      id="size-price"
                      inputMode="numeric"
                      placeholder="Preço base"
                      value={CurrencyMask.formatForDisplay(sizeForm.price || 0)}
                      onChange={(e) => {
                        const masked = CurrencyMask.applyMask(e.target.value);
                        e.target.value = masked;
                        const num = CurrencyMask.parseValue(masked);
                        setSizeForm({ ...sizeForm, price: num });
                      }}
                    />
                  </div>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="size-description">Descrição</Label>
                  <Input id="size-description" placeholder="Descrição" value={sizeForm.description as any} onChange={(e) => setSizeForm({ ...sizeForm, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3 items-center">
                  <div className="grid gap-1">
                    <Label htmlFor="size-order">Ordem</Label>
                    <Input id="size-order" type="number" placeholder="Ordem" value={sizeForm.display_order as any} onChange={(e) => setSizeForm({ ...sizeForm, display_order: Number(e.target.value) })} />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Switch checked={!!sizeForm.active} onCheckedChange={(v) => setSizeForm({ ...sizeForm, active: v ? 1 : 0 })} />
                    <span className="text-sm">Ativo</span>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setOpenSize(false); setEditingSize(null); resetSizeForm(); }}>Cancelar</Button>
                <Button onClick={saveSize}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Fatias</TableHead>
                  <TableHead>Máx. Sabores</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sizesFiltered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Nenhum tamanho</TableCell></TableRow>
                ) : sizesFiltered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.name}</TableCell>
                    <TableCell>{s.slices}</TableCell>
                    <TableCell>{s.max_flavors}</TableCell>
                    <TableCell>{formatBRL(Number(s.price) || 0)}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Switch
                          checked={!!s.active}
                          onCheckedChange={(v) => toggleSize(s, v)}
                          aria-label="Alternar status do tamanho"
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
                          <DropdownMenuItem onClick={() => { setEditingSize(s); setOpenSize(true); }}>
                            <Pencil className="mr-2 h-4 w-4" />
                            <span>Editar</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600 focus:text-red-700" onClick={() => deleteSize(s.id)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Excluir</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Flavors */}
        <TabsContent value="flavors" className="mt-4">
          <div className="flex items-center gap-4 mb-2">
            <Input placeholder="Buscar sabor..." value={flavorSearch} onChange={(e) => setFlavorSearch(e.target.value)} className="max-w-xs" />
            <div className="flex items-center gap-2">
              <Switch
                id="flavors-ativos"
                checked={!!flavorActiveOnly}
                onCheckedChange={onToggleFlavorActiveOnly}
                className="data-[state=checked]:bg-status-on data-[state=unchecked]:bg-status-off"
              />
              <label htmlFor="flavors-ativos" className="text-sm text-muted-foreground select-none">Ativos</label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="flavors-inativos"
                checked={!!flavorInactiveOnly}
                onCheckedChange={onToggleFlavorInactiveOnly}
                className="data-[state=checked]:bg-status-on data-[state=unchecked]:bg-status-off"
              />
              <label htmlFor="flavors-inativos" className="text-sm text-muted-foreground select-none">Inativos</label>
            </div>
          </div>

          <Dialog open={openFlavor} onOpenChange={(o) => { setOpenFlavor(o); if (!o) { setEditingFlavor(null); resetFlavorForm(); } }}>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingFlavor ? "Editar Sabor" : "Novo Sabor"}</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div className="grid gap-1">
                    <Label htmlFor="flavor-name">Nome</Label>
                    <Input id="flavor-name" placeholder="Nome" value={flavorForm.name as any} onChange={(e) => setFlavorForm({ ...flavorForm, name: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1">
                      <Label htmlFor="flavor-category">Categoria</Label>
                      <Input id="flavor-category" placeholder="Categoria" value={flavorForm.category as any} onChange={(e) => setFlavorForm({ ...flavorForm, category: e.target.value })} />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="flavor-category-value">Acréscimo categoria</Label>
                      <Input
                        id="flavor-category-value"
                        inputMode="numeric"
                        placeholder="Acréscimo categoria"
                        value={CurrencyMask.formatForDisplay(flavorForm.category_value || 0)}
                        onChange={(e) => {
                          const masked = CurrencyMask.applyMask(e.target.value);
                          e.target.value = masked;
                          const num = CurrencyMask.parseValue(masked);
                          setFlavorForm({ ...flavorForm, category_value: num });
                        }}
                      />
                    </div>
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="flavor-ingredients">Ingredientes</Label>
                    <Input id="flavor-ingredients" placeholder="Ingredientes" value={flavorForm.ingredients as any} onChange={(e) => setFlavorForm({ ...flavorForm, ingredients: e.target.value })} />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="flavor-image">URL da imagem</Label>
                    <Input id="flavor-image" placeholder="URL da imagem" value={flavorForm.image_url as any} onChange={(e) => setFlavorForm({ ...flavorForm, image_url: e.target.value })} />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="flavor-description">Descrição</Label>
                    <Input id="flavor-description" placeholder="Descrição" value={flavorForm.description as any} onChange={(e) => setFlavorForm({ ...flavorForm, description: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-center">
                    <div className="flex items-center gap-2"><Switch checked={!!flavorForm.active} onCheckedChange={(v) => setFlavorForm({ ...flavorForm, active: v ? 1 : 0 })} /><span className="text-sm">Ativo</span></div>
                    <div className="flex items-center gap-2"><Switch checked={!!flavorForm.is_vegan} onCheckedChange={(v) => setFlavorForm({ ...flavorForm, is_vegan: v ? 1 : 0 })} /><span className="text-sm">Vegano</span></div>
                    <div className="flex items-center gap-2"><Switch checked={!!flavorForm.is_gluten_free} onCheckedChange={(v) => setFlavorForm({ ...flavorForm, is_gluten_free: v ? 1 : 0 })} /><span className="text-sm">Sem Glúten</span></div>
                    <div className="flex items-center gap-2"><Switch checked={!!flavorForm.is_spicy} onCheckedChange={(v) => setFlavorForm({ ...flavorForm, is_spicy: v ? 1 : 0 })} /><span className="text-sm">Apimentado</span></div>
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="flavor-order">Ordem</Label>
                    <Input id="flavor-order" type="number" placeholder="Ordem" value={flavorForm.display_order as any} onChange={(e) => setFlavorForm({ ...flavorForm, display_order: Number(e.target.value) })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setOpenFlavor(false); setEditingFlavor(null); resetFlavorForm(); }}>Cancelar</Button>
                  <Button onClick={saveFlavor}>Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Acréscimo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flavorsFiltered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Nenhum sabor</TableCell></TableRow>
                ) : flavorsFiltered.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>{f.name}</TableCell>
                    <TableCell>{f.category || '-'}</TableCell>
                    <TableCell>{formatBRL(Number(f.category_value) || 0)}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Switch
                          checked={!!f.active}
                          onCheckedChange={(v) => toggleFlavor(f, v)}
                          aria-label="Alternar status do sabor"
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
                          <DropdownMenuItem onClick={() => { setEditingFlavor(f); setOpenFlavor(true); }}>
                            <Pencil className="mr-2 h-4 w-4" />
                            <span>Editar</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600 focus:text-red-700" onClick={() => deleteFlavor(f.id)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Excluir</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Borders */}
        <TabsContent value="borders" className="mt-4">
          {/* removido cabeçalho duplicado da aba Bordas */}
          <div className="flex w-full items-center mb-2">
            <div className="flex items-center gap-4">
              <Input placeholder="Buscar borda..." value={borderSearch} onChange={(e) => setBorderSearch(e.target.value)} className="max-w-xs" />
              <div className="flex items-center gap-2">
                <Switch
                  id="borders-ativos"
                  checked={!!borderActiveOnly}
                  onCheckedChange={onToggleBorderActiveOnly}
                  className="data-[state=checked]:bg-status-on data-[state=unchecked]:bg-status-off"
                />
                <label htmlFor="borders-ativos" className="text-sm text-muted-foreground select-none">Ativos</label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="borders-inativos"
                  checked={!!borderInactiveOnly}
                  onCheckedChange={onToggleBorderInactiveOnly}
                  className="data-[state=checked]:bg-status-on data-[state=unchecked]:bg-status-off"
                />
                <label htmlFor="borders-inativos" className="text-sm text-muted-foreground select-none">Inativos</label>
              </div>
            </div>
            <Dialog open={openBorder} onOpenChange={(o) => { setOpenBorder(o); if (!o) { setEditingBorder(null); resetBorderForm(); } }}>
              <DialogContent>
                <DialogHeader><DialogTitle>{editingBorder ? "Editar Borda" : "Nova Borda"}</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div className="grid gap-1">
                    <Label htmlFor="border-name">Nome</Label>
                    <Input id="border-name" placeholder="Nome" value={borderForm.name as any} onChange={(e) => setBorderForm({ ...borderForm, name: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1">
                      <Label htmlFor="border-price">Preço</Label>
                      <Input
                        id="border-price"
                        inputMode="numeric"
                        placeholder="Preço"
                        value={CurrencyMask.formatForDisplay(borderForm.price || 0)}
                        onChange={(e) => {
                          const masked = CurrencyMask.applyMask(e.target.value);
                          e.target.value = masked;
                          const num = CurrencyMask.parseValue(masked);
                          setBorderForm({ ...borderForm, price: num });
                        }}
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="border-order">Ordem</Label>
                      <Input id="border-order" type="number" placeholder="Ordem" value={borderForm.display_order as any} onChange={(e) => setBorderForm({ ...borderForm, display_order: Number(e.target.value) })} />
                    </div>
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="border-description">Descrição</Label>
                    <Input id="border-description" placeholder="Descrição" value={borderForm.description as any} onChange={(e) => setBorderForm({ ...borderForm, description: e.target.value })} />
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Switch checked={!!borderForm.active} onCheckedChange={(v) => setBorderForm({ ...borderForm, active: v ? 1 : 0 })} />
                    <span className="text-sm">Ativo</span>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setOpenBorder(false); setEditingBorder(null); resetBorderForm(); }}>Cancelar</Button>
                  <Button onClick={saveBorder}>Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Ordem</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bordersFiltered.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Nenhuma borda</TableCell></TableRow>
                ) : bordersFiltered.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>{b.name}</TableCell>
                    <TableCell>{formatBRL(Number(b.price) || 0)}</TableCell>
                    <TableCell>{b.display_order}</TableCell>
                    <TableCell>
                      <Switch checked={!!b.active} onCheckedChange={(v) => toggleBorder(b, v)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Ações</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => { setEditingBorder(b); setOpenBorder(true); }}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600" onClick={() => deleteBorder(b.id!)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Extras */}
        <TabsContent value="extras" className="mt-4">
          <div className="flex w-full items-center mb-2">
            <div className="flex items-center gap-4">
              <Input placeholder="Buscar adicional..." value={extraSearch} onChange={(e) => setExtraSearch(e.target.value)} className="max-w-xs" />
              <div className="flex items-center gap-2">
                <Switch
                  id="extras-ativos"
                  checked={!!extraActiveOnly}
                  onCheckedChange={onToggleExtraActiveOnly}
                  className="data-[state=checked]:bg-status-on data-[state=unchecked]:bg-status-off"
                />
                <label htmlFor="extras-ativos" className="text-sm text-muted-foreground select-none">Ativos</label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="extras-inativos"
                  checked={!!extraInactiveOnly}
                  onCheckedChange={onToggleExtraInactiveOnly}
                  className="data-[state=checked]:bg-status-on data-[state=unchecked]:bg-status-off"
                />
                <label htmlFor="extras-inativos" className="text-sm text-muted-foreground select-none">Inativos</label>
              </div>
            </div>
            <Dialog open={openExtra} onOpenChange={(o) => { setOpenExtra(o); if (!o) { setEditingExtra(null); resetExtraForm(); } }}>
              <DialogContent>
                <DialogHeader><DialogTitle>{editingExtra ? "Editar Adicional" : "Novo Adicional"}</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div className="grid gap-1">
                    <Label htmlFor="extra-name">Nome</Label>
                    <Input id="extra-name" placeholder="Nome" value={extraForm.name as any} onChange={(e) => setExtraForm({ ...extraForm, name: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1">
                      <Label htmlFor="extra-category">Categoria</Label>
                      <Input id="extra-category" placeholder="Categoria" value={extraForm.category as any} onChange={(e) => setExtraForm({ ...extraForm, category: e.target.value })} />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="extra-price">Preço</Label>
                      <Input
                        id="extra-price"
                        inputMode="numeric"
                        placeholder="Preço"
                        value={CurrencyMask.formatForDisplay(extraForm.price || 0)}
                        onChange={(e) => {
                          const masked = CurrencyMask.applyMask(e.target.value);
                          e.target.value = masked;
                          const num = CurrencyMask.parseValue(masked);
                          setExtraForm({ ...extraForm, price: num });
                        }}
                      />
                    </div>
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="extra-description">Descrição</Label>
                    <Input id="extra-description" placeholder="Descrição" value={extraForm.description as any} onChange={(e) => setExtraForm({ ...extraForm, description: e.target.value })} />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="extra-order">Ordem</Label>
                    <Input id="extra-order" type="number" placeholder="Ordem" value={extraForm.display_order as any} onChange={(e) => setExtraForm({ ...extraForm, display_order: Number(e.target.value) })} />
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Switch checked={!!extraForm.active} onCheckedChange={(v) => setExtraForm({ ...extraForm, active: v ? 1 : 0 })} />
                    <span className="text-sm">Ativo</span>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setOpenExtra(false); setEditingExtra(null); resetExtraForm(); }}>Cancelar</Button>
                  <Button onClick={saveExtra}>Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Ordem</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {extrasFiltered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Nenhum adicional</TableCell></TableRow>
                ) : extrasFiltered.map((ex) => (
                  <TableRow key={ex.id}>
                    <TableCell>{ex.name}</TableCell>
                    <TableCell>{ex.category || '-'}</TableCell>
                    <TableCell>{formatBRL(Number(ex.price) || 0)}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Switch
                          checked={!!ex.active}
                          onCheckedChange={(v) => toggleExtra(ex, v)}
                          aria-label="Alternar status do adicional"
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
                          <DropdownMenuItem onClick={() => { setEditingExtra(ex); setOpenExtra(true); }}>
                            <Pencil className="mr-2 h-4 w-4" />
                            <span>Editar</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600 focus:text-red-700" onClick={() => deleteExtra(ex.id)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Excluir</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}