/**
 * DISASTER-RESILIENT EMERGENCY COMMUNICATION NETWORK
 * Client Application Engine & Dijkstra Shortest Path Visualizer
 */

const API_BASE = window.location.origin;

// State
let networkData = { nodes: [], edges: [] };
let networkInstance = null;
let currentRouteResult = null;
let currentMetric = 'composite';
let activeFilter = 'all';

// DOM Elements
const networkMapEl = document.getElementById('networkMap');
const connectionPill = document.getElementById('connectionPill');
const connectionText = document.getElementById('connectionText');

// HUD Elements
const healthScoreEl = document.getElementById('healthScore');
const healthBarFill = document.getElementById('healthBarFill');
const aliveCountEl = document.getElementById('aliveCount');
const degradedCountEl = document.getElementById('degradedCount');
const downCountEl = document.getElementById('downCount');
const backtrackCountEl = document.getElementById('backtrackCount');
const backtrackHudSubEl = document.getElementById('backtrackHudSub');
const activeLinksEl = document.getElementById('activeLinks');
const connectedStatusEl = document.getElementById('connectedStatus');
const hudRouteLatencyEl = document.getElementById('hudRouteLatency');
const hudHopCountEl = document.getElementById('hudHopCount');

// Overlay Elements
const overlayPathDisplay = document.getElementById('overlayPathDisplay');
const overlayMetaDisplay = document.getElementById('overlayMetaDisplay');

// Node Inspector Popup
const nodeInspector = document.getElementById('nodeInspector');
const inspNodeId = document.getElementById('inspNodeId');
const inspRole = document.getElementById('inspRole');
const inspStatus = document.getElementById('inspStatus');
const inspBattery = document.getElementById('inspBattery');
const inspSignal = document.getElementById('inspSignal');
const inspLocation = document.getElementById('inspLocation');
const inspCoords = document.getElementById('inspCoords');
const inspBacktrackBox = document.getElementById('inspBacktrackBox');
const inspSavedLocation = document.getElementById('inspSavedLocation');
const inspSavedCoords = document.getElementById('inspSavedCoords');
const inspSavedTime = document.getElementById('inspSavedTime');
const inspSavedStats = document.getElementById('inspSavedStats');
const inspSavedVector = document.getElementById('inspSavedVector');
const inspDispatchVectorBtn = document.getElementById('inspDispatchVectorBtn');
const inspViewTrailBtn = document.getElementById('inspViewTrailBtn');
const inspFailBtn = document.getElementById('inspFailBtn');
const inspDegradeBtn = document.getElementById('inspDegradeBtn');
const inspRestoreBtn = document.getElementById('inspRestoreBtn');
const closeInspectorBtn = document.getElementById('closeInspectorBtn');
let inspectedNodeId = null;
let showBacktrackVectors = true;
let backtrackingRegistry = {};

// Backtracking Registry & Modals Elements
const toggleBacktrackOverlayBtn = document.getElementById('toggleBacktrackOverlayBtn');
const backtrackHeaderTag = document.getElementById('backtrackHeaderTag');
const backtrackGlobalBadge = document.getElementById('backtrackGlobalBadge');
const backtrackRegistryList = document.getElementById('backtrackRegistryList');
const openTrailModalBtn = document.getElementById('openTrailModalBtn');
const openUpdatePosModalBtn = document.getElementById('openUpdatePosModalBtn');

const trailModal = document.getElementById('trailModal');
const closeTrailModalBtn = document.getElementById('closeTrailModalBtn');
const closeTrailModalFooterBtn = document.getElementById('closeTrailModalFooterBtn');
const trailNodeSelect = document.getElementById('trailNodeSelect');
const refreshTrailBtn = document.getElementById('refreshTrailBtn');
const trailSummaryCard = document.getElementById('trailSummaryCard');
const trailTimelineContainer = document.getElementById('trailTimelineContainer');

const updatePosModal = document.getElementById('updatePosModal');
const closeUpdatePosModalBtn = document.getElementById('closeUpdatePosModalBtn');
const updatePosForm = document.getElementById('updatePosForm');
const updatePosNodeSelect = document.getElementById('updatePosNodeSelect');
const updateLocationInput = document.getElementById('updateLocationInput');
const updateLatInput = document.getElementById('updateLatInput');
const updateLngInput = document.getElementById('updateLngInput');
const updateActivityInput = document.getElementById('updateActivityInput');
const updateNoteInput = document.getElementById('updateNoteInput');

// Rescue Member Movement Logs Elements
const movementMemberTabs = document.getElementById('movementMemberTabs');
const movementSummaryRibbon = document.getElementById('movementSummaryRibbon');
const movementTotalDistanceBadge = document.getElementById('movementTotalDistanceBadge');
const movementStopsList = document.getElementById('movementStopsList');
const quickLogMovementBtn = document.getElementById('quickLogMovementBtn');
let activeMovementNodeId = 'A';
let rescueMovementLogsData = null;

// Routing Controls
const routingMetricSelect = document.getElementById('routingMetricSelect');
const recalculateRouteBtn = document.getElementById('recalculateRouteBtn');
const routeHopsGrid = document.getElementById('routeHopsGrid');
const dijkstraTraceLog = document.getElementById('dijkstraTraceLog');

// Manual Topology Controls
const nodeSelect = document.getElementById('nodeSelect');
const linkSelect = document.getElementById('linkSelect');
const failNodeBtn = document.getElementById('failNodeBtn');
const degradeNodeBtn = document.getElementById('degradeNodeBtn');
const restoreNodeBtn = document.getElementById('restoreNodeBtn');
const toggleLinkBtn = document.getElementById('toggleLinkBtn');
const restoreLinkBtn = document.getElementById('restoreLinkBtn');
const resetNetBtn = document.getElementById('resetNetBtn');
const recenterBtn = document.getElementById('recenterBtn');

// Messaging Elements
const messageForm = document.getElementById('messageForm');
const senderSelect = document.getElementById('senderSelect');
const destinationSelect = document.getElementById('destinationSelect');
const prioritySelect = document.getElementById('prioritySelect');
const messageInput = document.getElementById('messageInput');
const messageResultEl = document.getElementById('messageResult');
const activePriorityBadge = document.getElementById('activePriorityBadge');
const ledgerList = document.getElementById('ledgerList');
const ledgerCount = document.getElementById('ledgerCount');

// Logs & Filters
const eventLogEl = document.getElementById('eventLog');
const clearLogsBtn = document.getElementById('clearLogsBtn');

// Modal Elements
const projectFlowModal = document.getElementById('projectFlowModal');
const projectFlowBtn = document.getElementById('projectFlowBtn');
const closeFlowModalBtn = document.getElementById('closeFlowModalBtn');
const closeFlowModalFooterBtn = document.getElementById('closeFlowModalFooterBtn');
const demoScenarioBtn = document.getElementById('demoScenarioBtn');

// Disaster Scenario Buttons
const btnDisasterFlood = document.getElementById('btnDisasterFlood');
const btnDisasterEarthquake = document.getElementById('btnDisasterEarthquake');
const btnDisasterCyclone = document.getElementById('btnDisasterCyclone');
const btnDisasterEmp = document.getElementById('btnDisasterEmp');

// HTTP Utility
async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    ...options,
  });
  if (!response.ok) {
    let errorMsg = 'Request failed';
    try {
      const err = await response.json();
      errorMsg = err.detail || err.message || errorMsg;
    } catch {
      errorMsg = await response.text();
    }
    throw new Error(errorMsg);
  }
  return response.json();
}

// WebSocket Connection Management
function setConnectionState(connected) {
  if (connected) {
    connectionPill.style.borderColor = 'var(--color-emerald)';
    connectionPill.style.color = 'var(--color-emerald)';
    connectionText.textContent = 'ONLINE (LIVE WS)';
  } else {
    connectionPill.style.borderColor = 'var(--color-red)';
    connectionPill.style.color = 'var(--color-red)';
    connectionText.textContent = 'CONNECTING...';
  }
}

