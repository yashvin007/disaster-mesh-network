from __future__ import annotations

import networkx as nx


VALID_NODE_STATUSES = {"alive", "degraded", "down"}


def create_network():
    """Create the emergency mesh network used by the dashboard and API."""
    network = nx.Graph()

    nodes = {
        "A": {
            "id": "A",
            "name": "Rescue Team 1",
            "role": "Rescue",
            "status": "alive",
            "battery": 92,
            "signal_strength": 94,
            "location": "Zone A",
            "priority": "critical",
        },
        "B": {
            "id": "B",
            "name": "Ambulance",
            "role": "Medical",
            "status": "alive",
            "battery": 78,
            "signal_strength": 86,
            "location": "Zone B",
            "priority": "high",
        },
        "C": {
            "id": "C",
            "name": "Drone",
            "role": "Surveillance",
            "status": "alive",
            "battery": 65,
            "signal_strength": 75,
            "location": "Zone C",
            "priority": "medium",
        },
        "D": {
            "id": "D",
            "name": "Rescue Team 2",
            "role": "Rescue",
            "status": "alive",
            "battery": 88,
            "signal_strength": 90,
            "location": "Zone D",
            "priority": "critical",
        },
        "E": {
            "id": "E",
            "name": "Relief Camp",
            "role": "Relief",
            "status": "alive",
            "battery": 95,
            "signal_strength": 97,
            "location": "Zone E",
            "priority": "high",
        },
        "F": {
            "id": "F",
            "name": "Command Center",
            "role": "Command",
            "status": "alive",
            "battery": 100,
            "signal_strength": 100,
            "location": "Zone F",
            "priority": "critical",
        },
    }

    for node_id, metadata in nodes.items():
        network.add_node(node_id, **metadata)

    edges = [
        ("A", "B", {"latency": 20, "signal_strength": 90, "active": True}),
        ("A", "C", {"latency": 22, "signal_strength": 88, "active": True}),
        ("B", "D", {"latency": 18, "signal_strength": 92, "active": True}),
        ("C", "E", {"latency": 16, "signal_strength": 94, "active": True}),
        ("D", "E", {"latency": 12, "signal_strength": 96, "active": True}),
        ("D", "F", {"latency": 20, "signal_strength": 91, "active": True}),
        ("E", "F", {"latency": 15, "signal_strength": 98, "active": True}),
    ]

    network.add_edges_from(edges)
    return network


def get_network_snapshot(network):
    """Return serialized node and edge data for API and WebSocket consumers."""
    nodes = []
    for node_id in sorted(network.nodes):
        node_data = dict(network.nodes[node_id])
        node_data["id"] = node_id
        nodes.append(node_data)

    edges = []
    for source, target, edge_data in network.edges(data=True):
        edges.append(
            {
                "source": source,
                "target": target,
                "latency": edge_data.get("latency", 25),
                "signal_strength": edge_data.get("signal_strength", 80),
                "active": edge_data.get("active", True),
            }
        )

    return {"nodes": nodes, "edges": edges}


def validate_node_id(network, node_id):
    if node_id not in network.nodes:
        raise ValueError(f"Invalid node ID '{node_id}'.")
    return node_id