// Live Translation: keeps a copy of the app on the device so it opens even when the Wi-Fi is weak or away.
// The network is always tried first (so updates still arrive by themselves); the saved copy is used only when the network is slow or fails.
var CACHE='lt-v1',CORE=['./','terms.js','names.js','liturgy.js','synaxarium.js','manifest.json','icon.png'];
self.addEventListener('install',function(e){self.skipWaiting();e.waitUntil(caches.open(CACHE).then(function(c){return Promise.all(CORE.map(function(u){return fetch(u,{cache:'no-store'}).then(function(r){if(r.ok)return c.put(new URL(u,self.registration.scope).href,r)}).catch(function(){})}))}))});
self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim())});
function keyOf(req){var u=new URL(req.url);u.search='';u.hash='';if(/\/index\.html$/.test(u.pathname))u.pathname=u.pathname.replace(/index\.html$/,'');return u.href}
self.addEventListener('fetch',function(e){
  var req=e.request;if(req.method!=='GET')return;
  var u=new URL(req.url);if(u.origin!==self.location.origin)return;
  if(req.headers.get('range'))return;
  var key=keyOf(req);
  e.respondWith(caches.open(CACHE).then(function(c){
    return c.match(key).then(function(saved){
      var net=fetch(req).then(function(r){if(r&&r.status===200){try{c.put(key,r.clone())}catch(x){}}return r});
      if(!saved)return net;
      // a saved copy exists: give the network 4 seconds, then use the saved copy (the download still finishes in the background for next time)
      return new Promise(function(done){var t=setTimeout(function(){done(saved)},4000);
        net.then(function(r){clearTimeout(t);done(r&&r.status===200?r:saved)},function(){clearTimeout(t);done(saved)})});
    })}));
});
