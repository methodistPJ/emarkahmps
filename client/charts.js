/* Small accessible SVG chart library, no external data or remote scripts. */
(function(M) {
  M.chart = (grades, title) => {
    const max = Math.max(1, ...Object.values(grades)),
      bars = Object.entries(grades).map(([g, n], i) => {
        const h = 140 * n / max,
          x = 45 + i * 75;
        return `<rect x="${x}" y="${170-h}" width="42" height="${h}" fill="${g==='F'?'#172B4D':'#3563E9'}"/><text x="${x+21}" y="${160-h}" text-anchor="middle">${n}</text><text x="${x+21}" y="195" text-anchor="middle">${g}</text>`;
      }).join('');
    return `<svg viewBox="0 0 520 220" class="chart" role="img" aria-label="${M.esc(title)}"><title>${M.esc(title)}. ${Object.entries(grades).map(([g,n])=>`${g}: ${n}`).join(', ')}</title><line x1="25" y1="171" x2="500" y2="171" stroke="#dce1ea"/>${bars}</svg>`;
  };
})(window.MPS);
