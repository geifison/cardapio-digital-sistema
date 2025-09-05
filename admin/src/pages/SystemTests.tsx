import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEffect, useMemo, useRef, useState } from "react";
import { httpClient, httpClientAnon } from "@/lib/http";
import type { HttpError } from "@/lib/http";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

// Desabilitar socket apenas nesta página de testes do sistema
// ;(globalThis as any).__DISABLE_SOCKET__ = true;

// Tipos básicos
type TestResult = {
  id: string;
  module: string;
  name: string;
  status: "pass" | "fail" | "skip";
  latencyMs?: number;
  message?: string;
  error?: string;
  request?: any;
  response?: any;
};

// type RunnerOptions = {
//   concurrency?: number; // 1 a 3
//   stopOnFail?: boolean;
// };

// Helper global para serializar login e evitar corrida de sessão
let loginInFlight: Promise<void> | null = null;
async function safeLogin(email: string, password: string) {
  if (loginInFlight) {
    try { await loginInFlight; } catch {}
    return;
  }
  loginInFlight = (async () => {
    try {
      const ver = await httpClient.get<any>("/auth/verify");
      const isAuth = !!(ver?.data?.authenticated ?? (ver as any)?.authenticated);
      if (isAuth) return;
    } catch {}
    await httpClient.post("/auth/login", { email, password, remember: true });
  })();
  try {
    await loginInFlight;
  } finally {
    loginInFlight = null;
  }
}

// Utilitário simples para medir latência
async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; value: T }> {
  const t0 = performance.now();
  const value = await fn();
  const ms = performance.now() - t0;
  return { ms, value };
}

// Função de execução sequencial com paralelismo limitado
async function runWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  const queue = items.slice();
  const running: Promise<void>[] = [];

  async function next() {
    const item = queue.shift();
    if (item === undefined) return;
    const p = worker(item).then((res) => { results.push(res); }).catch(() => { /* o worker retorna falha como resultado */ }).finally(next);
    running.push(p.then(() => undefined));
  }

  const n = Math.max(1, Math.min(limit || 1, 3));
  for (let i = 0; i < n; i++) await next();
  await Promise.all(running);
  return results;
}

