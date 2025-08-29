// Removido: import { useState } from "react";
// Removido: import { Navbar } from "@/layout/Navbar";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminLayout } from "@/layout/AdminLayout";
import LoginPage from "@/pages/Login";
import ProductsPage from "@/pages/Products";
import ProductFormPage from "@/pages/ProductForm";
import PizzasPage from "@/pages/Pizzas";
import SettingsPage from "@/pages/Settings";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import CategoriesPage from "@/pages/Categories";
import CategoryFormPage from "@/pages/CategoryForm";
import OrdersPage from "@/pages/Orders";
import OrdersHistoryPage from "@/pages/OrdersHistory";
import type { ReactElement } from "react";

function Page({ title }: { title: string }) {
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground">Stack: React + Vite + Tailwind + shadcn/ui</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"></div>
    </div>
  );
}

function ProtectedRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-6">Carregando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <AdminLayout />;
}

function AdminOnly({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-6">Carregando...</div>;
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function App() {
  return (
    <TooltipProvider>
      <AuthProvider>
        <div className="min-h-screen bg-background text-foreground">
          <Routes>
            {/* Pública */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protegida */}
            <Route element={<ProtectedRoutes />}>
              <Route index element={<Page title="Dashboard" />} />
              <Route path="pedidos" element={<OrdersPage />} />
              <Route path="pedidos/historico" element={<OrdersHistoryPage />} />
              <Route path="produtos" element={<ProductsPage />} />
              <Route path="produtos/novo" element={<ProductFormPage mode="create" />} />
              <Route path="produtos/:id/editar" element={<ProductFormPage mode="edit" />} />
              <Route path="produtos/categorias" element={<CategoriesPage />} />
              <Route path="produtos/categorias/nova" element={<CategoryFormPage mode="create" />} />
              <Route path="produtos/categorias/:id/editar" element={<CategoryFormPage mode="edit" />} />
              <Route path="pizzas" element={<PizzasPage />} />
              <Route path="config" element={<AdminOnly><SettingsPage /></AdminOnly>} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster />
        </div>
      </AuthProvider>
    </TooltipProvider>
  );
}

export default App;
