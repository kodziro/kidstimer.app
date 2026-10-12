/*
  TelemetryDeck "appstore-click" and "crosslink-click" signals for kidstimer.app.

  Loads the TelemetryDeck JavaScript SDK (@telemetrydeck/sdk, ES module, no
  dependencies) from jsDelivr at runtime and sends one signal per click on an
  own App Store link (app id 1537955071; competitor App Store links on the
  comparison pages are ignored):  type "appstore-click",
  payload { page, position, source, path, referrer }.

  A click on a link to one of our other sites (the link has data-out) sends
  type "crosslink-click", payload { page, position, target, source, path,
  referrer }. target = data-out: "first-then" (first-then.app),
  "visual-schedule" (visual-schedule.app) or "token-board" (token-board.app);
  any other value sends nothing. position = data-td-position on the link.
  These links carry no Umami attributes.

  - source mirrors the Web SDK's "combinedSource" so clicks can be compared
    with pageviews by source: the utm_source query parameter if present (e.g.
    "chatgpt.com"), else the host of an external referrer (e.g.
    "www.google.com"), else "none". path is the page path, referrer the raw
    referrer host (may be kidstimer.app for internal navigation). No query
    strings, no full URLs, nothing personal.

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
  var CROSSLINK_TARGETS = { 'first-then': 1, 'visual-schedule': 1, 'token-board': 1 };
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

  function referrerHost() {
    try {
      return document.referrer ? new URL(document.referrer).hostname : '';
    } catch (e) { return ''; }
  }

  function source() {
    var utm = '';
    try { utm = new URLSearchParams(location.search).get('utm_source') || ''; } catch (e) {}
    if (utm) return utm.toLowerCase().slice(0, 100);
    var host = referrerHost();
    if (host && host !== location.hostname) return host;
    return 'none';
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
    var cross = target.closest('a[data-out]');
    if (cross) {
      var out = cross.getAttribute('data-out');
      if (!CROSSLINK_TARGETS[out]) return;
      try {
        td.signal('crosslink-click', {
          page: pageSlug(),
          position: cross.getAttribute('data-td-position') || 'other',
          target: out,
          source: source(),
          path: location.pathname,
          referrer: referrerHost() || 'none'
        }).catch(function () {});
      } catch (e) {}
      return;
    }
    var link = target.closest('a[href*="id1537955071"]');
    if (!link) return;
    var position = link.getAttribute('data-umami-event-position') ||
      link.getAttribute('data-td-position') || 'other';
    try {
      td.signal('appstore-click', {
        page: pageSlug(),
        position: position,
        source: source(),
        path: location.pathname,
        referrer: referrerHost() || 'none'
      }).catch(function () {});
    } catch (e) {}
  });
})();
