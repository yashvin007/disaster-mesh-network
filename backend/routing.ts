import { MeshNetwork, MeshEdge, MeshNode } from './network.js';

export type RoutingMetric = 'composite' | 'latency' | 'hops';

export interface RouteHop {
  from: string;
  to: string;
  latency_ms: number;
  signal_strength: number;
  edge_cost: number;
  cumulative_latency_ms: number;
}

export interface DijkstraStep {
  step: number;
  selected_node: string;
  distance_from_source: number;
  relaxed_neighbors: Array<{
    neighbor: string;
    old_distance: number;
    new_distance: number;
    relaxed: boolean;
  }>;
}

export interface RouteResult {
  source: string;
  destination: string;
  route: string[];
  hop_count: number;
  route_status: 'ok' | 'error' | 'unavailable';
  reason: string;
  metric_used: RoutingMetric;
  total_cost: number;
  total_latency_ms: number;
  bottleneck_signal: number;
  hops: RouteHop[];
  dijkstra_steps: DijkstraStep[];
  alternative_routes?: Array<{
    route: string[];
    total_latency_ms: number;
    hop_count: number;
  }>;
}

/**
 * Calculates edge weight for Dijkstra's algorithm based on chosen routing metric.
 *
 * 1. 'hops': Every hop has weight = 1 (Shortest path by number of hops)
 * 2. 'latency': Weight is link latency in ms (Fastest physical propagation time)
 * 3. 'composite' (Emergency Mesh Default):
 *    Cost = Latency + Signal Penalty (100 - Signal) + Battery Penalty (100 - Battery)
 *    This ensures packets avoid degrading or dying nodes even if they appear close!
 */
export function calculateEdgeWeight(
  network: MeshNetwork,
  source: string,
  target: string,
  edge: MeshEdge,
  metric: RoutingMetric = 'composite'
): number {
  const sNode = network.nodes.get(source);
  const tNode = network.nodes.get(target);

  const latency = edge.latency ?? 20;

  if (metric === 'hops') {
    return 1;
  }

  if (metric === 'latency') {
    return Math.max(1, latency);
  }

  // Composite metric for disaster mesh resilience:
  const minSignal = Math.min(
    sNode?.signal_strength ?? 70,
    tNode?.signal_strength ?? 70,
    edge.signal_strength ?? 70
  );
  const minBattery = Math.min(sNode?.battery ?? 100, tNode?.battery ?? 100);

  const signalPenalty = Math.max(0, 100 - minSignal) * 0.8;
  const batteryPenalty = minBattery < 30 ? (30 - minBattery) * 1.5 : 0;
  const degradedPenalty = (sNode?.status === 'degraded' || tNode?.status === 'degraded') ? 40 : 0;

  return latency + signalPenalty + batteryPenalty + degradedPenalty;
}

/**
 * Executes Dijkstra's Algorithm to determine the optimal shortest path
 * between source and destination in the disaster mesh network.
 */
