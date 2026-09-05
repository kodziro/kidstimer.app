/*
  TelemetryDeck "appstore-click" signal for kidstimer.app.

  Loads the TelemetryDeck JavaScript SDK (@telemetrydeck/sdk, ES module, no
  dependencies) from jsDelivr at runtime and sends one signal per click on an
  own App Store link (app id 1537955071; competitor App Store links on the
  comparison pages are ignored):  type "appstore-click", payload { page, position }.

  - Pageviews are still sent by the separate Web SDK tag in <head>; this file
    does not touch them.
  - Umami tracks the same click through its own data-umami-event attributes;
    this file reads the existing data-umami-event-position value as the
    "position" payload, so both tools report the same position names.
  - Navigation is never blocked or delayed: the click handler only fires a
    keepalive POST and returns. If the SDK fails to load, nothing is sent and
    the links keep working as plain links.
  - Cookieless: clientUser is a random value per page load, never stored.
*/
(function () {
  var APP_ID = 'C8069B87-B2F9-4171-A86E-90D5F369254D';
  var SDK_URL = 'https://cdn.jsdelivr.net/npm/@telemetrydeck/sdk@2.0.4/dist/telemetrydeck.js';
  var td = null;

  function pageSlug() {
    var explicit = document.body && document.body.getAttribute('data-td-page');
    if (explicit) return explicit;
    var path = location.pathname.replace(/\/index\.html$/, '/');
    if (path === '' || path === '/') return 'home';
    var guide = path.match(/\/guides\/([^\/]+)\.html$/);
    if (guide) return 'guide-' + guide[1];
    var name = path.replace(/^.*\//, '').replace(/\.html$/, '');
    return name || 'home';
  }

  function randomId() {
    try {
      if (crypto && crypto.randomUUID) return crypto.randomUUID();
    } catch (e) {}
    return String(Date.now()) + '-' + Math.random().toString(36).slice(2);
  }

  function isTestMode() {
    return /^localhost$|^127(\.\d+){0,2}\.\d+$|^\[::1?]$/.test(location.hostname) ||
      location.protocol === 'file:';
  }

  try {
    import(SDK_URL).then(function (mod) {
      var TelemetryDeck = mod.default;
      var instance = new TelemetryDeck({
        appID: APP_ID,
        clientUser: randomId(),
        testMode: isTestMode()
      });
      // Same request as the SDK's own _post (pinned 2.0.4), plus keepalive so
      // the browser finishes the POST even while it navigates to the App Store.
      instance._post = function (body) {
        return fetch(instance.target, {
          method: 'POST',
          mode: 'cors',
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      };
      td = instance;
    }).catch(function () { /* SDK unavailable: links still work, no signal */ });
  } catch (e) { /* dynamic import unsupported: same fallback */ }

  document.addEventListener('click', function (ev) {
    var target = ev.target;
    if (!target || !target.closest || !td) return;
    var link = target.closest('a[href*="id1537955071"]');
    if (!link) return;
    var position = link.getAttribute('data-umami-event-position') ||
      link.getAttribute('data-td-position') || 'other';
    try {
      td.signal('appstore-click', { page: pageSlug(), position: position })
        .catch(function () {});
    } catch (e) {}
  });
})();
