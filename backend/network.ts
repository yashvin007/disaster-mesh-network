export interface LocationCoordinates {
  lat: number;
  lng: number;
  altitude_m?: number;
}

export interface LocationBreadcrumb {
  timestamp: string;
  location: string;
  coordinates: LocationCoordinates;
  battery: number;
  signal_strength: number;
  status: 'alive' | 'degraded' | 'down';
  activity?: string;
  distance_from_prev_m?: number;
  note?: string;
}

export interface BacktrackSearchVector {
  nearest_active_node_id: string;
  nearest_active_node_name: string;
  distance_meters: number;
  bearing_degrees: number;
  estimated_reach_time_mins: number;
  recommended_search_path: string[];
}

export interface LastKnownLocation {
  timestamp: string;
  location: string;
  coordinates: LocationCoordinates;
  battery_at_cutoff: number;
  signal_at_cutoff: number;
  recorded_at: string;
  last_connected_peers: string[];
  status_at_cutoff: 'alive' | 'degraded' | 'down';
  rescue_priority: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  backtrack_search_vector?: BacktrackSearchVector;
  dispatch_status?: 'SEARCHING' | 'RESCUE_DISPATCHED' | 'STANDBY';
  route_taken?: string[];
  total_patrol_distance_m?: number;
  last_activity?: string;
}

export interface MeshNode {
  id: string;
  name: string;
  role: string;
  status: 'alive' | 'degraded' | 'down';
  battery: number;
  signal_strength: number;
  location: string;
  coordinates: LocationCoordinates;
  priority: string;
  last_known_location?: LastKnownLocation | null;
  location_history?: LocationBreadcrumb[];
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

export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);
  return Math.round(((theta * 180) / Math.PI + 360) % 360);
}

