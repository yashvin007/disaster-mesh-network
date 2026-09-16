"""Self-healing utilities for the mesh network."""

from __future__ import annotations

import networkx as nx


def calculate_network_health(network):
    """Calculate a health score based on live nodes, degraded nodes, down nodes,
    active links, and overall connectivity."""
    if network.number_of_nodes() == 0:
        return 0

    alive = sum(1 for _, values in network.nodes(data=True) if values.get("status") == "alive")
    degraded = sum(1 for _, values in network.nodes(data=True) if values.get("status") == "degraded")
    down = sum(1 for _, values in network.nodes(data=True) if values.get("status") == "down")
    total_nodes = network.number_of_nodes()
    active_links = sum(
        1
        for _, _, edge_data in network.edges(data=True)
        if edge_data.get("active", True) is True
    )
    total_links = max(1, network.number_of_edges())

    available_nodes = alive + (degraded * 0.5)
    availability_ratio = available_nodes / total_nodes
    link_ratio = active_links / total_links

    active_nodes = [
        node_id
        for node_id, values in network.nodes(data=True)
        if values.get("status") in {"alive", "degraded"}
    ]
    connectivity = 1.0 if not active_nodes else 1.0 if nx.is_connected(network.subgraph(active_nodes)) else 0.5

    health = (
        availability_ratio * 0.5
        + link_ratio * 0.3
        + connectivity * 0.2
    ) * 100

    return max(0, min(100, round(health)))


def get_network_health_summary(network):
    """Return node counts and health metrics for dashboard display."""
    alive = sum(1 for _, values in network.nodes(data=True) if values.get("status") == "alive")
    degraded = sum(1 for _, values in network.nodes(data=True) if values.get("status") == "degraded")
    down = sum(1 for _, values in network.nodes(data=True) if values.get("status") == "down")
    active_links = sum(
        1
        for _, _, edge_data in network.edges(data=True)
        if edge_data.get("active", True) is True
    )
    active_nodes = [
        node_id
        for node_id, values in network.nodes(data=True)
        if values.get("status") in {"alive", "degraded"}
    ]
    connected = True if not active_nodes else nx.is_connected(network.subgraph(active_nodes))

    return {
        "network_health": calculate_network_health(network),
        "alive": alive,
        "degraded": degraded,
        "down": down,
        "active_links": active_links,
        "connected": connected,
        "total_nodes": network.number_of_nodes(),
        "total_edges": network.number_of_edges(),
    }


def fail_node(network, node_id):
    """Mark a node as down and disable its links."""
    if node_id not in network.nodes:
        raise ValueError(f"Invalid node ID '{node_id}'.")

    network.nodes[node_id]["status"] = "down"
    network.nodes[node_id]["battery"] = 0
    network.nodes[node_id]["signal_strength"] = 0

    for neighbor in list(network.neighbors(node_id)):
        network[node_id][neighbor]["active"] = False

    return network.nodes[node_id]


def restore_node(network, node_id):
    """Restore a node to a healthy state and reactivate nearby links."""
    if node_id not in network.nodes:
        raise ValueError(f"Invalid node ID '{node_id}'.")

    metadata = network.nodes[node_id]
    metadata["status"] = "alive"
    metadata["battery"] = max(metadata.get("battery", 80), 75)
    metadata["signal_strength"] = max(metadata.get("signal_strength", 80), 80)

    for neighbor in list(network.neighbors(node_id)):
        if network.nodes[neighbor].get("status") != "down":
            network[node_id][neighbor]["active"] = True

    return metadata


def degrade_node(network, node_id):
    """Reduce performance stats for a node without taking it down."""
    if node_id not in network.nodes:
        raise ValueError(f"Invalid node ID '{node_id}'.")

    metadata = network.nodes[node_id]
    metadata["status"] = "degraded"
    metadata["battery"] = max(15, metadata.get("battery", 50) - 20)
    metadata["signal_strength"] = max(25, metadata.get("signal_strength", 60) - 20)
    return metadata


def recalculate_routes(network, source, destination):
    from backend.routing import find_best_route

    return find_best_route(network, source, destination)
