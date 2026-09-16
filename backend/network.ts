export interface MeshNode {
  id: string;
  name: string;
  role: string;
  status: 'alive' | 'degraded' | 'down';
  battery: number;
  signal_strength: number;
  location: string;
  priority: string;
}

export interface MeshEdge {
  source: string;
  target: string;
  latency: number;
  signal_strength: number;
  active: boolean;
}

export interface MeshNetwork {
  nodes: Map<string, MeshNode>;
  edges: MeshEdge[];
}

export const VALID_NODE_STATUSES = new Set(['alive', 'degraded', 'down']);

export function createNetwork(): MeshNetwork {
  const nodes = new Map<string, MeshNode>([
    [
      'A',
      {
        id: 'A',
        name: 'Rescue Team 1',
        role: 'Rescue',
        status: 'alive',
        battery: 92,
        signal_strength: 94,
        location: 'Zone A',
        priority: 'critical',
      },
    ],
    [
      'B',
      {
        id: 'B',
        name: 'Ambulance',
        role: 'Medical',
        status: 'alive',
        battery: 78,
        signal_strength: 86,
        location: 'Zone B',
        priority: 'high',
      },
    ],
    [
      'C',
      {
        id: 'C',
        name: 'Drone',
        role: 'Surveillance',
        status: 'alive',
        battery: 65,
        signal_strength: 75,
        location: 'Zone C',
        priority: 'medium',
      },
    ],
    [
      'D',
      {
        id: 'D',
        name: 'Rescue Team 2',
        role: 'Rescue',
        status: 'alive',
        battery: 88,
        signal_strength: 90,
        location: 'Zone D',
        priority: 'critical',
      },
    ],
    [
      'E',
      {
        id: 'E',
        name: 'Relief Camp',
        role: 'Relief',
        status: 'alive',
        battery: 95,
        signal_strength: 97,
        location: 'Zone E',
        priority: 'high',
      },
    ],
    [
      'F',
      {
        id: 'F',
        name: 'Command Center',
        role: 'Command',
        status: 'alive',
        battery: 100,
        signal_strength: 100,
        location: 'Zone F',
        priority: 'critical',
      },
    ],
  ]);

  const edges: MeshEdge[] = [
    { source: 'A', target: 'B', latency: 20, signal_strength: 90, active: true },
    { source: 'A', target: 'C', latency: 22, signal_strength: 88, active: true },
    { source: 'B', target: 'D', latency: 18, signal_strength: 92, active: true },
    { source: 'C', target: 'E', latency: 16, signal_strength: 94, active: true },
    { source: 'D', target: 'E', latency: 12, signal_strength: 96, active: true },
    { source: 'D', target: 'F', latency: 20, signal_strength: 91, active: true },
    { source: 'E', target: 'F', latency: 15, signal_strength: 98, active: true },
  ];

  return { nodes, edges };
}

export function getNetworkSnapshot(network: MeshNetwork) {
  const nodes = Array.from(network.nodes.keys())
    .sort()
    .map((nodeId) => ({
      ...network.nodes.get(nodeId)!,
      id: nodeId,
    }));

  const edges = network.edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
    latency: edge.latency ?? 25,
    signal_strength: edge.signal_strength ?? 80,
    active: edge.active ?? true,
  }));

  return { nodes, edges };
}

export function validateNodeId(network: MeshNetwork, nodeId: string): string {
  if (!network.nodes.has(nodeId)) {
    throw new Error(`Invalid node ID '${nodeId}'.`);
  }
  return nodeId;
}
