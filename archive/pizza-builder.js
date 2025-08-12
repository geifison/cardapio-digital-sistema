document.addEventListener("DOMContentLoaded", function () {

    let currentStep = 1;
    let selectedSize = null;
    let maxFlavors = 0;
    let selectedFlavors = {}; // Mudou para objeto: {nome: quantidade}
    let currentPrice = 0;

    const steps = document.querySelectorAll(".pizza-step");
    const progressSteps = document.querySelectorAll(".progress-step");

    function goToStep(step) {
        steps.forEach(s => s.classList.remove("active"));
        progressSteps.forEach(p => p.classList.remove("active", "completed"));
        
        document.getElementById(`step-${step}`).classList.add("active");
        document.querySelector(`.progress-step[data-step="${step}"]`).classList.add("active");
        
        // Marcar passos anteriores como completos
        for (let i = 1; i < step; i++) {
            const prevStep = document.querySelector(`.progress-step[data-step="${i}"]`);
            if (prevStep) {
                prevStep.classList.add("completed");
            }
        }

        currentStep = step;
        
        // Esconder botão de continuar quando não estiver no passo 2
        const continueBtn = document.getElementById('flavorsContinue');
        if (continueBtn && step !== 2) {
            continueBtn.style.display = 'none';
        }
    }

    // === PASSO 1: Escolher Tamanho ===
    document.querySelector("#sizesGrid").addEventListener("click", function (e) {
        const btn = e.target.closest(".size-option");
        if (!btn) return;

        // Remover seleção anterior
        document.querySelectorAll(".size-option").forEach(option => {
            option.classList.remove("selected");
        });

        // Selecionar novo tamanho
        btn.classList.add("selected");

        selectedSize = btn.dataset.size;
        maxFlavors = parseInt(btn.dataset.maxFlavors);

        // Atualiza no passo 2
        document.getElementById("selectedSizeName").textContent = btn.dataset.label;
        document.getElementById("selectedSizeInfo").textContent = btn.dataset.info;
        document.getElementById("maxFlavors").textContent = maxFlavors;

        // Vai automaticamente para o próximo passo
        setTimeout(() => goToStep(2), 300);
    });

    // === PASSO 2: Escolher Sabores ===
    document.querySelector("#flavorsGrid").addEventListener("click", function (e) {
        const flavor = e.target.closest(".flavor-option");
        if (!flavor) return;

        const flavorName = flavor.dataset.name;
        const flavorPrice = parseFloat(flavor.dataset.price);

        // Calcular total de sabores selecionados
        const totalSelectedFlavors = Object.values(selectedFlavors).reduce((sum, qty) => sum + qty, 0);

        // Se já está selecionado, aumenta quantidade
        if (selectedFlavors[flavorName]) {
            // Verifica se pode adicionar mais um
            if (totalSelectedFlavors < maxFlavors) {
                selectedFlavors[flavorName]++;
                updateFlavorDisplay(flavor, selectedFlavors[flavorName]);
            } else {
                // Atingiu limite, mostrar mensagem
                alert(`Máximo de ${maxFlavors} sabor${maxFlavors > 1 ? 'es' : ''} permitido para este tamanho`);
                return;
            }
        } else {
            // Primeira seleção deste sabor
            if (totalSelectedFlavors < maxFlavors) {
                selectedFlavors[flavorName] = 1;
                flavor.classList.add("selected");
                updateFlavorDisplay(flavor, 1);
            } else {
                alert(`Máximo de ${maxFlavors} sabor${maxFlavors > 1 ? 'es' : ''} permitido para este tamanho`);
                return;
            }
        }

        // Atualizar visualização da pizza
        updatePizzaVisualization();

        // Atualizar botão de continuar
        updateContinueButton();

        // Avançar automaticamente quando atingir o limite máximo
        const totalSelectedFlavors = Object.values(selectedFlavors).reduce((sum, qty) => sum + qty, 0);
        if (totalSelectedFlavors === maxFlavors) {
            updateSummaryInfo();
            setTimeout(() => goToStep(3), 500);
        }
    });

    // Função para atualizar visualização da pizza
    function updatePizzaVisualization() {
        const pizzaCircle = document.getElementById("pizzaCircle");
        const pizzaPreview = document.getElementById("pizzaPreview");
        const pizzaPreviewFinal = document.getElementById("pizzaPreviewFinal");
        
        const pizzaElements = [pizzaCircle, pizzaPreview, pizzaPreviewFinal];
        
        const flavorCount = Object.keys(selectedFlavors).length;
        if (flavorCount === 0) {
            pizzaElements.forEach(el => {
                if (el) el.style.background = '#f8f9fa';
            });
            return;
        }
        
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3'];
        
        if (flavorCount === 1) {
            pizzaElements.forEach(el => {
                if (el) el.style.background = colors[0];
            });
        } else {
            const segments = flavorCount;
            const anglePerSegment = 360 / segments;
            
            let gradient = 'conic-gradient(';
            const flavorNames = Object.keys(selectedFlavors);
            flavorNames.forEach((flavorName, index) => {
                const startAngle = index * anglePerSegment;
                const endAngle = (index + 1) * anglePerSegment;
                const color = colors[index % colors.length];
                
                gradient += `${color} ${startAngle}deg ${endAngle}deg`;
                if (index < segments - 1) gradient += ', ';
            });
            gradient += ')';
            
            pizzaElements.forEach(el => {
                if (el) el.style.background = gradient;
            });
        }
    }

    // === PASSO 3: Observações ===
    function skipObservations() {
        document.getElementById("finalSummarySize").textContent = selectedSize;
        const flavorTexts = [];
        for (const [name, qty] of Object.entries(selectedFlavors)) {
            if (qty > 1) {
                flavorTexts.push(`${name} (${qty}x)`);
            } else {
                flavorTexts.push(name);
            }
        }
        document.getElementById("finalSummaryFlavors").textContent = flavorTexts.join(", ");
        document.getElementById("finalSummaryPrice").textContent = `R$ ${currentPrice.toFixed(2)}`;

        const obs = document.getElementById("observations").value.trim();
        if (obs) {
            document.getElementById("finalSummaryObservationsContainer").style.display = "block";
            document.getElementById("finalSummaryObservations").textContent = obs;
        }

        // Verificar preferências
        const preferences = [];
        if (document.getElementById("wellDone").checked) preferences.push("Bem passada");
        if (document.getElementById("extraCheese").checked) preferences.push("Queijo extra");
        if (document.getElementById("crispyBorder").checked) preferences.push("Borda crocante");
        if (document.getElementById("noOnion").checked) preferences.push("Sem cebola");

        if (preferences.length > 0) {
            document.getElementById("finalSummaryPreferencesContainer").style.display = "block";
            document.getElementById("finalSummaryPreferences").textContent = preferences.join(", ");
        }

        updatePizzaVisualization();
        setTimeout(() => goToStep(4), 300);
    }

    document.querySelector("#observations").addEventListener("blur", skipObservations);
    document.querySelector(".btn-skip").addEventListener("click", skipObservations);

    // === PASSO 4: Adicionar ao Carrinho ===
    window.addToCart = function () {
        try {
            // Criar nome do produto
            const flavorTexts = [];
            for (const [name, qty] of Object.entries(selectedFlavors)) {
                if (qty > 1) {
                    flavorTexts.push(`${name} (${qty}x)`);
                } else {
                    flavorTexts.push(name);
                }
            }
            const productName = `${selectedSize} - ${flavorTexts.join(', ')}`;
            
            // Criar descrição detalhada
            let description = `Pizza ${selectedSize} com ${flavorTexts.join(', ')}`;
            
            // Adicionar observações se houver
            const obs = document.getElementById("observations").value.trim();
            if (obs) {
                description += ` | Obs: ${obs}`;
            }
            
            // Adicionar preferências se houver
            const preferences = [];
            if (document.getElementById("wellDone").checked) preferences.push("Bem passada");
            if (document.getElementById("extraCheese").checked) preferences.push("Queijo extra");
            if (document.getElementById("crispyBorder").checked) preferences.push("Borda crocante");
            if (document.getElementById("noOnion").checked) preferences.push("Sem cebola");
            
            if (preferences.length > 0) {
                description += ` | Preferências: ${preferences.join(', ')}`;
            }
            
            // Adicionar ao carrinho local
            const cartItem = {
                id: Date.now(),
                name: productName,
                price: currentPrice,
                quantity: 1,
                type: 'pizza',
                description: description,
                details: {
                    size: selectedSize,
                    flavors: selectedFlavors,
                    observations: obs,
                    preferences: preferences
                }
            };
            
            // Salvar no localStorage
            const existingCart = localStorage.getItem('cart');
            const cart = existingCart ? JSON.parse(existingCart) : [];
            
            if (!Array.isArray(cart)) {
                localStorage.setItem('cart', JSON.stringify([cartItem]));
            } else {
                cart.push(cartItem);
                localStorage.setItem('cart', JSON.stringify(cart));
            }
            

            
            // Mostrar modal de sucesso
            document.getElementById('successModal').classList.add('active');
            
        } catch (error) {
            console.error('❌ Erro ao adicionar ao carrinho:', error);
            alert('Erro ao adicionar ao carrinho. Tente novamente.');
        }
    };

    // Funções auxiliares
    window.closeModal = function() {
        document.getElementById('successModal').classList.remove('active');
        restartPizzaBuilder();
    };

    window.goToCart = function() {
        closeModal();
        window.location.href = 'index.html#cart';
    };

    window.restartPizzaBuilder = function() {
        // Resetar estado
        currentStep = 1;
        selectedSize = null;
        maxFlavors = 0;
        selectedFlavors = {};
        currentPrice = 0;

        // Limpar seleções
        document.querySelectorAll(".size-option").forEach(option => {
            option.classList.remove("selected");
        });
        
        document.querySelectorAll(".flavor-option").forEach(option => {
            option.classList.remove("selected");
        });

        // Limpar formulários
        document.getElementById("observations").value = "";
        document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = false;
        });

        // Resetar visualização
        updatePizzaVisualization();

        // Voltar ao primeiro passo
        goToStep(1);
    };

    // Filtros de categoria
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const category = this.dataset.category;
            const flavors = document.querySelectorAll('.flavor-option');
            
            flavors.forEach(flavor => {
                if (category === 'all' || flavor.dataset.category === category) {
                    flavor.style.display = 'block';
                } else {
                    flavor.style.display = 'none';
                }
            });
        });
    });

    // === FUNÇÕES AUXILIARES PARA MÚLTIPLOS SABORES ===
    
    /**
     * Atualiza a exibição de quantidade de um sabor
     */
    function updateFlavorDisplay(flavorElement, quantity) {
        // Remove contador anterior se existir
        const existingCounter = flavorElement.querySelector('.flavor-counter');
        if (existingCounter) {
            existingCounter.remove();
        }
        
        // Adiciona novo contador se quantidade > 1
        if (quantity > 1) {
            const counter = document.createElement('div');
            counter.className = 'flavor-counter';
            counter.textContent = `${quantity}x`;
            flavorElement.appendChild(counter);
        }
    }
    
    /**
     * Atualiza informações do resumo
     */
    function updateSummaryInfo() {
        // Criar texto dos sabores com quantidades
        const flavorTexts = [];
        for (const [name, qty] of Object.entries(selectedFlavors)) {
            if (qty > 1) {
                flavorTexts.push(`${name} (${qty}x)`);
            } else {
                flavorTexts.push(name);
            }
        }
        
        document.getElementById("summaryFlavors").textContent = flavorTexts.join(", ");
        document.getElementById("summarySize").textContent = selectedSize;
        
        // Calcular preço (usar o sabor mais caro)
        const prices = [];
        for (const [name, qty] of Object.entries(selectedFlavors)) {
            const flavorEl = document.querySelector(`[data-name="${name}"]`);
            const price = parseFloat(flavorEl.dataset.price);
            prices.push(price);
        }
        currentPrice = prices.length > 0 ? Math.max(...prices) : 0;
        document.getElementById("summaryPrice").textContent = `R$ ${currentPrice.toFixed(2)}`;
    }

    // === FUNÇÕES PARA BOTÃO CONTINUAR ===
    
    /**
     * Atualiza a exibição do botão de continuar
     */
    function updateContinueButton() {
        const continueBtn = document.getElementById('flavorsContinue');
        if (!continueBtn) return;
        
        // Calcular total de sabores selecionados
        const totalSelectedFlavors = Object.values(selectedFlavors).reduce((sum, qty) => sum + qty, 0);
        
        // Mostrar botão se pelo menos 1 sabor selecionado e não atingiu o máximo
        if (totalSelectedFlavors > 0 && totalSelectedFlavors < maxFlavors) {
            continueBtn.style.display = 'block';
        } else {
            continueBtn.style.display = 'none';
        }
    }

    /**
     * Continua do passo de sabores manualmente
     */
    window.continueFromFlavors = function() {
        const totalSelectedFlavors = Object.values(selectedFlavors).reduce((sum, qty) => sum + qty, 0);
        if (totalSelectedFlavors === 0) {
            alert('Selecione pelo menos um sabor para continuar');
            return;
        }
        
        // Atualizar dados do resumo
        updateSummaryInfo();
        
        // Ir para o próximo passo
        goToStep(3);
    };

});
