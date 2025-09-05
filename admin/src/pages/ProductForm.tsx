import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { httpClient } from "@/lib/http";
import { createProduct, getProductById, updateProduct } from "@/hooks/useProducts";
import { usePizza } from "@/hooks/usePizza";
import MultiSelect from "@/components/MultiSelect";
import { applyCurrencyMaskBRL, normalizeImageUrl, formatCurrencyBRL } from "@/lib/utils";

// Tipos locais
type Category = { id: number; name: string; active: number | boolean };

export type Product = {
  id?: number;
  name: string;
  description?: string | null;
  price: number;
  category_id: number | null;
  image_url?: string | null;
  active: boolean;
  product_type: "comum" | "pizza";
  display_order?: number | null;
  is_vegetarian?: boolean;
  is_vegan?: boolean;
  is_gluten_free?: boolean;
  is_spicy?: boolean;
  preparation_time?: number | null;
  pizza_sizes?: number[];
  pizza_flavors?: number[];
  pizza_borders?: number[];
  pizza_extras?: number[];
};

export default function ProductFormPage({ mode }: { mode: "create" | "edit" }) {
  const navigate = useNavigate();
  const params = useParams();
  const { toast } = useToast();
  const productId = mode === "edit" ? Number(params.id) : undefined;

  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [imageUploading, setImageUploading] = useState(false);

  // Hook pizza
  const { sizes, flavors, borders, extras, loading: pizzaLoading } = usePizza();

  const [form, setForm] = useState<Product>({
    name: "",
    description: "",
    price: 0,
    category_id: null,
    image_url: "",
    active: true,
    product_type: "comum",
    display_order: 0,
    is_vegetarian: false,
    is_vegan: false,
    is_gluten_free: false,
    is_spicy: false,
    preparation_time: 0,
    pizza_sizes: [],
    pizza_flavors: [],
    pizza_borders: [],
    pizza_extras: [],
  });

  // Carrega categorias
  useEffect(() => {
    (async () => {
      try {
        const res = await httpClient.get<{ success: boolean; data: Category[] }>("/categories?all=true");
        if (res.success) setCategories(res.data || []);
      } catch (e) {
        toast({ title: "Erro ao carregar categorias", variant: "destructive" as any });
      }
    })();
  }, [toast]);

  const [priceMasked, setPriceMasked] = useState<string>("");

  // Carrega produto em modo edição
  useEffect(() => {
    if (mode !== "edit" || !productId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await getProductById(productId);
        if (res.success) {
          const p = res.data;
          setForm({
            id: p.id,
            name: p.name || "",
            description: p.description || "",
            price: Number(p.price) || 0,
            category_id: p.category_id ?? null,
            image_url: p.image_url || "",
            active: !!p.active,
            product_type: (p.product_type as "comum" | "pizza") || "comum",
            display_order: p.display_order ?? 0,
            is_vegetarian: !!p.is_vegetarian,
            is_vegan: !!p.is_vegan,
            is_gluten_free: !!p.is_gluten_free,
            is_spicy: !!p.is_spicy,
            preparation_time: p.preparation_time ?? 0,
            pizza_sizes: p.pizza_sizes || [],
            pizza_flavors: p.pizza_flavors || [],
            pizza_borders: p.pizza_borders || [],
            pizza_extras: p.pizza_extras || [],
          });
          // sincroniza máscara
          const { masked } = applyCurrencyMaskBRL(String(Number(p.price) || 0));
          setPriceMasked(masked);
        }
      } catch (e: any) {
        toast({ title: "Erro ao carregar produto", description: e.message, variant: "destructive" as any });
      } finally {
        setLoading(false);
      }
    })();
  }, [mode, productId, toast]);

  // Upload imediato da imagem
  const handleImageChange = async (file?: File) => {
    if (!file) return;
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const payload = await httpClient.postFormData("/upload.php", formData);
      if (!payload?.success) {
        throw new Error(payload?.message || "Falha no upload");
      }
      setForm((prev) => ({ ...prev, image_url: payload.url }));
      toast({ title: "Imagem enviada", description: "Preview atualizado." });
    } catch (e: any) {
      toast({ title: "Erro no upload", description: e.message, variant: "destructive" as any });
    } finally {
      setImageUploading(false);
    }
  };

  // Validação mínima
  const canSubmit = useMemo(() => {
    return !!form.name?.trim() && typeof form.price === "number" && form.category_id !== null && !!form.product_type;
  }, [form]);

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" as any });
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        name: form.name,
        description: form.description || "",
        price: form.price,
        category_id: form.category_id,
        image_url: form.image_url || "",
        display_order: form.display_order ?? 0,
        active: !!form.active,
        is_vegetarian: !!form.is_vegetarian,
        is_vegan: !!form.is_vegan,
        is_gluten_free: !!form.is_gluten_free,
        is_spicy: !!form.is_spicy,
        preparation_time: form.preparation_time ?? 0,
        product_type: form.product_type,
      };

      // Pizza: enviar arrays se houver
      if (form.product_type === "pizza") {
        payload.pizza_sizes = form.pizza_sizes || [];
        payload.pizza_flavors = form.pizza_flavors || [];
        payload.pizza_borders = form.pizza_borders || [];
        payload.pizza_extras = form.pizza_extras || [];
      }

      if (mode === "create") {
        const res = await createProduct(payload);
        if (res.success) {
          toast({ title: "Produto criado" });
          navigate("/produtos");
          return;
        }
        throw new Error(res.message || "Falha ao criar produto");
      } else {
        const res = await updateProduct(productId!, payload);
        if (res.success) {
          toast({ title: "Produto atualizado" });
          navigate("/produtos");
          return;
        }
        throw new Error(res.message || "Falha ao atualizar produto");
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" as any });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex w-full items-center">
        <h1 className="text-2xl font-bold">{mode === "create" ? "Criar Produto" : "Editar Produto"}</h1>
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" onClick={() => navigate("/produtos")}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || loading || imageUploading}>
            {loading ? "Salvando..." : mode === "create" ? "Criar" : "Salvar"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna principal */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-4 space-y-4">
            <h2 className="text-base font-medium">Informações Básicas</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm">Nome <span className="text-red-500">*</span></label>
                <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm">Preço <span className="text-red-500">*</span></label>
                <Input
                  inputMode="numeric"
                  value={priceMasked}
                  onChange={(e) => {
                    const { masked, value } = applyCurrencyMaskBRL(e.target.value);
                    setPriceMasked(masked);
                    setForm((p) => ({ ...p, price: value }));
                  }}
                />
              </div>
            </div>
            <div>
              <label className="text-sm">Descrição</label>
              <Textarea value={form.description || ""} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
          </Card>

          <Card className="p-4 space-y-4">
            <h2 className="text-base font-medium">Categorização</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm">Categoria <span className="text-red-500">*</span></label>
                <Select value={form.category_id?.toString() || ""} onValueChange={(v) => setForm((p) => ({ ...p, category_id: Number(v) }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm">Tipo <span className="text-red-500">*</span></label>
                <Select value={form.product_type} onValueChange={(v) => setForm((p) => {
                  const nextType = v as "comum" | "pizza";
                  if (p.product_type === "pizza" && nextType !== "pizza") {
                    return {
                      ...p,
                      product_type: nextType,
                      pizza_sizes: [],
                      pizza_flavors: [],
                      pizza_borders: [],
                      pizza_extras: [],
                    };
                  }
                  return { ...p, product_type: nextType };
                })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comum">Comum</SelectItem>
                    <SelectItem value="pizza">Pizza</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          <Card className="p-4 space-y-4">
            <h2 className="text-base font-medium">Imagem</h2>
            <div className="flex items-center gap-4">
              <div className="h-24 w-24 rounded border bg-muted overflow-hidden">
                {form.image_url ? (
                  <img src={normalizeImageUrl(form.image_url)} alt="preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">Sem imagem</div>
                )}
              </div>
              <div className="space-y-2">
                <Input type="file" accept="image/*" onChange={(e) => handleImageChange(e.target.files?.[0])} />
                <p className="text-xs text-muted-foreground">Upload imediato ao selecionar. Máx 2MB. Formatos: jpg, jpeg, png, gif, webp.</p>
                {imageUploading && <p className="text-xs">Enviando imagem...</p>}
              </div>
            </div>
          </Card>

          <Card className="p-4 space-y-4">
            <h2 className="text-base font-medium">Pizza</h2>
            {form.product_type !== "pizza" ? (
              <p className="text-sm text-muted-foreground">Selecione o tipo "Pizza" para configurar tamanhos, sabores, bordas e adicionais.</p>
            ) : (
              <div className="space-y-6">
                {pizzaLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando configurações de pizza...</p>
                ) : (
                  <>
                    <MultiSelect
                      title="Tamanhos disponíveis"
                      options={sizes.filter(s => s.active).map(s => ({
                        id: s.id,
                        label: s.name,
                        description: `${s.slices} fatias, até ${s.max_flavors} sabores - ${formatCurrencyBRL(s.price)}`
                      }))}
                      value={form.pizza_sizes || []}
                      onChange={(value) => setForm(p => ({ ...p, pizza_sizes: value }))}
                      disabled={form.product_type !== "pizza"}
                    />
                    
                    <MultiSelect
                      title="Sabores disponíveis"
                      options={flavors.filter(f => f.active).map(f => ({
                        id: f.id,
                        name: f.name,
                        description: f.description || f.ingredients
                      }))}
                      value={form.pizza_flavors || []}
                      onChange={(value) => setForm(p => ({ ...p, pizza_flavors: value }))}
                      columns={3}
                      disabled={form.product_type !== "pizza"}
                    />
                    
                    <MultiSelect
                      title="Bordas disponíveis"
                      options={borders.filter(b => b.active).map(b => ({
                        id: b.id,
                        label: b.name,
                        description: b.price ? `+ ${formatCurrencyBRL(b.price)}` : b.description
                      }))}
                      value={form.pizza_borders || []}
                      onChange={(value) => setForm(p => ({ ...p, pizza_borders: value }))}
                      disabled={form.product_type !== "pizza"}
                    />
                    
                    <MultiSelect
                      title="Adicionais disponíveis"
                      options={extras.filter(e => e.active).map(e => ({
                        id: e.id,
                        label: e.name,
                        description: `+ ${formatCurrencyBRL(e.price)}${e.description ? ` - ${e.description}` : ''}`
                      }))}
                      value={form.pizza_extras || []}
                      onChange={(value) => setForm(p => ({ ...p, pizza_extras: value }))}
                      columns={3}
                      disabled={form.product_type !== "pizza"}
                    />
                  </>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Coluna lateral */}
        <div className="space-y-6">
          <Card className="p-4 space-y-3">
            <h2 className="text-base font-medium">Publicação</h2>
            <div className="flex items-center gap-2">
              <Switch checked={!!form.active} onCheckedChange={(v) => setForm((p) => ({ ...p, active: v }))} className="peer data-[state=checked]:bg-status-on data-[state=unchecked]:bg-status-off" />
              <span className="text-xs sm:text-sm whitespace-nowrap peer-data-[state=checked]:text-status-on peer-data-[state=unchecked]:text-status-off">Ativo</span>
            </div>
            <div className="flex items-center">
              <span className="text-sm">Vegetariano</span>
              <Switch checked={!!form.is_vegetarian} onCheckedChange={(v) => setForm((p) => ({ ...p, is_vegetarian: v }))} />
            </div>
            <div className="flex items-center">
              <span className="text-sm">Vegano</span>
              <Switch checked={!!form.is_vegan} onCheckedChange={(v) => setForm((p) => ({ ...p, is_vegan: v }))} />
            </div>
            <div className="flex items-center">
              <span className="text-sm">Sem glúten</span>
              <Switch checked={!!form.is_gluten_free} onCheckedChange={(v) => setForm((p) => ({ ...p, is_gluten_free: v }))} />
            </div>
            <div className="flex items-center">
              <span className="text-sm">Apimentado</span>
              <Switch checked={!!form.is_spicy} onCheckedChange={(v) => setForm((p) => ({ ...p, is_spicy: v }))} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}