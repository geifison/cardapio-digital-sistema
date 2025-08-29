import { NavigationMenu, NavigationMenuItem, NavigationMenuList } from "@/components/ui/navigation-menu";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";

export function Navbar() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `hover:underline ${isActive ? 'text-foreground font-semibold' : 'text-muted-foreground'}`;

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sheet>
            {/* Mantém apenas a composição correta: Tooltip -> TooltipTrigger -> SheetTrigger(asChild) -> Button */}
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
              <nav className="grid gap-2 mt-6">
                <NavLink to="/" className={linkClass}>Dashboard</NavLink>
                <NavLink to="/pedidos" className={linkClass}>Pedidos</NavLink>
                <NavLink to="/produtos" className={linkClass}>Produtos</NavLink>
                <NavLink to="/produtos/categorias" className={linkClass}>Categorias</NavLink>
                <NavLink to="/pizzas" className={linkClass}>Pizzas</NavLink>
                {isAdmin && <NavLink to="/config" className={linkClass}>Configurações</NavLink>}
              </nav>
            </SheetContent>
          </Sheet>
          <NavLink to="/" className={() => "font-semibold"}>Painel Administrativo PAPIBU</NavLink>
        </div>

        <NavigationMenu className="hidden md:flex">
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavLink to="/pedidos" className={linkClass}>Pedidos</NavLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavLink to="/produtos" className={linkClass}>Produtos</NavLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavLink to="/produtos/categorias" className={linkClass}>Categorias</NavLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavLink to="/pizzas" className={linkClass}>Pizzas</NavLink>
            </NavigationMenuItem>
            {isAdmin && (
              <NavigationMenuItem>
                <NavLink to="/config" className={linkClass}>Configurações</NavLink>
              </NavigationMenuItem>
            )}
          </NavigationMenuList>
        </NavigationMenu>
      </div>
    </header>
  );
}