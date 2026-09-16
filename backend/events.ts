export interface MeshEvent {
  timestamp: string;
  event_type: string;
  message: string;
  affected_node: string | null;
  severity: string;
}

export const EVENT_LOG: MeshEvent[] = [];

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

export function addEvent(
  eventType: string,
  message: string,
  affectedNode: string | null = null,
  severity = 'info'
): MeshEvent {
  const event: MeshEvent = {
    timestamp: timestamp(),
    event_type: eventType,
    message,
    affected_node: affectedNode,
    severity,
  };
  EVENT_LOG.unshift(event);
  return event;
}

export function getEvents(limit = 20): MeshEvent[] {
  return EVENT_LOG.slice(0, limit);
}
