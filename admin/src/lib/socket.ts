import { Socket, Manager } from 'socket.io-client'

let disabled = false

export function disableSocketsForTests(val: boolean) {
  disabled = val
}

let adminSocket: Socket | null = null
let clientSocket: Socket | null = null

// Cria um mock de socket quando desabilitado para testes/SSR
function createMockSocket(): Socket {
  return {
    connected: false,
    on: () => {},
    off: () => {},
    emit: () => {},
    connect: () => {},
    disconnect: () => {},
    // @ts-ignore propriedades não relevantes no mock
    id: undefined,
  } as unknown as Socket
}

function getBaseUrl() {
  try {
    const url = (import.meta as any).env?.VITE_SOCKET_URL || window.location.origin
    return url
  } catch {
    return 'http://localhost:3001'
  }
}

function buildNamespaceUrl(ns: string) {
  const base = getBaseUrl()
  const u = new URL(base)
  // garante barra única
  const path = u.pathname.endsWith('/') ? u.pathname.slice(0, -1) : u.pathname
  u.pathname = `${path}${ns.startsWith('/') ? ns : `/${ns}`}`
  return u.toString()
}

export function getAdminSocket(): Socket | null {
  if (disabled) return createMockSocket()
  if (adminSocket) return adminSocket
  try {
    const url = buildNamespaceUrl('/admin')
    const m = new Manager(url, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
    })
    adminSocket = m.socket('/') as unknown as Socket
    return adminSocket
  } catch (e) {
    console.error('Erro criando admin socket', e)
    return createMockSocket()
  }
}

export function getClientSocket(): Socket | null {
  if (disabled) return createMockSocket()
  if (clientSocket) return clientSocket
  try {
    const url = buildNamespaceUrl('/')
    const m = new Manager(url, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
    })
    clientSocket = m.socket('/') as unknown as Socket
    return clientSocket
  } catch (e) {
    console.error('Erro criando client socket', e)
    return createMockSocket()
  }
}