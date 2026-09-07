(() => {
  const root = document.documentElement;
  const themeButton = document.getElementById('theme-toggle');
  const menuButton = document.getElementById('menu-toggle');
  const navigation = document.getElementById('navigation');
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  let manualTheme = false;
  try { manualTheme = ['dark', 'light'].includes(localStorage.getItem('safesight-theme')); } catch { /* Storage is optional. */ }

  function applyTheme(theme) {
    root.dataset.theme = theme;
    themeButton.setAttribute('aria-pressed', String(theme === 'dark'));
    themeButton.setAttribute('aria-label', theme === 'dark' ? 'Chuyển giao diện sáng' : 'Chuyển giao diện tối');
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#141a17' : '#f3f2ed';
  }
  applyTheme(root.dataset.theme);
  themeButton.addEventListener('click', () => {
    const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    manualTheme = true;
    applyTheme(theme);
    try { localStorage.setItem('safesight-theme', theme); } catch { /* Toggle still works without storage. */ }
  });
  systemTheme.addEventListener('change', event => {
    if (!manualTheme) applyTheme(event.matches ? 'dark' : 'light');
  });

  function setMenu(open) {
    navigation.hidden = !open;
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Đóng menu' : 'Mở menu');
  }
  menuButton.addEventListener('click', () => setMenu(navigation.hidden));
  navigation.addEventListener('click', event => {
    if (event.target.closest('a')) setMenu(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !navigation.hidden) {
      setMenu(false);
      menuButton.focus();
    }
  });
  matchMedia('(min-width: 901px)').addEventListener('change', () => setMenu(false));
})();