function connectWebSocket() {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
  let socket;

  try {
    socket = new WebSocket(wsUrl);
  } catch (err) {
    setConnectionState(false);
    setTimeout(connectWebSocket, 3000);
    return;
  }

  socket.onopen = () => setConnectionState(true);

  socket.onclose = () => {
    setConnectionState(false);
    setTimeout(connectWebSocket, 2000);
  };

  socket.onerror = () => setConnectionState(false);

  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (!payload.nodes) return;
      networkData = { nodes: payload.nodes, edges: payload.edges };
      if (payload.backtracking) {
        backtrackingRegistry = payload.backtracking;
        renderBacktrackingRegistry(backtrackingRegistry);
      }
      if (payload.rescue_movement_logs) {
        rescueMovementLogsData = payload.rescue_movement_logs;
        renderRescueMovementLogs(rescueMovementLogsData);
      }
      updateStats({
        network_health: payload.network_health,
        alive: payload.alive_count ?? payload.nodes.filter((n) => n.status === 'alive').length,
        degraded: payload.degraded_count ?? payload.nodes.filter((n) => n.status === 'degraded').length,
        down: payload.down_count ?? payload.nodes.filter((n) => n.status === 'down').length,
        active_links: payload.active_links ?? payload.edges.filter((e) => e.active).length,
        connected: payload.connected ?? true,
        total_links: payload.edges.length,
        total_nodes: payload.nodes.length,
      });

      renderNetwork();
    } catch (err) {
      console.error('Error parsing WebSocket payload:', err);
    }
  };
}

// Stats & HUD Updates
function updateStats(summary) {
  const health = summary.network_health ?? 100;
  healthScoreEl.textContent = `${health}%`;
  healthBarFill.style.width = `${health}%`;

  if (health > 75) {
    healthScoreEl.className = 'hud-val health-good';
    healthBarFill.style.backgroundColor = 'var(--color-emerald)';
  } else if (health > 40) {
    healthScoreEl.className = 'hud-val text-amber';
    healthBarFill.style.backgroundColor = 'var(--color-amber)';
  } else {
    healthScoreEl.className = 'hud-val text-red';
    healthBarFill.style.backgroundColor = 'var(--color-red)';
  }

  aliveCountEl.textContent = `${summary.alive} / ${summary.total_nodes || 6}`;
  degradedCountEl.textContent = summary.degraded;
  downCountEl.textContent = summary.down;
  activeLinksEl.textContent = `${summary.active_links} / ${summary.total_links || 7}`;
  connectedStatusEl.textContent = summary.connected ? 'Mesh Partition: NONE' : 'Mesh Partition: DETECTED';
  connectedStatusEl.style.color = summary.connected ? 'var(--text-dim)' : 'var(--color-red)';
}

// Visual Styling for Nodes
function getNodeVisuals(node, isRouteNode) {
  if (node.status === 'down') {
    return {
      background: '#2b0d13',
      border: '#ef4444',
      size: 28,
      shadow: false,
    };
  }
  if (node.status === 'degraded') {
    return {
      background: isRouteNode ? '#854d0e' : '#451a03',
      border: '#f59e0b',
      size: isRouteNode ? 32 : 28,
      shadow: isRouteNode,
    };
  }
  // Alive
  return {
    background: isRouteNode ? '#064e3b' : '#042f2e',
    border: isRouteNode ? '#10b981' : '#0d9488',
    size: isRouteNode ? 34 : 28,
    shadow: isRouteNode,
  };
}

// Compute & Fetch Dijkstra Shortest Route
async function computeDijkstraRoute(source, destination, metric = currentMetric) {
  try {
    const data = await fetchJson(
      `${API_BASE}/network/routes?source=${encodeURIComponent(source)}&destination=${encodeURIComponent(
        destination
      )}&metric=${encodeURIComponent(metric)}`
    );
    currentRouteResult = data;
    renderDijkstraAnalysis(data);
    renderNetwork();
    return data;
  } catch (err) {
    console.error('Route calculation error:', err);
    currentRouteResult = {
      source,
      destination,
      route: [],
      hop_count: 0,
      route_status: 'unavailable',
      reason: err.message,
      total_latency_ms: 0,
      hops: [],
      dijkstra_steps: [],
    };
    renderDijkstraAnalysis(currentRouteResult);
    renderNetwork();
    return currentRouteResult;
  }
}

// Render Dijkstra Detailed Breakdown
function renderDijkstraAnalysis(result) {
  // Update HUD
  hudRouteLatencyEl.textContent = `${result.total_latency_ms || 0} ms`;
  hudHopCountEl.textContent = `${result.hop_count || 0} Hops (${result.metric_used || 'composite'})`;

  // Update Floating Overlay
  if (result.route_status === 'ok' && result.route.length > 0) {
    overlayPathDisplay.textContent = result.route.join(' ➔ ');
    overlayMetaDisplay.textContent = `Latency: ${result.total_latency_ms}ms | Hops: ${result.hop_count} | Cost: ${result.total_cost} | Bottleneck RF: ${result.bottleneck_signal}%`;
    overlayPathDisplay.style.color = '#10b981';
  } else {
    overlayPathDisplay.textContent = 'NO ROUTE AVAILABLE';
    overlayMetaDisplay.textContent = result.reason || 'Network severed';
    overlayPathDisplay.style.color = '#ef4444';
  }

  // Populate Hop Cards
  routeHopsGrid.innerHTML = '';
  if (!result.hops || result.hops.length === 0) {
    routeHopsGrid.innerHTML = `
      <div class="hop-card" style="grid-column: 1 / -1; border-color: var(--color-red); color: var(--color-red);">
        <strong>⚠️ No active transmission path</strong>
        <span style="font-size: 0.78rem; color: var(--text-muted);">${result.reason}</span>
      </div>`;
  } else {
    result.hops.forEach((hop, idx) => {
      const card = document.createElement('div');
      card.className = 'hop-card active-step';
      card.innerHTML = `
        <div class="hop-header">
          <span>HOP ${idx + 1} OF ${result.hops.length}</span>
          <span>${hop.latency_ms} ms</span>
        </div>
        <div class="hop-nodes">${hop.from} ➔ ${hop.to}</div>
        <div class="hop-stats">
          <span>Signal: ${hop.signal_strength}%</span>
          <span>Cost: ${hop.edge_cost}</span>
          <span>Σ Time: ${hop.cumulative_latency_ms}ms</span>
        </div>
      `;
      routeHopsGrid.appendChild(card);
    });
  }

  // Populate Dijkstra Relaxation Trace Table
  if (result.dijkstra_steps && result.dijkstra_steps.length > 0) {
    let tableHtml = `
      <table class="trace-table">
        <thead>
          <tr>
            <th>Step</th>
            <th>Extracted Min Vertex</th>
            <th>Dist From Src</th>
            <th>Evaluated Neighbors & Relaxations</th>
          </tr>
        </thead>
        <tbody>
    `;

    result.dijkstra_steps.forEach((step) => {
      const neighborText = step.relaxed_neighbors
        .map((n) => {
          const status = n.relaxed
            ? `<span class="trace-relaxed">Relaxed ${n.neighbor} (new: ${n.new_distance})</span>`
            : `Skipped ${n.neighbor} (${n.new_distance} ≥ current)`;
          return status;
        })
        .join('; ');

      tableHtml += `
        <tr>
          <td>#${step.step}</td>
          <td><strong>Node ${step.selected_node}</strong></td>
          <td>${step.distance_from_source}</td>
          <td>${neighborText || 'No unvisited neighbors'}</td>
        </tr>
      `;
    });

    tableHtml += '</tbody></table>';
    dijkstraTraceLog.innerHTML = tableHtml;
  } else {
    dijkstraTraceLog.innerHTML = '<p style="color: var(--text-muted);">No trace steps recorded.</p>';
  }
}

