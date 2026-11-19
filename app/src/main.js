import { drawCover } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const byId = id => document.getElementById(id);
const sampleNames = ['boulevard', 'pier', 'marina', 'street'];
const state = { layout: 'collage', grade: 'sunset', caption: 'NEON COAST', sub: 'vice heat rising', sticker: 'VICE HEAT', ink: true, stars: true, grain: true, zoom: 1, size: '1920x1080' };
const sampleCache = new Map();
let photos = [];
let toastTimer;
let repaintFrame;

function notify(message) {
  byId('status').textContent = message;
  byId('status').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => byId('status').classList.remove('visible'), 3500);
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('This image could not be opened. Try a JPG, PNG or WebP.'));
    image.src = url;
  });
}

async function sample(name) {
  const id = sampleNames.includes(name) ? name : 'boulevard';
  if (!sampleCache.has(id)) sampleCache.set(id, loadImage(`./samples/${id}.jpg`).then(image => ({ id, image, name: id, url: image.src })));
  return sampleCache.get(id);
}

function renderStrip() {
  const strip = byId('photo-strip');
  strip.replaceChildren();
  photos.forEach((photo, index) => {
    const button = document.createElement('button');
    button.className = 'photo-thumb';
    button.title = photos.length > 1 ? `Remove ${photo.name}` : 'At least one scene is needed';
    button.setAttribute('aria-label', button.title);
    const image = document.createElement('img'); image.src = photo.url; image.alt = photo.name;
    const number = document.createElement('span'); number.textContent = `0${index + 1}`;
    button.append(image, number);
    button.addEventListener('click', () => {
      if (photos.length === 1) return notify('Keep one scene in your story. Add another first.');
      const [removed] = photos.splice(index, 1);
      if (removed.id === 'custom') URL.revokeObjectURL(removed.url);
      renderStrip(); repaint();
    });
    strip.append(button);
  });
  byId('photo-count').textContent = `${photos.length} LOADED`;
}

function updateControls() {
  document.querySelectorAll('[data-layout]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.layout === state.layout)));
  document.querySelectorAll('[data-grade]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.grade === state.grade)));
  byId('grade-name').textContent = state.grade.toUpperCase();
  byId('caption').value = state.caption; byId('subtitle').value = state.sub; byId('sticker').value = state.sticker;
  for (const key of ['ink', 'stars', 'grain']) byId(key).checked = state[key];
  byId('zoom').value = state.zoom;
  byId('zoom-value').textContent = `${Math.round(state.zoom * 100)}%`;
  byId('title-count').textContent = `${state.caption.length} / 40`;
  byId('format').value = state.size;
  byId('layout-readout').textContent = `${state.layout.toUpperCase()} / 0${['collage', 'stack', 'hero', 'duo', 'tilt'].indexOf(state.layout) + 1}`;
  byId('size-readout').textContent = `${canvas.width} × ${canvas.height} · PRINT-READY PNG`;
}

function repaint() {
  const [width, height] = state.size.split('x').map(Number);
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  drawCover(canvas, photos, state);
  updateControls();
}

function schedulePaint() {
  cancelAnimationFrame(repaintFrame);
  repaintFrame = requestAnimationFrame(repaint);
}

async function addFiles(files) {
  const accepted = [...files].filter(file => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type));
  if (!accepted.length) return notify('Choose JPG, PNG or WebP images.');
  const loaded = [];
  for (const file of accepted.slice(0, 12)) {
    const url = URL.createObjectURL(file);
    try { loaded.push({ id: 'custom', name: file.name, image: await loadImage(url), url }); }
    catch (error) { URL.revokeObjectURL(url); notify(error.message); }
  }
  if (loaded.length) {
    photos = [...loaded, ...photos].slice(0, 12);
    renderStrip(); repaint(); notify(`${loaded.length} scene${loaded.length > 1 ? 's' : ''} added. Your story starts here.`);
  }
  byId('upload').value = '';
}

document.querySelectorAll('[data-layout]').forEach(button => button.addEventListener('click', () => {
  state.layout = button.dataset.layout;
  state.size = state.layout === 'stack' ? '1080x1350' : state.layout === 'tilt' ? '1080x1080' : '1920x1080';
  repaint();
}));
document.querySelectorAll('[data-grade]').forEach(button => button.addEventListener('click', () => { state.grade = button.dataset.grade; repaint(); }));
document.querySelectorAll('[data-sample]').forEach(button => button.addEventListener('click', async () => {
  const photo = await sample(button.dataset.sample);
  photos = [photo, ...photos.filter(item => item !== photo)].slice(0, 12);
  renderStrip(); repaint();
}));
for (const [id, key] of [['caption', 'caption'], ['subtitle', 'sub'], ['sticker', 'sticker'], ['zoom', 'zoom']]) {
  byId(id).addEventListener('input', event => { state[key] = key === 'zoom' ? Number(event.target.value) : event.target.value; schedulePaint(); });
}
for (const key of ['ink', 'stars', 'grain']) byId(key).addEventListener('change', event => { state[key] = event.target.checked; repaint(); });
byId('format').addEventListener('change', event => { state.size = event.target.value; repaint(); });
byId('upload').addEventListener('change', event => addFiles(event.target.files));
const dropzone = byId('dropzone');
for (const name of ['dragenter', 'dragover']) dropzone.addEventListener(name, event => { event.preventDefault(); dropzone.classList.add('dragging'); });
for (const name of ['dragleave', 'drop']) dropzone.addEventListener(name, event => { event.preventDefault(); dropzone.classList.remove('dragging'); });
dropzone.addEventListener('drop', event => addFiles(event.dataTransfer.files));
byId('export').addEventListener('click', () => {
  repaint();
  canvas.toBlob(blob => {
    if (!blob) return notify('Export could not be created. Please try again.');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `${state.caption.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'neon-coast'}-${canvas.width}x${canvas.height}.png`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
    notify(`Cover exported · ${canvas.width} × ${canvas.height} PNG`);
  }, 'image/png');
});

async function initialize(query) {
  const requestedLayout = query.get('layout');
  if (['collage', 'stack', 'hero', 'duo', 'tilt'].includes(requestedLayout)) state.layout = requestedLayout;
  const grade = query.get('grade');
  if (['sunset', 'neon', 'golden', 'vivid'].includes(grade)) state.grade = grade;
  if (query.has('caption')) state.caption = query.get('caption').slice(0, 40);
  if (query.has('sub')) state.sub = query.get('sub').slice(0, 48);
  if (query.has('ink')) state.ink = query.get('ink') === '1';
  state.size = state.layout === 'stack' ? '1080x1350' : state.layout === 'tilt' ? '1080x1080' : '1920x1080';
  const size = query.get('size');
  if (size && /^\d{3,4}x\d{3,4}$/.test(size) && size.split('x').map(Number).every(value => value >= 320 && value <= 4096)) state.size = size;
  const names = ['photo', 'photo2', 'photo3', 'photo4'].filter(key => query.has(key)).map(key => query.get(key));
  photos = await Promise.all((names.length ? names : sampleNames).map(sample));
  const fonts = await Promise.all([
    new FontFace('Anton', 'url(./fonts/Anton-Regular.ttf)').load(),
    new FontFace('Pacifico', 'url(./fonts/Pacifico-Regular.ttf)').load(),
  ]);
  fonts.forEach(font => document.fonts.add(font));
  renderStrip(); repaint();
}

const query = new URLSearchParams(location.search);
try {
  if (query.has('shot')) await runShot(query, initialize);
  else await initialize(query);
} catch (error) { notify(error.message); window.__shotError = error.message; }
