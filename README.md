# Disaster-Resilient Emergency Communication Network

## Problem
Disasters often damage or overload conventional communication infrastructure. Cell towers, wired links, and central hubs can fail when emergency teams need coordination most. In those moments, a resilient mesh network can continue operating even when some nodes go offline.

## Solution
This project simulates a self-healing emergency communication mesh using Python, FastAPI, NetworkX, and a plain HTML/CSS/JavaScript dashboard. The network monitors node health, reroutes traffic around failed equipment, and highlights route changes in real time.

## Features
- Mesh network simulation
- Real-time monitoring
- Node health tracking
- Self-healing routing
- Automatic rerouting
- Emergency messaging
- Message priorities
- WebSocket updates
- Network health monitoring
- Disaster simulation
- Demo mode

## Architecture
Frontend
↓
FastAPI
↓
NetworkX
↓
Network Simulator

## Installation
Open PowerShell in the project folder and run:

```powershell
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Run
Start the API server:

```powershell
uvicorn backend.main:app --reload
```

Then open any browser to:

- http://127.0.0.1:8000/
- http://127.0.0.1:8000/dashboard

## API
Important endpoints:

- GET /
- GET /health
- GET /network
- GET /network/status
- GET /network/routes?source=A&destination=F
- POST /network/node/{node_id}/fail
- POST /network/node/{node_id}/restore
- POST /network/node/{node_id}/status
- POST /messages/send
- GET /messages
- GET /events
- WebSocket /ws

## Demo Scenario
To demonstrate the self-healing behavior:

1. Start with a healthy network.
2. Send a normal message.
3. Fail node B.
4. Network discovers a new route around the failed node.
5. Route A -> C -> E -> F replaces the original A -> B -> D -> F path.
6. Send a critical SOS from A to F.
7. The message is sent over the alternate route.
8. Restore node B.
9. Normal routing resumes.

## Future Improvements
Possible future hardware integration may include:
- LoRa
- ESP32
- Raspberry Pi
- GPS
- Real radio communication

This project is intentionally a software simulation and does not claim live hardware deployment.
