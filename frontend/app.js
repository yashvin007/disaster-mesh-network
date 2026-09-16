const API_BASE = 'http://127.0.0.1:8000';
const networkMapEl = document.getElementById('networkMap');
const connectionPill = document.getElementById('connectionPill');
const eventLogEl = document.getElementById('eventLog');
const messageResultEl = document.getElementById('messageResult');
const healthScoreEl = document.getElementById('healthScore');

const nodeSelect = document.getElementById('nodeSelect');
const senderSelect = document.getElementById('senderSelect');
const destinationSelect = document.getElementById('destinationSelect');
const messageInput = document.getElementById('messageInput');
const prioritySelect = document.getElementById('prioritySelect');

let networkData = { nodes: [], edges: [] };
let networkInstance = null;

function setConnectionState(connected) {
  connectionPill.innerHTML = connected
    ? '<span class="connection-dot"></span><span>Connected</span>'
    : '<span class="connection-dot" style="background:#ef4b5b; box-shadow:0 0 12px rgba(239,75,91,0.8);"></span><span>Disconnected</span>';
  connectionPill.style.borderColor = connected ? 'rgba(55, 214, 122, 0.35)' : 'rgba(239,75,91,0.35)';
  connectionPill.style.background = connected ? 'rgba(55, 214, 122, 0.08)' : 'rgba(239,75,91,0.08)';
}

function getNodeStyle(status) {
  const palettes = {
    alive: { color: '#37d67a', border: '#79f2a2', background: '#1c6d46' },
    degraded: { color: '#f4b942', border: '#f7d580', background: '#7b5a16' },
    down: { color: '#ef4b5b', border: '#ff9aa5', background: '#6c1f2b' },
  };
  return palettes[status] || palettes.alive;
}

function renderNetwork(data) {
  const nodes = data.nodes.map((node) => ({
    id: node.id,
    label: node.id,
    title: `${node.name}<br>${node.role}<br>Status: ${node.status}<br>Battery: ${node.battery}%<br>Signal: ${node.signal_strength}%<br>Location: ${node.location}<br>Priority: ${node.priority}`,
    color: getNodeStyle(node.status),
    font: { color: '#edf5ff', face: 'Segoe UI', size: 16 },
    borderWidth: 2,
    shape: 'dot',
    size: node.status === 'down' ? 26 : 24,
    value: node.battery,
  }));

  const edges = data.edges.map((edge) => ({
    from: edge.source,
    to: edge.target,
    label: `${edge.latency} ms`,
    font: { color: '#dfeaf6', size: 10 },
    color: edge.active ? '#6daeff' : '#ef4b5b',
    width: edge.active ? 2 : 1,
    dashes: edge.active ? false : [6, 4],
  }));

  if (networkInstance) {
    networkInstance.setData({ nodes, edges });
    return;
  }

  const options = {
    nodes: {
      shape: 'dot',
      font: { face: 'Segoe UI', color: '#edf5ff', size: 14 },
      shadow: false,
      scaling: { min: 16, max: 30 },
    },
    edges: {
      smooth: true,
      arrows: { to: { enabled: false } },
      color: '#6daeff',
    },
    physics: { enabled: true, solver: 'forceAtlas2Based', stabilization: { iterations: 120 } },
    interaction: { hover: true, tooltipDelay: 150 },
    layout: { improvedLayout: true },
  };

  networkInstance = new vis.Network(networkMapEl, { nodes, edges }, options);
  networkInstance.on('click', (params) => {
    if (!params.nodes.length) return;
    const nodeId = params.nodes[0];
    const node = data.nodes.find((item) => item.id === nodeId);
    if (!node) return;
    alert(`${node.name}\nRole: ${node.role}\nStatus: ${node.status}\nBattery: ${node.battery}%\nSignal: ${node.signal_strength}%\nLocation: ${node.location}\nPriority: ${node.priority}`);
  });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Request failed');
  }
  return response.json();
}

function updateStats(data) {
  const summary = {
    network_health: data.network_health || 100,
    alive: data.alive || 0,
    degraded: data.degraded || 0,
    down: data.down || 0,
    active_links: data.active_links || 0,
    connected: data.connected ?? true,
  };

  healthScoreEl.textContent = `${summary.network_health}%`;
  document.getElementById('aliveCount').textContent = summary.alive;
  document.getElementById('degradedCount').textContent = summary.degraded;
  document.getElementById('downCount').textContent = summary.down;
  document.getElementById('activeLinks').textContent = summary.active_links;
  document.getElementById('connectedStatus').textContent = summary.connected ? 'YES' : 'NO';
}

function addEvent(event) {
  const item = document.createElement('li');
  const time = event.timestamp || new Date().toLocaleTimeString();
  item.innerHTML = `<span class="time">${time}</span><strong>${event.event_type}</strong><div>${event.message}</div>`;
  eventLogEl.prepend(item);
  while (eventLogEl.children.length > 12) {
    eventLogEl.removeChild(eventLogEl.lastChild);
  }
}

