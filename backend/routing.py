"""Routing logic for the disaster-resilient mesh network."""

from __future__ import annotations

import math

import networkx as nx


def _edge_cost(network, source, target, edge_data):
    """Return a routing cost favoring healthier and faster links."""
    source_attrs = network.nodes[source]
    target_attrs = network.nodes[target]

    signal = min(
        source_attrs.get("signal_strength", 50),
        target_attrs.get("signal_strength", 50),
    )
    latency = edge_data.get("latency", 30)
    penalty = max(0, 100 - signal)

    return 1 + (latency / 25) + (penalty / 25)


def find_best_route(network, source, destination):
    """Find the best route between two nodes while avoiding down nodes."""
    if source not in network.nodes:
        return {
            "source": source,
            "destination": destination,
            "route": [],
            "hop_count": 0,
            "route_status": "error",
            "reason": f"Source node '{source}' was not found.",
        }

    if destination not in network.nodes:
        return {
            "source": source,
            "destination": destination,
            "route": [],
            "hop_count": 0,
            "route_status": "error",
            "reason": f"Destination node '{destination}' was not found.",
        }

    if source == destination:
        return {
            "source": source,
            "destination": destination,
            "route": [source],
            "hop_count": 0,
            "route_status": "ok",
            "reason": "Direct route selected.",
        }

    candidate_graph = nx.Graph()

    for node_id, node_data in network.nodes(data=True):
        if node_data.get("status") == "down":
            continue
        candidate_graph.add_node(node_id, **node_data)

    for first, second, edge_data in network.edges(data=True):
        if first not in candidate_graph or second not in candidate_graph:
            continue
        if edge_data.get("active", True) is False:
            continue
        if network.nodes[first].get("status") == "down":
            continue
        if network.nodes[second].get("status") == "down":
            continue

        candidate_graph.add_edge(
            first,
            second,
            latency=edge_data.get("latency", 25),
            signal_strength=min(
                network.nodes[first].get("signal_strength", 50),
                network.nodes[second].get("signal_strength", 50),
            ),
            active=True,
        )

    if source not in candidate_graph or destination not in candidate_graph:
        return {
            "source": source,
            "destination": destination,
            "route": [],
            "hop_count": 0,
            "route_status": "unavailable",
            "reason": "No valid route is available because one or more nodes are offline.",
        }

    try:
        route = nx.shortest_path(
            candidate_graph,
            source,
            destination,
            weight=lambda u, v, d: _edge_cost(network, u, v, d),
        )
    except nx.NetworkXNoPath:
        return {
            "source": source,
            "destination": destination,
            "route": [],
            "hop_count": 0,
            "route_status": "unavailable",
            "reason": "No route exists after considering network health and link availability.",
        }

    hop_count = max(len(route) - 1, 0)
    return {
        "source": source,
        "destination": destination,
        "route": route,
        "hop_count": hop_count,
        "route_status": "ok",
        "reason": f"Best route selected with {hop_count} hop(s).",
    }
