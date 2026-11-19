const CREAM = '#fff2d8';
const DARK = '#160a18';
const gradedImages = new WeakMap();
const textures = new Map();

export const sceneCaptions = {
  boulevard: 'OCEAN DRIVE · 6:42 PM · GOLDEN HOUR',
  pier: 'PIER 9 · 5:17 PM · ONE LAST CAST',
  marina: 'MARINA DEL SOL · 7:40 PM · NO WITNESSES',
  street: 'VICE STRIP · 8:03 PM · FULL THROTTLE',
  custom: 'YOUR SCENE · RIGHT NOW · MAIN CHARACTER',
};

function surface(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function overlayTint(channel, tint) {
  const base = Math.max(0, Math.min(1, channel / 255));
  const overlay = base < .5 ? 2 * base * tint : 1 - 2 * (1 - base) * (1 - tint);
  return 255 * (base + .20 * (overlay - base));
}

function graded(photo, grade, ink) {
  let cache = gradedImages.get(photo.image);
  if (!cache) { cache = new Map(); gradedImages.set(photo.image, cache); }
  const key = `${grade}-${ink}`;
  if (cache.has(key)) return cache.get(key);
  const image = photo.image;
  const scale = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight));
  const result = surface(Math.round(image.naturalWidth * scale), Math.round(image.naturalHeight * scale));
  const context = result.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, result.width, result.height);
  const pixels = context.getImageData(0, 0, result.width, result.height);
  const colors = pixels.data;
  const golden = grade === 'golden';
  const saturation = golden ? 1.34 : 1.46;
  for (let offset = 0; offset < colors.length; offset += 4) {
    const red = colors[offset];
    const green = colors[offset + 1];
    const blue = colors[offset + 2];
    if (grade === 'sunset' || golden) {
      const luma = red * .2126 + green * .7152 + blue * .0722;
      const tone = luma / 255;
      const contrast = .48 * luma * (1 - tone) * (2 * tone - 1);
      const highlight = tone * tone * (3 - 2 * tone);
      const pivot = luma * (1 - saturation) + contrast;
      const warmHighlight = Math.max(0, red - blue) * highlight;
      colors[offset] = overlayTint(red * saturation + pivot + .12 * warmHighlight, .72 + .28 * highlight);
      colors[offset + 1] = overlayTint(green * saturation + pivot - (golden ? .48 : .62) * warmHighlight, .27 + (golden ? .41 : .31) * highlight);
      colors[offset + 2] = overlayTint(blue * saturation + pivot + .22 * warmHighlight, .84 - (golden ? .64 : .58) * highlight);
    } else if (grade === 'neon') {
      colors[offset] = red * 1.07 + 25;
      colors[offset + 1] = green * .78 + 3;
      colors[offset + 2] = blue * 1.05 + 20;
    } else {
      const average = (red + green + blue) / 3;
      colors[offset] = average + (red - average) * 1.35 + 12;
      colors[offset + 1] = average + (green - average) * 1.28;
      colors[offset + 2] = average + (blue - average) * 1.25;
    }
    if (ink) {
      colors[offset] = Math.round(colors[offset] / 10) * 10;
      colors[offset + 1] = Math.round(colors[offset + 1] / 10) * 10;
      colors[offset + 2] = Math.round(colors[offset + 2] / 10) * 10;
    }
  }
  context.putImageData(pixels, 0, 0);
  cache.set(key, result);
  return result;
}

function fit(context, image, width, height, zoom = 1, cropY = .5) {
  const scale = Math.max(width / image.width, height / image.height) * zoom;
  const drawnWidth = image.width * scale;
  const drawnHeight = image.height * scale;
  context.drawImage(image, (width - drawnWidth) / 2, (height - drawnHeight) * cropY, drawnWidth, drawnHeight);
}

function caps(context, text, x, y, size, color = CREAM, spacing = 1.3) {
  context.font = `600 ${size}px system-ui, sans-serif`;
  context.fillStyle = color;
  context.letterSpacing = `${spacing}px`;
  context.fillText(text, x, y);
  context.letterSpacing = '0px';
}

function star(context, x, y, radius, color = '#f9cb69') {
  context.beginPath();
  for (let point = 0; point < 10; point++) {
    const angle = -Math.PI / 2 + point * Math.PI / 5;
    const length = point % 2 ? radius * .43 : radius;
    context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
  }
  context.closePath(); context.fillStyle = color; context.fill();
}

