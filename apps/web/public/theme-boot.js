/* global document */
/* Runs before the page paints (a file, so the content security policy allows it): puts the saved theme on <html> so
   the first frame is already the right one. Night is the default. data-boot tells ui/theme.ts the attribute is ours,
   not the host's. */
(function () {
  var d = 'night';
  try {
    var s = JSON.parse(localStorage.getItem('daroon.v1') || 'null');
    if (s && s.settings && s.settings.direction) d = s.settings.direction;
    if (s && !s.nightDefault && d === 'auto') d = 'night';
  } catch (e) {
    // no storage (a private window): night, the default
  }
  var t = d === 'light' ? 'light' : d === 'auto' ? '' : 'dark';
  var root = document.documentElement;
  root.setAttribute('data-boot', '');
  if (t) root.setAttribute('data-theme', t);
})();
