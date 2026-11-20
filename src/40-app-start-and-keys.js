<script>
(function(){
  var $=function(id){return document.getElementById(id)};
  var S={get:function(k,d){try{var v=localStorage.getItem(k);return v===null?d:v}catch(e){return d}},set:function(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
  var ADMINVIEW=((document.querySelector('meta[name="view"]')||{}).content||'')==='admin'; // v102: the admin link; every other link is the user view
  try{[["ما شاء الله", "God willing"], ["مينا شهيد", "Mina Shaheid"], ["أبونا روفائيل", "Father Rofail"], ["القس روفائيل", "Father Rofail"], ["الشماس بطرس", "Deacon Botros"], ["الشماس بولس", "Deacon Boules"], ["الشماس أنطونيوس", "Deacon Antonious"], ["الشماس بيشوي", "Deacon Bishoy"], ["الكنيسة السريانية", "the Syriac Church"], ["الكنيسة السرياني", "the Syriac Church"], ["الآباء الأساقفة", "the bishops"], ["الآباء الكهنة", "the priests"], ["Syrian Church", "Syriac Church"], ["bishop fathers", "bishops"], ["Masha'Allah", "God willing"], ["Mashallah", "God willing"]].forEach(function(t){(window.COPTIC_TERMS=window.COPTIC_TERMS||[]).unshift(t)})}catch(e){} // v110: wording and names Mina gave after the 2026-11-18 test
  var KEYDB={
    open:function(){return new Promise(function(res,rej){try{var r=indexedDB.open('church',1);r.onupgradeneeded=function(){r.result.createObjectStore('kv')};r.onsuccess=function(){res(r.result)};r.onerror=function(){rej(r.error)}}catch(e){rej(e)}})},
    put:function(k,v){return KEYDB.open().then(function(db){return new Promise(function(res){var tx=db.transaction('kv','readwrite');tx.objectStore('kv').put(v,k);tx.oncomplete=function(){res(true)};tx.onerror=function(){res(false)}})}).catch(function(){return false})},
    get:function(k){return KEYDB.open().then(function(db){return new Promise(function(res){var q=db.transaction('kv').objectStore('kv').get(k);q.onsuccess=function(){res(q.result||'')};q.onerror=function(){res('')}})}).catch(function(){return ''})}
  };
  function saveKey(v){
    v=(v||'').trim();if(!v)return false;
    var ok=false;
    for(var i=0;i<3&&!ok;i++){try{localStorage.setItem('groqKey',v);ok=localStorage.getItem('groqKey')===v}catch(e){try{var tl=JSON.parse(localStorage.getItem('transcripts')||'[]');tl.shift();localStorage.setItem('transcripts',JSON.stringify(tl))}catch(e2){try{localStorage.removeItem('transcripts')}catch(e3){}}}} // storage full: make room by dropping the oldest saved service
    KEYDB.put('groqKey',v);
    try{document.cookie='gk='+encodeURIComponent(v)+';max-age=31536000;path=/;SameSite=Strict;Secure'}catch(e){}
    try{if(window.caches)caches.open('church-kv').then(function(c){return c.put('/key',new Response(v))})}catch(e){}
    return ok;
  }
  try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}
  // if the main copy of the key was lost, bring it back from the backup copy
  function cookieKey(){try{var m=/(?:^|; )gk=([^;]*)/.exec(document.cookie);return m?decodeURIComponent(m[1]):''}catch(e){return ''}}
  var KEYSRC='';
  if(!S.get('groqKey','')){
    KEYDB.get('groqKey').then(function(v){
      if(!v)v=cookieKey();
      if(v)return v;
      try{return window.caches?caches.open('church-kv').then(function(c){return c.match('/key')}).then(function(r){return r?r.text():''}):''}catch(e){return ''}
    }).then(function(v){if(v&&!S.get('groqKey','')){S.set('groqKey',v);KEYSRC='restored from backup'}}).catch(function(){});
  }
  else KEYDB.get('groqKey').then(function(v){var cur=S.get('groqKey','');if(cur&&v!==cur)KEYDB.put('groqKey',cur)});
  function keyBackup(){['sonioxKey','deepgramKey','cohereKey','claudeKey'].forEach(function(k){try{var cur=S.get(k,'');if(cur)KEYDB.put(k,cur);else KEYDB.get(k).then(function(v){if(v&&!S.get(k,''))S.set(k,v)})}catch(e){}})} // v63: a second copy of the other hearing keys, so they are pasted once and kept
  keyBackup();
  try{if(!localStorage.getItem('langMig38')){localStorage.setItem('lang','mixed');localStorage.setItem('langMig38','1')}}catch(e){} // v38: English words by the speaker are shown as said
  var LAUNCHES=0,STANDALONE=false;
  try{LAUNCHES=(parseInt(localStorage.getItem('launches')||'0',10)||0)+1;localStorage.setItem('launches',String(LAUNCHES))}catch(e){}
  try{STANDALONE=!!(window.navigator.standalone||(window.matchMedia&&matchMedia('(display-mode: standalone)').matches))}catch(e){}
  var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  var IOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);

