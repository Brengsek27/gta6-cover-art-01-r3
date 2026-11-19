export async function runShot(query, apply) {
  if (query.get('shot') === 'cover') document.body.classList.add('shot-cover');
  await apply(query);
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