// Testes mínimos prioritários (Autenticação, Produtos, Pedidos, Upload)
function buildCriticalTests(): { id: string; module: string; name: string; exec: () => Promise<TestResult> }[] {
  const tests: { id: string; module: string; name: string; exec: () => Promise<TestResult> }[] = [];

  // Auth: verify sem login deve falhar (401)
  tests.push({
    id: "auth.verify.unauth",
    module: "Auth",
    name: "Verify sem sessão deve retornar 401",
    exec: async () => {
      try {
        // Evita interferir na sessão global: não chamar logout aqui
        const { ms } = await timed(async () => {
          await httpClientAnon.get("/auth/verify");
        });
        return { id: "auth.verify.unauth", module: "Auth", name: "Verify sem sessão deve retornar 401", status: "fail", latencyMs: ms, message: "Esperado 401, mas requisição foi OK" };
      } catch (e: any) {
        const status = (e as HttpError)?.status;
        if (status === 401) return { id: "auth.verify.unauth", module: "Auth", name: "Verify sem sessão deve retornar 401", status: "pass" };
        return { id: "auth.verify.unauth", module: "Auth", name: "Verify sem sessão deve retornar 401", status: "fail", error: e?.message || String(e) };
      }
    }
  });

  // Auth: login com admin (necessário preencher credenciais manualmente na UI)
  // No modo automático, tentaremos usar variáveis de ambiente VITE_TEST_EMAIL/VITE_TEST_PASSWORD
  tests.push({
    id: "auth.login",
    module: "Auth",
    name: "Login como admin (usa .env VITE_TEST_EMAIL/VITE_TEST_PASSWORD)",
    exec: async () => {
      const email = (import.meta as any).env?.VITE_TEST_EMAIL as string | undefined;
      const password = (import.meta as any).env?.VITE_TEST_PASSWORD as string | undefined;
      if (!email || !password) {
        // Se já estiver autenticado, conta como PASS mesmo sem .env
        try {
          const { ms, value } = await timed(async () => httpClient.get<any>("/auth/verify"));
          const isAuth = !!(value?.data?.authenticated ?? (value as any)?.authenticated);
          if (isAuth) return { id: "auth.login", module: "Auth", name: "Login como admin", status: "pass", latencyMs: ms };
        } catch {}
        return { id: "auth.login", module: "Auth", name: "Login como admin", status: "skip", message: "Defina VITE_TEST_EMAIL/VITE_TEST_PASSWORD para rodar automático" };
      }
      try {
        // Evita perturbar a sessão se já estiver autenticado
        const { ms: msVerify, value: ver } = await timed(async () => httpClient.get<any>("/auth/verify"));
        const isAuth = !!(ver?.data?.authenticated ?? (ver as any)?.authenticated);
        if (isAuth) return { id: "auth.login", module: "Auth", name: "Login como admin", status: "pass", latencyMs: msVerify };

        // Padroniza login usando ensureAuthenticated (serializado via safeLogin)
        const { ms } = await timed(async () => ensureAuthenticated());
        return { id: "auth.login", module: "Auth", name: "Login como admin", status: "pass", latencyMs: ms };
      } catch (e: any) {
        return { id: "auth.login", module: "Auth", name: "Login como admin", status: "fail", error: e?.message || String(e) };
      }
    }
  });

  // Produtos: GET lista
  tests.push({
    id: "products.list",
    module: "Produtos",
    name: "Listar produtos",
    exec: async () => {
      try {
        const { ms, value } = await timed(async () => httpClient.get("/products"));
        const ok = value && Array.isArray((value as any).data);
        return ok ? { id: "products.list", module: "Produtos", name: "Listar produtos", status: "pass", latencyMs: ms } : { id: "products.list", module: "Produtos", name: "Listar produtos", status: "fail", latencyMs: ms, response: value };
      } catch (e: any) {
        return { id: "products.list", module: "Produtos", name: "Listar produtos", status: "fail", error: e?.message || String(e) };
      }
    }
  });

  // Pedidos: GET lista do dia (não falhar)
  tests.push({
    id: "orders.list",
    module: "Pedidos",
    name: "Listar pedidos (dia)",
    exec: async () => {
      const today = new Date().toISOString().slice(0,10);
      try {
        const { ms, value } = await timed(async () => httpClient.get(`/orders?date=${today}`));
        const ok = value && Array.isArray((value as any).data);
        return ok ? { id: "orders.list", module: "Pedidos", name: "Listar pedidos (dia)", status: "pass", latencyMs: ms } : { id: "orders.list", module: "Pedidos", name: "Listar pedidos (dia)", status: "fail", latencyMs: ms, response: value };
      } catch (e: any) {
        return { id: "orders.list", module: "Pedidos", name: "Listar pedidos (dia)", status: "fail", error: e?.message || String(e) };
      }
    }
  });

  // Upload: sanity do endpoint (sem enviar arquivo, deve falhar com erro legível)
  tests.push({
    id: "upload.sanity",
    module: "Upload",
    name: "POST /upload.php sem arquivo deve retornar erro",
    exec: async () => {
      try {
        await timed(async () => {
          const fd = new FormData();
          await httpClient.postFormData("/upload.php", fd);
        });
        return { id: "upload.sanity", module: "Upload", name: "POST /upload.php sem arquivo deve retornar erro", status: "fail", message: "Esperado erro, mas requisição foi OK" };
      } catch (e: any) {
        const status = (e as HttpError)?.status;
        if (status && status >= 400) return { id: "upload.sanity", module: "Upload", name: "POST /upload.php sem arquivo deve retornar erro", status: "pass" };
        return { id: "upload.sanity", module: "Upload", name: "POST /upload.php sem arquivo deve retornar erro", status: "fail", error: e?.message || String(e) };
      }
    }
  });

  // Usuários: CRUD básico em um único fluxo atômico (isola dados de teste e evita dependência de ordem)
  tests.push({
    id: "users.crud.basic",
    module: "Usuários",
    name: "CRUD básico (create, list, update, delete)",
    exec: async () => {
      // Verifica/garante autenticação de admin
      try {
        await ensureAuthenticated();
      } catch (e: any) {
        if (e?.message === SKIP_NO_CREDENTIALS) {
          return { id: "users.crud.basic", module: "Usuários", name: "CRUD básico (create, list, update, delete)", status: "skip", message: "Necessário estar autenticado ou definir VITE_TEST_EMAIL/VITE_TEST_PASSWORD" };
        }
        return { id: "users.crud.basic", module: "Usuários", name: "CRUD básico (create, list, update, delete)", status: "fail", error: e?.message || String(e) };
      }

      const uniq = Date.now();
      const newUser = {
        name: `Test User ${uniq}`,
        email: `test.user+${uniq}@example.com`,
        password: "test123456",
        role: "operator",
      };

      try {
        // CREATE
        const created = await httpClient.post<any>("/users/create", newUser);
        if (!(created && created.success === true && created.data && created.data.id)) {
          return { id: "users.crud.basic", module: "Usuários", name: "CRUD básico (create, list, update, delete)", status: "fail", message: "Falha ao criar usuário", response: created };
        }
        const userId = created.data.id as number;

        // LIST (deve conter o usuário criado)
        const list = await httpClient.get<any>("/users");
        if (!(list && list.success === true && Array.isArray(list.data))) {
          return { id: "users.crud.basic", module: "Usuários", name: "CRUD básico (create, list, update, delete)", status: "fail", message: "Falha ao listar usuários", response: list };
        }
        const found = list.data.find((u: any) => u.email === newUser.email);
        if (!found) {
          return { id: "users.crud.basic", module: "Usuários", name: "CRUD básico (create, list, update, delete)", status: "fail", message: "Usuário recém-criado não encontrado na listagem" };
        }

        // UPDATE
        const updated = await httpClient.post<any>("/users/update", {
          id: userId,
          name: `${newUser.name} Updated`,
          email: newUser.email,
          role: "manager",
          password: "test654321",
        });
        if (!(updated && updated.success === true)) {
          return { id: "users.crud.basic", module: "Usuários", name: "CRUD básico (create, list, update, delete)", status: "fail", message: "Falha ao atualizar usuário", response: updated };
        }

        // DELETE
        const deleted = await httpClient.post<any>("/users/delete", { id: userId });
        if (!(deleted && deleted.success === true)) {
          return { id: "users.crud.basic", module: "Usuários", name: "CRUD básico (create, list, update, delete)", status: "fail", message: "Falha ao excluir usuário", response: deleted };
        }

        // Sanidade: tentar excluir novamente deve retornar 404
        try {
          await httpClient.post<any>("/users/delete", { id: userId });
          return { id: "users.crud.basic", module: "Usuários", name: "CRUD básico (create, list, update, delete)", status: "fail", message: "Excluir novamente deveria falhar com 404" };
        } catch (e: any) {
          const st = (e as HttpError)?.status;
          if (st !== 404) {
            return { id: "users.crud.basic", module: "Usuários", name: "CRUD básico (create, list, update, delete)", status: "fail", message: `Esperado 404 ao excluir novamente, recebemos ${st}` };
          }
        }

        return { id: "users.crud.basic", module: "Usuários", name: "CRUD básico (create, list, update, delete)", status: "pass" };
      } catch (e: any) {
        return { id: "users.crud.basic", module: "Usuários", name: "CRUD básico (create, list, update, delete)", status: "fail", error: e?.message || String(e) };
      }
    }
  });

  // Usuários: criação com email inválido deve retornar 400
  tests.push({
    id: "users.create.invalidEmail",
    module: "Usuários",
    name: "Create com email inválido retorna 400/401",
    exec: async () => {
      // Garante autenticação
      try {
        await ensureAuthenticated();
      } catch (e: any) {
        if (e?.message === SKIP_NO_CREDENTIALS) {
          return { id: "users.create.invalidEmail", module: "Usuários", name: "Create com email inválido retorna 400/401", status: "skip", message: "Não autenticado. Defina VITE_TEST_EMAIL/VITE_TEST_PASSWORD" };
        }
        return { id: "users.create.invalidEmail", module: "Usuários", name: "Create com email inválido retorna 400/401", status: "fail", error: e?.message || String(e) };
      }

      try {
        await httpClient.post("/users/create", { name: "X", email: "invalid", password: "abcdef", role: "operator" });
        return { id: "users.create.invalidEmail", module: "Usuários", name: "Create com email inválido retorna 400/401", status: "fail", message: "Esperado 400/401, mas requisição foi OK" };
      } catch (e: any) {
        const st = (e as HttpError)?.status;
        if (st === 400 || st === 401) return { id: "users.create.invalidEmail", module: "Usuários", name: "Create com email inválido retorna 400/401", status: "pass" };
        return { id: "users.create.invalidEmail", module: "Usuários", name: "Create com email inválido retorna 400/401", status: "fail", error: e?.message || String(e) };
      }
    }
  });

  // Usuários: impedir exclusão do próprio usuário logado (espera 400)
  tests.push({
    id: "users.delete.self",
    module: "Usuários",
    name: "Excluir o próprio usuário deve falhar (400)",
    exec: async () => {
      // Garante autenticação
      try {
        await ensureAuthenticated();
      } catch (e: any) {
        if (e?.message === SKIP_NO_CREDENTIALS) {
          return { id: "users.delete.self", module: "Usuários", name: "Excluir o próprio usuário deve falhar (400)", status: "skip", message: "Não autenticado. Defina VITE_TEST_EMAIL/VITE_TEST_PASSWORD" };
        }
        return { id: "users.delete.self", module: "Usuários", name: "Excluir o próprio usuário deve falhar (400)", status: "fail", error: e?.message || String(e) };
      }

      try {
        const verify = await httpClient.get<any>("/auth/verify");
        const selfId = verify?.data?.user?.id;
        if (!selfId) return { id: "users.delete.self", module: "Usuários", name: "Excluir o próprio usuário deve falhar (400)", status: "skip", message: "Não foi possível obter o ID do usuário logado" };
        await httpClient.post<any>("/users/delete", { id: selfId });
        return { id: "users.delete.self", module: "Usuários", name: "Excluir o próprio usuário deve falhar (400)", status: "fail", message: "Esperado 400, mas requisição foi OK" };
      } catch (e: any) {
        const st = (e as HttpError)?.status;
        if (st === 400) return { id: "users.delete.self", module: "Usuários", name: "Excluir o próprio usuário deve falhar (400)", status: "pass" };
        return { id: "users.delete.self", module: "Usuários", name: "Excluir o próprio usuário deve falhar (400)", status: "fail", error: e?.message || String(e) };
      }
    }
  });

  // Usuários: impedir exclusão de usuário admin (espera 400) com cleanup
  tests.push({
    id: "users.delete.admin",
    module: "Usuários",
    name: "Excluir usuário admin deve falhar (400)",
    exec: async () => {
      // Garante autenticação
      try {
        await ensureAuthenticated();
      } catch (e: any) {
        if (e?.message === SKIP_NO_CREDENTIALS) {
          return { id: "users.delete.admin", module: "Usuários", name: "Excluir usuário admin deve falhar (400)", status: "skip", message: "Não autenticado. Defina VITE_TEST_EMAIL/VITE_TEST_PASSWORD" };
        }
        return { id: "users.delete.admin", module: "Usuários", name: "Excluir usuário admin deve falhar (400)", status: "fail", error: e?.message || String(e) };
      }

      const uniq = Date.now();
      const baseUser = { name: `Temp Admin Candidate ${uniq}`, email: `temp.admin.candidate+${uniq}@example.com`, password: "test123456", role: "operator" as const };
      let userId: number | null = null;
      try {
        // cria usuário base
        const created = await httpClient.post<any>("/users/create", baseUser);
        if (!(created && created.success && created.data?.id)) {
          return { id: "users.delete.admin", module: "Usuários", name: "Excluir usuário admin deve falhar (400)", status: "fail", message: "Falha ao criar usuário base", response: created };
        }
        userId = created.data.id;
        // promove a admin
        const promote = await httpClient.post<any>("/users/update", { id: userId, name: baseUser.name, email: baseUser.email, role: "admin" });
        if (!(promote && promote.success === true)) {
          return { id: "users.delete.admin", module: "Usuários", name: "Excluir usuário admin deve falhar (400)", status: "fail", message: "Falha ao promover usuário para admin", response: promote };
        }
        // tentativa de exclusão deve falhar com 400
        try {
          await httpClient.post<any>("/users/delete", { id: userId });
          return { id: "users.delete.admin", module: "Usuários", name: "Excluir usuário admin deve falhar (400)", status: "fail", message: "Esperado 400 ao excluir admin, mas requisição foi OK" };
        } catch (e: any) {
          const st = (e as HttpError)?.status;
          if (st !== 400) {
            return { id: "users.delete.admin", module: "Usuários", name: "Excluir usuário admin deve falhar (400)", status: "fail", message: `Esperado 400, recebemos ${st}` };
          }
        }
        // cleanup: rebaixa para operator e exclui
        try { await httpClient.post<any>("/users/update", { id: userId, name: baseUser.name, email: baseUser.email, role: "operator" }); } catch {}
        try { await httpClient.post<any>("/users/delete", { id: userId }); } catch {}
        return { id: "users.delete.admin", module: "Usuários", name: "Excluir usuário admin deve falhar (400)", status: "pass" };
      } catch (e: any) {
        // tentativa de cleanup em caso de erro intermediário
        if (userId) {
          try { await httpClient.post<any>("/users/update", { id: userId, name: baseUser.name, email: baseUser.email, role: "operator" }); } catch {}
          try { await httpClient.post<any>("/users/delete", { id: userId }); } catch {}
        }
        return { id: "users.delete.admin", module: "Usuários", name: "Excluir usuário admin deve falhar (400)", status: "fail", error: e?.message || String(e) };
      }
    }
  });

  // Usuários: duplicidade de email em create e update deve falhar (400)
  tests.push({
    id: "users.email.duplicate",
    module: "Usuários",
    name: "Duplicidade de email (create e update) retorna 400/401",
    exec: async () => {
      // Garante autenticação
      try {
        await ensureAuthenticated();
      } catch (e: any) {
        if (e?.message === SKIP_NO_CREDENTIALS) {
          return { id: "users.email.duplicate", module: "Usuários", name: "Duplicidade de email (create e update) retorna 400/401", status: "skip", message: "Não autenticado. Defina VITE_TEST_EMAIL/VITE_TEST_PASSWORD" };
        }
        return { id: "users.email.duplicate", module: "Usuários", name: "Duplicidade de email (create e update) retorna 400/401", status: "fail", error: e?.message || String(e) };
      }

      // Helper: em caso de 401, reautentica e tenta novamente uma vez
      const postWithReauth = async <T = any>(path: string, payload: any): Promise<T> => {
        try {
          // @ts-ignore
          return await httpClient.post<T>(path, payload);
        } catch (e: any) {
          const st = (e as HttpError)?.status;
          const emailEnv = (import.meta as any).env?.VITE_TEST_EMAIL as string | undefined;
          const passEnv = (import.meta as any).env?.VITE_TEST_PASSWORD as string | undefined;
          if (st === 401 && emailEnv && passEnv) {
            try {
              await safeLogin(emailEnv, passEnv);
              // @ts-ignore
              return await httpClient.post<T>(path, payload);
            } catch (_) { /* continua para lançar original */ }
          }
          throw e;
        }
      };

      let adminEmail: string | null = null;
      try {
        const verify = await httpClient.get<any>("/auth/verify");
        adminEmail = verify?.data?.user?.email || null;
      } catch { /* ignore */ }

      const uniq = Date.now();
      const userPayload = { name: `Dup Test ${uniq}`, email: `dup.test+${uniq}@example.com`, password: "test123456", role: "operator" as const };
      let userId: number | null = null;
      try {
        // create base user
        const created = await postWithReauth<any>("/users/create", userPayload);
        if (!(created && created.success && created.data?.id)) {
          return { id: "users.email.duplicate", module: "Usuários", name: "Duplicidade de email (create e update) retorna 400/401", status: "fail", message: "Falha ao criar usuário base", response: created };
        }
        userId = created.data.id;

        // create duplicado com email já usado (admin ou o próprio, se adminEmail não disponível)
        const dupEmail = adminEmail || userPayload.email;
        try {
          await postWithReauth<any>("/users/create", { name: `Dup Create ${uniq}`, email: dupEmail, password: "abcdefg", role: "operator" });
          return { id: "users.email.duplicate", module: "Usuários", name: "Duplicidade de email (create e update) retorna 400/401", status: "fail", message: "Esperado 400/401 em create duplicado, mas foi OK" };
        } catch (e: any) {
          const st = (e as HttpError)?.status;
          if (st !== 400 && st !== 401) {
            return { id: "users.email.duplicate", module: "Usuários", name: "Duplicidade de email (create e update) retorna 400/401", status: "fail", message: `Esperado 400/401 em create duplicado, recebemos ${st}` };
          }
        }

        // update para email duplicado (usa email do admin se disponível, senão cria outro usuário para duplicar)
        let targetDupEmail = adminEmail;
        let auxUserId: number | null = null;
        if (!targetDupEmail) {
          const aux = await postWithReauth<any>("/users/create", { name: `Aux ${uniq}`, email: `aux+${uniq}@example.com`, password: "test123456", role: "operator" });
          if (!(aux && aux.success && aux.data?.id)) {
            return { id: "users.email.duplicate", module: "Usuários", name: "Duplicidade de email (create e update) retorna 400/401", status: "fail", message: "Falha ao criar usuário auxiliar", response: aux };
          }
          auxUserId = aux.data.id;
          targetDupEmail = `aux+${uniq}@example.com`;
        }
        try {
          await postWithReauth<any>("/users/update", { id: userId, name: userPayload.name, email: targetDupEmail, role: userPayload.role });
          return { id: "users.email.duplicate", module: "Usuários", name: "Duplicidade de email (create e update) retorna 400/401", status: "fail", message: "Esperado 400/401 em update duplicado, mas foi OK" };
        } catch (e: any) {
          const st = (e as HttpError)?.status;
          if (st !== 400 && st !== 401) {
            return { id: "users.email.duplicate", module: "Usuários", name: "Duplicidade de email (create e update) retorna 400/401", status: "fail", message: `Esperado 400/401 em update duplicado, recebemos ${st}` };
          }
        }

        // cleanup
        try { if (auxUserId) await httpClient.post<any>("/users/delete", { id: auxUserId }); } catch {}
        try { if (userId) await httpClient.post<any>("/users/delete", { id: userId }); } catch {}
        return { id: "users.email.duplicate", module: "Usuários", name: "Duplicidade de email (create e update) retorna 400/401", status: "pass" };
      } catch (e: any) {
        // cleanup em falhas
        try { if (userId) await httpClient.post<any>("/users/delete", { id: userId }); } catch {}
        return { id: "users.email.duplicate", module: "Usuários", name: "Duplicidade de email (create e update) retorna 400/401", status: "fail", error: e?.message || String(e) };
      }
    }
  });

  // Usuários: role inválida no create deve falhar (400)
  tests.push({
    id: "users.create.invalidRole",
    module: "Usuários",
    name: "Create com role inválido retorna 400",
    exec: async () => {
      // Garante autenticação
      try {
        await ensureAuthenticated();
      } catch (e: any) {
        if (e?.message === SKIP_NO_CREDENTIALS) {
          return { id: "users.create.invalidRole", module: "Usuários", name: "Create com role inválido retorna 400", status: "skip", message: "Não autenticado. Defina VITE_TEST_EMAIL/VITE_TEST_PASSWORD" };
        }
        return { id: "users.create.invalidRole", module: "Usuários", name: "Create com role inválido retorna 400", status: "fail", error: e?.message || String(e) };
      }

      try {
        await httpClient.post<any>("/users/create", { name: "Invalid Role", email: `invalid.role+${Date.now()}@example.com`, password: "abcdef", role: "invalid" });
        return { id: "users.create.invalidRole", module: "Usuários", name: "Create com role inválido retorna 400", status: "fail", message: "Esperado 400, mas requisição foi OK" };
      } catch (e: any) {
        const st = (e as HttpError)?.status;
        if (st === 400) return { id: "users.create.invalidRole", module: "Usuários", name: "Create com role inválido retorna 400", status: "pass" };
        return { id: "users.create.invalidRole", module: "Usuários", name: "Create com role inválido retorna 400", status: "fail", error: e?.message || String(e) };
      }
    }
  });

  // Categorias: GET lista (inclui ?all=true para cobrir ambos os casos)
  tests.push({
    id: "categories.list",
    module: "Categorias",
    name: "Listar categorias",
    exec: async () => {
      try {
        const { ms, value } = await timed(async () => httpClient.get<any>("/categories?all=true"));
        const ok = value && value.success === true && Array.isArray(value.data);
        return ok
          ? { id: "categories.list", module: "Categorias", name: "Listar categorias", status: "pass", latencyMs: ms }
          : { id: "categories.list", module: "Categorias", name: "Listar categorias", status: "fail", latencyMs: ms, response: value };
      } catch (e: any) {
        return { id: "categories.list", module: "Categorias", name: "Listar categorias", status: "fail", error: e?.message || String(e) };
      }
    }
  });

  // Categorias: CRUD básico com cleanup
  tests.push({
    id: "categories.crud.basic",
    module: "Categorias",
    name: "CRUD básico (create, list, update, delete)",
    exec: async () => {
      // Garante autenticação
      try {
        await ensureAuthenticated();
      } catch (e: any) {
        if (e?.message === SKIP_NO_CREDENTIALS) {
          return { id: "categories.crud.basic", module: "Categorias", name: "CRUD básico (create, list, update, delete)", status: "skip", message: "Não autenticado. Defina VITE_TEST_EMAIL/VITE_TEST_PASSWORD" };
        }
        return { id: "categories.crud.basic", module: "Categorias", name: "CRUD básico (create, list, update, delete)", status: "fail", error: e?.message || String(e) };
      }

      const uniq = Date.now();
      const base = { name: `Cat Test ${uniq}`, description: "Desc inicial", image_url: null as string | null, display_order: 0, active: 1 };
      let catId: number | null = null;

      try {
        // CREATE
        const created = await httpClient.post<any>("/categories", base);
        if (!(created && created.success === true && created.data?.id)) {
          return { id: "categories.crud.basic", module: "Categorias", name: "CRUD básico (create, list, update, delete)", status: "fail", message: "Falha ao criar categoria", response: created };
        }
        catId = created.data.id as number;

        // LIST by id
        const got = await httpClient.get<any>(`/categories/${catId}`);
        if (!(got && got.success === true && got.data?.id === catId)) {
          return { id: "categories.crud.basic", module: "Categorias", name: "CRUD básico (create, list, update, delete)", status: "fail", message: "Categoria recém-criada não retornou corretamente em GET" };
        }

        // UPDATE
        const updPayload = { name: `${base.name} Updated`, description: "Desc atualizada", image_url: null, display_order: 5, active: 1 };
        const updated = await httpClient.put<any>(`/categories/${catId}`, updPayload);
        if (!(updated && updated.success === true && updated.data?.name === updPayload.name && updated.data?.display_order === updPayload.display_order)) {
          return { id: "categories.crud.basic", module: "Categorias", name: "CRUD básico (create, list, update, delete)", status: "fail", message: "Falha ao atualizar categoria", response: updated };
        }

        // DELETE
        const del = await httpClient.delete<any>(`/categories/${catId}`);
        if (!(del && del.success === true)) {
          return { id: "categories.crud.basic", module: "Categorias", name: "CRUD básico (create, list, update, delete)", status: "fail", message: "Falha ao excluir categoria", response: del };
        }

        // Sanidade: GET após delete deve 404
        try {
          await httpClient.get<any>(`/categories/${catId}`);
          return { id: "categories.crud.basic", module: "Categorias", name: "CRUD básico (create, list, update, delete)", status: "fail", message: "Esperado 404 após excluir categoria, mas GET foi OK" };
        } catch (e: any) {
          const st = (e as HttpError)?.status;
          if (st !== 404) {
            return { id: "categories.crud.basic", module: "Categorias", name: "CRUD básico (create, list, update, delete)", status: "fail", message: `Esperado 404 após excluir, recebemos ${st}` };
          }
        }

        return { id: "categories.crud.basic", module: "Categorias", name: "CRUD básico (create, list, update, delete)", status: "pass" };
      } catch (e: any) {
        // cleanup best-effort
        try { if (catId) await httpClient.delete<any>(`/categories/${catId}`); } catch {}
        return { id: "categories.crud.basic", module: "Categorias", name: "CRUD básico (create, list, update, delete)", status: "fail", error: e?.message || String(e) };
      }
    }
  });

  // Categorias: validação de nome obrigatório (create deve retornar 400)
  tests.push({
    id: "categories.create.nameRequired",
    module: "Categorias",
    name: "Create sem nome deve retornar 400",
    exec: async () => {
      // Autenticação exigida para criar
      try {
        await ensureAuthenticated();
      } catch (e: any) {
        if (e?.message === SKIP_NO_CREDENTIALS) {
          return { id: "categories.create.nameRequired", module: "Categorias", name: "Create sem nome deve retornar 400", status: "skip", message: "Não autenticado. Defina VITE_TEST_EMAIL/VITE_TEST_PASSWORD" };
        }
        return { id: "categories.create.nameRequired", module: "Categorias", name: "Create sem nome deve retornar 400", status: "fail", error: e?.message || String(e) };
      }

      try {
        await httpClient.post<any>("/categories", { description: "sem nome" });
        return { id: "categories.create.nameRequired", module: "Categorias", name: "Create sem nome deve retornar 400", status: "fail", message: "Esperado 400, mas requisição foi OK" };
      } catch (e: any) {
        const st = (e as HttpError)?.status;
        if (st === 400) return { id: "categories.create.nameRequired", module: "Categorias", name: "Create sem nome deve retornar 400", status: "pass" };
        return { id: "categories.create.nameRequired", module: "Categorias", name: "Create sem nome deve retornar 400", status: "fail", error: e?.message || String(e) };
      }
    }
  });

  // Categorias: UPDATE com nome vazio deve 400
  tests.push({
    id: "categories.update.nameRequired",
    module: "Categorias",
    name: "Update com nome vazio deve retornar 400",
    exec: async () => {
      try {
        await ensureAuthenticated();
      } catch (e: any) {
        if (e?.message === SKIP_NO_CREDENTIALS) {
          return { id: "categories.update.nameRequired", module: "Categorias", name: "Update com nome vazio deve retornar 400", status: "skip", message: "Não autenticado. Defina VITE_TEST_EMAIL/VITE_TEST_PASSWORD" };
        }
        return { id: "categories.update.nameRequired", module: "Categorias", name: "Update com nome vazio deve retornar 400", status: "fail", error: e?.message || String(e) };
      }

      const uniq = Date.now();
      const base = { name: `Cat Upd ${uniq}`, active: 1 } as any;
      let catId: number | null = null;
      try {
        const created = await httpClient.post<any>("/categories", base);
        catId = created?.data?.id || null;
        if (!catId) return { id: "categories.update.nameRequired", module: "Categorias", name: "Update com nome vazio deve retornar 400", status: "fail", message: "Falha ao criar categoria base" };
        try {
          await httpClient.put<any>(`/categories/${catId}`, { name: "", active: 1 });
          return { id: "categories.update.nameRequired", module: "Categorias", name: "Update com nome vazio deve retornar 400", status: "fail", message: "Esperado 400 no update com nome vazio" };
        } catch (e: any) {
          const st = (e as HttpError)?.status;
          if (st === 400) return { id: "categories.update.nameRequired", module: "Categorias", name: "Update com nome vazio deve retornar 400", status: "pass" };
          return { id: "categories.update.nameRequired", module: "Categorias", name: "Update com nome vazio deve retornar 400", status: "fail", error: e?.message || String(e) };
        }
      } catch (e: any) {
        return { id: "categories.update.nameRequired", module: "Categorias", name: "Update com nome vazio deve retornar 400", status: "fail", error: e?.message || String(e) };
      } finally {
        try { if (catId) await httpClient.delete<any>(`/categories/${catId}`); } catch {}
      }
    }
  });

  // Categorias: delete deve falhar (400) quando houver produtos associados
  tests.push({
    id: "categories.delete.withProducts",
    module: "Categorias",
    name: "Delete deve falhar com produtos associados (400)",
    exec: async () => {
      try {
        await ensureAuthenticated();
      } catch (e: any) {
        if (e?.message === SKIP_NO_CREDENTIALS) {
          return { id: "categories.delete.withProducts", module: "Categorias", name: "Delete deve falhar com produtos associados (400)", status: "skip", message: "Não autenticado. Defina VITE_TEST_EMAIL/VITE_TEST_PASSWORD" };
        }
        return { id: "categories.delete.withProducts", module: "Categorias", name: "Delete deve falhar com produtos associados (400)", status: "fail", error: e?.message || String(e) };
      }

      const uniq = Date.now();
      const catPayload = { name: `Cat Lock ${uniq}`, active: 1 } as any;
      let catId: number | null = null;
      let prodId: number | null = null;
      try {
        const c = await httpClient.post<any>("/categories", catPayload);
        catId = c?.data?.id || null;
        if (!catId) return { id: "categories.delete.withProducts", module: "Categorias", name: "Delete deve falhar com produtos associados (400)", status: "fail", message: "Falha ao criar categoria base" };

        const productPayload = {
          category_id: catId,
          name: `Prod vinc ${uniq}`,
          description: "",
          price: 10.5,
          active: 1,
          display_order: 0,
        } as any;
        const p = await httpClient.post<any>("/products", productPayload);
        prodId = p?.data?.id || null;
        if (!prodId) return { id: "categories.delete.withProducts", module: "Categorias", name: "Delete deve falhar com produtos associados (400)", status: "fail", message: "Falha ao criar produto vinculado" };

        try {
          await httpClient.delete<any>(`/categories/${catId}`);
          return { id: "categories.delete.withProducts", module: "Categorias", name: "Delete deve falhar com produtos associados (400)", status: "fail", message: "Esperado 400 ao deletar categoria com produtos" };
        } catch (e: any) {
          const st = (e as HttpError)?.status;
          if (st === 400) return { id: "categories.delete.withProducts", module: "Categorias", name: "Delete deve falhar com produtos associados (400)", status: "pass" };
          return { id: "categories.delete.withProducts", module: "Categorias", name: "Delete deve falhar com produtos associados (400)", status: "fail", error: e?.message || String(e) };
        }
      } catch (e: any) {
        return { id: "categories.delete.withProducts", module: "Categorias", name: "Delete deve falhar com produtos associados (400)", status: "fail", error: e?.message || String(e) };
      } finally {
        try { if (prodId) await httpClient.delete<any>(`/products/${prodId}`); } catch {}
        try { if (catId) await httpClient.delete<any>(`/categories/${catId}`); } catch {}
      }
    }
  });

  // Categorias: reorder com payload inválido deve 400
  tests.push({
    id: "categories.reorder.invalidPayload",
    module: "Categorias",
    name: "Reorder com payload inválido deve retornar 400",
    exec: async () => {
      try {
        await ensureAuthenticated();
      } catch (e: any) {
        if (e?.message === SKIP_NO_CREDENTIALS) {
          return { id: "categories.reorder.invalidPayload", module: "Categorias", name: "Reorder com payload inválido deve retornar 400", status: "skip", message: "Não autenticado. Defina VITE_TEST_EMAIL/VITE_TEST_PASSWORD" };
        }
        return { id: "categories.reorder.invalidPayload", module: "Categorias", name: "Reorder com payload inválido deve retornar 400", status: "fail", error: e?.message || String(e) };
      }

      try {
        await httpClient.post<any>("/categories/reorder", { ordens: [{ id: 1, display_order: 2 }] } as any);
        return { id: "categories.reorder.invalidPayload", module: "Categorias", name: "Reorder com payload inválido deve retornar 400", status: "fail", message: "Esperado 400 com campo incorreto" };
      } catch (e: any) {
        const st = (e as HttpError)?.status;
        if (st === 400) return { id: "categories.reorder.invalidPayload", module: "Categorias", name: "Reorder com payload inválido deve retornar 400", status: "pass" };
        return { id: "categories.reorder.invalidPayload", module: "Categorias", name: "Reorder com payload inválido deve retornar 400", status: "fail", error: e?.message || String(e) };
      }
    }
  });

  // Categorias: reorder em lote com cleanup
  tests.push({
    id: "categories.reorder.batch",
    module: "Categorias",
    name: "Reordenar categorias em lote",
    exec: async () => {
      // Autenticação exigida
      try {
        await ensureAuthenticated();
      } catch (e: any) {
        if (e?.message === SKIP_NO_CREDENTIALS) {
          return { id: "categories.reorder.batch", module: "Categorias", name: "Reordenar categorias em lote", status: "skip", message: "Não autenticado. Defina VITE_TEST_EMAIL/VITE_TEST_PASSWORD" };
        }
        return { id: "categories.reorder.batch", module: "Categorias", name: "Reordenar categorias em lote", status: "fail", error: e?.message || String(e) };
      }

      const uniq = Date.now();
      const payloads = [0,1,2].map(i => ({ name: `Cat Reorder ${uniq}-${i}`, description: "", image_url: null as string | null, display_order: 0, active: 1 }));
      const ids: number[] = [];

      try {
        // cria 3 categorias
        for (const p of payloads) {
          const res = await httpClient.post<any>("/categories", p);
          if (!(res && res.success === true && res.data?.id)) {
            return { id: "categories.reorder.batch", module: "Categorias", name: "Reordenar categorias em lote", status: "fail", message: "Falha ao criar categoria auxiliar", response: res };
          }
          ids.push(res.data.id);
        }

        // envia reorder
        const orders = ids.map((id, idx) => ({ id, display_order: 100 + (ids.length - idx) })); // ordem decrescente
        const reo = await httpClient.post<any>("/categories/reorder", { orders });
        if (!(reo && reo.success === true)) {
          return { id: "categories.reorder.batch", module: "Categorias", name: "Reordenar categorias em lote", status: "fail", message: "Falha ao reordenar categorias", response: reo };
        }

        // valida consultando as categorias individualmente
        for (let i = 0; i < ids.length; i++) {
          const id = ids[i];
          const expected = orders.find(o => o.id === id)?.display_order;
          const got = await httpClient.get<any>(`/categories/${id}`);
          if (!(got && got.success === true && got.data?.display_order === expected)) {
            return { id: "categories.reorder.batch", module: "Categorias", name: "Reordenar categorias em lote", status: "fail", message: `display_order inesperado para ID ${id}` , response: got };
          }
        }

        // cleanup
        for (const id of ids) {
          try { await httpClient.delete<any>(`/categories/${id}`); } catch {}
        }
        return { id: "categories.reorder.batch", module: "Categorias", name: "Reordenar categorias em lote", status: "pass" };
      } catch (e: any) {
        // cleanup best-effort
        for (const id of ids) { try { await httpClient.delete<any>(`/categories/${id}`); } catch {} }
        return { id: "categories.reorder.batch", module: "Categorias", name: "Reordenar categorias em lote", status: "fail", error: e?.message || String(e) };
      }
    }
  });

  return tests;
}

