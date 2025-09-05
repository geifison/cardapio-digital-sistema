import { create } from 'zustand';

// Constantes de status
export const ORDER_STATUS = {
  PENDING: 'pendente',
  ACCEPTED: 'aceito',
  PREPARING: 'preparando',
  DELIVERY: 'saiu_para_entrega',
  DELIVERED: 'finalizado',
  CANCELLED: 'cancelado'
};

export const STATUS_LABELS = {
  [ORDER_STATUS.PENDING]: 'Pendente',
  [ORDER_STATUS.ACCEPTED]: 'Aceito',
  [ORDER_STATUS.PREPARING]: 'Preparando',
  [ORDER_STATUS.DELIVERY]: 'Saiu para Entrega',
  [ORDER_STATUS.DELIVERED]: 'Finalizado',
  [ORDER_STATUS.CANCELLED]: 'Cancelado'
};

// Store principal
const useOrdersStore = create((set, get) => ({
  // Estado
  orders: new Map(),
  activeOrderId: null,
  isPolling: false,
  pollingInterval: null,
  lastSync: null,
  syncErrors: [],
  syncStatus: {
    isPolling: false,
    lastSync: null,
    syncErrors: []
  },

  // Ações
  addOrder: (order) => {
    set((state) => {
      const newOrders = new Map(state.orders);
      newOrders.set(order.id, order);
      return { orders: newOrders };
    });
  },

  setActiveOrder: (orderId) => {
    set({ activeOrderId: orderId });
  },

  updateOrderStatus: (orderId, status) => {
    set((state) => {
      const newOrders = new Map(state.orders);
      const order = newOrders.get(orderId);
      if (order) {
        newOrders.set(orderId, { ...order, status });
      }
      return { orders: newOrders };
    });
  },

  startPolling: () => {
    const { pollingInterval, activeOrderId } = get();
    
    // Se já está fazendo polling, não inicia novamente
    if (pollingInterval || !activeOrderId) {
      return;
    }

    set({ isPolling: true });

    const interval = setInterval(async () => {
      const { activeOrderId: currentOrderId } = get();
      
      if (!currentOrderId) {
        get().stopPolling();
        return;
      }

      try {
        const response = await fetch(`http://localhost:8000/api/orders/${currentOrderId}?sync=status`);
        
        if (response.ok) {
          const orderData = await response.json();
          
          // Atualizar o pedido na store
          get().updateOrderStatus(currentOrderId, orderData.status);
          
          // Atualizar informações de sincronização
          set({
            lastSync: new Date().toISOString(),
            syncErrors: [],
            syncStatus: {
              isPolling: true,
              lastSync: new Date().toISOString(),
              syncErrors: []
            }
          });

          // Se o pedido foi finalizado ou cancelado, parar o polling
          if (orderData.status === ORDER_STATUS.DELIVERED || orderData.status === ORDER_STATUS.CANCELLED) {
            get().stopPolling();
          }
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        console.error('Erro na sincronização:', error);
        
        const errorMessage = `Erro de sincronização: ${error.message}`;
        
        set((state) => ({
          syncErrors: [...state.syncErrors, errorMessage],
          syncStatus: {
            ...state.syncStatus,
            syncErrors: [...state.syncErrors, errorMessage]
          }
        }));
      }
    }, 5000); // Polling a cada 5 segundos

    set({ pollingInterval: interval });
  },

  stopPolling: () => {
    const { pollingInterval } = get();
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }
    set({ 
      isPolling: false, 
      pollingInterval: null,
      syncStatus: {
        isPolling: false,
        lastSync: get().lastSync,
        syncErrors: get().syncErrors
      }
    });
  }
}));

// Hook para o pedido ativo
export const useActiveOrder = () => {
  return useOrdersStore((state) => {
    const { orders, activeOrderId } = state;
    return activeOrderId ? orders.get(activeOrderId) : null;
  });
};

// Hook para status de sincronização
export const useSyncStatus = () => {
  const isPolling = useOrdersStore(state => state.isPolling);
  const lastSync = useOrdersStore(state => state.lastSync);
  const syncErrors = useOrdersStore(state => state.syncErrors);
  
  return { isPolling, lastSync, syncErrors };
};

export const useOrderStore = useOrdersStore;
export default useOrdersStore;