<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Página de Teste da API v2</title>
    <!-- Tailwind CSS para um estilo limpo e rápido -->
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        /* Estilo para um visual mais agradável */
        body {
            font-family: 'Inter', sans-serif;
        }
        .container {
            max-width: 1200px;
            margin: auto;
        }
        .api-section {
            background-color: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 0.75rem;
            padding: 1.5rem;
            margin-bottom: 2rem;
        }
        .btn {
            padding: 0.5rem 1rem;
            border-radius: 0.375rem;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
        }
        .btn-primary {
            background-color: #4f46e5;
            color: white;
        }
        .btn-primary:hover {
            background-color: #4338ca;
        }
        .btn-danger {
            background-color: #dc2626;
            color: white;
        }
        .btn-danger:hover {
            background-color: #b91c1c;
        }
        .input-field {
            width: 100%;
            padding: 0.5rem;
            border: 1px solid #d1d5db;
            border-radius: 0.375rem;
        }
        pre {
            background-color: #1f2937;
            color: #d1d5db;
            padding: 1rem;
            border-radius: 0.5rem;
            white-space: pre-wrap;
            word-wrap: break-word;
            font-family: monospace;
            max-height: 400px;
            overflow-y: auto;
        }
        .loader {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #4f46e5;
            border-radius: 50%;
            width: 16px;
            height: 16px;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
    <!-- Google Fonts: Inter -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body class="bg-gray-100 text-gray-800 p-8">

    <div class="container">
        <header class="text-center mb-10">
            <h1 class="text-4xl font-bold text-gray-900">Página de Teste da API v2</h1>
            <p class="text-lg text-gray-600 mt-2">Teste os endpoints da API, incluindo autenticação.</p>
        </header>

        <!-- Seção de Autenticação -->
        <section class="api-section">
            <h2 class="text-2xl font-semibold mb-4">1. Autenticação</h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                <input type="email" id="loginEmail" placeholder="Email (admin@cardapio.com)" class="input-field" value="admin@cardapio.com">
                <input type="password" id="loginPassword" placeholder="Senha (admin123)" class="input-field" value="admin123">
            </div>
            <div class="flex gap-4">
                <button id="btnLogin" class="btn btn-primary">Login</button>
                <button id="btnLogout" class="btn btn-danger">Logout</button>
            </div>
        </section>

        <!-- Seção de Testes de Usuários -->
        <section class="api-section">
            <h2 class="text-2xl font-semibold mb-4">2. Testes de Usuários (`UserController.php`)</h2>
            <p class="text-sm text-gray-500 mb-4">Estes testes só funcionarão após o login como administrador.</p>
            
            <!-- Listar Usuários -->
            <div class="mb-6">
                <h3 class="text-xl font-medium mb-2">Listar todos os usuários</h3>
                <button id="btnListUsers" class="btn btn-primary">Listar Usuários</button>
            </div>

            <!-- Criar Usuário -->
            <div class="mb-6">
                <h3 class="text-xl font-medium mb-2">Criar um novo usuário</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
                    <input type="text" id="createName" placeholder="Nome Completo" class="input-field">
                    <input type="email" id="createEmail" placeholder="Email" class="input-field">
                    <input type="password" id="createPassword" placeholder="Senha" class="input-field">
                    <select id="createRole" class="input-field">
                        <option value="operator">Atendente</option>
                        <option value="manager">Gerente</option>
                        <option value="admin">Administrador</option>
                    </select>
                </div>
                <button id="btnCreateUser" class="btn btn-primary">Criar Usuário</button>
            </div>
        </section>

        <!-- Área de Resposta da API -->
        <section>
            <h2 class="text-2xl font-semibold mb-4">Resposta da API</h2>
            <pre id="apiResponse">A resposta do servidor aparecerá aqui...</pre>
        </section>
    </div>

    <script>
        // Função principal para fazer chamadas à API e mostrar a resposta
        async function callApi(endpoint, method = 'GET', body = null) {
            const responseElement = document.getElementById('apiResponse');
            const button = event.target;
            const originalButtonText = button.innerHTML;
            button.innerHTML = `<div class="loader"></div> <span>Aguarde...</span>`;
            button.disabled = true;

            const baseUrl = '../api'; 
            const url = `${baseUrl}/${endpoint}`;

            const options = {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                // 'credentials: include' é crucial para enviar os cookies de sessão
                credentials: 'include' 
            };

            if (body) {
                options.body = JSON.stringify(body);
            }

            try {
                const response = await fetch(url, options);
                // Tenta ler como JSON, se falhar, lê como texto
                let responseData;
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    responseData = await response.json();
                } else {
                    responseData = await response.text();
                }
                
                responseElement.textContent = JSON.stringify({
                    status: response.status,
                    statusText: response.statusText,
                    data: responseData
                }, null, 2);

            } catch (error) {
                responseElement.textContent = `Erro na requisição:\n${error.toString()}`;
                console.error('Erro na API:', error);
            } finally {
                button.innerHTML = originalButtonText;
                button.disabled = false;
            }
        }

        // --- Event Listeners para os botões de teste ---

        // Autenticação
        document.getElementById('btnLogin').addEventListener('click', (event) => {
            const loginData = {
                email: document.getElementById('loginEmail').value,
                password: document.getElementById('loginPassword').value
            };
            if (!loginData.email || !loginData.password) {
                alert('Preencha email e senha.');
                return;
            }
            callApi('auth/login', 'POST', loginData);
        });

        document.getElementById('btnLogout').addEventListener('click', (event) => {
            callApi('auth/logout', 'POST');
        });

        // Testes de Usuários
        document.getElementById('btnListUsers').addEventListener('click', (event) => {
            callApi('users/list', 'GET');
        });

        document.getElementById('btnCreateUser').addEventListener('click', (event) => {
            const userData = {
                name: document.getElementById('createName').value,
                email: document.getElementById('createEmail').value,
                password: document.getElementById('createPassword').value,
                role: document.getElementById('createRole').value
            };
            if (!userData.name || !userData.email || !userData.password) {
                alert('Por favor, preencha nome, email e senha para criar um usuário.');
                return;
            }
            callApi('users/create', 'POST', userData);
        });

    </script>

</body>
</html>
