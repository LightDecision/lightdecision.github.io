/* Accuracy uses correct answers / all questions, including invalid outputs in the denominator. */
(() => {
  const english = document.documentElement.lang === 'en';
  const source = document.getElementById('option-generalization-data');
  if (!source) return;
  const data = JSON.parse(source.textContent);
  const container = document.getElementById('option-accuracy-bars');
  const buttons = [...document.querySelectorAll('.option-count-tabs button')];
  const ns = 'http://www.w3.org/2000/svg';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = null;
  let selected = '255';
  const bars = [];
  function node(tag, attrs, parent) {
    const el = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
    parent.appendChild(el);
    return el;
  }
  data.models.forEach((model, i) => {
    const slotWidth = (508 - 32) / data.models.length;
    const x = 32 + (i + 0.5) * slotWidth - 20;
    const g = node('g', { 'data-accuracy-model': model.id }, container);
    const rect = node('rect', { x, width: 40, fill: model.color, rx: 1.2 }, g);
    const title = node('title', {}, rect);
    const value = node('text', { x: x + 20, 'text-anchor': 'middle', class: model.id === 'tiny' || model.id === '27b' ? 'option-bar-value' : 'option-baseline-value' }, g);
    const count = node('text', { x: x + 20, y: 253, 'text-anchor': 'middle', class: 'scaling-tick' }, g);
    const icon = model.icon
      ? node('image', { href: model.icon, x: x + 12, width: 16, height: 16 }, g)
      : node('text', { x: x + 20, 'text-anchor': 'middle', class: 'scaling-label' }, g);
    if (!model.icon) icon.textContent = 'H';
    if (i < 2) {
      const label = node('text', { x: x + 20, y: 274, 'text-anchor': 'middle', class: 'scaling-label' }, g);
      label.textContent = i === 0 ? '4B' : '27B';
    }
    bars.push({ model, g, rect, title, value, count, icon, accuracy: 0 });
  });
  function paint(bar, value) {
    const height = 160 * value, y = 230 - height;
    bar.rect.setAttribute('height', height);
    bar.rect.setAttribute('y', y);
    bar.value.setAttribute('y', height >= 20 ? y + 16 : y - 5);
    bar.icon.setAttribute('y', y - (height >= 20 ? 24 : 39) + (bar.model.icon ? 0 : 13));
    bar.accuracy = value;
  }
  function select(key, animate = true) {
    if (frame !== null) cancelAnimationFrame(frame);
    selected = key;
    const view = data.views[key];
    document.getElementById('option-accuracy-title').textContent = english
      ? `Accuracy on ${view.n} questions with ${Number(key).toLocaleString('en-US')} options`
      : `${Number(key).toLocaleString('en-US')} 个候选，${view.n} 道题的准确率`;
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.options === key)));
    const from = bars.map(bar => bar.accuracy);
    bars.forEach(bar => {
      const score = view.models[bar.model.id];
      bar.g.dataset.accuracy = score.accuracy;
      bar.value.textContent = (score.accuracy * 100).toFixed(2);
      bar.count.textContent = `${score.correct}/${score.total}`;
      bar.title.textContent = english
        ? `${bar.model.label}: ${score.correct}/${score.total} correct, accuracy ${(score.accuracy * 100).toFixed(2)}%`
        : `${bar.model.label}：答对 ${score.correct}/${score.total}，准确率 ${(score.accuracy * 100).toFixed(2)}%`;
    });
    const start = performance.now(), duration = animate && !reduced.matches ? 460 : 0;
    function tick(time) {
      const progress = duration ? Math.min(1, (time - start) / duration) : 1;
      const t = progress * progress * (3 - 2 * progress);
      bars.forEach((bar, i) => paint(bar, from[i] + (view.models[bar.model.id].accuracy - from[i]) * t));
      frame = progress < 1 ? requestAnimationFrame(tick) : null;
    }
    tick(start);
  }
  buttons.forEach((button, index) => {
    button.addEventListener('click', () => { if (button.dataset.options !== selected) select(button.dataset.options); });
    button.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? 3 : (index + (event.key === 'ArrowLeft' ? 3 : 1)) % 4;
      buttons[next].focus();
      select(buttons[next].dataset.options);
    });
  });
  select('255', false);
})();
