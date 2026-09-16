import {
  MeshNetwork,
  MeshNode,
  validateNodeId,
  calculateDistanceMeters,
  calculateBearing,
  LocationBreadcrumb,
  LastKnownLocation,
  BacktrackSearchVector,
} from './network.js';

export function isConnected(network: MeshNetwork, activeNodeIds: string[]): boolean {
  if (activeNodeIds.length <= 1) return true;

  const activeSet = new Set(activeNodeIds);
  const adj = new Map<string, string[]>();
  for (const id of activeNodeIds) {
    adj.set(id, []);
  }

  for (const edge of network.edges) {
    if (!edge.active) continue;
    if (activeSet.has(edge.source) && activeSet.has(edge.target)) {
      adj.get(edge.source)!.push(edge.target);
      adj.get(edge.target)!.push(edge.source);
    }
  }

  // BFS from first active node
  const start = activeNodeIds[0];
  const visited = new Set<string>([start]);
  const queue = [start];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const neighbor of adj.get(curr) || []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return visited.size === activeNodeIds.length;
}

export function calculateNetworkHealth(network: MeshNetwork): number {
  if (network.nodes.size === 0) return 0;

  let alive = 0;
  let degraded = 0;
  let down = 0;
  const activeNodeIds: string[] = [];

  for (const node of network.nodes.values()) {
    if (node.status === 'alive') {
      alive++;
      activeNodeIds.push(node.id);
    } else if (node.status === 'degraded') {
      degraded++;
      activeNodeIds.push(node.id);
    } else if (node.status === 'down') {
      down++;
    }
  }

  const totalNodes = network.nodes.size;
  const activeLinks = network.edges.filter((e) => e.active).length;
  const totalLinks = Math.max(1, network.edges.length);

  const availableNodes = alive + degraded * 0.5;
  const availabilityRatio = availableNodes / totalNodes;
  const linkRatio = activeLinks / totalLinks;

  const connectivity = activeNodeIds.length === 0 ? 1.0 : isConnected(network, activeNodeIds) ? 1.0 : 0.4;

  const health = (availabilityRatio * 0.45 + linkRatio * 0.35 + connectivity * 0.2) * 100;
  return Math.max(0, Math.min(100, Math.round(health)));
}

export function getNetworkHealthSummary(network: MeshNetwork) {
  let alive = 0;
  let degraded = 0;
  let down = 0;
  const activeNodeIds: string[] = [];

  for (const node of network.nodes.values()) {
    if (node.status === 'alive') {
      alive++;
      activeNodeIds.push(node.id);
    } else if (node.status === 'degraded') {
      degraded++;
      activeNodeIds.push(node.id);
    } else if (node.status === 'down') {
      down++;
    }
  }

  const activeLinks = network.edges.filter((e) => e.active).length;
  const connected = activeNodeIds.length === 0 ? true : isConnected(network, activeNodeIds);

  return {
    network_health: calculateNetworkHealth(network),
    alive,
    degraded,
    down,
    active_links: activeLinks,
    connected,
    total_nodes: network.nodes.size,
    total_edges: network.edges.length,
  };
}

export function computeBacktrackVector(
  network: MeshNetwork,
  targetNodeId: string
): BacktrackSearchVector | undefined {
  const targetNode = network.nodes.get(targetNodeId);
  if (!targetNode) return undefined;

  let nearestActiveNode: MeshNode | null = null;
  let minDistance = Infinity;
  let calculatedBearing = 0;

  for (const otherNode of network.nodes.values()) {
    if (otherNode.id !== targetNodeId && otherNode.status !== 'down') {
      const dist = calculateDistanceMeters(
        otherNode.coordinates.lat,
        otherNode.coordinates.lng,
        targetNode.coordinates.lat,
        targetNode.coordinates.lng
      );
      if (dist < minDistance) {
        minDistance = dist;
        nearestActiveNode = otherNode;
        calculatedBearing = calculateBearing(
          otherNode.coordinates.lat,
          otherNode.coordinates.lng,
          targetNode.coordinates.lat,
          targetNode.coordinates.lng
        );
      }
    }
  }

  if (!nearestActiveNode) return undefined;

  return {
    nearest_active_node_id: nearestActiveNode.id,
    nearest_active_node_name: nearestActiveNode.name,
    distance_meters: minDistance,
    bearing_degrees: calculatedBearing,
    estimated_reach_time_mins: Math.max(1, Math.round(minDistance / 50)), // ~3 km/h foot rescue terrain
    recommended_search_path: [nearestActiveNode.id, targetNodeId],
  };
}

