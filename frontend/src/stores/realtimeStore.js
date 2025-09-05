import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { io } from 'socket.io-client';
import { useOrdersStore } from './orders.js';

// Store para comunicação em tempo real
export const useRealtimeStore = create(
  subscribeWithSelector((set, get) => ({
    // Estado da conexão Socket.IO
    socket: null,
    isConnected: false,
    connectionStatus: 'disconnected', // 'disconnected', 'connecting', 'connected', 'error'
    lastHeartbeat: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    
    // Configurações
    serverUrl: 'http://localhost:3000',
    autoReconnect: true,
    heartbeatInterval: 30000, // 30 segundos
    
    // Eventos recebidos
    lastEvent: null,
    eventHistory: [],
    
    // Inicializar conexão Socket.IO
    connect: () => {
      const { socket, serverUrl } = get();
      
      // Evitar múltiplas conexões
      if (socket && socket.connected) {
        console.log('Socket já conectado');
        return;
      }
      
      set({ connectionStatus: 'connecting' });
      
      try {
        const newSocket = io(serverUrl, {
          transports: ['websocket', 'polling'],
          timeout: 10000,
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          maxReconnectionAttempts: 5
        });
        
        // Event listeners
        newSocket.on('connect', () => {
          console.log('Socket.IO conectado:', newSocket.id);
          set({
            socket: newSocket,
            isConnected: true,
            connectionStatus: 'connected',
            reconnectAttempts: 0,
            lastHeartbeat: new Date().toISOString()
          });
          
          // Registrar cliente como frontend
          newSocket.emit('register', { type: 'frontend' });
        });
        
        newSocket.on('disconnect', (reason) => {
          console.log('Socket.IO desconectado:', reason);
          set({
            isConnected: false,
            connectionStatus: 'disconnected'
          });
        });
        
        newSocket.on('connect_error', (error) => {
          console.error('Erro de conexão Socket.IO:', error);
          set(state => ({
            connectionStatus: 'error',
            reconnectAttempts: state.reconnectAttempts + 1
          }));
        });
        
        // Eventos de pedidos
        newSocket.on('order:new', (orderData) => {
          console.log('Novo pedido recebido via Socket.IO:', orderData);
          
          // Adicionar ao histórico de eventos
          set(state => ({
            lastEvent: {
              type: 'order:new',
              data: orderData,
              timestamp: new Date().toISOString()
            },
            eventHistory: [
              ...state.eventHistory.slice(-49), // Manter apenas os últimos 50 eventos
              {
                type: 'order:new',
                data: orderData,
                timestamp: new Date().toISOString()
              }
            ]
          }));
          
          // Atualizar store de pedidos
          const ordersStore = useOrdersStore.getState();
          if (orderData && orderData.id) {
            ordersStore.addOrder(orderData);
          }
        });
        
        newSocket.on('order:update', (updateData) => {
          console.log('Atualização de pedido recebida via Socket.IO:', updateData);
          
          // Adicionar ao histórico de eventos
          set(state => ({
            lastEvent: {
              type: 'order:update',
              data: updateData,
              timestamp: new Date().toISOString()
            },
            eventHistory: [
              ...state.eventHistory.slice(-49),
              {
                type: 'order:update',
                data: updateData,
                timestamp: new Date().toISOString()
              }
            ]
          }));
          
          // Atualizar store de pedidos
          const ordersStore = useOrdersStore.getState();
          if (updateData && updateData.id) {
            ordersStore.updateOrderStatus(
              updateData.id,
              updateData.status,
              updateData.justification || 'Atualização via Socket.IO'
            );
          }
        });
        
        // Heartbeat para manter conexão viva
        newSocket.on('heartbeat', () => {
          set({ lastHeartbeat: new Date().toISOString() });
        });
        
        set({ socket: newSocket });
        
      } catch (error) {
        console.error('Erro ao inicializar Socket.IO:', error);
        set({ connectionStatus: 'error' });
      }
    },
    
    // Desconectar Socket.IO
    disconnect: () => {
      const { socket } = get();
      
      if (socket) {
        socket.disconnect();
        set({
          socket: null,
          isConnected: false,
          connectionStatus: 'disconnected'
        });
      }
    },
    
    // Enviar evento para o servidor
    emit: (eventName, data) => {
      const { socket, isConnected } = get();
      
      if (socket && isConnected) {
        socket.emit(eventName, data);
        return true;
      } else {
        console.warn('Socket não conectado. Não foi possível enviar evento:', eventName);
        return false;
      }
    },
    
    // Reconectar manualmente
    reconnect: () => {
      const { disconnect, connect } = get();
      disconnect();
      setTimeout(() => {
        connect();
      }, 1000);
    },
    
    // Limpar histórico de eventos
    clearEventHistory: () => {
      set({ eventHistory: [] });
    },
    
    // Obter status da conexão
    getConnectionInfo: () => {
      const state = get();
      return {
        isConnected: state.isConnected,
        connectionStatus: state.connectionStatus,
        lastHeartbeat: state.lastHeartbeat,
        reconnectAttempts: state.reconnectAttempts,
        eventCount: state.eventHistory.length
      };
    },
    
    // Reset da store
    reset: () => {
      const { disconnect } = get();
      disconnect();
      set({
        socket: null,
        isConnected: false,
        connectionStatus: 'disconnected',
        lastHeartbeat: null,
        reconnectAttempts: 0,
        lastEvent: null,
        eventHistory: []
      });
    }
  }))
);

// Hook para status da conexão
export const useConnectionStatus = () => {
  const isConnected = useRealtimeStore((state) => state.isConnected);
  const connectionStatus = useRealtimeStore((state) => state.connectionStatus);
  const lastHeartbeat = useRealtimeStore((state) => state.lastHeartbeat);
  const reconnectAttempts = useRealtimeStore((state) => state.reconnectAttempts);
  
  return {
    isConnected,
    connectionStatus,
    lastHeartbeat,
    reconnectAttempts
  };
};

// Hook para eventos recebidos
export const useRealtimeEvents = () => {
  const lastEvent = useRealtimeStore((state) => state.lastEvent);
  const eventHistory = useRealtimeStore((state) => state.eventHistory);
  
  return {
    lastEvent,
    eventHistory
  };
};

// Auto-conectar quando a store for criada
if (typeof window !== 'undefined') {
  // Conectar automaticamente após um pequeno delay
  setTimeout(() => {
    useRealtimeStore.getState().connect();
  }, 1000);
}

export default useRealtimeStore;