import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const chromePath = '/home/hatch/.cache/puppeteer/chrome/linux-157.0.8103.50/chrome-linux64/chrome';
const delay = duration => new Promise(resolveDelay => setTimeout(resolveDelay, duration));

async function freePort() {
  const server = createServer();
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  const port = server.address().port;
  await new Promise(resolveClose => server.close(resolveClose));
  return port;
}

export async function launchBrowser() {
  await mkdir(join(root, 'tools/.capture'), { recursive: true });
  const profile = await mkdtemp(join(root, 'tools/.capture/profile-'));
  const port = await freePort();
  const server = spawn(process.execPath, ['serve.ts', '--port', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  const browser = spawn(chromePath, [
    '--headless=new', '--no-sandbox', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--disable-gpu', '--hide-scrollbars', '--disable-background-networking', '--disable-component-update',
    '--disable-default-apps', '--no-first-run', '--no-default-browser-check', 'about:blank',
  ], { cwd: root, stdio: ['ignore', 'ignore', 'pipe'] });
  let socket;
  try {
    const endpoint = await new Promise((resolveEndpoint, reject) => {
      let stderr = '';
      const timeout = setTimeout(() => reject(new Error(`Chrome did not start: ${stderr.slice(-1000)}`)), 15000);
      browser.on('error', error => { clearTimeout(timeout); reject(error); });
      browser.on('exit', code => { clearTimeout(timeout); reject(new Error(`Chrome exited: ${code}`)); });
      browser.stderr.on('data', chunk => {
        stderr += chunk;
        const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (match) { clearTimeout(timeout); resolveEndpoint(match[1]); }
      });
    });
    socket = new WebSocket(endpoint);
    await new Promise((resolveOpen, reject) => { socket.onopen = resolveOpen; socket.onerror = reject; });
    const pending = new Map();
    const errors = [];
    let messageId = 0;
    socket.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text + ': ' + (message.params.exceptionDetails.exception?.description || ''));
      if (!message.id) return;
      const promise = pending.get(message.id);
      if (!promise) return;
      pending.delete(message.id); clearTimeout(promise.timeout);
      if (message.error) promise.reject(new Error(message.error.message));
      else promise.resolve(message.result);
    };
    const call = (method, params = {}, sessionId) => new Promise((resolveCall, reject) => {
      const id = ++messageId;
      const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 20000);
      pending.set(id, { resolve: resolveCall, reject, timeout });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
    const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
    const send = (method, params) => call(method, params, sessionId);
    await send('Page.enable'); await send('Runtime.enable');
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    for (let attempt = 0; attempt < 60; attempt++) {
      try { if ((await fetch(`http://127.0.0.1:${port}/app/`)).ok) break; } catch {}
      await delay(100);
      if (attempt === 59) throw new Error('Static server did not start');
    }
    return {
      send, evaluate, errors, baseUrl: `http://127.0.0.1:${port}/app/`,
      async navigate(query, width, height) {
        errors.length = 0;
        await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
        await send('Page.navigate', { url: `http://127.0.0.1:${port}/app/${query}` });
        for (let attempt = 0; attempt < 200; attempt++) {
          await delay(100);
          const status = await evaluate('({ready: window.__shotReady === true, error: window.__shotError})');
          if (status.error) throw new Error(status.error);
          if (status.ready) return;
        }
        throw new Error(`Shot timed out: ${query}\n${errors.join('\n')}`);
      },
      async close() {
        socket.close(); browser.kill('SIGTERM'); server.kill('SIGTERM');
        await Promise.all([new Promise(resolveExit => browser.exitCode !== null ? resolveExit() : browser.once('exit', resolveExit)), new Promise(resolveExit => server.exitCode !== null ? resolveExit() : server.once('exit', resolveExit))]);
        await rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
      },
    };
  } catch (error) {
    socket?.close(); browser.kill('SIGTERM'); server.kill('SIGTERM');
    throw error;
  }
}

async function capture() {
  const shots = JSON.parse(await readFile(join(root, 'shots.json'), 'utf8'));
  await mkdir(join(root, 'screenshots'), { recursive: true });
  const browser = await launchBrowser();
  try {
    for (const shot of shots) {
      await browser.navigate(shot.query, shot.w, shot.h);
      if (browser.errors.length) throw new Error(browser.errors.join('\n'));
      let bytes;
      let quality = 82;
      do {
        const { data } = await browser.send('Page.captureScreenshot', { format: 'jpeg', quality, captureBeyondViewport: false });
        bytes = Buffer.from(data, 'base64');
        if (bytes.length <= 262144) break;
        quality -= 7;
      } while (quality >= 40);
      if (bytes.length > 262144) throw new Error(`${shot.name} exceeds screenshot limit`);
      await writeFile(join(root, 'screenshots', shot.name), bytes);
      console.log(`${shot.name}  ${shot.w}×${shot.h}  ${bytes.length} bytes  JPEG ${quality}`);
    }
  } finally { await browser.close(); }
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  capture().catch(error => { console.error(error); process.exitCode = 1; });
}