// Render Graph using Vis.js
function renderNetwork() {
  if (!networkData.nodes || networkData.nodes.length === 0) return;

  const currentRoute = currentRouteResult?.route || [];
  const routeEdgeSet = new Set();

  for (let i = 0; i < currentRoute.length - 1; i++) {
    const u = currentRoute[i];
    const v = currentRoute[i + 1];
    routeEdgeSet.add(`${u}-${v}`);
    routeEdgeSet.add(`${v}-${u}`);
  }

  // Nodes format for Vis.js
  const visNodes = networkData.nodes.map((node) => {
    const isRouteNode = currentRoute.includes(node.id);
    const visuals = getNodeVisuals(node, isRouteNode);
    const isDown = node.status === 'down';
    const lastLoc = node.last_known_location;

    let labelText = `${node.id}\n${node.name.split(' ')[0]}`;
    if (isDown) {
      const locTag = lastLoc?.location ? lastLoc.location.split('(')[0].trim() : (node.location ? node.location.split('(')[0].trim() : 'Field Sector');
      labelText = `⚠️ ${node.id} [LOST]\n📍 ${locTag}`;
    }

    let tooltip = `Node ${node.id} (${node.name})\nRole: ${node.role}\nStatus: ${node.status.toUpperCase()}\nBattery: ${node.battery}%\nSignal: ${node.signal_strength}%\nLocation: ${node.location}`;
    if (isDown && lastLoc) {
      const v = lastLoc?.backtrack_search_vector;
      const recTime = lastLoc?.recorded_at || lastLoc?.timestamp || 'Recent';
      tooltip = `🚨 OFFLINE BEACON: Node ${node.id} (${node.name})\nStatus: DOWN / ISOLATED\n📍 LAST SAVED LOCATION: ${lastLoc?.location || node.location}\nGPS: ${lastLoc?.coordinates?.lat?.toFixed(4) || 0}°N, ${lastLoc?.coordinates?.lng?.toFixed(4) || 0}°W (Alt: ${lastLoc?.coordinates?.altitude_m || 0}m)\nCutoff Battery: ${lastLoc?.battery_at_cutoff ?? 0}%\nSignal: ${lastLoc?.signal_at_cutoff ?? 0}%\nRecorded: ${recTime}\n` +
        (v ? `Rescue Vector: from Node ${v.nearest_active_node_id} (${v.distance_meters}m @ ${v.bearing_degrees}°, ~${v.estimated_reach_time_mins} min)` : 'Vector: calculating...');
    }

    return {
      id: node.id,
      label: labelText,
      title: tooltip,
      color: {
        background: visuals.background,
        border: visuals.border,
        highlight: {
          background: '#0284c7',
          border: '#38bdf8',
        },
      },
      borderWidth: isDown ? 3 : (isRouteNode ? 3 : 2),
      shape: 'box',
      shapeProperties: { borderRadius: 8 },
      font: {
        color: isDown ? '#fca5a5' : '#f8fafc',
        face: 'ui-monospace, monospace',
        size: isDown ? 12 : 13,
        bold: true,
      },
      margin: 10,
      shadow: visuals.shadow
        ? { enabled: true, color: 'rgba(6, 182, 212, 0.4)', size: 12, x: 0, y: 0 }
        : false,
    };
  });

  // Edges format for Vis.js
  const visEdges = networkData.edges.map((edge) => {
    const isRouteEdge = routeEdgeSet.has(`${edge.source}-${edge.target}`);
    const isLinkActive = edge.active;

    let edgeColor = '#334155';
    let edgeWidth = 1.5;
    let dashes = false;

    if (!isLinkActive) {
      edgeColor = '#ef4444';
      edgeWidth = 1;
      dashes = [5, 5];
    } else if (isRouteEdge) {
      edgeColor = '#06b6d4';
      edgeWidth = 4.5;
      dashes = false;
    } else {
      edgeColor = '#475569';
      edgeWidth = 2;
    }

    return {
      id: `${edge.source}-${edge.target}`,
      from: edge.source,
      to: edge.target,
      label: `${edge.latency}ms | ${edge.signal_strength}%`,
      font: {
        color: isRouteEdge ? '#67e8f9' : '#94a3b8',
        size: 11,
        face: 'ui-monospace, monospace',
        strokeWidth: 2,
        strokeColor: '#090d14',
      },
      color: {
        color: edgeColor,
        highlight: '#38bdf8',
      },
      width: edgeWidth,
      dashes,
      arrows: isRouteEdge
        ? {
            to: {
              enabled: true,
              scaleFactor: 0.8,
            },
          }
        : undefined,
      smooth: { type: 'continuous', roundness: 0.2 },
    };
  });

  // Render Rescue Backtrack Vectors if enabled
  if (showBacktrackVectors) {
    networkData.nodes.forEach((node) => {
      if (node.status === 'down' && node.last_known_location?.backtrack_search_vector) {
        const v = node.last_known_location.backtrack_search_vector;
        visEdges.push({
          id: `backtrack-${v.nearest_active_node_id}-${node.id}`,
          from: v.nearest_active_node_id,
          to: node.id,
          label: `🚨 SEARCH VECTOR (${v.distance_meters}m, ${v.bearing_degrees}°)`,
          font: {
            color: '#fbbf24',
            size: 11,
            face: 'ui-monospace, monospace',
            strokeWidth: 2,
            strokeColor: '#451a03',
          },
          color: {
            color: '#f59e0b',
            highlight: '#fbbf24',
          },
          width: 3,
          dashes: [6, 4],
          arrows: {
            to: {
              enabled: true,
              scaleFactor: 1.0,
            },
          },
          smooth: { type: 'curvedCW', roundness: 0.25 },
        });
      }
    });
  }

  if (networkInstance) {
    networkInstance.setData({ nodes: visNodes, edges: visEdges });
    return;
  }

  const options = {
    physics: {
      enabled: true,
      solver: 'forceAtlas2Based',
      forceAtlas2Based: {
        gravitationalConstant: -70,
        centralGravity: 0.015,
        springLength: 120,
        springConstant: 0.09,
      },
      stabilization: { iterations: 150 },
    },
    interaction: {
      hover: true,
      tooltipDelay: 100,
      zoomView: true,
      dragView: true,
    },
    layout: { improvedLayout: true },
  };

  networkInstance = new vis.Network(networkMapEl, { nodes: visNodes, edges: visEdges }, options);

  // Click on Node opens Inspector & updates selection
  networkInstance.on('click', (params) => {
    if (params.nodes.length > 0) {
      const nodeId = params.nodes[0];
      showNodeInspector(nodeId);
      nodeSelect.value = nodeId;
    } else if (params.edges.length > 0) {
      const edgeId = params.edges[0];
      const parts = edgeId.split('-');
      if (parts.length === 2) {
        linkSelect.value = `${parts[0]}-${parts[1]}`;
      }
    }
  });
}

// Show Node Inspector
function showNodeInspector(nodeId) {
  const node = networkData.nodes.find((n) => n.id === nodeId);
  if (!node) return;

  inspectedNodeId = nodeId;
  inspNodeId.textContent = `NODE ${node.id} (${node.name})`;
  inspRole.textContent = node.role;
  inspStatus.textContent = node.status.toUpperCase();
  inspStatus.style.color =
    node.status === 'alive'
      ? 'var(--color-emerald)'
      : node.status === 'degraded'
      ? 'var(--color-amber)'
      : 'var(--color-red)';
  inspBattery.textContent = `${node.battery}%`;
  inspSignal.textContent = `${node.signal_strength}%`;
  inspLocation.textContent = node.location;
  if (inspCoords) {
    inspCoords.textContent = node.coordinates
      ? `${node.coordinates.lat.toFixed(4)}° N, ${node.coordinates.lng.toFixed(4)}° W`
      : 'N/A';
  }

  // Handle Last Saved Location & Backtracking Telemetry Box
  if (inspBacktrackBox) {
    if (node.status === 'down' || node.last_known_location) {
      const lastLoc = node.last_known_location;
      if (lastLoc) {
        inspBacktrackBox.classList.remove('hidden');
        inspSavedLocation.textContent = lastLoc?.location || node.location || 'Unknown Field Position';
        inspSavedCoords.textContent = `${lastLoc?.coordinates?.lat?.toFixed(4) || 0}° N, ${lastLoc?.coordinates?.lng?.toFixed(4) || 0}° W (Alt: ${lastLoc?.coordinates?.altitude_m || 0}m)`;
        const recTimeStr = lastLoc?.recorded_at
          ? (isNaN(new Date(lastLoc.recorded_at).getTime()) ? String(lastLoc.recorded_at) : new Date(lastLoc.recorded_at).toLocaleTimeString())
          : (lastLoc?.timestamp ? new Date(lastLoc.timestamp).toLocaleTimeString() : 'Recent');
        inspSavedTime.textContent = `${recTimeStr} [${lastLoc?.dispatch_status || 'LOST'}]`;
        inspSavedStats.textContent = `Battery: ${lastLoc?.battery_at_cutoff ?? 0}% | Signal: ${lastLoc?.signal_at_cutoff ?? 0}%`;

        const v = lastLoc?.backtrack_search_vector;
        if (v) {
          inspSavedVector.textContent = `Deploy from Node ${v.nearest_active_node_id} (${v.distance_meters}m @ ${v.bearing_degrees}° ${v.cardinal_direction || ''}, ~${v.estimated_reach_time_mins} min)`;
        } else {
          inspSavedVector.textContent = 'Calculating search corridor from surviving units...';
        }
      } else {
        inspBacktrackBox.classList.add('hidden');
      }
    } else {
      inspBacktrackBox.classList.add('hidden');
    }
  }

  nodeInspector.classList.remove('hidden');
}

