/* Preserve the current section when switching between static language pages. */
(() => {
  const links = [...document.querySelectorAll('.language-switch a[data-language]')];
  const targets = links.map(link => link.getAttribute('href').split('#')[0]);
  function update() {
    links.forEach((link, index) => { link.href = targets[index] + window.location.hash; });
  }
  update();
  window.addEventListener('hashchange', update);
})();