export function findBestRoute(
  network: MeshNetwork,
  source: string,
  destination: string,
  metric: RoutingMetric = 'composite'
): RouteResult {
  const emptyResult = (
    status: 'error' | 'unavailable',
    reason: string
  ): RouteResult => ({
    source,
    destination,
    route: [],
    hop_count: 0,
    route_status: status,
    reason,
    metric_used: metric,
    total_cost: 0,
    total_latency_ms: 0,
    bottleneck_signal: 0,
    hops: [],
    dijkstra_steps: [],
  });

  if (!network.nodes.has(source)) {
    return emptyResult('error', `Source node '${source}' does not exist in the mesh.`);
  }

  if (!network.nodes.has(destination)) {
    return emptyResult('error', `Destination node '${destination}' does not exist in the mesh.`);
  }

  if (source === destination) {
    return {
      source,
      destination,
      route: [source],
      hop_count: 0,
      route_status: 'ok',
      reason: 'Source and destination are identical (zero hops).',
      metric_used: metric,
      total_cost: 0,
      total_latency_ms: 0,
      bottleneck_signal: 100,
      hops: [],
      dijkstra_steps: [],
    };
  }

  const sourceNode = network.nodes.get(source)!;
  const destNode = network.nodes.get(destination)!;

  if (sourceNode.status === 'down') {
    return emptyResult(
      'unavailable',
      `Source node '${source}' (${sourceNode.name}) is OFFLINE/DOWN.`
    );
  }

  if (destNode.status === 'down') {
    return emptyResult(
      'unavailable',
      `Destination node '${destination}' (${destNode.name}) is OFFLINE/DOWN.`
    );
  }

  // Construct active graph representation
  const activeNodes = new Set<string>();
  for (const [id, node] of network.nodes.entries()) {
    if (node.status !== 'down') {
      activeNodes.add(id);
    }
  }

  // Build adjacency mapping
  const adj = new Map<
    string,
    Array<{ target: string; edge: MeshEdge; weight: number }>
  >();

  for (const nodeId of activeNodes) {
    adj.set(nodeId, []);
  }

  for (const edge of network.edges) {
    if (!edge.active) continue;
    if (!activeNodes.has(edge.source) || !activeNodes.has(edge.target)) continue;

    const w = calculateEdgeWeight(network, edge.source, edge.target, edge, metric);

    adj.get(edge.source)!.push({ target: edge.target, edge, weight: w });
    adj.get(edge.target)!.push({ target: edge.source, edge, weight: w });
  }

  // Dijkstra's Algorithm
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const visited = new Set<string>();
  const dijkstraSteps: DijkstraStep[] = [];

  for (const id of activeNodes) {
    dist.set(id, Infinity);
    prev.set(id, null);
  }
  dist.set(source, 0);

  let stepCount = 0;

  while (visited.size < activeNodes.size) {
    // Find unvisited node with smallest distance
    let u: string | null = null;
    let minDist = Infinity;

    for (const id of activeNodes) {
      if (!visited.has(id)) {
        const d = dist.get(id) ?? Infinity;
        if (d < minDist) {
          minDist = d;
          u = id;
        }
      }
    }

    if (!u || minDist === Infinity) break;

    visited.add(u);
    stepCount++;

    const relaxedNeighbors: DijkstraStep['relaxed_neighbors'] = [];
    const neighbors = adj.get(u) || [];

    for (const { target: v, weight } of neighbors) {
      if (visited.has(v)) continue;

      const oldDist = dist.get(v) ?? Infinity;
      const newDist = minDist + weight;
      const relaxed = newDist < oldDist;

      if (relaxed) {
        dist.set(v, newDist);
        prev.set(v, u);
      }

      relaxedNeighbors.push({
        neighbor: v,
        old_distance: oldDist === Infinity ? -1 : Math.round(oldDist * 10) / 10,
        new_distance: Math.round(newDist * 10) / 10,
        relaxed,
      });
    }

    dijkstraSteps.push({
      step: stepCount,
      selected_node: u,
      distance_from_source: Math.round(minDist * 10) / 10,
      relaxed_neighbors: relaxedNeighbors,
    });

    if (u === destination) {
      break; // Shortest path to destination discovered
    }
  }

  const destDist = dist.get(destination);
  if (destDist === undefined || destDist === Infinity) {
    return emptyResult(
      'unavailable',
      `No route exists between '${source}' and '${destination}'. Topology is partitioned or intermediate relays are severed.`
    );
  }

  // Traceback optimal path
  const route: string[] = [];
  let curr: string | null = destination;
  while (curr !== null) {
    route.unshift(curr);
    curr = prev.get(curr) ?? null;
  }

  // Construct detailed per-hop metrics
  const hops: RouteHop[] = [];
  let totalLatency = 0;
  let bottleneckSignal = 100;

  for (let i = 0; i < route.length - 1; i++) {
    const u = route[i];
    const v = route[i + 1];

    const edge = network.edges.find(
      (e) =>
        (e.source === u && e.target === v) ||
        (e.source === v && e.target === u)
    );

    const lat = edge?.latency ?? 20;
    const sig = edge?.signal_strength ?? 80;
    const cost = edge ? calculateEdgeWeight(network, u, v, edge, metric) : 20;

    totalLatency += lat;
    bottleneckSignal = Math.min(
      bottleneckSignal,
      sig,
      network.nodes.get(u)?.signal_strength ?? 100,
      network.nodes.get(v)?.signal_strength ?? 100
    );

    hops.push({
      from: u,
      to: v,
      latency_ms: lat,
      signal_strength: sig,
      edge_cost: Math.round(cost * 10) / 10,
      cumulative_latency_ms: totalLatency,
    });
  }

  // Find an alternative route by penalizing the primary path
  const alternativeRoutes = findAlternativeRoute(network, source, destination, route);

  return {
    source,
    destination,
    route,
    hop_count: route.length - 1,
    route_status: 'ok',
    reason: `Optimal Dijkstra route computed (${route.length - 1} hops, ${totalLatency}ms total latency).`,
    metric_used: metric,
    total_cost: Math.round(destDist * 10) / 10,
    total_latency_ms: totalLatency,
    bottleneck_signal: bottleneckSignal,
    hops,
    dijkstra_steps: dijkstraSteps,
    alternative_routes: alternativeRoutes,
  };
}

/**
 * Finds alternative candidate paths for comparison and failover demonstration.
 */
function findAlternativeRoute(
  network: MeshNetwork,
  source: string,
  destination: string,
  primaryRoute: string[]
): Array<{ route: string[]; total_latency_ms: number; hop_count: number }> {
  if (primaryRoute.length <= 2) return [];

  // Temporarily disable one intermediate link from primary route to find second best
  const midIndex = Math.floor(primaryRoute.length / 2);
  const u = primaryRoute[midIndex - 1];
  const v = primaryRoute[midIndex];

  const edge = network.edges.find(
    (e) =>
      (e.source === u && e.target === v) ||
      (e.source === v && e.target === u)
  );

  if (!edge) return [];

  const originalActive = edge.active;
  edge.active = false;

  const altResult = findBestRoute(network, source, destination, 'latency');

  edge.active = originalActive;

  if (altResult.route_status === 'ok' && altResult.route.length > 0) {
    return [
      {
        route: altResult.route,
        total_latency_ms: altResult.total_latency_ms,
        hop_count: altResult.hop_count,
      },
    ];
  }

  return [];
}