async function loadEvents() {
  const result = await fetchJson(`${API_BASE}/events`);
  (result.events || []).forEach(addEvent);
}

async function updateState() {
  try {
    const result = await fetchJson(`${API_BASE}/network/status`);
    updateStats(result);
    const networkResult = await fetchJson(`${API_BASE}/network`);
    networkData = networkResult;
    renderNetwork(networkResult);
  } catch (error) {
    console.error('State update failed:', error);
  }
}

async function connectWebSocket() {
  const socket = new WebSocket('ws://127.0.0.1:8000/ws');
  socket.onopen = () => setConnectionState(true);
  socket.onclose = () => setConnectionState(false);
  socket.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    if (!payload.nodes) return;
    networkData = { nodes: payload.nodes, edges: payload.edges };
    renderNetwork(payload);
    updateStats({
      network_health: payload.network_health,
      alive: payload.nodes.filter((n) => n.status === 'alive').length,
      degraded: payload.nodes.filter((n) => n.status === 'degraded').length,
      down: payload.nodes.filter((n) => n.status === 'down').length,
      active_links: payload.edges.filter((e) => e.active).length,
      connected: payload.nodes.some((n) => n.status !== 'down'),
    });
  };
}

async function failNodeAction() {
  const nodeId = nodeSelect.value;
  const response = await fetchJson(`${API_BASE}/network/node/${nodeId}/fail`, { method: 'POST' });
  messageResultEl.textContent = `NODE FAILURE: ${nodeId} went offline. Route: ${response.route.route.join(' → ')}`;
  await updateState();
  await loadEvents();
}

async function restoreNodeAction() {
  const nodeId = nodeSelect.value;
  const response = await fetchJson(`${API_BASE}/network/node/${nodeId}/restore`, { method: 'POST' });
  messageResultEl.textContent = `NODE RESTORED: ${nodeId} is healthy again.`;
  await updateState();
  await loadEvents();
}

async function failLinkAction() {
  const nodeId = nodeSelect.value;
  const pair = [nodeId, 'F'];
  const response = await fetchJson(`${API_BASE}/network/link/${pair[0]}/${pair[1]}/fail`, { method: 'POST' });
  messageResultEl.textContent = `LINK FAILURE: ${pair[0]}-${pair[1]} disabled. Route: ${response.route.route.join(' → ')}`;
  await updateState();
  await loadEvents();
}

async function resetNetworkAction() {
  const response = await fetchJson(`${API_BASE}/network/reset`, { method: 'POST' });
  messageResultEl.textContent = `NETWORK RESET: ${response.message}`;
  await updateState();
  await loadEvents();
}

async function sendEmergencyMessage(event) {
  event.preventDefault();
  const payload = {
    sender: senderSelect.value,
    destination: destinationSelect.value,
    message: messageInput.value,
    priority: prioritySelect.value,
  };
  const response = await fetchJson(`${API_BASE}/messages/send`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const routeMessage = response.route && response.route.length ? response.route.join(' → ') : 'No route';
  messageResultEl.textContent = `MESSAGE ${response.delivery_status.toUpperCase()}: ${routeMessage}`;
  await updateState();
  await loadEvents();
}

async function runDemoMode() {
  messageResultEl.textContent = 'DEMO MODE: starting network simulation';
  await fetchJson(`${API_BASE}/network/reset`, { method: 'POST' });
  await new Promise((resolve) => setTimeout(resolve, 1200));
  await fetchJson(`${API_BASE}/messages/send`, {
    method: 'POST',
    body: JSON.stringify({
      sender: 'A',
      destination: 'F',
      message: 'Normal message test',
      priority: 'NORMAL',
    }),
  });
  await new Promise((resolve) => setTimeout(resolve, 1200));
  await fetchJson(`${API_BASE}/network/node/B/fail`, { method: 'POST' });
  await new Promise((resolve) => setTimeout(resolve, 1400));
  await fetchJson(`${API_BASE}/network/node/B/restore`, { method: 'POST' });
  await new Promise((resolve) => setTimeout(resolve, 1200));
  await fetchJson(`${API_BASE}/messages/send`, {
    method: 'POST',
    body: JSON.stringify({
      sender: 'A',
      destination: 'F',
      message: 'SOS - Rescue team requires immediate assistance',
      priority: 'CRITICAL',
    }),
  });
  await updateState();
  await loadEvents();
  messageResultEl.textContent = 'DEMO MODE COMPLETE: alternate routing restored and critical message delivered.';
}

document.getElementById('failNodeBtn').addEventListener('click', failNodeAction);
document.getElementById('restoreNodeBtn').addEventListener('click', restoreNodeAction);
document.getElementById('failLinkBtn').addEventListener('click', failLinkAction);
document.getElementById('resetNetBtn').addEventListener('click', resetNetworkAction);
document.getElementById('demoBtn').addEventListener('click', runDemoMode);
document.getElementById('messageForm').addEventListener('submit', sendEmergencyMessage);

(async function start() {
  setConnectionState(false);
  await updateState();
  await loadEvents();
  connectWebSocket();
})();
