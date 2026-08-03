"""The trusted-client guard.

No route in this API is authenticated, so this guard is the only thing standing
between a stranger on the same network and `GET /api/people` or
`DELETE /api/people/{code}`. It is worth testing on its own.

The endpoint tests can't cover it: TestClient reports its peer as the literal
string "testclient", so they switch the guard off (see conftest). These tests
import the matcher directly instead.
"""

import importlib
import sys

import pytest


def _load_main(monkeypatch, cidrs: str):
    """Imports app.main with a given TRUSTED_CLIENT_CIDRS, since it is read once
    at import time."""
    monkeypatch.setenv("TRUSTED_CLIENT_CIDRS", cidrs)
    for module in [m for m in sys.modules if m == "app" or m.startswith("app.")]:
        del sys.modules[module]
    from tests.conftest import _stub_vision_modules

    _stub_vision_modules()
    return importlib.import_module("app.main")


@pytest.mark.parametrize(
    "host, trusted",
    [
        ("127.0.0.1", True),
        ("127.0.0.53", True),  # anywhere in 127.0.0.0/8
        ("::1", True),
        # A v4 peer on a dual-stack socket arrives wrapped; it must still match
        # 127.0.0.0/8 rather than falling through as an unknown v6 address.
        ("::ffff:127.0.0.1", True),
        ("192.168.83.103", False),  # the station's own LAN address
        ("192.168.83.200", False),  # a visitor's phone
        ("10.0.0.5", False),
        ("172.17.0.2", False),  # a container, when the range isn't widened
        ("8.8.8.8", False),
        ("testclient", False),  # not an address at all
        ("", False),
        (None, False),
    ],
)
def test_default_trusts_only_loopback(monkeypatch, host, trusted):
    main = _load_main(monkeypatch, "127.0.0.0/8,::1")
    assert main._is_trusted(host) is trusted


def test_widening_admits_the_docker_bridge(monkeypatch):
    """What docker-compose.yml does so the frontend container can reach the API."""
    main = _load_main(monkeypatch, "127.0.0.0/8,::1,172.16.0.0/12")
    assert main._is_trusted("172.17.0.2") is True
    assert main._is_trusted("127.0.0.1") is True
    # Widening for containers must not quietly admit the LAN as well.
    assert main._is_trusted("192.168.83.200") is False


def test_star_disables_the_guard(monkeypatch):
    main = _load_main(monkeypatch, "*")
    assert main._is_trusted("8.8.8.8") is True
    assert main._is_trusted("testclient") is True
    assert main._is_trusted(None) is True


def test_a_single_host_can_be_trusted(monkeypatch):
    """A bare IP is a valid entry, not just a CIDR."""
    main = _load_main(monkeypatch, "127.0.0.1,192.168.83.50")
    assert main._is_trusted("192.168.83.50") is True
    assert main._is_trusted("192.168.83.51") is False
