from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.events import add_event, get_events
from backend.messaging import get_recent_messages, send_message
from backend.network import create_network, get_network_snapshot, validate_node_id
from backend.routing import find_best_route
from backend.self_healing import (
    calculate_network_health,
    degrade_node,
    fail_node,
    get_network_health_summary,
    restore_node,
)

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"

app = FastAPI(
    title="Disaster-Resilient Emergency Communication Network",
    description="Backend for a self-healing emergency mesh network.",
    version="1.0.0",
)

app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

NETWORK = create_network()
ACTIVE_CONNECTIONS: set[WebSocket] = set()


async def broadcast_network_state():
    """Push a compact network snapshot to all WebSocket clients once per second."""
    while True:
        payload = get_network_snapshot(NETWORK)
        payload["network_health"] = get_network_health_summary(NETWORK)["network_health"]
        payload["timestamp"] = datetime.now(timezone.utc).isoformat()

        dead_connections = set()
        for websocket in list(ACTIVE_CONNECTIONS):
            try:
                await websocket.send_json(payload)
            except Exception:
                dead_connections.add(websocket)

        ACTIVE_CONNECTIONS.difference_update(dead_connections)
        await asyncio.sleep(1)


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(broadcast_network_state())


@app.get("/")
def home():
    return {
        "message": "Disaster Mesh Network API is running!",
        "status": "online",
        "dashboard": "/static/index.html",
    }


@app.get("/dashboard")
def dashboard_page():
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "network_health": calculate_network_health(NETWORK),
    }


@app.get("/network")
def get_network():
    return get_network_snapshot(NETWORK)


@app.get("/network/status")
def get_network_status():
    return get_network_health_summary(NETWORK)


@app.get("/network/routes")
def get_routes(source: str = "A", destination: str = "F"):
    if source not in NETWORK.nodes or destination not in NETWORK.nodes:
        raise HTTPException(status_code=404, detail="One or both nodes are invalid.")
    return find_best_route(NETWORK, source, destination)


@app.post("/network/reset")
def reset_network():
    global NETWORK
    NETWORK = create_network()
    add_event("NETWORK_DEGRADED", "Network reset to full service state.", None, "low")
    return {
        "message": "Network state has been reset.",
        "network": get_network_snapshot(NETWORK),
        "network_health": get_network_health_summary(NETWORK),
    }


@app.post("/network/link/{source}/{target}/fail")
def fail_link_endpoint(source: str, target: str):
    if source not in NETWORK.nodes or target not in NETWORK.nodes:
        raise HTTPException(status_code=404, detail="One or both nodes are invalid.")
    if not NETWORK.has_edge(source, target):
        raise HTTPException(status_code=404, detail=f"Link {source}-{target} does not exist.")

    NETWORK[source][target]["active"] = False
    add_event("LINK_FAILURE", f"Link {source}-{target} failed.", None, "high")
    return {
        "message": f"Link {source}-{target} has been deactivated.",
        "route": find_best_route(NETWORK, "A", "F"),
    }


@app.post("/network/link/{source}/{target}/restore")
def restore_link_endpoint(source: str, target: str):
    if source not in NETWORK.nodes or target not in NETWORK.nodes:
        raise HTTPException(status_code=404, detail="One or both nodes are invalid.")
    if not NETWORK.has_edge(source, target):
        raise HTTPException(status_code=404, detail=f"Link {source}-{target} does not exist.")

    NETWORK[source][target]["active"] = True
    add_event("NODE_RECOVERY", f"Link {source}-{target} was restored.", None, "medium")
    return {
        "message": f"Link {source}-{target} has been restored.",
        "route": find_best_route(NETWORK, "A", "F"),
    }


@app.post("/network/node/{node_id}/fail")
def fail_node_endpoint(node_id: str):
    try:
        validate_node_id(NETWORK, node_id)
        fail_node(NETWORK, node_id)
        add_event("NODE_FAILURE", f"Node {node_id} went offline.", node_id, "high")
        return {
            "message": f"Node {node_id} has been failed.",
            "node": NETWORK.nodes[node_id],
            "route": find_best_route(NETWORK, "A", "F"),
        }
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/network/node/{node_id}/restore")
def restore_node_endpoint(node_id: str):
    try:
        validate_node_id(NETWORK, node_id)
        restore_node(NETWORK, node_id)
        add_event("NODE_RECOVERY", f"Node {node_id} was restored and rejoined the mesh.", node_id, "medium")
        return {
            "message": f"Node {node_id} has been restored.",
            "node": NETWORK.nodes[node_id],
            "route": find_best_route(NETWORK, "A", "F"),
        }
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/network/node/{node_id}/status")
def update_node_status(node_id: str, payload: dict[str, Any]):
    try:
        validate_node_id(NETWORK, node_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    status_name = str(payload.get("status", "")).lower()
    allowed = {"alive", "degraded", "down"}
    if status_name not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Status must be one of: {sorted(allowed)}.",
        )

    if status_name == "down":
        fail_node(NETWORK, node_id)
        add_event("NODE_FAILURE", f"Node {node_id} changed status to down.", node_id, "high")
    elif status_name == "alive":
        restore_node(NETWORK, node_id)
        add_event("NODE_RECOVERY", f"Node {node_id} returned to alive status.", node_id, "medium")
    else:
        degrade_node(NETWORK, node_id)
        add_event("NETWORK_DEGRADED", f"Node {node_id} entered degraded mode.", node_id, "medium")

    return {
        "message": f"Node {node_id} status updated to {status_name}.",
        "node": NETWORK.nodes[node_id],
    }


@app.post("/messages/send")
def send_message_endpoint(payload: dict[str, Any]):
    sender = str(payload.get("sender", "")).strip()
    destination = str(payload.get("destination", "")).strip()
    message = str(payload.get("message", "")).strip()
    priority = str(payload.get("priority", "NORMAL")).upper()

    if not sender or not destination or not message:
        raise HTTPException(status_code=400, detail="Sender, destination, and message are required.")

    try:
        record = send_message(NETWORK, sender, destination, message, priority)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    route = find_best_route(NETWORK, sender, destination)
    if route["route_status"] == "ok":
        add_event("MESSAGE_SENT", f"Critical SOS sent from {sender} to {destination}.", sender, "high")
        add_event("MESSAGE_DELIVERED", f"Message delivered along route: {' -> '.join(route['route'])}.", destination, "medium")
    else:
        add_event("MESSAGE_SENT", f"Message attempt from {sender} to {destination} failed due to route unavailability.", sender, "high")

    record["route"] = route.get("route", [])
    record["delivery_status"] = route["route_status"] if route["route_status"] != "ok" else "delivered"
    return record


@app.get("/messages")
def get_messages():
    return {"messages": get_recent_messages(20)}


@app.get("/events")
def get_event_log():
    return {"events": get_events(20)}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    ACTIVE_CONNECTIONS.add(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ACTIVE_CONNECTIONS.discard(websocket)


@app.get("/network/routes/{source}/{destination}")
def get_path_route(source: str, destination: str):
    return find_best_route(NETWORK, source, destination)