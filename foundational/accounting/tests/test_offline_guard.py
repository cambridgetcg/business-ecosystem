"""The suite-wide network guard in conftest.py is active in the pytest process."""
import socket

import pytest

from tests import conftest


@pytest.mark.parametrize("attempt", [
    lambda: socket.getaddrinfo("example.invalid", 443),
    lambda: socket.gethostbyname("example.invalid"),
    lambda: socket.create_connection(("192.0.2.1", 443), timeout=0.1),
])
def test_outbound_network_is_refused(attempt):
    attempts = len(conftest.network_attempts)
    with pytest.raises(AssertionError, match="network access forbidden"):
        attempt()
    # This probe was deliberate: forget it so the session result stays green.
    del conftest.network_attempts[attempts:]


def test_local_socket_pairs_stay_available():
    left, right = socket.socketpair()
    with left, right:
        left.sendall(b"ok")
        assert right.recv(2) == b"ok"
