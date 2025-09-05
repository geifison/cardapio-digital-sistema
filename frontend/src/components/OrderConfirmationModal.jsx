import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Progress } from '@/components/ui/progress.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { useOrderStore, useActiveOrder, useSyncStatus, ORDER_STATUS, STATUS_LABELS } from '../stores/orders-simple.js';
import { Clock, CheckCircle, Package, Truck, XCircle, Wifi, WifiOff, AlertCircle, Play, ChefHat } from 'lucide-react';
import { generateWhatsAppMessage, openWhatsApp } from '@/lib/checkout-utils.js';

const ORDER_STATUSES = {
  [ORDER_STATUS.PENDING]: { label: STATUS_LABELS[ORDER_STATUS.PENDING], icon: Clock, progress: 20, color: 'bg-yellow-500' },
  [ORDER_STATUS.ACCEPTED]: { label: STATUS_LABELS[ORDER_STATUS.ACCEPTED], icon: Play, progress: 40, color: 'bg-blue-500' },
  [ORDER_STATUS.PREPARING]: { label: STATUS_LABELS[ORDER_STATUS.PREPARING], icon: ChefHat, progress: 60, color: 'bg-blue-600' },
  [ORDER_STATUS.DELIVERY]: { label: STATUS_LABELS[ORDER_STATUS.DELIVERY], icon: Truck, progress: 80, color: 'bg-purple-600' },
  [ORDER_STATUS.DELIVERED]: { label: STATUS_LABELS[ORDER_STATUS.DELIVERED], icon: CheckCircle, progress: 100, color: 'bg-green-500' },
  [ORDER_STATUS.CANCELLED]: { label: STATUS_LABELS[ORDER_STATUS.CANCELLED], icon: Package, progress: 0, color: 'bg-red-500' }
};

export function OrderConfirmationModal({ isOpen, onClose, orderData, customerData, cartItems }) {
  const [estimatedTime, setEstimatedTime] = useState(30);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Zustand store hooks
  const { addOrder, setActiveOrder, startPolling, stopPolling } = useOrderStore();
  const activeOrder = useActiveOrder();
  const { isPolling, lastSync, syncErrors } = useSyncStatus();
  
  const currentStatus = activeOrder?.status || ORDER_STATUS.PENDING;
  const statusInfo = ORDER_STATUSES[currentStatus] || ORDER_STATUSES[ORDER_STATUS.PENDING];
  const StatusIcon = statusInfo.icon;
  
  // Calcula tempo restante
  const totalEstimatedMinutes = activeOrder?.estimated_delivery_time || estimatedTime;
  const remainingTime = Math.max(0, totalEstimatedMinutes - elapsedTime);

  useEffect(() => {
    if (!isOpen) {
      setElapsedTime(0);
      stopPolling();
      return;
    }

    // Adiciona o pedido à store e inicia sincronização
    if (orderData?.id) {
      const order = {
        id: orderData.id,
        number: orderData.order_number,
        status: ORDER_STATUS.PENDING,
        created_at: new Date().toISOString(),
        total: orderData.total_amount,
        customer_data: customerData,
        items: cartItems,
        estimated_delivery_time: estimatedTime
      };
      
      addOrder(order);
      setActiveOrder(orderData.id);
      
      // Iniciar polling para sincronização em tempo real
      startPolling();
    }

    // Timer para tempo decorrido
    const timeInterval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 60000); // Atualiza a cada minuto

    // Cleanup: parar polling quando o modal for fechado
    return () => {
      clearInterval(timeInterval);
      if (!isOpen) {
        stopPolling();
      }
    };
  }, [isOpen, orderData, addOrder, setActiveOrder, startPolling, stopPolling, customerData, cartItems, estimatedTime]);

  const handleWhatsAppContact = () => {
    if (!customerData || !cartItems) return;
    
    const message = generateWhatsAppMessage(
      { items: cartItems, total: Number(orderData?.total_amount) || 0 },
      customerData
    );
    openWhatsApp(message);
  };

  const formatTime = (minutes) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };



  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader className="text-center">
          <DialogTitle className="flex items-center justify-center gap-2 text-xl">
            <CheckCircle className="h-6 w-6 text-green-500" />
            Pedido Confirmado!
          </DialogTitle>
          <DialogDescription>
            Seu pedido foi registrado com sucesso
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Número do Pedido */}
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Número do Pedido</div>
            <div className="text-2xl font-bold text-primary">
              #{orderData?.order_number || 'N/A'}
            </div>
          </div>

          {/* Status Atual */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Badge variant="secondary">
                <StatusIcon className="h-4 w-4 mr-1" />
                {statusInfo.label}
              </Badge>
              {/* Indicador de sincronização */}
              <div className="flex items-center gap-1">
                {isPolling ? (
                  <Wifi className="h-4 w-4 text-green-500 animate-pulse" title="Sincronizando em tempo real" />
                ) : (
                  <WifiOff className="h-4 w-4 text-gray-400" title="Sincronização pausada" />
                )}
                {syncErrors && syncErrors.length > 0 && (
                  <AlertCircle className="h-4 w-4 text-red-500" title={`${syncErrors.length} erro(s) de sincronização`} />
                )}
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div 
                className={`h-2 rounded-full transition-all duration-500 ease-out ${statusInfo.color}`}
                style={{ width: `${statusInfo.progress}%` }}
              ></div>
            </div>
          </div>

          {/* Tempo Estimado */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium">Tempo Estimado</span>
            </div>
            <div className="text-right">
              <div className="font-bold">{formatTime(remainingTime)}</div>
              <div className="text-xs text-muted-foreground">
                {elapsedTime > 0 && `${formatTime(elapsedTime)} decorridos`}
              </div>
              <div className="text-sm text-gray-600">
                <p>Tempo estimado: <span className="font-medium">{activeOrder?.estimated_delivery_time || estimatedTime} minutos</span></p>
              </div>
            </div>
          </div>

          {/* Status de Sincronização */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              {isPolling ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
              <span className="text-xs font-medium">
                {isPolling ? 'Sincronizando' : 'Desconectado'}
              </span>
            </div>
            {lastSync && (
              <div className="text-xs text-muted-foreground">
                Última atualização: {new Date(lastSync).toLocaleTimeString()}
              </div>
            )}
          </div>
          
          {/* Erros de Sincronização */}
          {syncErrors && syncErrors.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-xs font-medium text-red-800 mb-1">Problemas de Sincronização:</div>
              {syncErrors.slice(-2).map((error, index) => (
                <div key={index} className="text-xs text-red-600">
                  {new Date(error.timestamp).toLocaleTimeString()}: {error.error}
                </div>
              ))}
            </div>
          )}

          {/* Ações */}
          <div className="space-y-2">
            <Button 
              onClick={handleWhatsAppContact} 
              className="w-full" 
              variant="outline"
            >
              Entrar em Contato via WhatsApp
            </Button>
            <Button onClick={onClose} className="w-full">
              Fechar
            </Button>
          </div>

          {/* Informações Adicionais */}
          <div className="text-xs text-center text-muted-foreground">
            Você receberá atualizações sobre o status do seu pedido.
            <br />
            Em caso de dúvidas, entre em contato conosco.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default OrderConfirmationModal;