closeInspectorBtn.addEventListener('click', () => {
  nodeInspector.classList.add('hidden');
});

// Inspector Actions
inspFailBtn.addEventListener('click', async () => {
  if (!inspectedNodeId) return;
  await failNodeAction(inspectedNodeId);
  showNodeInspector(inspectedNodeId);
});

inspDegradeBtn.addEventListener('click', async () => {
  if (!inspectedNodeId) return;
  await degradeNodeAction(inspectedNodeId);
  showNodeInspector(inspectedNodeId);
});

inspRestoreBtn.addEventListener('click', async () => {
  if (!inspectedNodeId) return;
  await restoreNodeAction(inspectedNodeId);
  showNodeInspector(inspectedNodeId);
});

inspDispatchVectorBtn.addEventListener('click', async () => {
  if (!inspectedNodeId) return;
  await dispatchRescueBacktrackAction(inspectedNodeId);
  showNodeInspector(inspectedNodeId);
});

inspViewTrailBtn.addEventListener('click', async () => {
  if (!inspectedNodeId) return;
  trailNodeSelect.value = inspectedNodeId;
  await loadNodeTrail(inspectedNodeId);
  trailModal.classList.remove('hidden');
});

// Event Logging System
function addEventToLog(event) {
  const li = document.createElement('li');
  const severity = (event.severity || 'low').toLowerCase();
  li.className = `severity-${severity}`;

  const time = event.timestamp
    ? new Date(event.timestamp).toLocaleTimeString()
    : new Date().toLocaleTimeString();

  li.innerHTML = `
    <div class="event-header">
      <strong>${event.event_type}</strong>
      <span>${time}</span>
    </div>
    <div class="event-msg">${event.message}</div>
  `;

  eventLogEl.prepend(li);
  while (eventLogEl.children.length > 50) {
    eventLogEl.removeChild(eventLogEl.lastChild);
  }
}

async function refreshEvents() {
  try {
    const data = await fetchJson(`${API_BASE}/events`);
    if (data.events) {
      eventLogEl.innerHTML = '';
      data.events.forEach(addEventToLog);
    }
  } catch (err) {
    console.warn('Failed to load events:', err);
  }
}

// ==========================================================================
// BACKTRACKING & LAST SAVED LOCATION CONTROLS
// ==========================================================================

function renderBacktrackingRegistry(registry = {}) {
  let offlineNodesList = [];
  if (Array.isArray(registry)) {
    offlineNodesList = registry;
  } else if (registry && Array.isArray(registry.offline_nodes)) {
    offlineNodesList = registry.offline_nodes;
  } else if (registry && registry.offline_nodes_map && typeof registry.offline_nodes_map === 'object') {
    offlineNodesList = Object.values(registry.offline_nodes_map);
  } else if (registry && typeof registry === 'object') {
    offlineNodesList = Object.keys(registry)
      .filter((k) => k !== 'offline_count' && k !== 'active_count' && k !== 'all_nodes_locations' && k !== 'offline_nodes' && k !== 'offline_nodes_map')
      .map((k) => registry[k])
      .filter((n) => n && typeof n === 'object' && (n.status === 'down' || n.current_status === 'down' || n.last_known_location));
  }

  // Also include any nodes that are currently down in networkData.nodes if not already present
  if (networkData && Array.isArray(networkData.nodes)) {
    networkData.nodes.forEach((n) => {
      if (n.status === 'down' && !offlineNodesList.some((item) => (item.id || item.node_id) === n.id)) {
        offlineNodesList.push({
          id: n.id,
          name: n.name,
          role: n.role,
          current_status: 'down',
          last_known_location: n.last_known_location,
        });
      }
    });
  }

  const count = offlineNodesList.length;

  if (backtrackCountEl) {
    if (count === 0) {
      backtrackCountEl.textContent = '0 BEACONS';
      backtrackCountEl.className = 'hud-val text-emerald';
      if (backtrackHudSubEl) backtrackHudSubEl.textContent = 'All Nodes Online';
      if (backtrackGlobalBadge) {
        backtrackGlobalBadge.className = 'badge-beacon standby';
        backtrackGlobalBadge.textContent = 'ALL UNITS ONLINE';
      }
    } else {
      backtrackCountEl.textContent = `${count} BEACON${count > 1 ? 'S' : ''}`;
      backtrackCountEl.className = 'hud-val text-red';
      if (backtrackHudSubEl) backtrackHudSubEl.textContent = 'Active Search Vectors';
      if (backtrackGlobalBadge) {
        backtrackGlobalBadge.className = 'badge-beacon active';
        backtrackGlobalBadge.textContent = `${count} UNIT${count > 1 ? 'S' : ''} LOST`;
      }
    }
  }

  if (!backtrackRegistryList) return;
  backtrackRegistryList.innerHTML = '';

  if (count === 0) {
    backtrackRegistryList.innerHTML = `
      <div class="empty-backtrack-state" id="emptyBacktrackState">
        <span class="empty-icon">🛰️</span>
        <span>All 6 nodes actively heartbeating. Telemetry breadcrumb buffers synchronized.</span>
      </div>
    `;
    return;
  }

  offlineNodesList.forEach((data) => {
    if (!data || typeof data !== 'object') return;
    const nodeId = data.id || data.node_id;
    if (!nodeId) return;

    const nodeRef = networkData?.nodes?.find((n) => n.id === nodeId);
    const nodeName = data.name || nodeRef?.name || `Squad ${nodeId}`;

    const lastLoc = data.last_known_location || nodeRef?.last_known_location || {
      location: data.location || nodeRef?.location || 'Unknown Field Position',
      coordinates: data.coordinates || nodeRef?.coordinates || { lat: 34.0522, lng: -118.2437, altitude_m: 0 },
      recorded_at: null,
      timestamp: null,
      battery_at_cutoff: data.battery ?? nodeRef?.battery ?? 0,
      signal_at_cutoff: data.signal_strength ?? nodeRef?.signal_strength ?? 0,
      dispatch_status: 'SEARCHING',
      route_taken: [data.location || nodeRef?.location || 'Base Station Depot'],
      total_patrol_distance_m: 0,
      activity: 'Field Transit',
    };

    const vector = data?.backtrack_search_vector || lastLoc?.backtrack_search_vector;

    let recordedTime = 'Just now';
    if (lastLoc?.recorded_at) {
      recordedTime = isNaN(new Date(lastLoc.recorded_at).getTime())
        ? String(lastLoc.recorded_at)
        : new Date(lastLoc.recorded_at).toLocaleTimeString();
    } else if (lastLoc?.timestamp) {
      recordedTime = isNaN(new Date(lastLoc.timestamp).getTime())
        ? String(lastLoc.timestamp)
        : new Date(lastLoc.timestamp).toLocaleTimeString();
    }

    const card = document.createElement('div');
    card.className = 'backtrack-unit-card';

    let vectorHtml = '';
    if (vector) {
      vectorHtml = `
        <div class="unit-vector-box">
          ⚡ <strong>Backtrack Vector:</strong> Deploy from <strong>Node ${vector.nearest_active_node_id}</strong> (${vector.distance_meters}m @ ${vector.bearing_degrees}° ${vector.cardinal_direction || ''}, ~${vector.estimated_reach_time_mins} min ETA)
        </div>
      `;
    } else {
      vectorHtml = `
        <div class="unit-vector-box">
          ⚡ <strong>Backtrack Vector:</strong> All neighbor units severed. Awaiting external drone beacon.
        </div>
      `;
    }

    const routeText = lastLoc?.route_taken && lastLoc.route_taken.length > 0
      ? lastLoc.route_taken.join(' ➔ ')
      : 'Base Station Depot';

    const distText = lastLoc?.total_patrol_distance_m
      ? (lastLoc.total_patrol_distance_m >= 1000
          ? `${(lastLoc.total_patrol_distance_m / 1000).toFixed(2)} km`
          : `${lastLoc.total_patrol_distance_m} m`)
      : 'N/A';

    card.innerHTML = `
      <div class="unit-card-header">
        <span class="unit-id-badge">
          <span class="pulse-beacon-dot"></span>
          NODE ${nodeId} (${nodeName})
        </span>
        <span class="unit-time-tag">Signal Cutoff at ${recordedTime}</span>
      </div>
      <div class="unit-card-body">
        <div class="unit-loc-row">📍 <strong>Last Saved Location:</strong> ${lastLoc?.location || 'Field Sector'}</div>
        <div class="unit-coords-row">GPS: ${lastLoc?.coordinates?.lat?.toFixed(4) || 0}°N, ${lastLoc?.coordinates?.lng?.toFixed(4) || 0}°W (Alt: ${lastLoc?.coordinates?.altitude_m || 0}m)</div>
        <div style="font-size: 0.76rem; color: #67e8f9; margin-top: 2px;">
          🗺️ <strong>Patrol Route ("Where They Went"):</strong> ${routeText} [LOST]
        </div>
        <div style="font-size: 0.72rem; color: #94a3b8; display: flex; justify-content: space-between; margin-top: 2px;">
          <span>Activity at Cutoff: <strong>${lastLoc?.activity || lastLoc?.last_activity || 'Field Transit'}</strong></span>
          <span>Total Traversed: <strong style="color: #38bdf8;">${distText}</strong></span>
        </div>
        <div style="font-size: 0.72rem; color: #94a3b8;">Cutoff Battery: ${lastLoc?.battery_at_cutoff ?? 0}% | Signal: ${lastLoc?.signal_at_cutoff ?? 0}% | Dispatch: ${lastLoc?.dispatch_status || 'PENDING'}</div>
        ${vectorHtml}
      </div>
      <div class="unit-card-actions">
        <button class="neo-btn-sm danger full-width" onclick="dispatchRescueBacktrackAction('${nodeId}')">
          🚨 Dispatch Search
        </button>
        <button class="neo-btn-sm" onclick="selectRescueMovementMember('${nodeId}')" title="Audit this squad's full patrol itinerary">
          Patrol Log
        </button>
        <button class="neo-btn-sm" onclick="showNodeInspector('${nodeId}'); if (networkInstance) networkInstance.focus('${nodeId}', { scale: 1.2, animation: true });">
          Inspect
        </button>
      </div>
    `;

    backtrackRegistryList.appendChild(card);
  });
}

