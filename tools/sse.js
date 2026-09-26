// Minimaler EventSource-Ersatz für Node (fetch mit Streaming-Body), nur für die Werkzeuge (duel-bot.js, Prüfskripte):
// Events nach dem SSE-Format (event:/data:), addEventListener, close, Neuverbindung nach einer Sekunde.
class NodeEventSource {
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.closed = false;
    this.listeners = new Map();
    this.connect();
  }
  addEventListener(name, fn) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(fn);
  }
  dispatch(name, data) {
    for (const fn of this.listeners.get(name) || []) fn({ type: name, data });
  }
  async connect() {
    if (this.closed) return;
    try {
      const res = await fetch(this.url, { headers: { Accept: 'text/event-stream' }, redirect: 'follow' });
      if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);
      this.readyState = 1;
      this.dispatch('open', null);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '', event = 'message', data = [];
      while (!this.closed) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).replace(/\r$/, '');
          buf = buf.slice(i + 1);
          if (line === '') {
            if (data.length) this.dispatch(event, data.join('\n'));
            event = 'message'; data = [];
            continue;
          }
          if (line.startsWith(':')) continue;
          const c = line.indexOf(':');
          const field = c < 0 ? line : line.slice(0, c);
          let val = c < 0 ? '' : line.slice(c + 1);
          if (val.startsWith(' ')) val = val.slice(1);
          if (field === 'event') event = val;
          else if (field === 'data') data.push(val);
        }
      }
    } catch {
      this.dispatch('error', null);
    }
    this.readyState = 0;
    if (!this.closed) setTimeout(() => this.connect(), 1000);
  }
  close() {
    this.closed = true;
    this.readyState = 2;
  }
}
module.exports = { NodeEventSource };
