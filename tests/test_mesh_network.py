import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.network import create_network
from backend.routing import find_best_route
from backend.self_healing import calculate_network_health
from backend.messaging import send_message


@pytest.fixture
def client():
    return TestClient(app)


def test_network_creation():
    network = create_network()
    assert network is not None
    assert set(network.nodes) == {"A", "B", "C", "D", "E", "F"}


def test_node_count():
    network = create_network()
    assert network.number_of_nodes() == 6


def test_edge_count():
    network = create_network()
    assert network.number_of_edges() == 7


def test_route_calculation():
    network = create_network()
    route = find_best_route(network, "A", "F")
    assert route["source"] == "A"
    assert route["destination"] == "F"
    assert route["route_status"] == "ok"
    assert route["hop_count"] >= 2
    assert route["route"][0] == "A"
    assert route["route"][-1] == "F"


def test_route_avoids_down_nodes():
    network = create_network()
    network.nodes["B"]["status"] = "down"
    network.nodes["B"]["battery"] = 0
    network.nodes["B"]["signal_strength"] = 0
    network["A"]["B"]["active"] = False
    network["B"]["D"]["active"] = False

    route = find_best_route(network, "A", "F")
    assert "B" not in route["route"]
    assert route["route_status"] == "ok"


def test_alternate_route_after_failure():
    network = create_network()
    network.nodes["B"]["status"] = "down"
    network.nodes["B"]["signal_strength"] = 0
    network["A"]["B"]["active"] = False
    network["B"]["D"]["active"] = False

    route = find_best_route(network, "A", "F")
    assert route["route"] != ["A", "B", "D", "F"]
    assert route["route"][-1] == "F"


def test_node_restoration():
    network = create_network()
    network.nodes["B"]["status"] = "down"
    network.nodes["B"]["battery"] = 0
    network.nodes["B"]["signal_strength"] = 0
    network.nodes["B"]["status"] = "alive"
    network.nodes["B"]["battery"] = 78
    network.nodes["B"]["signal_strength"] = 86

    assert network.nodes["B"]["status"] == "alive"
    assert network.nodes["B"]["battery"] == 78


def test_network_health_calculation():
    network = create_network()
    health = calculate_network_health(network)
    assert 0 <= health <= 100
    assert health > 80


def test_invalid_node_handling(client):
    response = client.post("/network/node/INVALID/fail")
    assert response.status_code == 404
    assert "Invalid node" in response.json()["detail"]


def test_emergency_message_routing():
    network = create_network()
    message = send_message(network, "A", "F", "Critical rescue required", "CRITICAL")
    assert message["delivery_status"] in {"delivered", "queued"}
    assert message["route"][0] == "A"
    assert message["route"][-1] == "F"


def test_api_network_status(client):
    response = client.get("/network/status")
    assert response.status_code == 200
    data = response.json()
    assert "network_health" in data
    assert "alive" in data
    assert "down" in data
