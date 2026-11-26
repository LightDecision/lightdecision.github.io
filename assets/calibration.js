/* MMDM reliability diagram. All plotted points come from the saved common-sample bins. */
(() => {
  'use strict';
  const english = document.documentElement.lang === 'en';
  const dataElement = document.getElementById('calibration-data');
  if (!dataElement) return;
  const data = JSON.parse(dataElement.textContent);
  const svgNS = 'http://www.w3.org/2000/svg';
  const container = document.getElementById('calibration-curves');
  const tabs = [...document.querySelectorAll('.calibration-tabs [role="tab"]')];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const series = new Map();
  let frame = null;
  let currentMode = 'hard';

  function element(name, attributes, parent) {
    const node = document.createElementNS(svgNS, name);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    parent.appendChild(node);
    return node;
  }

  // Baselines are drawn first so the two solid gold curves remain easy to follow.
  const drawOrder = [...data.models.filter(model => !model.ours), ...data.models.filter(model => model.ours)];
  for (const model of drawOrder) {
    const group = element('g', { 'data-cal-model': model.id }, container);
    const paths = Array.from({ length: 9 }, () => element('path', {
      fill: 'none', stroke: model.color, 'stroke-width': model.ours ? 3 : 2,
      'stroke-dasharray': model.ours ? 'none' : '7 5', 'stroke-linecap': 'round'
    }, group));
    const points = Array.from({ length: 10 }, () => {
      const point = element('circle', {
        r: model.ours ? 4.5 : 3.4, fill: model.color, stroke: model.color,
        'stroke-width': 1.7, tabindex: 0, role: 'img'
      }, group);
      element('title', {}, point);
      return point;
    });
    series.set(model.id, { model, paths, points, state: null });
  }

  function targetState(model, mode) {
    const bins = data.views[mode].models[model.id].bins;
    return {
      points: bins.map(bin => ({
        x: 86 + 860 * (bin.confidence ?? (bin.index + 0.5) / 10),
        y: 418 - 340 * (bin.target ?? 0),
        opacity: bin.n ? 1 : 0,
        hollow: bin.low_count
      })),
      segments: bins.slice(0, -1).map((bin, index) => bin.n && bins[index + 1].n ? 1 : 0)
    };
  }

  function paint(item, state) {
    state.points.forEach((point, index) => {
      const circle = item.points[index];
      circle.setAttribute('cx', point.x);
      circle.setAttribute('cy', point.y);
      circle.setAttribute('opacity', point.opacity);
      circle.setAttribute('fill', point.hollow ? '#fff' : item.model.color);
      circle.setAttribute('tabindex', point.opacity > 0.99 ? '0' : '-1');
      circle.setAttribute('aria-hidden', point.opacity === 0 ? 'true' : 'false');
      circle.style.pointerEvents = point.opacity > 0.99 ? 'auto' : 'none';
    });
    item.paths.forEach((path, index) => {
      const a = state.points[index], b = state.points[index + 1];
      path.setAttribute('d', `M${a.x} ${a.y} L${b.x} ${b.y}`);
      path.setAttribute('opacity', state.segments[index]);
    });
    item.state = state;
  }

  function updateLabels(mode) {
    const view = data.views[mode];
    const hard = mode === 'hard';
    const ylabel = english
      ? (hard ? 'Observed accuracy' : 'Mean target probability of chosen answer')
      : (hard ? '实际准确率' : '所选答案的平均目标概率');
    document.getElementById('cal-y-label').textContent = ylabel;
    document.getElementById('cal-title').textContent = english ? `MMDM ${hard ? 'hard' : 'soft'}-label calibration` : `MMDM ${hard ? '硬' : '软'}标签概率校准`;
    document.getElementById('cal-desc').textContent = english
      ? `Mean predicted probability versus ${ylabel.toLowerCase()} on ${view.n} shared valid examples. Solid lines: LightDecision-1; dashed lines: baselines. Filled points: at least 20 examples; hollow points: fewer than 20.`
      : `在 ${view.n} 条共同有效样本上比较平均预测概率与${ylabel}。实线为 LightDecision-1，虚线为对照模型；实心点表示大于等于 20 条样本，空心点表示少于 20 条样本。`;
    const percent = value => `${(value * 100).toFixed(2)}%`;
    document.getElementById('calibration-panel').setAttribute('aria-labelledby', `cal-tab-${mode}`);
    tabs.forEach(tab => {
      const active = tab.dataset.mode === mode;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    for (const item of series.values()) {
      const stats = view.models[item.model.id];
      const legend = document.querySelector(`.calibration-model-legend [data-model="${item.model.id}"]`);
      legend.title = `${item.model.label} · ECE ${percent(stats.ece)} · n=${stats.n}`;
      stats.bins.forEach((bin, index) => {
        const text = bin.n
          ? `${item.model.label} · ${english ? 'Predicted probability' : '预测概率'} ${percent(bin.confidence)} · ${ylabel} ${percent(bin.target)} · n=${bin.n}`
          : `${item.model.label} · ${english ? 'No examples in this bin' : '该区间无样本'}`;
        item.points[index].querySelector('title').textContent = text;
        item.points[index].setAttribute('aria-label', text);
      });
    }
  }

  function select(mode, animate = true) {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    currentMode = mode;
    updateLabels(mode);
    const transitions = [...series.values()].map(item => {
      const to = targetState(item.model, mode);
      const from = item.state || to;
      // Appearing/disappearing bins fade at their observed position, without inventing observations.
      const start = { points: from.points.map((p, i) => p.opacity === 0 ? { ...to.points[i], opacity: 0 } : p), segments: from.segments };
      const end = { points: to.points.map((p, i) => p.opacity === 0 ? { ...from.points[i], opacity: 0 } : p), segments: to.segments };
      return { item, from: start, to: end };
    });
    const duration = animate && !reduceMotion.matches ? 480 : 0;
    const started = performance.now();
    function tick(now) {
      const progress = duration ? Math.min(1, (now - started) / duration) : 1;
      const t = progress * progress * (3 - 2 * progress);
      for (const { item, from, to } of transitions) {
        paint(item, {
          points: to.points.map((p, i) => ({
            x: from.points[i].x + (p.x - from.points[i].x) * t,
            y: from.points[i].y + (p.y - from.points[i].y) * t,
            opacity: from.points[i].opacity + (p.opacity - from.points[i].opacity) * t,
            hollow: p.hollow
          })),
          segments: to.segments.map((opacity, i) => from.segments[i] + (opacity - from.segments[i]) * t)
        });
      }
      frame = progress < 1 ? requestAnimationFrame(tick) : null;
    }
    tick(started);
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.dataset.mode !== currentMode) select(tab.dataset.mode);
    });
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[1] : tabs.find(other => other !== tab);
      next.focus();
      select(next.dataset.mode);
    });
  });
  select('hard', false);
})();
