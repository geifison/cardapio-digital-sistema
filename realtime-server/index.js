import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
app.use(cors({ origin: '*', methods: ['GET','POST'], allowedHeaders: ['Content-Type','X-REALTIME-SECRET'] }));
app.use(express.json());

// Healthcheck simples
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Config
const PORT = process.env.PORT || 3000;
const REALTIME_SECRET = process.env.REALTIME_SECRET || 'dev-secret';

// Namespaces/salas
const nsAdmin = io.of('/admin');
const nsClient = io.of('/client');

// Log para conexões no namespace raiz (para debug)
io.on('connection', (socket) => {
  console.log('[realtime] ATENÇÃO: conexão no namespace raiz (não deveria acontecer):', socket.id);
});

nsAdmin.on('connection', (socket) => {
  console.log('[realtime] admin conectado:', socket.id);
  // Painel se junta à sala "orders" para receber eventos gerais
  socket.join('orders');
});

nsClient.on('connection', (socket) => {
  console.log('[realtime] client conectado:', socket.id);
  // Cliente informa qual pedido acompanhar
  socket.on('watch:order', ({ orderId }) => {
    if (!orderId) return;
    socket.join(`order:${orderId}`);
  });
});

// Middleware simples para validar header secreto nas rotas HTTP
function requireSecret(req, res, next) {
  const h = req.get('X-REALTIME-SECRET');
  if (!h || h !== REALTIME_SECRET) {
    return res.status(401).json({ error: true, message: 'Unauthorized' });
  }
  next();
}

// Endpoints para o PHP notificar
app.post('/novo-pedido', requireSecret, (req, res) => {
  const payload = req.body || {};
  const orderId = Number(payload.order_id);
  const event = {
    type: 'order:new',
    order_id: orderId,
    status: payload.status || 'novo',
    at: Date.now()
  };
  console.log('[realtime] Emitindo evento order:new:', event);
  console.log('[realtime] Clientes admin conectados:', nsAdmin.sockets.size);
  nsAdmin.to('orders').emit('order:new', event);
  if (orderId) nsClient.to(`order:${orderId}`).emit('order:update', event);
  return res.json({ ok: true });
});

app.post('/atualizar-status', requireSecret, (req, res) => {
  const payload = req.body || {};
  const orderId = Number(payload.order_id);
  const status = payload.status || null;
  const event = { type: 'order:update', order_id: orderId, status, at: Date.now() };
  nsAdmin.to('orders').emit('order:update', event);
  if (orderId) nsClient.to(`order:${orderId}`).emit('order:update', event);
  return res.json({ ok: true });
});

server.listen(PORT, () => {
  console.log(`[realtime] Socket.IO rodando na porta ${PORT}`);
});