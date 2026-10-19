// Test guard, loaded by vitest (setupFiles) and by every CLI child process
// (node --import): opening a socket, resolving a name or fetching throws.
// It proves the intake makes no network call; it is not a sandbox.
import dns from 'node:dns';
import net from 'node:net';

const refuse = (what) =>
  function refused() {
    throw new Error(`network access refused in commerce-intake tests: ${what}`);
  };
net.Socket.prototype.connect = refuse('net.Socket.connect');
dns.lookup = refuse('dns.lookup');
dns.promises.lookup = refuse('dns.promises.lookup');
globalThis.fetch = refuse('fetch');
