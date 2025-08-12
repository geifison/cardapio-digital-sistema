/**
 * Carregador de Modais
 * Carrega os modais do arquivo modals.html dinamicamente
 */

// Função para carregar os modais
async function loadModals() {
    console.log('🚀 Iniciando carregamento dos modais...');
    
    try {
        const modalsContainer = document.getElementById('modals-container');
        if (!modalsContainer) {
            console.error('❌ Container de modais não encontrado!');
            return false;
        }

        // Determinar o caminho correto baseado na URL atual
        const currentPath = window.location.pathname;
        console.log('📍 Caminho atual:', currentPath);
        
        let modalPath;
        if (currentPath.includes('/admin/')) {
            modalPath = 'modals.html'; // Estamos dentro do admin
        } else {
            modalPath = 'admin/modals.html'; // Estamos na raiz
        }

        console.log('📂 Tentando carregar modais de:', modalPath);
        
        const response = await fetch(modalPath);
        
        if (!response.ok) {
            console.log('⚠️ Primeira tentativa falhou, tentando caminho alternativo...');
            const alternatePath = modalPath === 'modals.html' ? 'admin/modals.html' : 'modals.html';
            console.log('📂 Tentando caminho alternativo:', alternatePath);
            
            const alternateResponse = await fetch(alternatePath);
            if (!alternateResponse.ok) {
                throw new Error(`Falha em ambos os caminhos. Status: ${response.status}, ${alternateResponse.status}`);
            }
            
            const modalsHtml = await alternateResponse.text();
            modalsContainer.innerHTML = modalsHtml;
            console.log('✅ Modais carregados com sucesso (caminho alternativo)!');
        } else {
            const modalsHtml = await response.text();
            modalsContainer.innerHTML = modalsHtml;
            console.log('✅ Modais carregados com sucesso!');
        }

        // Verificar se os modais principais foram carregados
        setTimeout(() => {
            const productModal = document.getElementById('productModal');
            const categoryModal = document.getElementById('categoryModal');
            
            console.log('🔍 Verificando modais carregados:');
            console.log('  - productModal:', productModal ? '✅' : '❌');
            console.log('  - categoryModal:', categoryModal ? '✅' : '❌');
            
            if (!productModal || !categoryModal) {
                console.error('❌ Alguns modais não foram carregados corretamente');
                console.log('Container HTML:', modalsContainer.innerHTML.substring(0, 200) + '...');
            }
        }, 100);

        return true;
        
    } catch (error) {
        console.error('❌ Erro ao carregar modais:', error);
        // Fallback: criar modais básicos se necessário
        createFallbackModals();
        return false;
    }
}

// Função de fallback para criar modais básicos se o carregamento falhar
function createFallbackModals() {
    console.log('Criando modais de fallback...');
    
    const modalsContainer = document.getElementById('modals-container');
    if (!modalsContainer) return;
    
    // Modal de loading básico
    const loadingModal = document.createElement('div');
    loadingModal.className = 'loading-overlay';
    loadingModal.id = 'loadingOverlay';
    loadingModal.innerHTML = `
        <div class="loading-spinner">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Carregando...</p>
        </div>
    `;
    
    modalsContainer.appendChild(loadingModal);
}

// Carregar modais quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM carregado, aguardando scripts...');
    // Aguardar um pouco para garantir que o admin.js já foi carregado
    setTimeout(() => {
        loadModals();
    }, 500); // Aumentei o tempo para garantir que tudo foi carregado
});

// Também tentar carregar quando a janela estiver totalmente carregada
window.addEventListener('load', function() {
    console.log('🚀 Janela carregada, verificando modais...');
    const modalsContainer = document.getElementById('modals-container');
    if (modalsContainer && !modalsContainer.innerHTML.trim()) {
        console.log('📦 Container vazio, carregando modais...');
        loadModals();
    }
});

// Exportar função para uso externo
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { loadModals };
}