export function computeTotalPatrolDistance(history: LocationBreadcrumb[]): number {
  if (!history || history.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1].coordinates;
    const curr = history[i].coordinates;
    if (prev && curr && typeof prev.lat === 'number' && typeof curr.lat === 'number') {
      total += calculateDistanceMeters(prev.lat, prev.lng, curr.lat, curr.lng);
    }
  }
  return total;
}

export function failNode(network: MeshNetwork, nodeId: string): MeshNode {
  validateNodeId(network, nodeId);
  const node = network.nodes.get(nodeId)!;

  // 1. Identify currently connected peers before links drop
  const lastConnectedPeers: string[] = [];
  for (const edge of network.edges) {
    if (edge.active && (edge.source === nodeId || edge.target === nodeId)) {
      const peer = edge.source === nodeId ? edge.target : edge.source;
      lastConnectedPeers.push(peer);
    }
  }

  // 2. Compute Backtracking Search Vector from nearest surviving active node
  const backtrackVector = computeBacktrackVector(network, nodeId);

  // 3. Extract movement history details (where the rescue member went)
  const routeTaken = (node.location_history || []).map((b) => b.location);
  const totalPatrolDist = computeTotalPatrolDistance(node.location_history || []);
  const lastActivity =
    node.location_history && node.location_history.length > 0
      ? node.location_history[node.location_history.length - 1].activity
      : 'Field Operation';

  // 4. Save Last Known Location snapshot (Black Box beacon)
  const previousBattery = node.battery;
  const previousSignal = node.signal_strength;
  const cutoffTimestamp = new Date().toISOString();

  node.last_known_location = {
    timestamp: cutoffTimestamp,
    location: node.location,
    coordinates: { ...node.coordinates },
    battery_at_cutoff: previousBattery,
    signal_at_cutoff: previousSignal,
    recorded_at: new Date().toLocaleTimeString(),
    last_connected_peers: lastConnectedPeers,
    status_at_cutoff: 'down',
    rescue_priority: node.priority === 'critical' ? 'CRITICAL' : 'HIGH',
    backtrack_search_vector: backtrackVector,
    dispatch_status: 'SEARCHING',
    route_taken: routeTaken,
    total_patrol_distance_m: totalPatrolDist,
    last_activity: lastActivity,
  };

  // 5. Record entry in node breadcrumb location history
  if (!node.location_history) node.location_history = [];
  node.location_history.push({
    timestamp: cutoffTimestamp,
    location: node.location,
    coordinates: { ...node.coordinates },
    battery: previousBattery,
    signal_strength: previousSignal,
    status: 'down',
    activity: 'Signal Lost / Cutoff',
    distance_from_prev_m: 0,
    note: `Rescue member signal severed. Last saved location cached. Backtrack search corridor initialized from teammate ${backtrackVector?.nearest_active_node_id || 'HQ'}.`,
  });

  // 6. Update active status
  node.status = 'down';
  node.battery = 0;
  node.signal_strength = 0;

  for (const edge of network.edges) {
    if (edge.source === nodeId || edge.target === nodeId) {
      edge.active = false;
    }
  }

  return node;
}

export function restoreNode(network: MeshNetwork, nodeId: string): MeshNode {
  validateNodeId(network, nodeId);
  const node = network.nodes.get(nodeId)!;

  node.status = 'alive';
  node.battery = Math.max(node.battery ?? 85, 80);
  node.signal_strength = Math.max(node.signal_strength ?? 85, 85);

  if (node.last_known_location) {
    node.last_known_location.dispatch_status = 'STANDBY';
  }

  if (!node.location_history) node.location_history = [];
  node.location_history.push({
    timestamp: new Date().toISOString(),
    location: node.location,
    coordinates: { ...node.coordinates },
    battery: node.battery,
    signal_strength: node.signal_strength,
    status: 'alive',
    note: 'Node re-established contact. Power restored and mesh re-converged.',
  });

  // Re-enable edges if adjacent node is not down
  for (const edge of network.edges) {
    if (edge.source === nodeId || edge.target === nodeId) {
      const otherId = edge.source === nodeId ? edge.target : edge.source;
      const otherNode = network.nodes.get(otherId);
      if (otherNode && otherNode.status !== 'down') {
        edge.active = true;
      }
    }
  }

  return node;
}

