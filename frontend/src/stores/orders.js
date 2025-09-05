import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// Constantes de status dos pedidos (mapeamento com backend)
export const ORDER_STATUS = {
  PENDING: 'novo',
  ACCEPTED: 'aceito',
  PREPARING: 'producao', 
  DELIVERY: 'entrega',
  DELIVERED: 'finalizado',
  CANCELLED: 'cancelado'
};

export const STATUS_LABELS = {
  [ORDER_STATUS.PENDING]: 'Pedido Recebido',
  [ORDER_STATUS.ACCEPTED]: 'Pedido Aceito',
  [ORDER_STATUS.PREPARING]: 'Em Preparação',
  [ORDER_STATUS.DELIVERY]: 'Saiu para Entrega',
  [ORDER_STATUS.DELIVERED]: 'Entregue',
  [ORDER_STATUS.CANCELLED]: 'Cancelado'
};

// Store principal para gerenciamento de pedidos
export const useOrdersStore = create(
  subscribeWithSelector((set, get) => ({
    // Estado dos pedidos
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

    // Ações para gerenciar pedidos
    addOrder: (order) => {
      set((state) => {
        const newOrders = new Map(state.orders);
        newOrders.set(order.id, {
          ...order,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          syncStatus: 'synced'
        });
        return { orders: newOrders };
      });
    },

    updateOrderStatus: (orderId, newStatus, justification = '') => {
      set((state) => {
        const newOrders = new Map(state.orders);
        const order = newOrders.get(orderId);
        
        if (order) {
          const updatedOrder = {
            ...order,
            status: newStatus,
            updatedAt: new Date().toISOString(),
            syncStatus: 'pending',
            statusHistory: [
              ...(order.statusHistory || []),
              {
                status: newStatus,
                timestamp: new Date().toISOString(),
                justification: justification || `Status alterado para ${STATUS_LABELS[newStatus]}`,
                source: 'frontend'
              }
            ]
          };
          newOrders.set(orderId, updatedOrder);
        }
        
        return { orders: newOrders };
      });
    },

    setActiveOrder: (orderId) => {
      set({ activeOrderId: orderId });
    },

    getOrder: (orderId) => {
      return get().orders.get(orderId);
    },

    getActiveOrder: () => {
      const { orders, activeOrderId } = get();
      return activeOrderId ? orders.get(activeOrderId) : null;
    },

    // Função para sincronizar com o backend
    syncOrderWithBackend: async (orderId) => {
      try {
        const response = await fetch(`http://localhost:8000/api/orders/${orderId}?sync=status`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        if (data.success && data.data) {
          set((state) => {
            const newOrders = new Map(state.orders);
            const currentOrder = newOrders.get(orderId);
            
            if (currentOrder) {
              // Merge dos dados do backend com os locais
              const syncedOrder = {
                ...currentOrder,
                status: data.data.status,
                updated_at: data.data.updated_at,
                payment_status: data.data.payment_status,
                estimated_delivery_time: data.data.estimated_delivery_time,
                syncStatus: 'synced',
                lastSyncAt: new Date().toISOString()
              };
              newOrders.set(orderId, syncedOrder);
            }
            
            return { 
              orders: newOrders,
              lastSync: new Date().toISOString(),
              syncStatus: {
                ...state.syncStatus,
                lastSync: new Date().toISOString()
              }
            };
          });
        }
        
        return data;
      } catch (error) {
        console.error('Erro na sincronização:', error);
        
        set((state) => ({
          syncErrors: [...state.syncErrors, {
            orderId,
            error: error.message,
            timestamp: new Date().toISOString()
          }].slice(-5),
          syncStatus: {
            ...state.syncStatus,
            syncErrors: [...state.syncStatus.syncErrors, {
              orderId,
              error: error.message,
              timestamp: new Date().toISOString()
            }].slice(-5)
          }
        }));
        
        throw error;
      }
    },

    // Polling para sincronização contínua
    startPolling: (orderId, intervalMs = 5000) => {
      const { pollingInterval, isPolling } = get();
      
      // Para polling anterior se existir
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      
      const interval = setInterval(async () => {
        try {
          await get().syncOrderWithBackend(orderId);
        } catch (error) {
          console.error('Erro no polling:', error);
        }
      }, intervalMs);
      
      set(state => ({ 
        pollingInterval: interval, 
        isPolling: true,
        activeOrderId: orderId,
        syncStatus: {
          ...state.syncStatus,
          isPolling: true
        }
      }));
    },

    stopPolling: () => {
      const { pollingInterval } = get();
      
      if (pollingInterval) {
        clearInterval(pollingInterval);
        set(state => ({ 
          pollingInterval: null, 
          isPolling: false,
          syncStatus: {
            ...state.syncStatus,
            isPolling: false
          }
        }));
      }
    },

    // Limpar erros de sincronização
    clearSyncErrors: () => {
      set({ syncErrors: [] });
    },

    // Reset da store
    reset: () => {
      const { pollingInterval } = get();
      
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      
      set({
        orders: new Map(),
        activeOrderId: null,
        isPolling: false,
        pollingInterval: null,
        lastSync: null,
        syncErrors: []
      });
    }
  }))
);

// Hook personalizado para usar com um pedido específico
export const useOrder = (orderId) => {
  return useOrdersStore((state) => state.orders.get(orderId));
};

// Hook para o pedido ativo
export const useActiveOrder = () => {
  return useOrdersStore((state) => {
    const { orders, activeOrderId } = state;
    return activeOrderId ? orders.get(activeOrderId) : null;
  });
};

// Hook para status de sincronização
export const useSyncStatus = () => {
  return useOrdersStore((state) => ({
    isPolling: state.isPolling,
    lastSync: state.lastSync,
    syncErrors: state.syncErrors
  }));
};

// Exportação principal da store
export { useOrdersStore as useOrderStore };
export default useOrdersStore;