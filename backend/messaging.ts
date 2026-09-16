import { MeshNetwork } from './network.js';
import { findBestRoute, RoutingMetric, RouteHop } from './routing.js';

export interface MessageRecord {
  id: string;
  sender: string;
  destination: string;
  message: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  timestamp: string;
  route: string[];
  hop_count: number;
  total_latency_ms: number;
  delivery_status: 'delivered' | 'failed' | string;
  route_details?: RouteHop[];
  failure_reason?: string;
}

export const MESSAGE_HISTORY: MessageRecord[] = [];

export function getRecentMessages(limit = 30): MessageRecord[] {
  return MESSAGE_HISTORY.slice(-limit).reverse();
}

export function sendMessage(
  network: MeshNetwork,
  sender: string,
  destination: string,
  message: string,
  priority = 'NORMAL',
  metric: RoutingMetric = 'composite'
): { record: MessageRecord; routeResult: ReturnType<typeof findBestRoute> } {
  if (!network.nodes.has(sender)) {
    throw new Error(`Sender '${sender}' is invalid.`);
  }
  if (!network.nodes.has(destination)) {
    throw new Error(`Destination '${destination}' is invalid.`);
  }

  const normPriority = (String(priority).toUpperCase()) as MessageRecord['priority'];
  const validPriorities = new Set(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']);
  if (!validPriorities.has(normPriority)) {
    throw new Error(
      `Priority must be one of: ${Array.from(validPriorities).sort().join(', ')}.`
    );
  }

  const routeResult = findBestRoute(network, sender, destination, metric);
  const route = routeResult.route;
  const isDelivered = routeResult.route_status === 'ok' && route.length > 0;
  const delivery_status = isDelivered ? 'delivered' : 'failed';

  const messageRecord: MessageRecord = {
    id: `EMG-${String(MESSAGE_HISTORY.length + 1).padStart(4, '0')}`,
    sender,
    destination,
    message,
    priority: normPriority,
    timestamp: new Date().toISOString(),
    route,
    hop_count: routeResult.hop_count,
    total_latency_ms: routeResult.total_latency_ms,
    delivery_status,
    route_details: routeResult.hops,
    failure_reason: isDelivered ? undefined : routeResult.reason,
  };

  MESSAGE_HISTORY.push(messageRecord);
  return { record: messageRecord, routeResult };
}