export function updateNodeLocation(
  network: MeshNetwork,
  nodeId: string,
  newLocation: string,
  coordinates?: { lat: number; lng: number; altitude_m?: number },
  activity = 'Patrol Movement',
  note = 'GPS telemetry position update.'
): MeshNode {
  validateNodeId(network, nodeId);
  const node = network.nodes.get(nodeId)!;

  const prevCoords = { ...node.coordinates };
  node.location = newLocation;
  if (coordinates) {
    node.coordinates = {
      lat: coordinates.lat,
      lng: coordinates.lng,
      altitude_m: coordinates.altitude_m ?? node.coordinates.altitude_m,
    };
  }

  const distFromPrev = calculateDistanceMeters(
    prevCoords.lat,
    prevCoords.lng,
    node.coordinates.lat,
    node.coordinates.lng
  );

  if (!node.location_history) node.location_history = [];
  node.location_history.push({
    timestamp: new Date().toISOString(),
    location: node.location,
    coordinates: { ...node.coordinates },
    battery: node.battery,
    signal_strength: node.signal_strength,
    status: node.status,
    activity,
    distance_from_prev_m: distFromPrev,
    note,
  });

  return node;
}

export function getRescueMovementLogs(network: MeshNetwork) {
  const members = Array.from(network.nodes.values()).map((node) => {
    const history = node.location_history || [];
    const totalDist = computeTotalPatrolDistance(history);
    return {
      id: node.id,
      name: node.name,
      role: node.role,
      status: node.status,
      battery: node.battery,
      signal_strength: node.signal_strength,
      current_location: node.location,
      coordinates: node.coordinates,
      total_waypoints: history.length,
      total_patrol_distance_m: totalDist,
      last_activity: history.length > 0 ? history[history.length - 1].activity : 'Field Operations',
      last_known_location: node.last_known_location,
      waypoints: history,
    };
  });

  return {
    timestamp: new Date().toISOString(),
    total_members: members.length,
    active_members: members.filter((m) => m.status !== 'down').length,
    offline_members: members.filter((m) => m.status === 'down').length,
    members,
  };
}

export function dispatchRescueBacktrack(
  network: MeshNetwork,
  targetNodeId: string,
  dispatchedBy?: string
): { success: boolean; message: string; target_node: MeshNode; vector?: BacktrackSearchVector } {
  validateNodeId(network, targetNodeId);
  const node = network.nodes.get(targetNodeId)!;

  const vector = computeBacktrackVector(network, targetNodeId);
  if (node.last_known_location) {
    node.last_known_location.dispatch_status = 'RESCUE_DISPATCHED';
    if (vector) {
      node.last_known_location.backtrack_search_vector = vector;
    }
  }

  return {
    success: true,
    message: `Rescue team dispatched to last known saved location of Node ${targetNodeId} (${node.location}) via responder ${vector?.nearest_active_node_id || 'HQ'}.`,
    target_node: node,
    vector,
  };
}

