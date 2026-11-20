  // ---- v102: two views of the same app ----
  // The link that is shared is the USER view: captions, text size, Start / Pause, full screen. Nothing else can be reached from it.
  // The ADMIN link (…/admin/) asks for a passcode that the church server checks (never the page: this page's code is public),
  // shows every setting, and saves the settings on the server so every device picks them up by itself.
  var CFG_URL='https://church-settings.minaypharmd.workers.dev',CFG_NS=/\/test\//.test(location.pathname)?'test':'live';
  // what every device shares. Keys, the review key, the text size and the instant preview stay with each device.
  var SHARED=['micMode','noise','lang','autoRead','notes','terms','hideWords','reading','prayers','showAr','maxMin','idleMin','dailyCap','builtin','think','frame','title'];
  var LIGHT={showAr:1,frame:1,think:1,title:1}; // safe to change while a service is running; the rest waits until it is stopped
  var CFG={rev:parseInt(S.get('cfgRev','0'),10)||0,busy:false,pt:0,rt:0};
  function cfgTok(){var t=S.get('adminTok','');var m=/^(\d{10,16})\.[0-9a-f]{64}$/.exec(t);return m&&Number(m[1])>Date.now()?t:''}
  function cfgDef(k){return k==='title'?CHURCH:(DEF[k]||'')}
  function cfgLocal(){var o={};SHARED.forEach(function(k){o[k]=String(S.get(k,cfgDef(k)))});return o}
  function cfgFetch(path,opts,ms){
    var ac=('AbortController' in window)?new AbortController():null,o=opts||{};if(ac)o.signal=ac.signal;o.cache='no-store';
    var t=setTimeout(function(){try{ac&&ac.abort()}catch(e){}},ms||9000);
    return fetch(CFG_URL+path,o).then(function(r){clearTimeout(t);return r.json().then(function(j){return {s:r.status,j:j||{}}},function(){return {s:r.status,j:{}}})},function(e){clearTimeout(t);throw e});
  }
  function cfgNote(text,bad,stay){
    if(!ADMINVIEW)return;var n=$('cfgNote');
    if(!n){n=document.createElement('div');n.id='cfgNote';document.body.appendChild(n)}
    n.textContent=text||'';n.className=bad?'bad':'';n.style.display=text?'block':'none';
    clearTimeout(CFG.nt);if(text&&!bad&&!stay)CFG.nt=setTimeout(function(){n.style.display='none'},5000);
  }
  function cfgEditing(){try{return ADMINVIEW&&(dlg.open||document.activeElement===title||S.get('cfgDirty','')==='1')}catch(e){return false}}
  // takes the server's settings into this device. Never moves backwards, never touches what the admin is in the middle of changing.
  function cfgApply(vals,rev){
    if(!vals||typeof rev!=='number'||rev<=CFG.rev)return false;
    if(cfgEditing())return false;
    if(!S.get('cfgBackup','')){try{S.set('cfgBackup',JSON.stringify({at:new Date().toISOString(),values:cfgLocal()}))}catch(e){}} // this device's own settings from before the first sync, kept once
    var ch=[],waiting=false;
    SHARED.forEach(function(k){
      if(typeof vals[k]!=='string')return;var v=(k==='title'&&(!vals[k].trim()||vals[k]===CHURCH_OLD))?CHURCH:vals[k];
      if(String(S.get(k,cfgDef(k)))===v)return;
      if(running&&!LIGHT[k]){waiting=true;return}
      S.set(k,v);ch.push(k);
    });
    if(!waiting){CFG.rev=rev;S.set('cfgRev',String(rev))} // with something still waiting, the same version is taken again after the service
    if(ch.length){
      dbg('SETTINGS from the server (version '+rev+'): '+ch.join(', ')+(waiting?' (the rest waits until the service is stopped)':''));
      try{if(ch.indexOf('title')>=0){title.textContent=S.get('title',CHURCH);churchNote()}}catch(e){}
      try{applyView()}catch(e){}
      if(!running&&ch.some(function(k){return !LIGHT[k]})){
        try{readyRefresh()}catch(e){}
        LIB=null;setTimeout(function(){try{getLib()}catch(e){}},0);
        if(ch.indexOf('reading')>=0||ch.indexOf('autoRead')>=0||ch.indexOf('notes')>=0){try{loadReadings()}catch(e){}}
      }
    }
    return true;
  }
  function cfgPull(){
    if(CFG.busy)return Promise.resolve();CFG.busy=true;
    return cfgFetch('/settings?ns='+CFG_NS).then(function(x){
      CFG.busy=false;if(x.s!==200||typeof x.j.rev!=='number')return;
      CFG.seen=x.j.rev;CFG.at=x.j.at||'';CFG.hasRv=!!x.j.hasReviewKey;cfgApply(x.j.values,x.j.rev);cfgState();
    },function(){CFG.busy=false});
  }
  function cfgPush(){
    if(!ADMINVIEW)return;S.set('cfgDirty','1');clearTimeout(CFG.pt);CFG.pt=setTimeout(cfgSend,500);
  }
  function cfgSend(){
    clearTimeout(CFG.rt);
    var tk=cfgTok();if(!tk){cfgNote('Not saved for the other devices: the admin passcode is needed again.',true);admGate();return}
    cfgNote('Saving for every device…',false,true);
    cfgFetch('/settings?ns='+CFG_NS,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tk},body:JSON.stringify({baseRev:CFG.rev,values:cfgLocal()})},12000).then(function(x){
      if(x.s===200&&x.j.ok){CFG.rev=x.j.rev;CFG.seen=x.j.rev;CFG.at=x.j.at||'';S.set('cfgRev',String(x.j.rev));S.set('cfgDirty','');cfgNote('Saved for every device ✓');cfgState();return}
      if(x.s===409){S.set('cfgDirty','');var was=dlg.open;try{if(was)dlg.close()}catch(e){}cfgApply(x.j.values,x.j.rev);cfgState();cfgNote('Another device changed the settings a moment ago, so that newer version was loaded here. Open Settings and make your change again.',true);return}
      if(x.s===401){S.set('adminTok','');cfgNote('Not saved for the other devices: the admin passcode is needed again.',true);admGate();return}
      cfgNote('Not saved for the other devices (the server answered '+x.s+(x.j.error?' '+x.j.error:'')+'). Trying again in 30 seconds.',true);CFG.rt=setTimeout(cfgSend,30000);
    },function(){cfgNote('Not saved for the other devices yet: no connection to the server. Trying again in 30 seconds.',true);CFG.rt=setTimeout(cfgSend,30000)});
  }
  function cfgState(){ // one line at the top of the admin's settings: what the server holds
    var el=$('cfgState');if(!el)return;
    if(S.get('cfgDirty','')==='1'){el.textContent='A change on this device is not on the server yet.';return}
    if(typeof CFG.seen!=='number'){el.textContent='The server has not answered yet, so these are the settings saved on this device.';return}
    if(!CFG.seen){el.textContent='Nothing is saved on the server yet. Press Save here, on the device whose settings every device should use, to send them.';return}
    var when='';try{if(CFG.at)when=' Last saved '+new Date(CFG.at).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+'.'}catch(e){}
    el.textContent=(CFG.rev===CFG.seen?'Every device uses these settings.':'A newer version is on the server; it loads here when Settings is closed.')+when;
  }
  // ---- the passcode screen of the admin link ----
  function admGate(){
    if($('admGate'))return;
    var g=document.createElement('div');g.id='admGate';
    g.innerHTML='<form id="admForm" autocomplete="off"><h2>Admin</h2><p>Enter the admin passcode to open every setting.</p><input id="admPass" type="password" autocomplete="current-password" aria-label="Admin passcode"><button id="admGo" type="submit">Open</button><div id="admMsg" role="status"></div></form>';
    document.body.appendChild(g);
    var msg=$('admMsg'),inp=$('admPass'),go=$('admGo');
    setTimeout(function(){try{inp.focus()}catch(e){}},50);
    $('admForm').onsubmit=function(ev){
      ev.preventDefault();var v=inp.value;if(!v){msg.textContent='Type the passcode first.';return}
      go.disabled=true;msg.textContent='Checking…';
      cfgFetch('/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pass:v})},12000).then(function(x){
        go.disabled=false;
        if(x.s===200&&x.j.token){S.set('adminTok',x.j.token);inp.value='';g.remove();admEnter();return}
        inp.value='';
        if(x.s===401)msg.textContent='Wrong passcode.'+(typeof x.j.left==='number'&&x.j.left<=3?' '+x.j.left+' more tr'+(x.j.left===1?'y':'ies')+' before a 15 minute wait.':'');
        else if(x.s===429)msg.textContent='Too many wrong tries. Wait 15 minutes, then try again.';
        else if(x.s===503&&x.j.error==='not_set')msg.textContent='No admin passcode has been set on the server yet.';
        else msg.textContent='The server could not check the passcode (answer '+x.s+'). Try again in a minute.';
      },function(){go.disabled=false;msg.textContent='Could not reach the server. Check the connection and try again.'});
    };
  }
  function admEnter(){
    setAdmin(true);adminUntil=Date.now()+3e11; // the admin link stays unlocked: the passcode is the lock
    document.body.classList.add('adminok');
    cfgPull().then(function(){if(S.get('cfgDirty','')==='1')cfgSend();rvGive()});
  }
  function rvGive(){ // the review sheet key on this admin device goes to the church server once, so every other device works without it
    var k=rvKey(),tk=cfgTok();if(!ADMINVIEW||!k||!tk||CFG.hasRv||typeof CFG.seen!=='number')return;
    cfgFetch('/secret',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tk},body:JSON.stringify({reviewKey:k})}).then(function(x){
      if(x.s===200&&x.j.ok){CFG.hasRv=true;dbg('REVIEW: key handed to the church server');cfgNote('Review sheet key saved on the server: every device can now send review lines \u2713');try{rvNote()}catch(e){}}
      else dbg('REVIEW: key not handed over (answer '+x.s+')');
    },function(){dbg('REVIEW: key not handed over (no connection)')});
  }
  function admSignOut(){S.set('adminTok','');try{dlg.close()}catch(e){}setAdmin(false);document.body.classList.remove('adminok');admGate()}
  (function(){
    document.body.classList.add(ADMINVIEW?'adminview':'userview');
    setTimeout(function(){ // after the settings window has been built
      try{var ba0=$('basicArea'),c=$('showAr');while(c&&ba0&&c!==ba0&&!(c.parentNode&&c.parentNode.parentNode&&c.parentNode.parentNode.parentNode===ba0))c=c.parentNode;if(c&&c!==ba0)c.classList.add('adminonly')}catch(e){}
      try{var ap=$('adminPin'),d=ap&&ap.closest('details');if(d)d.style.display='none'}catch(e){} // the per-device Owner PIN is replaced by the server passcode
      if(ADMINVIEW){
        try{var oa=$('ownerArea');
          var st=document.createElement('div');st.id='cfgState';st.className='help';var ba=$('basicArea');if(ba&&ba.parentNode)ba.parentNode.insertBefore(st,ba);
          var so=document.createElement('div');so.className='actions';so.style.justifyContent='flex-start';so.innerHTML='<button type="button" id="admOut">Sign out of admin on this device</button>';if(oa)oa.appendChild(so);
          $('admOut').onclick=admSignOut;
        }catch(e){}
        var g0=$('gear').onclick;$('gear').onclick=function(){cfgState();return g0.apply(this,arguments)};
        var s0=$('save').onclick;$('save').onclick=function(){var r=s0.apply(this,arguments);cfgPush();return r};
        title.addEventListener('input',function(){if(document.body.classList.contains('admin'))cfgPush()});
        title.addEventListener('blur',function(){if(S.get('cfgDirty','')==='1'){clearTimeout(CFG.pt);cfgSend()}});
      }
    },0);
    if(ADMINVIEW){
      if(cfgTok()){admEnter();cfgFetch('/check',{headers:{'Authorization':'Bearer '+cfgTok()}}).then(function(x){if(x.s===401){S.set('adminTok','');setAdmin(false);document.body.classList.remove('adminok');admGate()}},function(){})} // no connection: the saved sign-in still opens the settings of this device
      else admGate();
    }else cfgPull();
    setInterval(function(){if(!document.hidden)cfgPull()},120000);
    document.addEventListener('visibilitychange',function(){if(!document.hidden)cfgPull()});
  })();

