  // ---- title and settings ----
  var CHURCH='St. George Coptic Orthodox Church of Norristown, PA',CHURCH_OLD='St. George Coptic Orthodox Church · Norristown, PA',title=$('title');
  (function(){var t0=S.get('title','');if(!t0||t0==='Live Translation'||t0===CHURCH_OLD)S.set('title',CHURCH)})(); // v147: the name as Mina wrote it
  // v147: the bottom tag of the running screen is the church name, taken from the title setting; with no name (empty, or just Live Translation) nothing is shown
  function churchNote(){try{var n=$('betaNoteA'),t=String(S.get('title','')||'').trim();if(/^live translation$/i.test(t))t='';n.textContent=t}catch(e){}}
  title.textContent=S.get('title',CHURCH);churchNote();
  title.addEventListener('input',function(){S.set('title',title.textContent.trim()||CHURCH);churchNote()});
  title.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();title.blur()}});
  title.addEventListener('blur',function(){if(!title.textContent.trim())title.textContent=CHURCH});

  try{if(!S.get('shareMig58','')){if(S.get('share','1')==='0')S.set('share','1');S.set('shareMig58','1')}}catch(e){}
  try{if(!S.get('maxMig58','')){if(S.get('maxMin','120')==='120')S.set('maxMin','240');S.set('maxMig58','1')}}catch(e){} // v58: the automatic stop moves from 2 hours to 4
  try{if(!S.get('hearMig56','')){S.set('hearSpeed','accurate');S.set('hearMig56','1')}}catch(e){} // v56: accurate hearing is the default again (the fast model dropped words)
  var FIELDS=['groqKey','engine','preview','micMode','noise','lang','autoRead','email','notes','terms','hideWords','reading','prayers','size','showAr','maxMin','idleMin','dailyCap','builtin','reviewKey','adminPin','hearSpeed','hearEngine','cohereKey','deepgramKey','sonioxKey','translator','think','claudeKey','share','room','role','watchCode','frame'],DEF={think:'ahead',translator:'claude',frame:'1',role:'main',share:'1',hearEngine:'whisper',hearSpeed:'accurate',preview:(!IOS&&SR&&/Chrome|Edg/.test(navigator.userAgent)&&!/Android/.test(navigator.userAgent))?'1':'0',size:'46',showAr:'0',maxMin:'240',idleMin:'10',dailyCap:'240',builtin:'1',engine:'whisper',micMode:'room',noise:'normal',lang:'mixed',autoRead:'1'};
  function applyView(){document.body.classList.toggle('noframe',S.get('frame','1')==='0');document.documentElement.style.setProperty('--fs',S.get('size','46')+'px');$('ar').hidden=S.get('showAr','0')!=='1';if(typeof fit==='function')fit()}
  applyView();
  var dlg=$('settings');
  var BASICF={size:1,showAr:1,micMode:1,noise:1,lang:1,autoRead:1,notes:1,reading:1}; // the everyday settings: nothing here can break the app or cost money
  if(!ADMINVIEW)BASICF={size:1}; // v102: the shared link only changes the text size
  (function(){
    try{
      var kids=[].slice.call(dlg.children),blocks={},order=[],cur=null,tail=null;
      kids.forEach(function(el){
        if(el.tagName==='H2')return;
        if(el.classList.contains('actions')&&el.querySelector('#save')){tail=el;cur=null;return}
        if(el.tagName==='LABEL'||el.classList.contains('row')){var key=el.tagName==='LABEL'?(el.getAttribute('for')||el.textContent.trim()):'row';cur=blocks[key]={els:[el]};order.push(key)}
        else if(cur)cur.els.push(el);
      });
      try{var dc=$('dailyCap');if(dc&&dc.parentNode)dc.parentNode.style.display='none'}catch(e){}
      var GONEF={groqKey:1,hearSpeed:1,hearEngine:1,cohereKey:1,deepgramKey:1,translator:1,engine:1,email:1,testfile:1}; // v98: settings of the removed services stay hidden
      function sec(parent,title,keys,open){var d=document.createElement(parent.id==='basicArea'?'div':'details');
        if(d.tagName==='DETAILS'){d.className='sec';if(open)d.open=true;var sm=document.createElement('summary');sm.textContent=title;d.appendChild(sm)}else{var h=document.createElement('h3');h.textContent=title;d.appendChild(h)}
        keys.forEach(function(k){var b=blocks[k];if(!b)return;b.els.forEach(function(e){if(GONEF[k])e.style.display='none';d.appendChild(e)});delete blocks[k]});parent.appendChild(d);return d}
      var basic=document.createElement('div');basic.id='basicArea';var owner=document.createElement('div');owner.id='ownerArea';
      // the row of small boxes holds both kinds: text size and "show Arabic" are everyday, the three stops are the owner's
      var row=blocks.row&&blocks.row.els[0],brow=document.createElement('div');brow.className='row';
      if(row){[].slice.call(row.children).forEach(function(c){if(c.querySelector('#size')||c.querySelector('#showAr'))brow.appendChild(c)})}
      blocks.display={els:[brow]};
      sec(basic,'Display',['display']);sec(basic,'Sound',['micMode','noise','lang']);sec(basic,'Today',['autoRead','notes','reading']);
      var gate=document.createElement('div');gate.id='ownerGate';gate.innerHTML='<button type="button" id="ownerBtn">Owner settings</button><div class="help">Keys, hearing engine, church terms, limits and tests. For the person who set the app up.</div>';
      var warn=document.createElement('div');warn.className='help warn';warn.id='ownerWarn';owner.appendChild(warn);
      var hk=sec(owner,'Hearing and keys',['hearEngine','sonioxKey','translator','think','claudeKey','groqKey','hearSpeed','deepgramKey','cohereKey','engine','preview','email'],true);
      sec(owner,'Words and corrections',['terms','hideWords','builtin','Learned corrections','prayers','reviewKey']);
      if(MULTI)sec(owner,'Other screens',['role','watchCode','frame','share','room']);
      sec(owner,'Limits',['row']);
      sec(owner,'Tests and reports',['testlive','testfile']);
      sec(owner,'Access',['adminPin']);
      var rest=Object.keys(blocks);if(rest.length)sec(owner,'Other',rest);
      // "Check everything" belongs where the keys are pasted, in the section that is already open
      try{var cb=owner.querySelector('#chkBtn'),co=owner.querySelector('#chkOut');if(cb&&co){var ca=document.createElement('div');ca.className='actions';ca.style.justifyContent='flex-start';ca.appendChild(cb);hk.appendChild(ca);hk.appendChild(co)}}catch(e){}
      var ref=tail||null;dlg.insertBefore(basic,ref);dlg.insertBefore(gate,ref);dlg.insertBefore(owner,ref);
    }catch(e){try{console.log('settings layout: '+e.message)}catch(x){}}
  })();
  function ownerNote(){var w=$('ownerWarn');if(w)w.textContent=S.get('adminPin','')?'':'No Owner PIN is set on this device, so anyone can open these settings. Set one under Access.'}
  function fillSettings(own){try{roomCode()}catch(e){}dlg.classList.toggle('basic',!own);FIELDS.forEach(function(k){var el=$(k);if(el)el.value=(own||BASICF[k])?S.get(k,DEF[k]||''):''});ownerNote();try{applyKeyLocks()}catch(e){}}
  // v64: a saved key is locked; the only way to change it is the Unlock button next to it
  var KEYIDS=['groqKey','sonioxKey','deepgramKey','cohereKey','claudeKey'];
  function applyKeyLocks(){KEYIDS.forEach(function(k){var el=$(k);if(!el)return;var b=$(k+'Lock');if(!b){b=document.createElement('button');b.type='button';b.id=k+'Lock';b.className='keylock';el.insertAdjacentElement('afterend',b);b.onclick=function(){if(!el.readOnly)return;el.readOnly=false;el.value='';b.style.display='none';if(k==='groqKey'&&$('pasteKey'))$('pasteKey').disabled=false;el.focus()}}var saved=!!S.get(k,'');if(saved&&el.value){el.readOnly=true;b.style.display='';b.textContent='Locked and saved. Unlock to change';if(k==='groqKey'&&$('pasteKey'))$('pasteKey').disabled=true}else{el.readOnly=false;b.style.display='none';if(k==='groqKey'&&$('pasteKey'))$('pasteKey').disabled=false}})}
  $('gear').onclick=function(){fillSettings(document.body.classList.contains('admin'));$('keyNote').textContent=S.get('groqKey','')?'Key saved on this device ✓':'No key saved on this device yet. Paste it above; it saves by itself.';$('usageNote').textContent='Used today: '+Math.round(usedToday()/60)+' min. Translator allowance left today: '+Math.round(budgetLeft()*100)+'%'+(basicCount?'. Basic backup used '+basicCount+' time(s) this session.':'.');$('libNote').textContent=libNote();$('readStatus').textContent=readStatus;try{renderFixes()}catch(e){}try{rvNote()}catch(e){}dlg.showModal()};
  $('close').onclick=function(){dlg.close()};
  setTimeout(function(){var ob=$('ownerBtn');if(ob)ob.onclick=function(){askAdmin();if(document.body.classList.contains('admin')){fillSettings(true);$('keyNote').textContent=S.get('groqKey','')?'Key saved on this device \u2713':'No key saved on this device yet. Paste it above; it saves by itself.'}}},0);
  function keyChanged(){var v=$('groqKey').value.trim();if(!v)return;var ok=saveKey(v);groqBlockedUntil=0;whisperBlockedUntil=0;
    $('keyNote').textContent=ok?(/^gsk_/.test(v)?'Key saved on this device ✓':'Saved, but Groq keys usually start with gsk_. Check you copied all of it.'):'Could not save the key: this device\'s storage is full or blocked (Private Browsing?).'}
  $('pasteKey').onclick=function(){try{navigator.clipboard.readText().then(function(v){v=(v||'').trim();if(!v){$('keyNote').textContent='Nothing copied. Copy the key first (it starts with gsk_).';return}$('groqKey').value=v;keyChanged()},function(){$('keyNote').textContent='Tap in the box, then tap and hold, then Paste.'})}catch(e){$('keyNote').textContent='Tap in the box, then tap and hold, then Paste.'}};
  ['sonioxKey','deepgramKey','cohereKey','claudeKey','hearEngine','translator'].forEach(function(k){var el=$(k);if(!el)return;var sv=function(){var v=String(el.value).trim();if(!v&&k!=='hearEngine'&&k!=='translator')return;if(el.readOnly)return;S.set(k,v);if(k==='claudeKey')claudeBlockedUntil=0;if(v&&k!=='hearEngine'&&k!=='translator')try{keyBackup()}catch(e){}};el.addEventListener('input',sv);el.addEventListener('change',sv);el.addEventListener('blur',sv)}); // saved as they are typed, like the Groq key, so "Check everything" tests what is in the boxes
  $('groqKey').addEventListener('input',keyChanged);$('groqKey').addEventListener('change',keyChanged);$('groqKey').addEventListener('blur',keyChanged);
  dlg.addEventListener('close',function(){var v=$('groqKey').value.trim();if(v&&v!==S.get('groqKey',''))saveKey(v)}); // closing the settings any way keeps a newly pasted key
  $('save').onclick=function(){var lim=dlg.classList.contains('basic');FIELDS.forEach(function(k){if(lim&&!BASICF[k])return;if(KEYIDS.indexOf(k)>=0&&!String($(k).value).trim())return; /* a key is never wiped by saving an empty box */if(k==='groqKey'){var kv=String($(k).value).trim();if(kv)saveKey(kv);return}S.set(k,String($(k).value).trim())});groqBlockedUntil=0;whisperBlockedUntil=0;interimBlockedUntil=0;keyBackup();applyView();dlg.close();try{if(!lim){var rc=String(S.get('room','')).toUpperCase().replace(/[^A-Z0-9]/g,'');S.set('room',rc);roomCode();S.set('watchCode',String(S.get('watchCode','')).toUpperCase().replace(/[^A-Z0-9]/g,''));shareStop();roleApply()}readyRefresh()}catch(e){}LIB=null;setTimeout(function(){try{getLib()}catch(e){}},0);loadReadings();if(running&&!isScreen()){stop();start()}};
  $('clear').onclick=function(){lines=[];enEl.innerHTML='';render()};

  function pairs(key){
    return S.get(key,'').split('\n').map(function(l){var i=l.indexOf('=');if(i<1)return null;return {a:l.slice(0,i).trim(),b:l.slice(i+1).trim()}}).filter(function(p){return p&&p.a&&p.b});
  }
  function escRe(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
  var AR=/[؀-ۿ]/;
  function normAr(s){return s.replace(/[ً-ْـ]/g,'').replace(/[إأآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[،؛؟٪٫٬٠-٩]/g,' ').replace(/[^؀-ۿ\s]/g,' ').replace(/\s+/g,' ').trim()}
  function arPat(t){var al=/^ال/.test(t);return (al?'(?:ال|لل)':'')+escRe(al?t.slice(2):t).replace(/[اأإآ]/g,'[اأإآ]').replace(/[ةه]/g,'[ةه]').replace(/[يى]/g,'[يى]')}
  function words(s){return normAr(s).split(' ').filter(Boolean)}
  function similarity(a,b){
    var A=words(a),B=words(b);if(!A.length||!B.length)return 0;
    var set={},hit=0;B.forEach(function(w){set[w]=(set[w]||0)+1});
    A.forEach(function(w){if(set[w]){hit++;set[w]--}});
    return (2*hit)/(A.length+B.length);
  }