function chip(context, photo, width, height, fontSize = 8) {
  const text = sceneCaptions[photo.id] || sceneCaptions.custom;
  const margin = 12;
  context.save();
  context.font = `600 ${fontSize}px system-ui, sans-serif`;
  context.letterSpacing = '.8px';
  const available = width - margin * 2;
  const measured = context.measureText(text).width + 26;
  const scale = Math.min(1, available / measured);
  context.translate(margin, height - 31);
  context.scale(scale, scale);
  context.fillStyle = '#1c101bdc';
  context.fillRect(0, 0, measured, 21);
  context.fillStyle = '#ffd17c';
  context.beginPath(); context.arc(9, 10.5, 2, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#fff0d4';
  context.fillText(text, 17, 14);
  context.restore();
}

export function getPanels(layout, width, height) {
  const panel = (x, y, wide, high, photo, rotation = 0, cropY = .5) => ({ x: x * width, y: y * height, w: wide * width, h: high * height, photo, rotation, cropY });
  if (layout === 'stack') return [
    panel(.022, .018, .956, .445, 0, 0, .04),
    panel(.022, .474, .474, .214, 1, 0, .04),
    panel(.506, .474, .472, .214, 2),
    panel(.022, .701, .956, .216, 3, 0, .50),
  ];
  if (layout === 'tilt') return [
    panel(.045, .155, .34, .50, 0, -6, .16),
    panel(.62, .16, .34, .50, 2, 5, .16),
    panel(.29, .185, .42, .42, 1, 0, .10),
  ];
  if (layout === 'duo') return [panel(.02, .025, .475, .885, 0, 0, .3), panel(.505, .025, .475, .885, 1)];
  if (layout === 'hero') return [panel(.015, .02, .97, .89, 0, 0, .3)];
  return [
    panel(.02, .025, .535, .625, 0, 0, .04),
    panel(.565, .025, .415, .46, 1, 0, .02),
    panel(.565, .501, .415, .405, 2, 0, .52),
    panel(.02, .668, .535, .238, 3, 0, .62),
  ];
}

function drawPanel(context, panel, photo, options) {
  const border = 6.5;
  context.save();
  context.translate(panel.x + panel.w / 2, panel.y + panel.h / 2);
  context.rotate(panel.rotation * Math.PI / 180);
  context.translate(-panel.w / 2, -panel.h / 2);
  const layered = ['tilt', 'collage', 'stack'].includes(options.layout);
  context.shadowColor = layered ? '#0b0209d9' : '#0b0209bf';
  context.shadowBlur = options.layout === 'tilt' ? 35 : layered ? 23 : 18;
  context.shadowOffsetX = 3;
  context.shadowOffsetY = options.layout === 'tilt' ? 15 : 8;
  context.fillStyle = '#f5e6c9';
  context.fillRect(-border, -border, panel.w + border * 2, panel.h + border * 2);
  context.shadowColor = 'transparent';
  context.shadowBlur = 0; context.shadowOffsetX = 0; context.shadowOffsetY = 0;
  context.save();
  context.beginPath(); context.rect(0, 0, panel.w, panel.h); context.clip();
  fit(context, graded(photo, options.grade, options.ink), panel.w, panel.h, options.zoom, panel.cropY);
  const shade = context.createLinearGradient(0, panel.h * .38, 0, panel.h);
  shade.addColorStop(0, '#250c2400'); shade.addColorStop(1, '#230c244f');
  context.fillStyle = shade; context.fillRect(0, 0, panel.w, panel.h);
  chip(context, photo, panel.w, panel.h, options.layout === 'stack' ? 8.5 : 8);
  context.restore();
  context.strokeStyle = '#1a1023'; context.lineWidth = 1.5;
  context.strokeRect(-border, -border, panel.w + border * 2, panel.h + border * 2);
  context.restore();
}

function palm(context, x, y, height, lean) {
  context.save(); context.translate(x, y);
  context.strokeStyle = '#251625'; context.fillStyle = '#251625';
  context.lineWidth = height * .035;
  context.beginPath(); context.moveTo(0, 0); context.quadraticCurveTo(lean * .3, -height * .55, lean, -height); context.stroke();
  for (let frond = 0; frond < 9; frond++) {
    const angle = -Math.PI + frond * Math.PI / 8;
    const reach = height * .35;
    const endX = lean + Math.cos(angle) * reach;
    const endY = -height + Math.sin(angle) * reach * .55 + height * .13;
    const controlX = lean + Math.cos(angle) * reach * .68;
    const controlY = -height + Math.sin(angle) * reach * .8 - height * .07;
    context.lineWidth = height * .006;
    context.beginPath(); context.moveTo(lean, -height); context.quadraticCurveTo(controlX, controlY, endX, endY); context.stroke();
    for (let leaf = 1; leaf <= 11; leaf++) {
      const fraction = leaf / 12;
      const inverse = 1 - fraction;
      const leafX = inverse * inverse * lean + 2 * inverse * fraction * controlX + fraction * fraction * endX;
      const leafY = inverse * inverse * -height + 2 * inverse * fraction * controlY + fraction * fraction * endY;
      const length = height * .10 * (1 - fraction * .68);
      context.beginPath(); context.moveTo(leafX, leafY);
      context.lineTo(leafX + (frond < 4 ? -1 : 1) * length * .35, leafY + length);
      context.lineTo(leafX + height * .009, leafY - height * .004); context.fill();
    }
  }
  context.restore();
}

function backdrop(context, scene, width, height, options) {
  if (scene) fit(context, graded(scene, options.grade, options.ink), width, height, 1.04, .5);
  context.fillStyle = '#2c132a60'; context.fillRect(0, 0, width, height);
  const glow = context.createRadialGradient(width * .69, height * .13, 0, width * .69, height * .13, width * .5);
  glow.addColorStop(0, '#ffd58b90'); glow.addColorStop(1, '#ffb76a00');
  context.fillStyle = glow; context.fillRect(0, 0, width, height);
  context.fillStyle = '#ffce86'; context.beginPath(); context.arc(width * .76, height * .16, width * .075, 0, Math.PI * 2); context.fill();
  palm(context, width * .06, height * .79, height * .69, width * .06);
  palm(context, width * .96, height * .75, height * .7, -width * .03);
}

function starsPill(context, x, y, scale = 1) {
  context.save(); context.translate(x, y); context.scale(scale, scale);
  context.fillStyle = '#20121be8'; context.beginPath(); context.roundRect(-72, -20, 144, 52, 25); context.fill();
  context.strokeStyle = '#f9d28b6b'; context.lineWidth = 1; context.stroke();
  for (let index = 0; index < 5; index++) star(context, -45 + index * 23, -1, 8);
  context.textAlign = 'center'; caps(context, 'MAXIMUM HEAT', 0, 19, 6.6, '#f9d28b', 1.8);
  context.restore();
}

function seal(context, x, y, radius, label) {
  context.save(); context.translate(x, y); context.rotate(8 * Math.PI / 180);
  context.beginPath();
  for (let point = 0; point < 64; point++) {
    const angle = point * Math.PI / 32;
    const length = point % 2 ? radius * .91 : radius;
    context.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
  }
  context.closePath(); context.shadowColor = '#140615b3'; context.shadowBlur = 13; context.shadowOffsetY = 8;
  const gold = context.createLinearGradient(0, -radius, 0, radius);
  gold.addColorStop(0, '#ffe4a0'); gold.addColorStop(.55, '#e9ae4b'); gold.addColorStop(1, '#c48133');
  context.fillStyle = gold; context.fill(); context.shadowColor = 'transparent';
  context.strokeStyle = '#4e2b26'; context.lineWidth = 1.2; context.setLineDash([3, 3]);
  context.beginPath(); context.arc(0, 0, radius * .79, 0, Math.PI * 2); context.stroke(); context.setLineDash([]);
  context.textAlign = 'center'; caps(context, 'LIMITED EDITION', 0, -radius * .47, radius * .105, '#4b2825', 1);
  const words = (label.trim() || 'VICE HEAT').toUpperCase().split(/\s+/);
  const lines = words.length > 1 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : words;
  let size = radius * .44;
  context.font = `${size}px Anton`;
  while (lines.some(line => context.measureText(line).width > radius * 1.3) && size > 9) context.font = `${--size}px Anton`;
  context.fillStyle = '#3f2024';
  lines.forEach((line, index) => context.fillText(line, 0, lines.length === 1 ? size * .3 : -2 + index * size * 1.06));
  caps(context, 'NO. 001 / NC', 0, radius * .62, radius * .1, '#4b2825', 1);
  context.restore();
}

function titleLines(text, portrait) {
  const words = text.trim().toUpperCase().split(/\s+/);
  if (!portrait || text.length < 13 || words.length < 2) return [words.join(' ')];
  let best = 1;
  for (let index = 1; index < words.length; index++) {
    if (Math.abs(words.slice(0, index).join(' ').length - words.slice(index).join(' ').length) < Math.abs(words.slice(0, best).join(' ').length - words.slice(best).join(' ').length)) best = index;
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}

function lettering(context, width, height, options) {
  if (!options.caption.trim()) return;
  const portrait = height / width > .82;
  const lines = titleLines(options.caption, portrait);
  const twoLines = lines.length > 1;
  const maxWidth = width * (options.layout === 'collage' ? .82 : .87);
  let size = twoLines ? height * (options.layout === 'stack' ? .115 : .128) : Math.min(height * .19, width * .205);
  context.letterSpacing = '-.8px';
  context.font = `${size}px Anton`;
  while (lines.some(line => context.measureText(line).width > maxWidth) && size > 20) { size -= 1; context.font = `${size}px Anton`; }
  const baseline = height * (twoLines ? .789 : .837);
  const step = size * 1.03;
  const center = width * (options.layout === 'collage' ? .46 : options.layout === 'stack' ? .565 : .5);
  context.save(); context.textAlign = 'center'; context.lineJoin = 'round';
  lines.forEach((line, index) => {
    const y = baseline + index * step;
    context.font = `${size}px Anton`;
    context.lineWidth = size / 9;
    context.strokeStyle = '#2a0a24'; context.fillStyle = '#2a0a24';
    context.strokeText(line, center - size * .045, y + size * .085);
    context.fillText(line, center - size * .045, y + size * .085);
    context.strokeStyle = DARK; context.strokeText(line, center, y);
    const gradient = context.createLinearGradient(0, y - size * .8, 0, y);
    gradient.addColorStop(0, '#fff6dd'); gradient.addColorStop(.44, '#ffdb8d'); gradient.addColorStop(.72, '#ffb347'); gradient.addColorStop(1, '#ff7a3c');
    context.fillStyle = gradient; context.fillText(line, center, y);
    const highlight = context.createLinearGradient(0, y - size * .83, 0, y - size * .48);
    highlight.addColorStop(0, '#ffffff75'); highlight.addColorStop(1, '#ffffff00');
    context.fillStyle = highlight; context.fillText(line, center, y - .65);
  });
  const scriptY = options.layout === 'collage' ? height * .83 : twoLines ? Math.min(height * .914, baseline + step + size * .20) : height * .898;
  context.letterSpacing = '0px';
  context.translate(width * .61, scriptY); context.rotate(-3 * Math.PI / 180);
  let scriptSize = Math.min(width * .057, height * .077);
  context.font = `${scriptSize}px Pacifico`;
  while (context.measureText(options.sub).width > width * .63 && scriptSize > 12) context.font = `${--scriptSize}px Pacifico`;
  context.shadowColor = '#ff3082'; context.shadowBlur = 13;
  context.lineWidth = 3; context.strokeStyle = '#541831'; context.strokeText(options.sub, 0, 0);
  context.fillStyle = '#ff5da2'; context.fillText(options.sub, 0, 0);
  context.restore();
}

function furniture(context, width, height) {
  const baseY = height * .943;
  const size = Math.min(32, height * .047);
  context.save();
  context.fillStyle = '#1b101ee8'; context.fillRect(0, height * .923, width, height * .077);
  context.strokeStyle = '#f4dfb1'; context.lineWidth = 1;
  context.strokeRect(28, baseY - 7, size, size);
  context.font = `${size * .58}px Anton`; context.fillStyle = CREAM; context.textAlign = 'center';
  context.fillText('NC', 28 + size / 2, baseY + size * .48);
  context.textAlign = 'left';
  caps(context, 'NEON COAST EDITION', 38 + size, baseY + 2, 9, CREAM, 1.6);
  caps(context, 'MAKE YOUR OWN LEGEND · VOL. 06', 38 + size, baseY + 14, 6.3, '#e4c899', 1.1);
  const codeX = width - 143;
  context.fillStyle = '#f3ddb4';
  let cursor = codeX;
  for (let bar = 0; bar < 50; bar++) {
    const thickness = ((bar * 7 + bar * bar) % 3) + .7;
    context.fillRect(cursor, baseY - 9, thickness, 20 - (bar % 7 === 0 ? 0 : 3));
    cursor += thickness + 1;
    if (cursor > width - 30) break;
  }
  caps(context, '0 02026 NC001', codeX, baseY + 21, 6, CREAM, 2.2);
  caps(context, 'NEON COAST STUDIO · AN INDEPENDENT PICTURE · YOUR CITY. YOUR STORY. YOUR RULES.', 28, height - 9, 5.5, '#d7c6aa', .9);
  context.textAlign = 'right'; caps(context, 'EST. MMXXVI', width - 28, height - 9, 6, CREAM, 1.2);
  context.strokeStyle = '#fff0cc9c'; context.lineWidth = .7;
  context.strokeRect(10, 10, width - 20, height - 20);
  context.restore();
}

function finish(context, width, height, grain) {
  if (grain) {
    let texture = textures.get('grain');
    if (!texture) {
      texture = surface(220, 220);
      const noiseContext = texture.getContext('2d');
      const image = noiseContext.createImageData(220, 220);
      let seed = 7319;
      for (let offset = 0; offset < image.data.length; offset += 4) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const value = seed >>> 24;
        image.data[offset] = value; image.data[offset + 1] = value; image.data[offset + 2] = value; image.data[offset + 3] = 24;
      }
      noiseContext.putImageData(image, 0, 0); textures.set('grain', texture);
    }
    context.save(); context.globalCompositeOperation = 'soft-light';
    context.fillStyle = context.createPattern(texture, 'repeat'); context.fillRect(0, 0, width, height); context.restore();
  }
  const vignette = context.createRadialGradient(width * .5, height * .43, width * .22, width * .5, height * .43, Math.max(width, height) * .75);
  vignette.addColorStop(0, '#170b2000'); vignette.addColorStop(1, '#170b2070');
  context.fillStyle = vignette; context.fillRect(0, 0, width, height);
}

export function drawCover(canvas, photos, input = {}) {
  const options = { layout: 'collage', grade: 'sunset', caption: 'NEON COAST', sub: 'vice heat rising', sticker: 'VICE HEAT', ink: true, stars: true, grain: true, zoom: 1, ...input };
  if (!photos.length) return;
  const context = canvas.getContext('2d');
  const width = 1000;
  const height = width * canvas.height / canvas.width;
  context.setTransform(canvas.width / width, 0, 0, canvas.width / width, 0, 0);
  context.fillStyle = '#29182b'; context.fillRect(0, 0, width, height);
  const usedImages = new Set();
  if (options.layout === 'tilt') {
    const scene = photos[3];
    const snapshots = photos.slice(0, 3);
    backdrop(context, snapshots.some(photo => photo.image === scene?.image) ? null : scene, width, height, options);
  }
  const panels = getPanels(options.layout, width, height);
  for (const panel of panels) {
    const photo = photos[panel.photo];
    if (!photo || usedImages.has(photo.image)) continue;
    usedImages.add(photo.image);
    drawPanel(context, panel, photo, options);
  }
  if (options.stars) {
    const hero = panels[options.layout === 'tilt' ? 2 : 0];
    starsPill(context, hero.x + hero.w - 76, hero.y + 34, options.layout === 'stack' ? 1.1 : .85);
  }
  if (options.layout === 'collage') {
    context.fillStyle = '#1b101be6'; context.fillRect(32, height * .635, 320, 20);
    for (let index = 0; index < 5; index++) star(context, 44 + index * 12, height * .65, 4);
    caps(context, '“PURE GOLDEN-HOUR MAYHEM” — THE LEONIDA POST', 106, height * .657, 7.1, CREAM, .55);
  }
  lettering(context, width, height, options);
  if (options.sticker.trim()) {
    const collage = options.layout === 'collage';
    const sealY = collage ? .58 : ['stack', 'tilt'].includes(options.layout) ? .727 : .73;
    seal(context, width * (collage ? .883 : .857), height * sealY, collage ? 64 : 68, options.sticker);
  }
  furniture(context, width, height);
  finish(context, width, height, options.grain);
}
