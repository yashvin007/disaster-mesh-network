import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';

import {
  createNetwork,
  getNetworkSnapshot,
  validateNodeId,
  MeshNetwork,
} from './backend/network.js';
import { findBestRoute, RoutingMetric } from './backend/routing.js';
import {
  calculateNetworkHealth,
  degradeNode,
  failNode,
  getNetworkHealthSummary,
  restoreNode,
  simulateDisaster,
} from './backend/self_healing.js';
import { getRecentMessages, sendMessage } from './backend/messaging.js';
import { addEvent, getEvents } from './backend/events.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIR = path.join(__dirname, 'frontend');

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

app.use(cors());
app.use(express.json());

let NETWORK: MeshNetwork = createNetwork();
const activeConnections = new Set<WebSocket>();

// Broadcast network state to WebSocket clients every second
setInterval(() => {
  if (activeConnections.size === 0) return;

  const snapshot = getNetworkSnapshot(NETWORK);
  const health = getNetworkHealthSummary(NETWORK);
  const defaultRoute = findBestRoute(NETWORK, 'A', 'F', 'composite');

  const payload = JSON.stringify({
    ...snapshot,
    network_health: health.network_health,
    alive_count: health.alive,
    degraded_count: health.degraded,
    down_count: health.down,
    active_links: health.active_links,
    connected: health.connected,
    default_route: defaultRoute,
    timestamp: new Date().toISOString(),
  });

  for (const client of activeConnections) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(payload);
      } catch {
        activeConnections.delete(client);
      }
    } else if (
      client.readyState === WebSocket.CLOSED ||
      client.readyState === WebSocket.CLOSING
    ) {
      activeConnections.delete(client);
    }
  }
}, 1000);

// Static frontend serving
app.use('/static', express.static(FRONTEND_DIR));
app.use(express.static(FRONTEND_DIR));

app.get('/', (req: Request, res: Response) => {
  if (req.accepts('html') && !req.accepts('json')) {
    return res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
  }
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.json({
      message: 'Disaster Mesh Network API is active',
      status: 'online',
      algorithm: 'Dijkstra Shortest Path with Composite Metric',
      dashboard: '/dashboard',
    });
  }
  return res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

app.get('/dashboard', (_req: Request, res: Response) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    network_health: calculateNetworkHealth(NETWORK),
  });
});

app.get('/network', (_req: Request, res: Response) => {
  res.json(getNetworkSnapshot(NETWORK));
});

app.get('/network/status', (_req: Request, res: Response) => {
  res.json(getNetworkHealthSummary(NETWORK));
});

app.get('/network/links', (_req: Request, res: Response) => {
  res.json({ links: NETWORK.edges });
});

// Route finding with Dijkstra algorithm
app.get('/network/routes', (req: Request, res: Response) => {
  const source = String(req.query.source || 'A').toUpperCase();
  const destination = String(req.query.destination || 'F').toUpperCase();
  const metric = (String(req.query.metric || 'composite')) as RoutingMetric;

  if (!NETWORK.nodes.has(source) || !NETWORK.nodes.has(destination)) {
    return res.status(404).json({ detail: 'One or both node IDs are invalid.' });
  }

  const result = findBestRoute(NETWORK, source, destination, metric);
  res.json(result);
});

app.get('/network/routes/:source/:destination', (req: Request, res: Response) => {
  const source = req.params.source.toUpperCase();
  const destination = req.params.destination.toUpperCase();
  const metric = (String(req.query.metric || 'composite')) as RoutingMetric;

  if (!NETWORK.nodes.has(source) || !NETWORK.nodes.has(destination)) {
    return res.status(404).json({ detail: 'One or both nodes are invalid.' });
  }

  res.json(findBestRoute(NETWORK, source, destination, metric));
});

// Network Reset
app.post('/network/reset', (_req: Request, res: Response) => {
  NETWORK = createNetwork();
  addEvent('NETWORK_RESET', 'Network topology reset to full operational state.', null, 'low');
  const snapshot = getNetworkSnapshot(NETWORK);
  const health = getNetworkHealthSummary(NETWORK);
  const route = findBestRoute(NETWORK, 'A', 'F', 'composite');

  res.json({
    message: 'Network state has been restored to factory baseline.',
    network: snapshot,
    network_health: health,
    route,
  });
});

// Link Controls
app.post('/network/link/toggle', (req: Request, res: Response) => {
  const source = String(req.body?.source || '').toUpperCase();
  const target = String(req.body?.target || '').toUpperCase();

  const edge = NETWORK.edges.find(
    (e) =>
      (e.source === source && e.target === target) ||
      (e.source === target && e.target === source)
  );

  if (!edge) {
    return res.status(404).json({ detail: `Link ${source}-${target} not found.` });
  }

  edge.active = !edge.active;
  const stateLabel = edge.active ? 'RESTORED' : 'SEVERED';
  addEvent(
    edge.active ? 'LINK_RECOVERY' : 'LINK_FAILURE',
    `Link ${source} <-> ${target} is now ${stateLabel}.`,
    null,
    edge.active ? 'medium' : 'high'
  );

  const route = findBestRoute(NETWORK, 'A', 'F', 'composite');
  res.json({
    message: `Link ${source}-${target} set to ${edge.active ? 'active' : 'inactive'}.`,
    edge,
    route,
  });
});

