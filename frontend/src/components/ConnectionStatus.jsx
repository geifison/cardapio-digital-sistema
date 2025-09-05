import { useConnectionStatus } from '@/stores/realtimeStore.js'
import { Badge } from '@/components/ui/badge.jsx'
import { Wifi, WifiOff, AlertCircle, Loader2 } from 'lucide-react'

export function ConnectionStatus() {
  const { isConnected, connectionStatus, reconnectAttempts } = useConnectionStatus()

  const getStatusConfig = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          icon: Wifi,
          text: 'Conectado',
          variant: 'default',
          className: 'bg-green-500 text-white'
        }
      case 'connecting':
        return {
          icon: Loader2,
          text: 'Conectando...',
          variant: 'secondary',
          className: 'bg-yellow-500 text-white animate-pulse'
        }
      case 'error':
        return {
          icon: AlertCircle,
          text: `Erro (${reconnectAttempts}/5)`,
          variant: 'destructive',
          className: 'bg-red-500 text-white'
        }
      case 'disconnected':
      default:
        return {
          icon: WifiOff,
          text: 'Desconectado',
          variant: 'outline',
          className: 'bg-gray-500 text-white'
        }
    }
  }

  const config = getStatusConfig()
  const Icon = config.icon

  return (
    <Badge 
      variant={config.variant}
      className={`flex items-center gap-1 text-xs ${config.className}`}
    >
      <Icon className={`w-3 h-3 ${connectionStatus === 'connecting' ? 'animate-spin' : ''}`} />
      {config.text}
    </Badge>
  )
}

export default ConnectionStatus