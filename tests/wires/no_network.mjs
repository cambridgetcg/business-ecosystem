// Preloaded into every Node child of the wire tests (node --import): opening a
// socket, resolving a name or fetching throws. It proves the producer makes no
// network call; it is not a sandbox.
import dns from 'node:dns';
import net from 'node:net';

const refuse = (what) =>
  function refused() {
    throw new Error(`network access refused in the wire tests: ${what}`);
  };
net.Socket.prototype.connect = refuse('net.Socket.connect');
dns.lookup = refuse('dns.lookup');
dns.promises.lookup = refuse('dns.promises.lookup');
globalThis.fetch = refuse('fetch');
