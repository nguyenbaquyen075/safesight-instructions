/* Set the theme before paint; storage may be disabled by the browser. */
(() => {
  let savedTheme;
  try { savedTheme = localStorage.getItem('safesight-theme'); } catch { /* Use system preference. */ }
  const theme = savedTheme === 'dark' || savedTheme === 'light'
    ? savedTheme : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = theme;
})();
