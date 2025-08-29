import { io, Socket } from 'socket.io-client';

let adminSocket: Socket | null = null;

export function getAdminSocket() {
  if (adminSocket && adminSocket.connected) return adminSocket;
  const url = (import.meta as any).env?.VITE_SOCKET_URL || 'http://localhost:3000';
  adminSocket = io(`${url}/admin`, { transports: ['websocket'], reconnection: true });
  return adminSocket;
}