export function getBacktrackingRegistry(network: MeshNetwork) {
  const allNodes = Array.from(network.nodes.values());
  const offlineNodes = allNodes.filter((n) => n.status === 'down');
  
  const offlineNodesMap: Record<string, any> = {};

  const mappedOfflineNodes = offlineNodes.map((n) => {
    if (!n.last_known_location) {
      n.last_known_location = {
        timestamp: new Date().toISOString(),
        location: n.location,
        coordinates: { ...n.coordinates },
        battery_at_cutoff: n.battery || 0,
        signal_at_cutoff: n.signal_strength || 0,
        recorded_at: new Date().toLocaleTimeString(),
        last_connected_peers: [],
        status_at_cutoff: 'down',
        rescue_priority: n.priority === 'critical' ? 'CRITICAL' : 'HIGH',
        backtrack_search_vector: computeBacktrackVector(network, n.id),
        dispatch_status: 'SEARCHING',
        route_taken: (n.location_history || []).map((b) => b.location).concat(n.location),
        total_patrol_distance_m: computeTotalPatrolDistance(n.location_history || []),
        last_activity: 'Field Transit',
      };
    } else if (!n.last_known_location.backtrack_search_vector) {
      n.last_known_location.backtrack_search_vector = computeBacktrackVector(network, n.id);
    }

    const item = {
      id: n.id,
      name: n.name,
      role: n.role,
      priority: n.priority,
      current_status: n.status,
      last_known_location: n.last_known_location,
      backtrack_search_vector: n.last_known_location.backtrack_search_vector,
      breadcrumbs_count: n.location_history?.length || 0,
      recent_history: (n.location_history || []).slice(-4),
    };

    offlineNodesMap[n.id] = item;
    return item;
  });

  return {
    offline_count: offlineNodes.length,
    active_count: allNodes.length - offlineNodes.length,
    offline_nodes: mappedOfflineNodes,
    offline_nodes_map: offlineNodesMap,
    all_nodes_locations: allNodes.map((n) => ({
      id: n.id,
      name: n.name,
      status: n.status,
      location: n.location,
      coordinates: n.coordinates,
      last_known_location: n.last_known_location,
    })),
  };
}

export function degradeNode(network: MeshNetwork, nodeId: string): MeshNode {
  validateNodeId(network, nodeId);
  const node = network.nodes.get(nodeId)!;

  node.status = 'degraded';
  node.battery = Math.max(15, (node.battery ?? 60) - 30);
  node.signal_strength = Math.max(20, (node.signal_strength ?? 65) - 35);

  return node;
}

export function simulateDisaster(
  network: MeshNetwork,
  scenario: 'earthquake' | 'cyclone' | 'flood' | 'emp'
): { title: string; description: string; affected_nodes: string[]; affected_links: string[] } {
  switch (scenario) {
    case 'flood': {
      // Flood submerges low-elevation river node C (drone charging pad / valley relay)
      failNode(network, 'C');
      degradeNode(network, 'E');
      return {
        title: 'Flash Flood Impact',
        description: 'Zone C relay submerged; Drone grounded. Relief Camp (E) operating on backup battery.',
        affected_nodes: ['C', 'E'],
        affected_links: ['A-C', 'C-E'],
      };
    }
    case 'earthquake': {
      // Earthquake severs primary ground links B-D and degrades Node B (Ambulance)
      const eBD = network.edges.find(e => (e.source === 'B' && e.target === 'D') || (e.source === 'D' && e.target === 'B'));
      if (eBD) eBD.active = false;
      degradeNode(network, 'B');
      return {
        title: 'Magnitude 7.1 Earthquake',
        description: 'Road infrastructure collapse severed Link B-D. Ambulance unit degraded with debris interference.',
        affected_nodes: ['B'],
        affected_links: ['B-D'],
      };
    }
    case 'cyclone': {
      // Cyclone creates severe RF interference on air relays
      degradeNode(network, 'C');
      degradeNode(network, 'A');
      const eAC = network.edges.find(e => (e.source === 'A' && e.target === 'C') || (e.source === 'C' && e.target === 'A'));
      if (eAC) {
        eAC.latency = 95;
        eAC.signal_strength = 35;
      }
      return {
        title: 'Severe Cyclone Windstorm',
        description: 'High RF attenuation on aerial channels. Link A-C latency spiked to 95ms. Signal dropped to 35%.',
        affected_nodes: ['A', 'C'],
        affected_links: ['A-C'],
      };
    }
    case 'emp': {
      // High-altitude surge knocks out command link D-F
      const eDF = network.edges.find(e => (e.source === 'D' && e.target === 'F') || (e.source === 'F' && e.target === 'D'));
      if (eDF) eDF.active = false;
      return {
        title: 'Power Grid Failure & Surge',
        description: 'Command tower main link D-F tripped. Mesh must self-heal and reroute via Relief Camp E.',
        affected_nodes: [],
        affected_links: ['D-F'],
      };
    }
  }
}