function Summary({ results }: { results: TestResult[] }) {
  const counts = useMemo(() => {
    const total = results.length;
    const pass = results.filter(r => r.status === "pass").length;
    const fail = results.filter(r => r.status === "fail").length;
    const skip = results.filter(r => r.status === "skip").length;
    const p50 = percentile(results.map(r => r.latencyMs || 0), 50);
    const p95 = percentile(results.map(r => r.latencyMs || 0), 95);
    return { total, pass, fail, skip, p50, p95 };
  }, [results]);

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Resumo</CardTitle>
        <CardDescription>
          Total: {counts.total} • Pass: {counts.pass} • Fail: {counts.fail} • Skip: {counts.skip} • p50: {Math.round(counts.p50)} ms • p95: {Math.round(counts.p95)} ms
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

function percentile(values: number[], p: number): number {
  const v = values.filter(n => typeof n === 'number' && isFinite(n)).sort((a,b)=>a-b);
  if (!v.length) return 0;
  const idx = Math.ceil((p/100) * v.length) - 1;
  return v[Math.max(0, Math.min(idx, v.length-1))];
}

export default function SystemTests() {
  const isDevLocal = (import.meta as any).env?.DEV === true;
  if (!isDevLocal) {
    console.warn("/tests oculto fora de DEV");
  }
  const [activeTab, setActiveTab] = useState("critical");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [concurrency, setConcurrency] = useState(1);
  const [stopOnFail, setStopOnFail] = useState(false);
  const cancelRef = useRef<{ cancel: () => void } | null>(null);
  // Modal de Export JSON
  const [jsonModalOpen, setJsonModalOpen] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Segurança: opcional travar pela origem de dev
    const isDev = (import.meta as any).env?.DEV === true;
    if (!isDevLocal) {
      console.warn("/tests oculto fora de DEV");
    }
  }, []);

  // Autoajuste por query string e autoexecução (dentro do componente)
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const cStr = sp.get("c");
      if (cStr) {
        const cVal = Math.max(1, Math.min(3, Number(cStr)));
        if (!Number.isNaN(cVal)) setConcurrency(cVal);
      }
      const ar = sp.get("autorun");
      if (ar === "1" || ar === "true") {
        setTimeout(() => {
          if (!running) runAll();
        }, 50);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const tests = useMemo(() => {
    if (activeTab === "critical") return buildCriticalTests();
    return [];
  }, [activeTab]);

  async function runAll() {
    if (running) return;
    setRunning(true);
    setResults([]);
    let aborted = false;
    cancelRef.current = { cancel: () => { aborted = true; } };

    // Pré-autentica uma vez para evitar corrida de sessão durante o pool
    try {
      await ensureAuthenticated();
    } catch { /* ignora: testes individuais lidam com skip/fail conforme necessário */ }

    const out: TestResult[] = [];

    // Execução com concorrência limitada
    const worker = async (t: { id: string; module: string; name: string; exec: () => Promise<TestResult> }) => {
      if (aborted) return { id: t.id, module: t.module, name: t.name, status: "skip" as const, message: "Abortado" };
      const res = await t.exec();
      out.push(res);
      setResults((prev) => [...prev, res]);
      if (stopOnFail && res.status === "fail") {
        aborted = true;
      }
      return res;
    };

    await runWithConcurrency(tests, concurrency, worker);

    setRunning(false);
  }

  function exportJSON() {
    const text = JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2);
    setJsonText(text);
    setCopied(false);
    setJsonModalOpen(true);
  }

  function exportCSV() {
    const header = ["id","module","name","status","latencyMs","message"].join(",");
    const lines = results.map(r => [r.id, r.module, '"'+r.name.replace(/"/g,'""')+'"', r.status, r.latencyMs ?? '', '"'+(r.message||'').replace(/"/g,'""')+'"'].join(","));
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `report-tests-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold mb-4">Suíte de Testes Temporária</h1>

      <div className="flex items-center gap-2 mb-4">
        <label className="text-sm">Concorrência:</label>
        <select className="border rounded px-2 py-1" value={concurrency} onChange={(e)=> setConcurrency(Number(e.target.value))}>
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
        </select>
        <label className="ml-4 text-sm flex items-center gap-2">
          <input type="checkbox" checked={stopOnFail} onChange={(e)=> setStopOnFail(e.target.checked)} /> Parar no primeiro erro
        </label>
        <div className="ml-auto flex gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              try {
                const url = new URL(window.location.href);
                url.searchParams.set("autorun", "1");
                url.searchParams.set("c", "1");
                window.location.href = url.toString();
              } catch {
                const base = window.location.origin + window.location.pathname;
                window.location.href = `${base}?autorun=1&c=1`;
              }
            }}
          >
            Repetir autorun=1&c=1
          </Button>
          <Button variant="outline" onClick={exportJSON} disabled={!results.length}>Export JSON</Button>
          <Button variant="outline" onClick={exportCSV} disabled={!results.length}>Export CSV</Button>
          {!running ? (
            <Button onClick={runAll}>Executar</Button>
          ) : (
            <Button variant="destructive" onClick={() => cancelRef.current?.cancel()}>Parar</Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="critical">Críticos</TabsTrigger>
          <TabsTrigger value="more" disabled>Mais módulos (em breve)</TabsTrigger>
        </TabsList>
        <TabsContent value="critical" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Testes Prioritários</CardTitle>
              <CardDescription>Autenticação, Usuários, Produtos, Pedidos e Upload</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Módulo</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Latência</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground">Nenhuma execução. Clique em Executar.</TableCell>
                    </TableRow>
                  )}
                  {results.map((r) => (
                    <TableRow key={r.id + Math.random()}>
                      <TableCell>{r.module}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell>
                        {r.status === "pass" ? <span className="text-green-600">PASS</span> : r.status === "fail" ? <span className="text-red-600">FAIL</span> : <span className="text-yellow-600">SKIP</span>}
                        {r.error && <div className="text-xs text-red-500 mt-1">{r.error}</div>}
                        {r.message && <div className="text-xs text-muted-foreground mt-1">{r.message}</div>}
                      </TableCell>
                      <TableCell className="text-right">{r.latencyMs ? `${Math.round(r.latencyMs)} ms` : '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Summary results={results} />
      <div className="text-sm text-muted-foreground">Orçamento: p50 ≤ 120 ms, p95 ≤ 300 ms (local)</div>

      {/* Modal Export JSON */}
      <Dialog
        open={jsonModalOpen}
        onOpenChange={(o) => {
          setJsonModalOpen(o);
          if (!o) setCopied(false);
        }}
      >
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Exportar Resultado (JSON)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={jsonText}
              readOnly
              rows={16}
              className="font-mono text-sm leading-relaxed"
            />
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(jsonText);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    } catch (e) {
                      console.error(e);
                    }
                  }}
                >
                  {copied ? "Copiado!" : "Copiar"}
                </Button>
                {copied && <span className="text-green-600 text-sm">Código copiado</span>}
              </div>
              <Button type="button" variant="outline" onClick={() => setJsonModalOpen(false)}>
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const SKIP_NO_CREDENTIALS = "SKIP_NO_CREDENTIALS";
async function ensureAuthenticated(): Promise<void> {
  try {
    const ver = await httpClient.get<any>("/auth/verify");
    const isAuth = !!(ver?.data?.authenticated ?? (ver as any)?.authenticated);
    if (isAuth) return;
  } catch { /* continua para tentar login */ }
  const emailEnv = (import.meta as any).env?.VITE_TEST_EMAIL as string | undefined;
  const passEnv = (import.meta as any).env?.VITE_TEST_PASSWORD as string | undefined;
  if (!emailEnv || !passEnv) throw new Error(SKIP_NO_CREDENTIALS);
  await safeLogin(emailEnv, passEnv);
}

// removido: autorun global duplicado (hook fora do componente)


