import { useEffect, useState } from "react";
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, ChevronLeft, ChevronRight } from "lucide-react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { httpClient } from "@/lib/http";
import { normalizeImageUrl, assetUrl } from "@/lib/utils";

const loginSchema = z.object({
  email: z.string().min(1, "Informe seu e-mail.").email("E-mail inválido."),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres."),
  remember: z.boolean().default(false),
});

type LoginForm = z.input<typeof loginSchema>;

type Slide = {
  src: string;
  title: string;
  desc?: string;
  alt: string;
};

const slides: Slide[] = [
  {
    src: assetUrl("/sabor-que-conquista.jpg"),
    title: "Sabor que conquista",
    desc: "Lanches crocantes prontos para encantar seus clientes em cada pedido.",
    alt: "Batatas fritas crocantes",
  },
  {
    src: assetUrl("/tecnologia-negocio.png"),
    title: "Tecnologia a favor do seu negócio",
    desc: "Gestão inteligente com automações e relatórios para decisões rápidas.",
    alt: "Ilustração tecnológica gerada por IA",
  },
  {
    src: assetUrl("/experiencia-impecavel.jpg"),
    alt: "Experiência impecável: imagem de comida apetitosa",
    title: "Experiência impecável",
    desc:
      "Pedidos sem atrito, interface responsiva e fluxo otimizado do balcão à entrega.",
  },
];

export default function LoginPage() {
  const { toast } = useToast();
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  // Logo da empresa (carregado do backend)
  const [logoUrl, setLogoUrl] = useState<string>("");
  // Nome da empresa (carregado do backend)
  const [companyName, setCompanyName] = useState<string>("");

  const savedEmail = typeof window !== "undefined" ? localStorage.getItem("remember_email") || "" : "";
  const savedRemember = typeof window !== "undefined" ? localStorage.getItem("remember_flag") === "1" : false;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: savedEmail,
      password: "",
      remember: savedRemember || false // Ensure remember is always boolean
    }
  });

  useEffect(() => {
    const id = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // Buscar dados mínimos da empresa (logo e nome)
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res: any = await httpClient.get("/settings/company");
        if (active && res?.success && res.data) {
          if (res.data.logo_url) setLogoUrl(String(res.data.logo_url));
          if (res.data.name) setCompanyName(String(res.data.name));
        }
      } catch (_) {
        // silencioso: não bloquear login caso falhe
      }
    })();
    return () => { active = false };
  }, []);

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  const onSubmit: SubmitHandler<LoginForm> = async (data) => {
    try {
      await login(data.email, data.password, !!data.remember);
      if (data.remember) {
        localStorage.setItem("remember_email", data.email);
        localStorage.setItem("remember_flag", "1");
      } else {
        localStorage.removeItem("remember_email");
        localStorage.setItem("remember_flag", "0");
      }
      toast({ title: "Bem-vindo!", description: "Login realizado com sucesso." });
      navigate("/", { replace: true });
    } catch (err: any) {
      toast({ title: "Falha no login", description: err?.message || "Verifique suas credenciais.", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen grid grid-rows-[1fr_auto] grid-cols-1 md:grid-cols-2">
      <div className="relative hidden md:block bg-muted">
        <img
          src={slides[currentSlide].src}
          alt={slides[currentSlide].alt}
          className="absolute inset-0 w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={(e) => {
            e.currentTarget.src = assetUrl("/fallback-login.svg");
          }}
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative h-full flex flex-col justify-end p-10 text-white">
          <div className="max-w-lg">
            <h2 className="text-3xl font-bold">{slides[currentSlide].title}</h2>
            <p className="text-white/90">{slides[currentSlide].desc}</p>
          </div>
          <div className="mt-6 flex items-center gap-3">
            <button
              className="p-2 rounded-full bg-white/20 hover:bg-white/30"
              onClick={() => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)}
              aria-label="Slide anterior"
            >
              <ChevronLeft />
            </button>
            <button
              className="p-2 rounded-full bg-white/20 hover:bg-white/30"
              onClick={() => setCurrentSlide((prev) => (prev + 1) % slides.length)}
              aria-label="Próximo slide"
            >
              <ChevronRight />
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        {/* Contêiner mantém largura do Card e posiciona o logo acima */}
        <div className="w-full max-w-sm flex flex-col items-center">
          {(logoUrl || companyName) && (
            <div className="mb-4 flex flex-col items-center">
              {logoUrl ? (
                <img
                  src={normalizeImageUrl(logoUrl)}
                  alt="Logo da empresa"
                  className="h-16 w-auto mb-1 rounded-md bg-white p-1 shadow-sm"
                />
              ) : null}
              {companyName ? (
                <div className="text-base font-medium text-center">{companyName}</div>
              ) : null}
            </div>
          )}

          <Card className="w-full">
            <CardHeader>
              <CardTitle>Entrar</CardTitle>
              <CardDescription>Acesse o painel administrativo</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      className={`pl-10 ${errors.email ? "border-destructive focus-visible:ring-destructive" : ""}`}
                      aria-invalid={!!errors.email}
                      aria-describedby={errors.email ? "email-error" : undefined}
                      {...register("email")}
                      autoFocus
                    />
                  </div>
                  {errors.email && (
                    <p id="email-error" className="text-sm text-destructive">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      className={`pl-10 pr-10 ${errors.password ? "border-destructive focus-visible:ring-destructive" : ""}`}
                      aria-invalid={!!errors.password}
                      aria-describedby={errors.password ? "password-error" : undefined}
                      {...register("password")}
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p id="password-error" className="text-sm text-destructive">
                      {errors.password.message}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input id="remember" type="checkbox" className="h-4 w-4" {...register("remember")} />
                    <Label htmlFor="remember">Lembrar de mim</Label>
                  </div>
                </div>

                <Button className="w-full" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Entrando..." : "Entrar"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Ao entrar, você concorda com nossos Termos de Serviço e Política de Privacidade.
                </p>
              </form>
            </CardContent>
            <CardFooter className="flex w-full items-center">
              <Button variant="link" asChild className="px-0">
                <Link to="/forgot-password">Esqueci minha senha</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
      <footer className="col-span-1 md:col-span-2 text-center text-xs text-muted-foreground py-3 border-t">
        Copyright 2025 - ♥ por <a href="https://www.gsite.com.br" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">Gsite</a>
      </footer>
    </div>
  );
}