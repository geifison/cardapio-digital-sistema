import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { normalizeImageUrl } from "@/lib/utils";
import { useCategories, getCategoryById } from "@/hooks/useCategories";
import type { Category } from "@/hooks/useCategories";
import { useNavigate, useParams } from "react-router-dom";
import { httpClient } from "@/lib/http";

export default function CategoryFormPage({ mode }: { mode: "create" | "edit" }) {
  const navigate = useNavigate();
  const params = useParams();
  const id = params.id ? Number(params.id) : null;
  const isEdit = mode === "edit" && !!id;
  const { toast } = useToast();
  const { createCategory, updateCategory } = useCategories({ autoFetch: false });

  const [imageUploading, setImageUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Partial<Category>>({ name: "", description: "", image_url: "", display_order: 0, active: 1 });

  useEffect(() => {
    (async () => {
      if (isEdit && id) {
        try {
          const res = await getCategoryById(id);
          if (res.success) {
            const c = res.data;
            setForm({
              name: c.name,
              description: c.description || "",
              image_url: c.image_url || "",
              display_order: c.display_order || 0,
              active: Number(c.active) ? 1 : 0,
            });
          }
        } catch (e) {
          toast({ title: "Erro", description: "Falha ao carregar categoria", variant: "destructive" as any });
        }
      }
    })();
  }, [id, isEdit, toast]);

  const canSubmit = useMemo(() => {
    return Boolean(form.name && (form.active === 0 || form.active === 1));
  }, [form.name, form.active]);

  const onFileChange = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImageUploading(true);
      const fd = new FormData();
      fd.append("image", file);
      const payload = await httpClient.postFormData("/upload.php", fd);
      if (!payload?.success) throw new Error(payload?.message || "Falha no upload");
      setForm((prev) => ({ ...prev, image_url: payload.url }));
    } catch (e: any) {
      toast({ title: "Erro no upload", description: e.message, variant: "destructive" as any });
    } finally {
      setImageUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    const payload: Partial<Category> = {
      name: form.name?.trim() || "",
      description: form.description || "",
      image_url: form.image_url || "",
      display_order: Number(form.display_order) || 0,
      active: form.active ? 1 : 0,
    };
    const action = isEdit && id ? updateCategory(id, payload) : createCategory(payload);
    const res = await action;
    setLoading(false);
    if (res.success) {
      toast({ title: isEdit ? "Categoria atualizada" : "Categoria criada" });
      navigate("/produtos/categorias");
    } else {
      toast({ title: "Erro", description: res.message, variant: "destructive" as any });
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm">Nome</label>
          <Input value={form.name as any} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Bebidas" />
        </div>
        <div className="grid gap-2">
          <label className="text-sm">Ordem de Exibição</label>
          <Input type="number" value={form.display_order as any} onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })} />
        </div>
        <div className="grid gap-2 md:col-span-2">
          <label className="text-sm">Descrição</label>
          <Textarea value={form.description as any} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Opcional" />
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-[240px_1fr]">
        <div className="aspect-square rounded-md border overflow-hidden bg-muted">
          {form.image_url ? (
            <img src={normalizeImageUrl(form.image_url)} alt="preview" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full grid place-items-center text-xs text-muted-foreground">Sem imagem</div>
          )}
        </div>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <label className="text-sm">URL da imagem</label>
            <Input value={form.image_url as any} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
            <p className="text-xs text-muted-foreground">Você pode colar uma URL ou fazer upload de um arquivo.</p>
          </div>
          <div className="grid gap-2">
            <label className="text-sm">Upload de imagem</label>
            <Input type="file" accept="image/*" onChange={onFileChange} />
            <p className="text-xs text-muted-foreground">Upload imediato ao selecionar. Máx 2MB. Formatos: jpg, jpeg, png, gif, webp.</p>
            {imageUploading && <p className="text-xs">Enviando imagem...</p>}
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={!!form.active} onCheckedChange={(v) => setForm({ ...form, active: v ? 1 : 0 })} className="peer data-[state=checked]:bg-status-on data-[state=unchecked]:bg-status-off" />
            <span className="text-xs sm:text-sm shrink-0 whitespace-nowrap peer-data-[state=checked]:text-status-on peer-data-[state=unchecked]:text-status-off">Ativa</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!canSubmit || loading || imageUploading}>{isEdit ? "Salvar alterações" : "Criar categoria"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}