export function createNetwork(): MeshNetwork {
  const baseTime = new Date();
  const tMinus = (mins: number) => new Date(baseTime.getTime() - mins * 60000).toISOString();

  const nodes = new Map<string, MeshNode>([
    [
      'A',
      {
        id: 'A',
        name: 'Rescue Team 1',
        role: 'Field Squad Alpha',
        status: 'alive',
        battery: 92,
        signal_strength: 94,
        location: 'Zone A (Sector 4 - North Ridge)',
        coordinates: { lat: 34.0522, lng: -118.2437, altitude_m: 240 },
        priority: 'critical',
        last_known_location: null,
        location_history: [
          {
            timestamp: tMinus(65),
            location: 'Zone F (Command Center HQ)',
            coordinates: { lat: 34.0370, lng: -118.2710, altitude_m: 210 },
            battery: 100,
            signal_strength: 99,
            status: 'alive',
            activity: 'Mission Departure',
            distance_from_prev_m: 0,
            note: 'Briefing completed; issued mesh radios and field repeaters',
          },
          {
            timestamp: tMinus(45),
            location: 'Zone E (Relief Base Camp)',
            coordinates: { lat: 34.0495, lng: -118.2670, altitude_m: 190 },
            battery: 97,
            signal_strength: 98,
            status: 'alive',
            activity: 'Logistics Restock',
            distance_from_prev_m: 1450,
            note: 'Picked up satellite battery packs and solar chargers',
          },
          {
            timestamp: tMinus(25),
            location: 'Sector 4 Approach Trail (Valley Crossing)',
            coordinates: { lat: 34.0515, lng: -118.2425, altitude_m: 210 },
            battery: 95,
            signal_strength: 92,
            status: 'alive',
            activity: 'Squad Transit',
            distance_from_prev_m: 2280,
            note: 'Crossed river wash; verified direct line-of-sight with Drone C',
          },
          {
            timestamp: tMinus(10),
            location: 'Zone A (Sector 4 - North Ridge)',
            coordinates: { lat: 34.0522, lng: -118.2437, altitude_m: 240 },
            battery: 92,
            signal_strength: 94,
            status: 'alive',
            activity: 'Perimeter Observation',
            distance_from_prev_m: 130,
            note: 'Stationed on high-elevation ridge; radio relay operating nominally',
          },
        ],
      },
    ],
    [
      'B',
      {
        id: 'B',
        name: 'Ambulance',
        role: 'Mobile Medical Support',
        status: 'alive',
        battery: 78,
        signal_strength: 86,
        location: 'Zone B (Sector 2 - Medical Staging)',
        coordinates: { lat: 34.0480, lng: -118.2520, altitude_m: 160 },
        priority: 'high',
        last_known_location: null,
        location_history: [
          {
            timestamp: tMinus(75),
            location: 'Central Medical Dispatch',
            coordinates: { lat: 34.0380, lng: -118.2600, altitude_m: 140 },
            battery: 95,
            signal_strength: 96,
            status: 'alive',
            activity: 'Mobilization',
            distance_from_prev_m: 0,
            note: 'Medical vehicle deployed with emergency paramedic crew',
          },
          {
            timestamp: tMinus(40),
            location: 'Highway 101 Access Ramp',
            coordinates: { lat: 34.0450, lng: -118.2500, altitude_m: 150 },
            battery: 86,
            signal_strength: 90,
            status: 'alive',
            activity: 'En Route',
            distance_from_prev_m: 1180,
            note: 'Navigated around fractured asphalt; linked to Rescue Team 2',
          },
          {
            timestamp: tMinus(12),
            location: 'Zone B (Sector 2 - Medical Staging)',
            coordinates: { lat: 34.0480, lng: -118.2520, altitude_m: 160 },
            battery: 78,
            signal_strength: 86,
            status: 'alive',
            activity: 'Staging Established',
            distance_from_prev_m: 380,
            note: 'Tri-fold medical triage and trauma tent fully erected',
          },
        ],
      },
    ],
    [
      'C',
      {
        id: 'C',
        name: 'Drone',
        role: 'Aerial Recon & Scout',
        status: 'alive',
        battery: 65,
        signal_strength: 75,
        location: 'Zone C (Sector 3 - River Valley Relay)',
        coordinates: { lat: 34.0590, lng: -118.2490, altitude_m: 350 },
        priority: 'medium',
        last_known_location: null,
        location_history: [
          {
            timestamp: tMinus(45),
            location: 'Launch Pad Echo (Relief Camp)',
            coordinates: { lat: 34.0495, lng: -118.2670, altitude_m: 190 },
            battery: 98,
            signal_strength: 98,
            status: 'alive',
            activity: 'Pre-flight Launch',
            distance_from_prev_m: 0,
            note: 'Airborne launch authorized; rotors spinning nominally',
          },
          {
            timestamp: tMinus(28),
            location: 'Sector 3 Canyon Gorge Scan',
            coordinates: { lat: 34.0550, lng: -118.2460, altitude_m: 290 },
            battery: 82,
            signal_strength: 88,
            status: 'alive',
            activity: 'Reconnaissance Sweep',
            distance_from_prev_m: 2040,
            note: 'Infrared canyon sweep complete; passable ground route verified',
          },
          {
            timestamp: tMinus(5),
            location: 'Zone C (Sector 3 - River Valley Relay)',
            coordinates: { lat: 34.0590, lng: -118.2490, altitude_m: 350 },
            battery: 65,
            signal_strength: 75,
            status: 'alive',
            activity: 'Airborne RF Relay',
            distance_from_prev_m: 530,
            note: 'High-altitude hovering relay bridging Squad 1 and Relief Camp',
          },
        ],
      },
    ],
    [
      'D',
      {
        id: 'D',
        name: 'Rescue Team 2',
        role: 'Field Squad Bravo',
        status: 'alive',
        battery: 88,
        signal_strength: 90,
        location: 'Zone D (Sector 5 - Urban Debris)',
        coordinates: { lat: 34.0410, lng: -118.2580, altitude_m: 175 },
        priority: 'critical',
        last_known_location: null,
        location_history: [
          {
            timestamp: tMinus(60),
            location: 'Zone F (Command Center HQ)',
            coordinates: { lat: 34.0370, lng: -118.2710, altitude_m: 210 },
            battery: 100,
            signal_strength: 100,
            status: 'alive',
            activity: 'Squad Briefing',
            distance_from_prev_m: 0,
            note: 'Squad Bravo assigned to Sector 5 collapsed structures',
          },
          {
            timestamp: tMinus(35),
            location: 'South Boulevard Intersection',
            coordinates: { lat: 34.0390, lng: -118.2620, altitude_m: 180 },
            battery: 93,
            signal_strength: 95,
            status: 'alive',
            activity: 'Path Clearing',
            distance_from_prev_m: 860,
            note: 'Removed fallen light pole blocking access road',
          },
          {
            timestamp: tMinus(15),
            location: 'Zone D (Sector 5 - Urban Debris)',
            coordinates: { lat: 34.0410, lng: -118.2580, altitude_m: 175 },
            battery: 88,
            signal_strength: 90,
            status: 'alive',
            activity: 'Ground Search',
            distance_from_prev_m: 430,
            note: 'Search dogs deployed; mesh telemetry pinging with Command Center',
          },
        ],
      },
    ],
    [
      'E',
      {
        id: 'E',
        name: 'Relief Camp',
        role: 'Logistics & Supply Base',
        status: 'alive',
        battery: 95,
        signal_strength: 97,
        location: 'Zone E (Sector 1 - Relief Base Camp)',
        coordinates: { lat: 34.0495, lng: -118.2670, altitude_m: 190 },
        priority: 'high',
        last_known_location: null,
        location_history: [
          {
            timestamp: tMinus(90),
            location: 'Sector 1 Peripheral Gate',
            coordinates: { lat: 34.0470, lng: -118.2690, altitude_m: 185 },
            battery: 99,
            signal_strength: 95,
            status: 'alive',
            activity: 'Convoy Arrival',
            distance_from_prev_m: 0,
            note: 'Forward supply convoy arrived with communications gear',
          },
          {
            timestamp: tMinus(40),
            location: 'Zone E (Sector 1 - Relief Base Camp)',
            coordinates: { lat: 34.0495, lng: -118.2670, altitude_m: 190 },
            battery: 95,
            signal_strength: 97,
            status: 'alive',
            activity: 'Base Hub Active',
            distance_from_prev_m: 340,
            note: 'Central logistics depot established; charging stations operational',
          },
        ],
      },
    ],
    [
      'F',
      {
        id: 'F',
        name: 'Command Center',
        role: 'Incident Operations HQ',
        status: 'alive',
        battery: 100,
        signal_strength: 100,
        location: 'Zone F (Sector 6 - Emergency Ops HQ)',
        coordinates: { lat: 34.0370, lng: -118.2710, altitude_m: 210 },
        priority: 'critical',
        last_known_location: null,
        location_history: [
          {
            timestamp: tMinus(120),
            location: 'Zone F (Sector 6 - Emergency Ops HQ)',
            coordinates: { lat: 34.0370, lng: -118.2710, altitude_m: 210 },
            battery: 100,
            signal_strength: 100,
            status: 'alive',
            activity: 'Incident Base Setup',
            distance_from_prev_m: 0,
            note: 'Emergency Operations Center established with generator power',
          },
        ],
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
