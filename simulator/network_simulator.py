"""Deterministic disaster simulation helpers for the mesh network demo."""

from __future__ import annotations

import random

from backend.network import create_network
from backend.routing import find_best_route
from backend.self_healing import fail_node, restore_node, degrade_node


NETWORK = create_network()


def simulate_node_failure(node_id="B"):
    """Simulate a node failure and update the network in a controlled way."""
    if node_id not in NETWORK.nodes:
        raise ValueError(f"Invalid node ID '{node_id}'.")
    fail_node(NETWORK, node_id)
    return {"node_id": node_id, "status": NETWORK.nodes[node_id]["status"], "route": find_best_route(NETWORK, "A", "F")}


def simulate_node_recovery(node_id="B"):
    """Restore a failed node and allow normal routing again."""
    if node_id not in NETWORK.nodes:
        raise ValueError(f"Invalid node ID '{node_id}'.")
    restore_node(NETWORK, node_id)
    return {"node_id": node_id, "status": NETWORK.nodes[node_id]["status"], "route": find_best_route(NETWORK, "A", "F")}


def simulate_degradation(node_id="C"):
    """Reduce a node's performance without taking it down."""
    if node_id not in NETWORK.nodes:
        raise ValueError(f"Invalid node ID '{node_id}'.")
    degrade_node(NETWORK, node_id)
    return {"node_id": node_id, "status": NETWORK.nodes[node_id]["status"], "battery": NETWORK.nodes[node_id]["battery"]}


def update_network_conditions():
    """Apply controlled, deterministic changes that resemble disaster conditions."""
    random.seed(42)
    if random.random() < 0.35:
        node_id = random.choice(["A", "B", "C", "D", "E", "F"])
        if NETWORK.nodes[node_id]["status"] == "alive":
            degrade_node(NETWORK, node_id)
    if random.random() < 0.2:
        node_id = random.choice(["A", "B", "C", "D", "E", "F"])
        if NETWORK.nodes[node_id]["status"] != "down":
            fail_node(NETWORK, node_id)
    for node_id in NETWORK.nodes:
        node_data = NETWORK.nodes[node_id]
        if node_data["status"] == "alive":
            node_data["battery"] = max(10, node_data["battery"] - 1)
            node_data["signal_strength"] = max(40, node_data["signal_strength"] - 2)
        elif node_data["status"] == "degraded":
            node_data["battery"] = max(5, node_data["battery"] - 2)
            node_data["signal_strength"] = max(25, node_data["signal_strength"] - 3)

    return {"status": "updated", "network": NETWORK}
