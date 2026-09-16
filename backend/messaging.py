"""Emergency messaging logic with route-aware delivery."""

from __future__ import annotations

from datetime import datetime, timezone

MESSAGE_HISTORY = []


def _timestamp():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def get_recent_messages(limit=20):
    return list(MESSAGE_HISTORY[-limit:])


def send_message(network, sender, destination, message, priority="NORMAL"):
    """Send a message using the best available route."""
    from backend.routing import find_best_route

    sender_ok = sender in network.nodes
    destination_ok = destination in network.nodes
    if not sender_ok:
        raise ValueError(f"Sender '{sender}' is invalid.")
    if not destination_ok:
        raise ValueError(f"Destination '{destination}' is invalid.")

    priority = str(priority).upper()
    valid_priorities = {"LOW", "NORMAL", "HIGH", "CRITICAL"}
    if priority not in valid_priorities:
        raise ValueError(f"Priority must be one of: {sorted(valid_priorities)}.")

    route_result = find_best_route(network, sender, destination)
    route = route_result.get("route", [])
    if route_result.get("route_status") == "ok":
        delivery_status = "delivered"
    else:
        delivery_status = "failed"

    message_record = {
        "id": f"MSG-{len(MESSAGE_HISTORY) + 1:04d}",
        "sender": sender,
        "destination": destination,
        "message": message,
        "priority": priority,
        "timestamp": _timestamp(),
        "route": route,
        "delivery_status": delivery_status,
    }

    MESSAGE_HISTORY.append(message_record)
    return message_record
