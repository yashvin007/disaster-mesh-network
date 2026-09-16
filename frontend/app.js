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
const inspFailBtn = document.getElementById('inspFailBtn');
const inspDegradeBtn = document.getElementById('inspDegradeBtn');
const inspRestoreBtn = document.getElementById('inspRestoreBtn');
const closeInspectorBtn = document.getElementById('closeInspectorBtn');
let inspectedNodeId = null;

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

    return {
      id: node.id,
      label: `${node.id}\n${node.name.split(' ')[0]}`,
      title: `Node ${node.id} (${node.name})&#10;Role: ${node.role}&#10;Status: ${node.status.toUpperCase()}&#10;Battery: ${node.battery}%&#10;Signal: ${node.signal_strength}%&#10;Location: ${node.location}`,
      color: {
        background: visuals.background,
        border: visuals.border,
        highlight: {
          background: '#0284c7',
          border: '#38bdf8',
        },
      },
      borderWidth: isRouteNode ? 3 : 2,
      shape: 'box',
      shapeProperties: { borderRadius: 8 },
      font: {
        color: '#f8fafc',
        face: 'ui-monospace, monospace',
        size: 13,
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

// State Synchronization
async function refreshState() {
  try {
    const statusData = await fetchJson(`${API_BASE}/network/status`);
    updateStats(statusData);

    const netData = await fetchJson(`${API_BASE}/network`);
    networkData = netData;

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
