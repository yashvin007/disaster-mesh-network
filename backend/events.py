"""Simple in-memory event log for network activity."""

from __future__ import annotations

from datetime import datetime, timezone

EVENT_LOG = []


def _timestamp():
    return datetime.now(timezone.utc).strftime("%H:%M:%S")


def add_event(event_type, message, affected_node=None, severity="info"):
    event = {
        "timestamp": _timestamp(),
        "event_type": event_type,
        "message": message,
        "affected_node": affected_node,
        "severity": severity,
    }
    EVENT_LOG.insert(0, event)
    return event


def get_events(limit=20):
    return list(EVENT_LOG[:limit])
