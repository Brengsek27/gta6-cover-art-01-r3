import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './capture.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const downloads = join(root, 'tools/.capture/downloads');
const pause = milliseconds => new Promise(resolvePause => setTimeout(resolvePause, milliseconds));
await rm(downloads, { recursive: true, force: true });
await mkdir(downloads, { recursive: true });
const browser = await launchBrowser();
const settle = expression => browser.evaluate(`(async () => { ${expression}; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); })()`);
const signature = () => browser.evaluate(`(() => {
  const canvas = document.getElementById('cover');
  const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let hash = 2166136261;
  for (let offset = 0; offset < pixels.length; offset += 997) hash = Math.imul(hash ^ pixels[offset], 16777619);
  return hash >>> 0;
})()`);
try {
  await browser.navigate('?shot=editor', 1280, 720);
  assert.equal(await browser.evaluate('document.querySelectorAll(".photo-thumb").length'), 4);
  assert.equal(await browser.evaluate('document.getElementById("caption").maxLength'), 40);
  const exportBounds = await browser.evaluate('(() => { const bounds = document.getElementById("export").getBoundingClientRect(); return {top: bounds.top, bottom: bounds.bottom}; })()');
  assert(exportBounds.top > 0 && exportBounds.bottom <= 720, 'Export must be visible at 1280×720');
  const layouts = { collage: [1920, 1080], stack: [1080, 1350], hero: [1920, 1080], duo: [1920, 1080], tilt: [1080, 1080] };
  const hashes = new Set();
  for (const [layout, size] of Object.entries(layouts)) {
    await settle(`document.querySelector('[data-layout="${layout}"]').click()`);
    assert.deepEqual(await browser.evaluate('(() => { const canvas = document.getElementById("cover"); return [canvas.width, canvas.height]; })()'), size);
    hashes.add(await signature());
    assert.equal(await browser.evaluate(`document.querySelector('[data-layout="${layout}"]').getAttribute('aria-pressed')`), 'true');
  }
  assert.equal(hashes.size, 5, 'Each layout must produce distinct artwork');
  const gradeHashes = new Set();
  for (const grade of ['sunset', 'neon', 'golden', 'vivid']) {
    await settle(`document.querySelector('[data-grade="${grade}"]').click()`);
    gradeHashes.add(await signature());
  }
  assert.equal(gradeHashes.size, 4, 'Each grade must change the cover');
  for (const key of ['ink', 'stars', 'grain']) {
    const before = await signature();
    await settle(`document.getElementById('${key}').click()`);
    assert.notEqual(await signature(), before, `${key} must repaint`);
  }
  for (const [id, value] of [['caption', 'MIDNIGHT RUN'], ['subtitle', 'no turning back'], ['sticker', 'HOT PURSUIT'], ['zoom', '1.35']]) {
    const before = await signature();
    await settle(`document.getElementById('${id}').value = ${JSON.stringify(value)}; document.getElementById('${id}').dispatchEvent(new Event('input', {bubbles: true}))`);
    assert.notEqual(await signature(), before, `${id} must repaint`);
  }
  for (const format of ['1080x1080', '1080x1350', '1920x1080']) {
    await settle(`document.getElementById('format').value = '${format}'; document.getElementById('format').dispatchEvent(new Event('change', {bubbles: true}))`);
    assert.deepEqual(await browser.evaluate('(() => { const canvas = document.getElementById("cover"); return [canvas.width, canvas.height]; })()'), format.split('x').map(Number));
  }
  await settle(`document.querySelector('[data-sample="street"]').click(); await new Promise(resolve => setTimeout(resolve, 50))`);
  assert.equal(await browser.evaluate('document.querySelector(".photo-thumb img").alt'), 'street');
  const { root: documentRoot } = await browser.send('DOM.getDocument');
  const { nodeId } = await browser.send('DOM.querySelector', { nodeId: documentRoot.nodeId, selector: '#upload' });
  await browser.send('DOM.setFileInputFiles', { nodeId, files: [join(root, 'app/samples/boulevard.jpg'), join(root, 'app/samples/pier.jpg')] });
  for (let attempt = 0; attempt < 30; attempt++) {
    if (await browser.evaluate('document.querySelectorAll(".photo-thumb").length === 6')) break;
    await pause(100);
  }
  assert.equal(await browser.evaluate('document.querySelectorAll(".photo-thumb").length'), 6);
  assert.equal(await browser.evaluate('document.querySelector(".photo-thumb img").alt'), 'boulevard.jpg');
  await settle('document.querySelector(".photo-thumb").click()');
  assert.equal(await browser.evaluate('document.querySelectorAll(".photo-thumb").length'), 5);
  await browser.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await settle('document.getElementById("export").click()');
  let filename;
  for (let attempt = 0; attempt < 60; attempt++) {
    filename = (await readdir(downloads)).find(name => name.endsWith('.png'));
    if (filename) break;
    await pause(100);
  }
  assert(filename, 'Export must download a PNG');
  const png = await readFile(join(downloads, filename));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), 1920);
  assert.equal(png.readUInt32BE(20), 1080);
  assert.deepEqual(browser.errors, []);
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await settle('window.dispatchEvent(new Event("resize"))');
  assert.equal(await browser.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true, 'Mobile must not overflow horizontally');
  console.log(`PASS: 5 layouts, 4 grades, 3 effects, all text/zoom/format controls, sample selection, multi-upload, removal, mobile fit, full-size PNG (${png.length} bytes), no browser errors.`);
} finally { await browser.close(); }
