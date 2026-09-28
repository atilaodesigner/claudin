// Latency lab proxy (PLANO.md B5): TCP pass-through that delays every chunk by RTT/2 in
// each direction, plus jitter and "loss". On TCP (WebSocket) a lost packet shows up as a
// retransmission stall, so loss is modeled as an occasional extra delay that also holds
// back everything behind it (head-of-line blocking). Order is always preserved.
//
//   node proxy.mjs --listen 2600 --target 2567 --rtt 100 --jitter 15 --loss 0.01
import net from 'node:net';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : def;
};
const LISTEN = arg('listen', 2600);
const TARGET = arg('target', 2567);
const RTT = arg('rtt', 100);
const JITTER = arg('jitter', 0);
const LOSS = arg('loss', 0);
const STALL = arg('stall', 200); // retransmission stall (ms) when a "packet" is lost

function pipe(from, to) {
  let last = 0;
  from.on('data', (chunk) => {
    const now = Date.now();
    let delay = RTT / 2 + (Math.random() * 2 - 1) * JITTER;
    if (Math.random() < LOSS) delay += STALL;
    const at = Math.max(now + Math.max(0, delay), last); // TCP never reorders
    last = at;
    setTimeout(() => to.writable && to.write(chunk), at - now);
  });
  from.on('close', () => setTimeout(() => to.destroy(), RTT));
  from.on('error', () => to.destroy());
}

net
  .createServer((client) => {
    const server = net.connect(TARGET, '127.0.0.1');
    client.setNoDelay(true);
    server.setNoDelay(true);
    pipe(client, server);
    pipe(server, client);
  })
  .listen(LISTEN, () => console.log(`[netlab] :${LISTEN} → :${TARGET}  RTT ${RTT} ms ±${JITTER}  loss ${(LOSS * 100).toFixed(1)}%`));
