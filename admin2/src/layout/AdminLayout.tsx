import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Menu, Home, ShoppingBag, Box, ListTree, Pizza, Settings, Search, Bell } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import logoUrl from "../../logo_apibu.svg";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { assetUrl } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/pedidos", label: "Pedidos", icon: ShoppingBag },
  { to: "/pedidos/historico", label: "Histórico de Pedidos", iconImage: "/icons/orders_history.svg" },
  { to: "/produtos", label: "Produtos", icon: Box },
  { to: "/produtos/categorias", label: "Categorias", icon: ListTree },
  { to: "/pizzas", label: "Pizzas", icon: Pizza },
  { to: "/config", label: "Configurações", icon: Settings },
];

function Sidebar({ collapsed, isAdmin }: { collapsed: boolean; isAdmin: boolean }) {
  return (
    <aside className={`hidden md:flex md:flex-col border-r bg-background ${collapsed ? "md:w-16" : "md:w-56"}`}>
      {/* Brand no topo do menu lateral */}
      <div className="flex items-center gap-2 h-14 px-3 border-b">
        <img src={logoUrl} alt="PAPIBU" className="h-6 w-auto" />
        {!collapsed && <span className="font-semibold tracking-wide">PAPIBU</span>}
      </div>
      <nav className="flex-1 px-2 py-2 space-y-1">
        {(isAdmin ? navItems : navItems.filter(item => item.to !== "/config")).map(({ to, label, icon: Icon, iconImage }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground ${
                isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
              }`
            }
            end={to === "/"}
          >
            {Icon ? <Icon size={18} /> : iconImage ? <img src={assetUrl(iconImage)} alt="" className="h-[18px] w-[18px]" /> : null}
            {!collapsed && <span>{label}</span>}
            {collapsed && <span className="sr-only">{label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

function MobileNav({ isAdmin }: { isAdmin: boolean }) {
  return (
    <Sheet>
      <Tooltip>
        <TooltipTrigger asChild>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Abrir menu</span>
            </Button>
          </SheetTrigger>
        </TooltipTrigger>
        <TooltipContent>Abrir menu</TooltipContent>
      </Tooltip>
      <SheetContent side="left" className="w-64">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        {/* Brand simples no topo do drawer */}
        <div className="flex items-center gap-2 h-12">
          <img src={logoUrl} alt="PAPIBU" className="h-6 w-auto" />
          <span className="font-semibold">PAPIBU</span>
        </div>
        <nav className="grid gap-2 mt-4">
          {(isAdmin ? navItems : navItems.filter(item => item.to !== "/config")).map(({ to, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `px-3 py-2 rounded ${isActive ? "bg-accent" : "hover:bg-accent"}`} end={to === "/"}>
              {label}
            </NavLink>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function useBreadcrumb() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);
  const map: Record<string, string> = {
    pedidos: "Pedidos",
    produtos: "Produtos",
    categorias: "Categorias",
    pizzas: "Pizzas",
    config: "Configurações",
    buscar: "Buscar",
    historico: "Histórico de Pedidos",
  };
  return { segments, map };
}

export function AdminLayout() {
  const { segments, map } = useBreadcrumb();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';

  const onSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const q = (fd.get("q") || "").toString().trim();
    // Não navegar para /buscar, redirecionar para Produtos com filtro
    if (q) navigate(`/produtos?q=${encodeURIComponent(q)}`);
  };

  const initials = (user?.name || "U").split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <Sidebar collapsed={collapsed} isAdmin={isAdmin} />
      <div className="flex flex-col min-h-screen flex-1">
        <header className="sticky top-0 z-40 border-b bg-background">
          <div className="w-full px-4 h-14 flex items-center gap-3 justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="hidden md:flex">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => setCollapsed(v => !v)} aria-label="Alternar sidebar">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Alternar sidebar</TooltipContent>
                </Tooltip>
              </div>
              <MobileNav isAdmin={isAdmin} />
              {/* Removido: logo e texto no header; agora ficam no menu lateral */}
            </div>

            {/* Removido o Menu Principal (links) do topo */}
            {/* <nav className="hidden md:flex items-center gap-4 text-sm"> ... </nav> */}

            <div className="flex items-center gap-2">
              <form onSubmit={onSearchSubmit} className="hidden lg:flex items-center">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input name="q" placeholder="Buscar..." className="pl-8 w-72" />
                </div>
              </form>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileSearchOpen(true)} aria-label="Abrir busca">
                    <Search className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Abrir busca</TooltipContent>
              </Tooltip>

              <ThemeToggle />

              {isAdmin && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Notificações" onClick={() => navigate('/config')}>
                      <Bell className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Notificações</TooltipContent>
                </Tooltip>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:inline-block max-w-[12rem] truncate text-sm">{user?.name || 'Usuário'}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{user?.name || 'Usuário'}</span>
                      <span className="text-xs text-muted-foreground truncate">{user?.email || ''}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled>Meu Perfil</DropdownMenuItem>
                  <DropdownMenuItem disabled>Configurações da Conta</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={async () => { await logout(); navigate('/login', { replace: true }); }}>Sair</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <div className="w-full px-4 py-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <NavLink to="/">Dashboard</NavLink>
                </BreadcrumbLink>
              </BreadcrumbItem>
              {segments.length > 0 && <BreadcrumbSeparator />}
              {segments.map((seg, idx) => {
                const href = `/${segments.slice(0, idx + 1).join("/")}`;
                const label = map[seg] || seg;
                const isLast = idx === segments.length - 1;
                return (
                  <BreadcrumbItem key={href}>
                    {isLast ? (
                      <BreadcrumbPage>{label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <NavLink to={href}>{label}</NavLink>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
          <Separator className="my-4" />
          <div className="pb-10">
            <Outlet />
          </div>
        </div>
        <footer className="mt-auto w-full px-4 py-3 text-center text-xs text-muted-foreground border-t">
          Copyright 2025 - ♥ por <a href="https://www.gsite.com.br" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">Gsite</a>
        </footer>
      </div>
      <Dialog open={mobileSearchOpen} onOpenChange={setMobileSearchOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Buscar</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              onSearchSubmit(e);
              setMobileSearchOpen(false);
            }}
            className="flex gap-2"
          >
            <Input name="q" placeholder="Buscar..." autoFocus />
            <Button type="submit">Buscar</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}