// Make dispatchRescueBacktrackAction globally accessible
window.dispatchRescueBacktrackAction = async function(nodeId) {
  try {
    const res = await fetchJson(`${API_BASE}/network/node/${encodeURIComponent(nodeId)}/backtrack/dispatch`, {
      method: 'POST',
    });
    messageResultEl.className = 'dispatch-result-box success';
    messageResultEl.innerHTML = `
      <span>🚨 <strong>SEARCH & RESCUE DISPATCHED:</strong> ${res.dispatch_report?.summary || res.message}</span>
    `;

    if (networkInstance) {
      networkInstance.focus(nodeId, {
        scale: 1.3,
        animation: { duration: 800, easingFunction: 'easeInOutQuad' },
      });
    }

    await refreshState();
    await refreshEvents();
  } catch (err) {
    messageResultEl.className = 'dispatch-result-box failed';
    messageResultEl.textContent = `Rescue dispatch error: ${err.message}`;
  }
};

// Select Rescue Movement Member & Scroll
window.selectRescueMovementMember = function(nodeId) {
  activeMovementNodeId = nodeId;
  renderRescueMovementLogs(rescueMovementLogsData);
  const movementCard = document.getElementById('movementCard');
  if (movementCard) {
    movementCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
};

// Render Rescue Member Movement Logs ("Where They Went")
function renderRescueMovementLogs(logsData) {
  if (!logsData || !logsData.rescue_movement_logs) return;
  const logs = logsData.rescue_movement_logs;
  const currentMember = logs[activeMovementNodeId];

  // Update tabs active state
  if (movementMemberTabs) {
    Array.from(movementMemberTabs.children).forEach((btn) => {
      const nId = btn.getAttribute('data-node');
      btn.classList.toggle('active', nId === activeMovementNodeId);
      const nodeObj = networkData.nodes.find((n) => n.id === nId);
      if (nodeObj && nodeObj.status === 'down') {
        btn.style.color = '#ef4444';
      } else {
        btn.style.color = '';
      }
    });
  }

  if (!currentMember) return;

  // Update Summary Ribbon
  if (movementSummaryRibbon) {
    const isDown = currentMember.status === 'down';
    const statusColor = isDown
      ? 'var(--color-red)'
      : currentMember.status === 'degraded'
      ? 'var(--color-amber)'
      : 'var(--color-emerald)';
    const statusText = isDown
      ? '🚨 CONTACT LOST (BACKTRACKING ACTIVE)'
      : currentMember.status === 'degraded'
      ? '⚠️ DEGRADED LINK'
      : '✅ ONLINE & PATROLLING';

    movementSummaryRibbon.innerHTML = `
      <div class="summary-stat-box">
        <span class="summary-stat-label">Rescue Member</span>
        <span class="summary-stat-val" style="color: var(--color-cyan);">Node ${currentMember.node_id} - ${currentMember.name}</span>
      </div>
      <div class="summary-stat-box">
        <span class="summary-stat-label">Tactical Role</span>
        <span class="summary-stat-val">${currentMember.role}</span>
      </div>
      <div class="summary-stat-box">
        <span class="summary-stat-label">Radio Status</span>
        <span class="summary-stat-val" style="color: ${statusColor};">${statusText}</span>
      </div>
      <div class="summary-stat-box">
        <span class="summary-stat-label">Total Patrol Traversed</span>
        <span class="summary-stat-val" style="color: #38bdf8;">${currentMember.total_patrol_distance_formatted || (currentMember.total_patrol_distance_m + ' m')}</span>
      </div>
      <div class="summary-stat-box">
        <span class="summary-stat-label">Waypoints Logged</span>
        <span class="summary-stat-val">${currentMember.waypoints_count} Stops</span>
      </div>
      <div class="summary-stat-box">
        <span class="summary-stat-label">Power & Signal</span>
        <span class="summary-stat-val">🔋 ${currentMember.battery}% | 📶 ${currentMember.signal_strength}%</span>
      </div>
    `;
  }

  // Update total badge
  if (movementTotalDistanceBadge) {
    movementTotalDistanceBadge.textContent = `Total Patrol: ${currentMember.total_patrol_distance_formatted || (currentMember.total_patrol_distance_m + ' m')}`;
  }

  // Update Stops List ("Where They Went")
  if (movementStopsList) {
    movementStopsList.innerHTML = '';
    const history = currentMember.location_history || [];

    if (history.length === 0) {
      movementStopsList.innerHTML = `
        <div style="color: var(--text-muted); font-size: 0.8rem; padding: 16px; text-align: center;">
          No patrol stops logged yet for ${currentMember.name}. Use "+ Log Waypoint" to record their movement.
        </div>
      `;
      return;
    }

    // Display in reverse chronological order (latest stop on top)
    const reversedHistory = history.slice().reverse();
    reversedHistory.forEach((stop, index) => {
      const isLatest = index === 0;
      const isDownStop = isLatest && currentMember.status === 'down';
      const stopCard = document.createElement('div');
      stopCard.className = `patrol-stop-card ${isLatest ? 'latest-stop' : ''} ${isDownStop ? 'severed-stop' : ''}`;

      const stopIdx = history.length - index;
      const timeStr = stop.timestamp ? new Date(stop.timestamp).toLocaleTimeString() : `Stop #${stopIdx}`;
      const distFromPrev = stop.distance_from_prev_m
        ? `+${stop.distance_from_prev_m >= 1000 ? (stop.distance_from_prev_m / 1000).toFixed(2) + ' km' : stop.distance_from_prev_m + ' m'}`
        : 'Starting Depot';

      stopCard.innerHTML = `
        <div class="stop-top-row">
          <span class="stop-num-tag">
            ${isDownStop ? '🚨 LAST SAVED LOCATION (CUTOFF POINT)' : isLatest ? '🟢 CURRENT LOCATION (ACTIVE)' : `STOP #${stopIdx}`}
          </span>
          <div style="display: flex; gap: 8px; align-items: center;">
            <span class="stop-activity-badge">${stop.activity || 'Field Movement'}</span>
            <span class="stop-time-tag">${timeStr}</span>
          </div>
        </div>
        <div class="stop-location-name">
          <span>📍</span>
          <strong>${stop.location}</strong>
        </div>
        <div class="stop-coords-row">
          <span>GPS: ${stop.coordinates?.lat?.toFixed(4)}°N, ${stop.coordinates?.lng?.toFixed(4)}°W (Alt: ${stop.coordinates?.altitude_m || 0}m)</span>
          <span class="stop-distance-gain">Leg Distance: ${distFromPrev}</span>
        </div>
        ${stop.note ? `<div class="stop-notes">"${stop.note}"</div>` : ''}
        <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--text-dim); margin-top: 2px;">
          <span>Node Telemetry at Stop: Battery ${stop.battery}% | RF ${stop.signal_strength}%</span>
          <span style="color: ${stop.status === 'down' ? 'var(--color-red)' : 'var(--color-emerald)'}">${stop.status.toUpperCase()}</span>
        </div>
      `;

      movementStopsList.appendChild(stopCard);
    });
  }
}

async function loadNodeTrail(nodeId) {
  try {
    const data = await fetchJson(`${API_BASE}/network/node/${encodeURIComponent(nodeId)}/breadcrumbs`);
    const crumbs = data.breadcrumbs || [];

    trailSummaryCard.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <strong>Node ${nodeId} Telemetry Trail</strong>
        <span class="priority-pill normal">${crumbs.length} Logged Breadcrumbs</span>
      </div>
      <div>Current Status: <strong>${data.last_known_location ? 'OFFLINE (FROZEN SNAPSHOT)' : 'ONLINE'}</strong></div>
      <div>Last Recorded Location: <strong>${data.last_known_location ? data.last_known_location.location : (crumbs[crumbs.length - 1]?.location || 'N/A')}</strong></div>
    `;

    trailTimelineContainer.innerHTML = '';
    if (crumbs.length === 0) {
      trailTimelineContainer.innerHTML = '<div style="color: var(--text-muted); padding: 12px;">No historical telemetry breadcrumbs recorded yet.</div>';
      return;
    }

    // Display in reverse chronological order
    crumbs.slice().reverse().forEach((crumb, idx) => {
      const entry = document.createElement('div');
      entry.className = 'timeline-entry';
      const timeStr = crumb.timestamp ? new Date(crumb.timestamp).toLocaleTimeString() : `Ping -${idx}`;
      const isCutoff = crumb.status === 'down';
      const legDist = crumb.distance_from_prev_m
        ? `+${crumb.distance_from_prev_m >= 1000 ? (crumb.distance_from_prev_m / 1000).toFixed(2) + ' km' : crumb.distance_from_prev_m + ' m'}`
        : '';

      entry.innerHTML = `
        <div class="timeline-dot ${isCutoff ? 'down' : ''}"></div>
        <div class="timeline-header">
          <span>${timeStr} ${crumb.activity ? `[${crumb.activity}]` : ''}</span>
          <span style="color: ${isCutoff ? 'var(--color-red)' : 'var(--color-emerald)'}">${crumb.status.toUpperCase()}</span>
        </div>
        <div class="timeline-loc">${crumb.location}</div>
        <div class="timeline-meta">
          GPS: ${crumb.coordinates?.lat?.toFixed(4)}°N, ${crumb.coordinates?.lng?.toFixed(4)}°W | Batt: ${crumb.battery}% | Sig: ${crumb.signal_strength}%
          ${legDist ? ` | Leg: <span style="color: #38bdf8;">${legDist}</span>` : ''}
        </div>
        ${crumb.note ? `<div class="timeline-note">${crumb.note}</div>` : ''}
      `;
      trailTimelineContainer.appendChild(entry);
    });
  } catch (err) {
    trailTimelineContainer.innerHTML = `<div class="text-red">Error loading trail: ${err.message}</div>`;
  }
}

async function handleLocationUpdate(event) {
  event.preventDefault();
  const nodeId = updatePosNodeSelect.value;
  const location = updateLocationInput.value.trim();
  const lat = parseFloat(updateLatInput.value);
  const lng = parseFloat(updateLngInput.value);
  const activity = updateActivityInput?.value?.trim() || 'Patrol Waypoint';
  const note = updateNoteInput?.value?.trim() || '';

  if (!location || isNaN(lat) || isNaN(lng)) {
    return;
  }

  try {
    const res = await fetchJson(`${API_BASE}/network/node/${encodeURIComponent(nodeId)}/location`, {
      method: 'POST',
      body: JSON.stringify({
        location,
        coordinates: { lat, lng },
        activity,
        note,
      }),
    });

    updatePosModal.classList.add('hidden');
    messageResultEl.className = 'dispatch-result-box success';
    messageResultEl.textContent = `LOCATION UPDATED: Node ${nodeId} moved to "${location}" (${lat.toFixed(4)}, ${lng.toFixed(4)}). Activity: ${activity}.`;

    await refreshState();
    await refreshEvents();
  } catch (err) {
    alert(`Failed to update location: ${err.message}`);
  }
}

// State Synchronization
async function refreshState() {
  try {
    const statusData = await fetchJson(`${API_BASE}/network/status`);
    updateStats(statusData);

    const netData = await fetchJson(`${API_BASE}/network`);
    networkData = netData;

    try {
      const btData = await fetchJson(`${API_BASE}/network/backtracking`);
      backtrackingRegistry = btData.backtracking || {};
      renderBacktrackingRegistry(backtrackingRegistry);
    } catch (e) {
      console.warn('Backtracking sync warning:', e);
    }

    try {
      const logsData = await fetchJson(`${API_BASE}/network/rescue-movement-logs`);
      rescueMovementLogsData = logsData;
      renderRescueMovementLogs(rescueMovementLogsData);
    } catch (e) {
      console.warn('Movement logs sync warning:', e);
    }

    await computeDijkstraRoute(senderSelect.value, destinationSelect.value, currentMetric);
  } catch (err) {
    console.error('Failed to sync network state:', err);
  }
}

// Topology Modification Actions
async function failNodeAction(nodeId = nodeSelect.value) {
  try {
    const res = await fetchJson(`${API_BASE}/network/node/${encodeURIComponent(nodeId)}/fail`, {
      method: 'POST',
    });
    messageResultEl.className = 'dispatch-result-box failed';
    messageResultEl.textContent = `NODE FAILURE: Node ${nodeId} knocked offline. Dijkstra rerouting...`;
    await refreshState();
    await refreshEvents();
  } catch (err) {
    messageResultEl.textContent = `Error: ${err.message}`;
  }
}

async function degradeNodeAction(nodeId = nodeSelect.value) {
  try {
    await fetchJson(`${API_BASE}/network/node/${encodeURIComponent(nodeId)}/degrade`, {
      method: 'POST',
    });
    messageResultEl.className = 'dispatch-result-box';
    messageResultEl.textContent = `NODE DEGRADED: Node ${nodeId} low power / noisy RF.`;
    await refreshState();
    await refreshEvents();
  } catch (err) {
    messageResultEl.textContent = `Error: ${err.message}`;
  }
}

async function restoreNodeAction(nodeId = nodeSelect.value) {
  try {
    await fetchJson(`${API_BASE}/network/node/${encodeURIComponent(nodeId)}/restore`, {
      method: 'POST',
    });
    messageResultEl.className = 'dispatch-result-box success';
    messageResultEl.textContent = `NODE RESTORED: Node ${nodeId} online & re-converged.`;
    await refreshState();
    await refreshEvents();
  } catch (err) {
    messageResultEl.textContent = `Error: ${err.message}`;
  }
}

async function toggleLinkAction() {
  const linkVal = linkSelect.value;
  const [src, tgt] = linkVal.split('-');
  try {
    const res = await fetchJson(`${API_BASE}/network/link/toggle`, {
      method: 'POST',
      body: JSON.stringify({ source: src, target: tgt }),
    });
    messageResultEl.className = 'dispatch-result-box';
    messageResultEl.textContent = res.message;
    await refreshState();
    await refreshEvents();
  } catch (err) {
    messageResultEl.textContent = `Error: ${err.message}`;
  }
}

async function restoreLinkAction() {
  const linkVal = linkSelect.value;
  const [src, tgt] = linkVal.split('-');
  try {
    const res = await fetchJson(`${API_BASE}/network/link/${src}/${tgt}/restore`, {
      method: 'POST',
    });
    messageResultEl.className = 'dispatch-result-box success';
    messageResultEl.textContent = res.message;
    await refreshState();
    await refreshEvents();
  } catch (err) {
    messageResultEl.textContent = `Error: ${err.message}`;
  }
}

async function resetNetworkAction() {
  try {
    const res = await fetchJson(`${API_BASE}/network/reset`, { method: 'POST' });
    messageResultEl.className = 'dispatch-result-box success';
    messageResultEl.textContent = res.message;
    await refreshState();
    await refreshEvents();
  } catch (err) {
    messageResultEl.textContent = `Error: ${err.message}`;
  }
}

// Disaster Scenario Handler
async function triggerDisasterScenario(scenario) {
  try {
    const res = await fetchJson(`${API_BASE}/network/disaster`, {
      method: 'POST',
      body: JSON.stringify({ scenario }),
    });
    messageResultEl.className = 'dispatch-result-box failed';
    messageResultEl.textContent = `DISASTER SIMULATION: ${res.report.title} — ${res.report.description}`;
    await refreshState();
    await refreshEvents();
  } catch (err) {
    messageResultEl.textContent = `Error: ${err.message}`;
  }
}

// Emergency Messaging Dispatch
async function handleDispatch(event) {
  event.preventDefault();
  const payload = {
    sender: senderSelect.value,
    destination: destinationSelect.value,
    priority: prioritySelect.value,
    message: messageInput.value.trim(),
    metric: currentMetric,
  };

  if (!payload.message) {
    messageResultEl.textContent = 'Please enter an emergency message payload.';
    return;
  }

  try {
    const res = await fetchJson(`${API_BASE}/messages/send`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.delivery_status === 'delivered') {
      messageResultEl.className = 'dispatch-result-box success';
      messageResultEl.innerHTML = `
        <span>✅ <strong>[${res.id}] DELIVERED</strong> via Dijkstra path: <strong>${res.route.join(' ➔ ')}</strong> (Latency: ${res.total_latency_ms}ms, ${res.hop_count} hops)</span>
      `;
    } else {
      messageResultEl.className = 'dispatch-result-box failed';
      messageResultEl.innerHTML = `
        <span>❌ <strong>[${res.id}] DELIVERY FAILED:</strong> ${res.failure_reason || 'Destination unreachable'}</span>
      `;
    }

    addMessageToLedger(res);
    await refreshState();
    await refreshEvents();
  } catch (err) {
    messageResultEl.className = 'dispatch-result-box failed';
    messageResultEl.textContent = `Dispatch error: ${err.message}`;
  }
}

function addMessageToLedger(msg) {
  const item = document.createElement('div');
  item.className = 'ledger-item';

  const isDelivered = msg.delivery_status === 'delivered';
  const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : '';

  item.innerHTML = `
    <div class="id-route">
      <span class="priority-pill ${msg.priority.toLowerCase()}">${msg.priority}</span>
      <strong>${msg.id}</strong>
      <span>${msg.sender} ➔ ${msg.destination}</span>
      <span style="color: var(--text-dim);">(${msg.route ? msg.route.join('➔') : 'none'})</span>
    </div>
    <div style="display: flex; gap: 12px; align-items: center;">
      <span>${msg.total_latency_ms || 0}ms</span>
      <span class="${isDelivered ? 'status-delivered' : 'status-failed'}">${msg.delivery_status.toUpperCase()}</span>
      <span style="color: var(--text-dim);">${time}</span>
    </div>
  `;

  ledgerList.prepend(item);
  ledgerCount.textContent = `${ledgerList.children.length} Dispatched`;
}

async function loadMessages() {
  try {
    const data = await fetchJson(`${API_BASE}/messages`);
    if (data.messages) {
      ledgerList.innerHTML = '';
      data.messages.forEach(addMessageToLedger);
    }
  } catch (err) {
    console.warn('Failed to load message history:', err);
  }
}

// Automated Hackathon Demo Walkthrough
async function runHackathonDemo() {
  demoScenarioBtn.disabled = true;
  demoScenarioBtn.textContent = 'DEMO RUNNING...';

  // Step 1: Reset to baseline
  messageResultEl.className = 'dispatch-result-box';
  messageResultEl.textContent = 'DEMO STEP 1/5: Initializing baseline disaster mesh network...';
  await resetNetworkAction();
  await new Promise((r) => setTimeout(r, 1200));

  // Step 2: Normal Transmission
  messageResultEl.textContent = 'DEMO STEP 2/5: Dispatching routine health telemetry over primary Dijkstra route (A ➔ C ➔ E ➔ F)...';
  await fetchJson(`${API_BASE}/messages/send`, {
    method: 'POST',
    body: JSON.stringify({
      sender: 'A',
      destination: 'F',
      message: 'Zone A Squad: routine status check. All clear.',
      priority: 'NORMAL',
    }),
  });
  await refreshState();
  await refreshEvents();
  await new Promise((r) => setTimeout(r, 2000));

  // Step 3: Disaster Strikes! Flash flood knocks out relay Node C
  messageResultEl.className = 'dispatch-result-box failed';
  messageResultEl.textContent = 'DEMO STEP 3/5: FLASH FLOOD! Valley Relay Node C is submerged and offline!';
  await fetchJson(`${API_BASE}/network/node/C/fail`, { method: 'POST' });
  await refreshState();
  await refreshEvents();
  await new Promise((r) => setTimeout(r, 2000));

  // Step 4: Critical SOS reroutes dynamically via Dijkstra
  messageResultEl.className = 'dispatch-result-box';
  messageResultEl.textContent = 'DEMO STEP 4/5: Dispatching CRITICAL SOS. Dijkstra dynamically reroutes via Ambulance B & Team D (A ➔ B ➔ D ➔ F)...';
  await fetchJson(`${API_BASE}/messages/send`, {
    method: 'POST',
    body: JSON.stringify({
      sender: 'A',
      destination: 'F',
      message: '🚨 SOS: Flood surge at Sector 1 bridge! Trapped responders need air extraction!',
      priority: 'CRITICAL',
    }),
  });
  await refreshState();
  await refreshEvents();
  await new Promise((r) => setTimeout(r, 2200));

  // Step 5: Relay C restored & mesh reconverges
  messageResultEl.className = 'dispatch-result-box success';
  messageResultEl.textContent = 'DEMO STEP 5/5: Backup battery deployed on Node C. Network self-healed and topology re-converged!';
  await fetchJson(`${API_BASE}/network/node/C/restore`, { method: 'POST' });
  await refreshState();
  await refreshEvents();

  demoScenarioBtn.disabled = false;
  demoScenarioBtn.innerHTML = '<span class="btn-icon">⚡</span> RUN HACKATHON DEMO';
}

// Event Listeners Initialization
function initEventListeners() {
  // Metric selector
  routingMetricSelect.addEventListener('change', (e) => {
    currentMetric = e.target.value;
    computeDijkstraRoute(senderSelect.value, destinationSelect.value, currentMetric);
  });

  recalculateRouteBtn.addEventListener('click', () => {
    computeDijkstraRoute(senderSelect.value, destinationSelect.value, currentMetric);
  });

  // Origin / Destination changes
  senderSelect.addEventListener('change', () => {
    computeDijkstraRoute(senderSelect.value, destinationSelect.value, currentMetric);
  });

  destinationSelect.addEventListener('change', () => {
    computeDijkstraRoute(senderSelect.value, destinationSelect.value, currentMetric);
  });

  // Priority change badge
  prioritySelect.addEventListener('change', (e) => {
    const val = e.target.value;
    activePriorityBadge.className = `priority-pill ${val.toLowerCase()}`;
    activePriorityBadge.textContent = `${val} PRIORITY`;
  });

  // Presets
  document.querySelectorAll('.preset-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      messageInput.value = chip.getAttribute('data-msg') || '';
    });
  });

  // Manual Controls
  failNodeBtn.addEventListener('click', () => failNodeAction(nodeSelect.value));
  degradeNodeBtn.addEventListener('click', () => degradeNodeAction(nodeSelect.value));
  restoreNodeBtn.addEventListener('click', () => restoreNodeAction(nodeSelect.value));
  toggleLinkBtn.addEventListener('click', toggleLinkAction);
  restoreLinkBtn.addEventListener('click', restoreLinkAction);
  resetNetBtn.addEventListener('click', resetNetworkAction);

  recenterBtn.addEventListener('click', () => {
    if (networkInstance) {
      networkInstance.fit({ animation: { duration: 600, easingFunction: 'easeInOutQuad' } });
    }
  });

  // Disaster scenarios
  btnDisasterFlood.addEventListener('click', () => triggerDisasterScenario('flood'));
  btnDisasterEarthquake.addEventListener('click', () => triggerDisasterScenario('earthquake'));
  btnDisasterCyclone.addEventListener('click', () => triggerDisasterScenario('cyclone'));
  btnDisasterEmp.addEventListener('click', () => triggerDisasterScenario('emp'));

  // Message dispatch form
  messageForm.addEventListener('submit', handleDispatch);

  // Clear visual logs
  clearLogsBtn.addEventListener('click', () => {
    eventLogEl.innerHTML = '';
  });

  // Filter tags
  document.querySelectorAll('.filter-tag').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-tag').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.getAttribute('data-filter') || 'all';

      const items = eventLogEl.querySelectorAll('li');
      items.forEach((item) => {
        if (activeFilter === 'all') {
          item.style.display = 'block';
        } else if (activeFilter === 'critical') {
          item.style.display = item.classList.contains('severity-critical') ? 'block' : 'none';
        } else if (activeFilter === 'routing') {
          item.style.display =
            item.textContent.includes('Dijkstra') ||
            item.textContent.includes('route') ||
            item.textContent.includes('LINK')
              ? 'block'
              : 'none';
        }
      });
    });
  });

  // Project Flow Modal
  projectFlowBtn.addEventListener('click', () => {
    projectFlowModal.classList.remove('hidden');
  });

  closeFlowModalBtn.addEventListener('click', () => {
    projectFlowModal.classList.add('hidden');
  });

  closeFlowModalFooterBtn.addEventListener('click', () => {
    projectFlowModal.classList.add('hidden');
  });

  // Rescue Vector Overlay Toggle
  if (toggleBacktrackOverlayBtn) {
    toggleBacktrackOverlayBtn.addEventListener('click', () => {
      showBacktrackVectors = !showBacktrackVectors;
      toggleBacktrackOverlayBtn.textContent = showBacktrackVectors ? 'Rescue Vectors: ON' : 'Rescue Vectors: OFF';
      toggleBacktrackOverlayBtn.style.color = showBacktrackVectors ? 'var(--color-amber)' : 'var(--text-muted)';
      renderNetwork();
    });
  }

  // Trail Modal Listeners
  if (openTrailModalBtn) {
    openTrailModalBtn.addEventListener('click', async () => {
      trailModal.classList.remove('hidden');
      await loadNodeTrail(trailNodeSelect.value);
    });
  }

  if (closeTrailModalBtn) {
    closeTrailModalBtn.addEventListener('click', () => trailModal.classList.add('hidden'));
  }
  if (closeTrailModalFooterBtn) {
    closeTrailModalFooterBtn.addEventListener('click', () => trailModal.classList.add('hidden'));
  }

  if (trailNodeSelect) {
    trailNodeSelect.addEventListener('change', () => loadNodeTrail(trailNodeSelect.value));
  }
  if (refreshTrailBtn) {
    refreshTrailBtn.addEventListener('click', () => loadNodeTrail(trailNodeSelect.value));
  }

  // Update Position Modal Listeners
  if (openUpdatePosModalBtn) {
    openUpdatePosModalBtn.addEventListener('click', () => {
      const node = networkData.nodes.find((n) => n.id === updatePosNodeSelect.value);
      if (node) {
        updateLocationInput.value = node.location || '';
        updateLatInput.value = node.coordinates?.lat || 34.0522;
        updateLngInput.value = node.coordinates?.lng || -118.2437;
      }
      updatePosModal.classList.remove('hidden');
    });
  }

  if (closeUpdatePosModalBtn) {
    closeUpdatePosModalBtn.addEventListener('click', () => updatePosModal.classList.add('hidden'));
  }

  if (updatePosNodeSelect) {
    updatePosNodeSelect.addEventListener('change', () => {
      const node = networkData.nodes.find((n) => n.id === updatePosNodeSelect.value);
      if (node) {
        updateLocationInput.value = node.location || '';
        updateLatInput.value = node.coordinates?.lat || 34.0522;
        updateLngInput.value = node.coordinates?.lng || -118.2437;
      }
    });
  }

  if (updatePosForm) {
    updatePosForm.addEventListener('submit', handleLocationUpdate);
  }

  // Movement Logs Member Tab Listeners
  if (movementMemberTabs) {
    movementMemberTabs.querySelectorAll('.member-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeMovementNodeId = btn.getAttribute('data-node') || 'A';
        renderRescueMovementLogs(rescueMovementLogsData);
      });
    });
  }

  // Quick Log Movement button
  if (quickLogMovementBtn) {
    quickLogMovementBtn.addEventListener('click', () => {
      updatePosNodeSelect.value = activeMovementNodeId;
      const node = networkData.nodes.find((n) => n.id === activeMovementNodeId);
      if (node) {
        updateLocationInput.value = node.location || '';
        updateLatInput.value = node.coordinates?.lat || 34.0522;
        updateLngInput.value = node.coordinates?.lng || -118.2437;
      }
      updatePosModal.classList.remove('hidden');
    });
  }

  // Quick Waypoint presets in updatePosModal
  ['presetNorthRidgeBtn', 'presetMedJunctionBtn', 'presetDebrisGridBtn', 'presetBaseCampBtn'].forEach((btnId) => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.addEventListener('click', () => {
        if (btn.dataset.loc) updateLocationInput.value = btn.dataset.loc;
        if (btn.dataset.lat) updateLatInput.value = btn.dataset.lat;
        if (btn.dataset.lng) updateLngInput.value = btn.dataset.lng;
        if (btn.dataset.act && updateActivityInput) updateActivityInput.value = btn.dataset.act;
        if (btn.dataset.note && updateNoteInput) updateNoteInput.value = btn.dataset.note;
      });
    }
  });

  // Demo runner
  demoScenarioBtn.addEventListener('click', runHackathonDemo);
}

// Bootstrap
(async function init() {
  setConnectionState(false);
  initEventListeners();
  await refreshState();
  await refreshEvents();
  await loadMessages();
  connectWebSocket();
})();
