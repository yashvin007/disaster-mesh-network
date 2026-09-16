import { MeshNetwork, MeshNode, validateNodeId } from './network.js';

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

export function failNode(network: MeshNetwork, nodeId: string): MeshNode {
  validateNodeId(network, nodeId);
  const node = network.nodes.get(nodeId)!;

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