app.post('/network/link/:source/:target/fail', (req: Request, res: Response) => {
  const source = req.params.source.toUpperCase();
  const target = req.params.target.toUpperCase();

  const edge = NETWORK.edges.find(
    (e) =>
      (e.source === source && e.target === target) ||
      (e.source === target && e.target === source)
  );

  if (!edge) {
    return res.status(404).json({ detail: `Link ${source}-${target} does not exist.` });
  }

  edge.active = false;
  addEvent('LINK_FAILURE', `Emergency Link ${source}-${target} severed.`, null, 'high');

  res.json({
    message: `Link ${source}-${target} deactivated.`,
    edge,
    route: findBestRoute(NETWORK, 'A', 'F', 'composite'),
  });
});

app.post('/network/link/:source/:target/restore', (req: Request, res: Response) => {
  const source = req.params.source.toUpperCase();
  const target = req.params.target.toUpperCase();

  const edge = NETWORK.edges.find(
    (e) =>
      (e.source === source && e.target === target) ||
      (e.source === target && e.target === source)
  );

  if (!edge) {
    return res.status(404).json({ detail: `Link ${source}-${target} does not exist.` });
  }

  edge.active = true;
  addEvent('LINK_RECOVERY', `Emergency Link ${source}-${target} reconnected.`, null, 'medium');

  res.json({
    message: `Link ${source}-${target} restored.`,
    edge,
    route: findBestRoute(NETWORK, 'A', 'F', 'composite'),
  });
});

// Node Controls
app.post('/network/node/:node_id/fail', (req: Request, res: Response) => {
  const nodeId = req.params.node_id.toUpperCase();
  try {
    validateNodeId(NETWORK, nodeId);
    const node = failNode(NETWORK, nodeId);
    addEvent('NODE_FAILURE', `Node ${nodeId} (${node.name}) failed or knocked offline.`, nodeId, 'high');
    const route = findBestRoute(NETWORK, 'A', 'F', 'composite');
    res.json({
      message: `Node ${nodeId} failed. Dijkstra recalculating alternative path.`,
      node,
      route,
    });
  } catch (err: any) {
    res.status(404).json({ detail: err.message });
  }
});

app.post('/network/node/:node_id/restore', (req: Request, res: Response) => {
  const nodeId = req.params.node_id.toUpperCase();
  try {
    validateNodeId(NETWORK, nodeId);
    const node = restoreNode(NETWORK, nodeId);
    addEvent(
      'NODE_RECOVERY',
      `Node ${nodeId} (${node.name}) restored and rejoined mesh.`,
      nodeId,
      'medium'
    );
    const route = findBestRoute(NETWORK, 'A', 'F', 'composite');
    res.json({
      message: `Node ${nodeId} restored.`,
      node,
      route,
    });
  } catch (err: any) {
    res.status(404).json({ detail: err.message });
  }
});

app.post('/network/node/:node_id/degrade', (req: Request, res: Response) => {
  const nodeId = req.params.node_id.toUpperCase();
  try {
    validateNodeId(NETWORK, nodeId);
    const node = degradeNode(NETWORK, nodeId);
    addEvent(
      'NETWORK_DEGRADED',
      `Node ${nodeId} entered degraded mode (low battery/signal).`,
      nodeId,
      'medium'
    );
    const route = findBestRoute(NETWORK, 'A', 'F', 'composite');
    res.json({
      message: `Node ${nodeId} degraded.`,
      node,
      route,
    });
  } catch (err: any) {
    res.status(404).json({ detail: err.message });
  }
});

// Disaster Simulation
app.post('/network/disaster', (req: Request, res: Response) => {
  const scenario = (req.body?.scenario || 'earthquake') as 'earthquake' | 'cyclone' | 'flood' | 'emp';
  const report = simulateDisaster(NETWORK, scenario);
  addEvent(
    'DISASTER_SIMULATION',
    `${report.title}: ${report.description}`,
    report.affected_nodes[0] || null,
    'critical'
  );

  const route = findBestRoute(NETWORK, 'A', 'F', 'composite');
  res.json({
    report,
    route,
    network_health: getNetworkHealthSummary(NETWORK),
  });
});

// Messaging
app.post('/messages/send', (req: Request, res: Response) => {
  const sender = String(req.body?.sender || '').toUpperCase().trim();
  const destination = String(req.body?.destination || '').toUpperCase().trim();
  const message = String(req.body?.message || '').trim();
  const priority = String(req.body?.priority || 'NORMAL').toUpperCase();
  const metric = (String(req.body?.metric || 'composite')) as RoutingMetric;

  if (!sender || !destination || !message) {
    return res
      .status(400)
      .json({ detail: 'Sender, destination, and message are required.' });
  }

  try {
    const { record, routeResult } = sendMessage(
      NETWORK,
      sender,
      destination,
      message,
      priority,
      metric
    );

    if (record.delivery_status === 'delivered') {
      addEvent(
        'MESSAGE_SENT',
        `[${priority}] SOS dispatched from ${sender} to ${destination} via [${record.route.join(' -> ')}]. Delay: ${record.total_latency_ms}ms`,
        sender,
        priority === 'CRITICAL' ? 'critical' : 'high'
      );
    } else {
      addEvent(
        'MESSAGE_FAILED',
        `[${priority}] Delivery failed from ${sender} to ${destination}: ${routeResult.reason}`,
        sender,
        'critical'
      );
    }

    res.json({
      ...record,
      routeResult,
    });
  } catch (err: any) {
    return res.status(404).json({ detail: err.message });
  }
});

app.get('/messages', (_req: Request, res: Response) => {
  res.json({ messages: getRecentMessages(30) });
});

app.get('/events', (_req: Request, res: Response) => {
  res.json({ events: getEvents(30) });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  activeConnections.add(ws);
  ws.on('close', () => activeConnections.delete(ws));
  ws.on('error', () => activeConnections.delete(ws));
});

server.listen(PORT, HOST, () => {
  console.log(`Disaster Mesh Network Server running on http://${HOST}:${PORT}`);
});
