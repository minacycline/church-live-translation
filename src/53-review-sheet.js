  // ---- review sheet: lines the app cannot fix itself go to a Google Sheet, approved answers come back ----
  var RV_BASE='https://mini.tail99f4f6.ts.net/webhook',rvBusy=false,rvLast='';
  try{var rkm=/[?&]rk=([^&#]+)/.exec(location.search);if(rkm){S.set('reviewKey',decodeURIComponent(rkm[1]));history.replaceState(null,'',location.pathname)}}catch(e){}
  function rvKey(){return S.get('reviewKey','')}
  var RV_NOKEY='The review sheet key is not on the church server yet: sign in once on the admin link on the phone that has the key.'; // v107: any device sends review lines through the church server, which holds the key
  function rvHash(t){var h=5381;for(var i=0;i<t.length;i++)h=((h<<5)+h+t.charCodeAt(i))|0;return 'a'+(h>>>0).toString(36)+t.length.toString(36)}
  function rvJ(k){try{return JSON.parse(S.get(k,'[]'))||[]}catch(e){return []}}
  function rvFixes(){return rvJ('reviewFix')}
  function rvNote(){var n=$('rvNote');if(n)n.textContent=(rvKey()?'Key saved on this device. ':(CFG.hasRv?'Using the key kept on the church server. ':'No key on this device. '))+rvJ('reviewQ').length+' line(s) waiting to send, '+rvFixes().length+' approved fix(es) loaded.'+(rvLast?' '+rvLast:'')}
  // v126: an ordinary word that only sounds like a Bible name (إشارة "sign" next to سارة) is not a review item.
  // A guess is kept when a naming word comes right before it (القديس, أبونا, النبي, اسمه...) or when the translator wrote that name.
  var NAME_CUE=/^(و|ف)?(ال)?(قديس|قديسه|شهيد|انبا|ابونا|ابينا|مار|ماري|نبي|رسول|ملك|اسمه|اسمها|اسمهم|يا|ابن|بنت|ابو|ام|اخو|اخت|سيدنا|ستنا|الست|بولس|بطرس)$/;
  function nameWorthReview(l){
    if(!l.guesses||!l.guesses.length)return [];
    var w=normAr(l.ar||'').split(' '),en=String(l.en||'').toLowerCase();
    return l.guesses.filter(function(g){
      if(g[2]&&en.indexOf(String(g[2]).toLowerCase())>=0)return true;
      var i=w.indexOf(g[0]);return i>0&&NAME_CUE.test(w[i-1]);
    });
  }
  function rvQueue(ls){
    var q=rvJ('reviewQ'),sent=rvJ('reviewSent'),have={},fx={},add=0,over=0;q.forEach(function(r){have[r.key]=1});sent.forEach(function(k){have[k]=1});rvFixes().forEach(function(p){fx[rvHash(fixKey(p.ar))]=1});
    ls.forEach(function(l){
      if(l.rvDone||!l.en||l.fixed||l.prayer||!l.ar||!AR.test(l.ar))return;l.rvDone=true;
      var why=[],shaky=typeof l.conf==='number'&&l.conf<-0.7;
      if(shaky)why.push('hearing confidence '+l.conf.toFixed(2));
      if(l.alt&&similarity(normAr(l.alt),normAr(l.ar))<0.6)why.push('the two hearings disagree (phone heard: '+l.alt+')');
      var gs=nameWorthReview(l);if(gs.length)why.push('possible misheard name: '+gs.map(function(x){return x[0]+' may be '+x[1]+' ('+x[2]+')'}).join(', '));
      if(l.fixes)why.push('translator changed words: '+l.fixes.join(' | '));
      if(!why.length)return;
      var key=rvHash(fixKey(l.ar));if(have[key]||fx[key])return;if(add>=500){over++;return}have[key]=1;add++;
      q.push({key:key,ar:l.ar,en:l.en,pos:l.rep?mmss(l.pos):new Date(l.t0||Date.now()).toTimeString().slice(0,5),why:why.join('; ')});
    });
    if(over)dbg('REVIEW more flagged lines than one session may add: '+over+' were not put on the Corrections list');
    if(q.length>3000)dbg('REVIEW list is full: '+(q.length-3000)+' of the oldest waiting lines were let go');
    S.set('reviewQ',JSON.stringify(q.slice(-3000)));
  }
  async function rvPull(){
    var k=rvKey();if(!navigator.onLine)return;
    try{var c=new AbortController();setTimeout(function(){c.abort()},20000);var r=await fetch(k?RV_BASE+'/church-review-approved?k='+encodeURIComponent(k):CFG_URL+'/review-approved',{signal:c.signal,cache:'no-store'});
      if(!k&&r.status===409){rvLast=RV_NOKEY;rvNote();return} /* v107: no key on this device and none on the server yet */
      if(!r.ok)throw new Error('HTTP '+r.status);var j=await r.json();
      if(j&&j.ok&&Array.isArray(j.rows)){var old=S.get('reviewFix','[]'),nw=JSON.stringify(j.rows.slice(0,20000));if(old!==nw){S.set('reviewFix',nw);LIB=null;setTimeout(function(){try{getLib()}catch(e){}},0);dbg('REVIEW: '+j.rows.length+' approved fixes loaded')}rvLast='Sheet checked '+new Date().toTimeString().slice(0,5)+'.'}
    }catch(e){rvLast='Sheet not reachable ('+(e.name==='AbortError'?'timeout':e.message)+'); will retry.';dbg('REVIEW pull failed: '+e.message)}
    rvNote();
  }
  // v126: before flagged lines go to the sheet, Claude looks at each one once and writes a recommended English
  // (or "Keep as shown"), so the Corrections tab has something to approve. A line it cannot judge is sent with the box empty.
  async function rvRecommend(batch){
    var need=batch.filter(function(x){return x&&x.rec===undefined}).slice(0,25);
    if(!need.length||!aiOK())return;
    var list=need.map(function(x,i){return (i+1)+'. Arabic heard: '+String(x.ar).slice(0,700)+'\n   English shown: '+String(x.en).slice(0,700)+'\n   Why flagged: '+String(x.why).slice(0,200)}).join('\n\n');
    var res=await claudeCall([{role:'system',content:'You check live captions from a Coptic Orthodox church in Norristown. The speaker talks in Egyptian Arabic; speech recognition wrote the Arabic, sometimes with misheard words; a translator wrote the English shown. For each numbered line decide whether the English shown is right for what the speaker most likely said. Use Coptic Orthodox church wording; quoted Scripture uses NKJV wording; the opening prayer is "In the name of the Father, and the Son, and the Holy Spirit, one God. Amen." Never add a name the speaker did not say. Answer only with a JSON array, one object per line in the same order: {"n": number, "rec": "KEEP"} when the English shown is right, or {"n": number, "rec": "<the corrected full English line>"} when it should change, or {"n": number, "rec": "UNSURE"} when the Arabic is too garbled to judge.'},{role:'user',content:list}],2500,0,30000);
    var arr=[];try{var t=res.text,a=t.indexOf('['),b=t.lastIndexOf(']');arr=JSON.parse(t.slice(a,b+1))}catch(e){throw new Error('the answer was not readable')}
    var byN={};arr.forEach(function(o){if(o&&typeof o.n==='number'&&typeof o.rec==='string')byN[o.n]=o.rec.trim()});
    var keys={};need.forEach(function(x,i){var r=byN[i+1];keys[x.key]=r===undefined?'':(/^KEEP$/i.test(r)||r.replace(/\W+/g,'').toLowerCase()===String(x.en).replace(/\W+/g,'').toLowerCase())?'Keep as shown':/^UNSURE$/i.test(r)?'':r.slice(0,1000)});
    var q=rvJ('reviewQ');q.forEach(function(x){if(Object.prototype.hasOwnProperty.call(keys,x.key))x.rec=keys[x.key]});S.set('reviewQ',JSON.stringify(q));
    dbg('REVIEW: recommendations written for '+need.length+' line(s)');
  }
  async function rvFlush(){
    var k=rvKey();if(rvBusy||!navigator.onLine)return;
    var q=rvJ('reviewQ');if(!q.length){return rvPull()}
    rvBusy=true;
    try{await rvRecommend(q.slice(0,60))}catch(e){dbg('REVIEW recommendation step: '+e.message)}
    q=rvJ('reviewQ');
    try{var batch=q.slice(0,60),c=new AbortController();setTimeout(function(){c.abort()},25000);
      var r=k?await fetch(RV_BASE+'/church-review-add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({k:k,rows:batch}),signal:c.signal})
             :await fetch(CFG_URL+'/review-add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rows:batch}),signal:c.signal});
      if(!k&&r.status===409){rvLast=RV_NOKEY+' '+q.length+' line(s) are kept on this device until then.';dbg('REVIEW: no key on the server yet, '+q.length+' line(s) kept');rvBusy=false;rvNote();return}
      if(!r.ok)throw new Error('HTTP '+r.status);
      var sent=rvJ('reviewSent');batch.forEach(function(x){sent.push(x.key)});S.set('reviewSent',JSON.stringify(sent.slice(-2000)));
      var done={};batch.forEach(function(x){done[x.key]=1});S.set('reviewQ',JSON.stringify(rvJ('reviewQ').filter(function(x){return !done[x.key]})));
      rvLast='Sent '+batch.length+' line(s) at '+new Date().toTimeString().slice(0,5)+'.';dbg('REVIEW: sent '+batch.length+' lines');
    }catch(e){rvLast='Could not send ('+(e.name==='AbortError'?'timeout':e.message)+'); kept for later.';dbg('REVIEW send failed: '+e.message)}
    rvBusy=false;rvNote();
    setTimeout(rvPull,4000);
  }
  window.addEventListener('online',function(){rvFlush()});
  setTimeout(function(){rvNote();rvFlush()},4000);
  setInterval(function(){if(!running)rvFlush()},600000);
  if($('rvNow'))$('rvNow').onclick=function(){rvLast='Working...';rvNote();rvFlush()};

  // ---- review and correct ----
  var rdlg=$('review');
  function addPair(key,a,b){var cur=S.get(key,'');var line=a+' = '+b;S.set(key,(cur?cur+'\n':'')+line)}
  function openReview(){
    var list=$('reviewList');list.innerHTML='';
    var items=lines.slice(-40).reverse();
    if(!items.length){list.innerHTML='<div class="help">Nothing to review yet.</div>'}
    items.forEach(function(l){
      var d=document.createElement('div');d.className='rv';
      d.innerHTML='<div class="a"></div><div class="e"></div><div class="fixrow"><input placeholder="Correct English for this line" aria-label="Correct English"><button class="primary">Save fix</button><span class="saved"></span></div>';
      d.querySelector('.a').textContent=l.ar;d.querySelector('.e').textContent=(l.fixed?'✓ ':'')+(l.en||'…')+(l.t0&&l.t1?'  ('+((l.tDraft?('draft '+((l.tDraft-l.t0)/1000).toFixed(1)+' s, '):'')+'final '+((l.t1-l.t0)/1000).toFixed(1))+' s)':'');
      var inp=d.querySelector('input'),btn=d.querySelector('button'),msg=d.querySelector('.saved');
      btn.onclick=function(){
        var v=inp.value.trim();if(!v)return;
        var wordsAr=words(l.ar).length;
        if(wordsAr<=3){addPair('terms',l.ar,v);msg.textContent='Saved to church terms.'}
        else{addPair('prayers',l.ar,v);msg.textContent='Saved to prayer library.'}
        l.en=v;l.fixed=true;render();
      };
      list.appendChild(d);
    });
    renderTx();rdlg.showModal();
  }
  $('reviewBtn').onclick=openReview;
  $('recBtn').onclick=recShare;
  $('lrnBtn').onclick=function(){var keep={fix:LEARN.fix,fixNo:LEARN.fixNo};LEARN=keep;learnSave();$('chkOut').textContent='Learned microphone and model settings cleared; learned corrections were kept. They rebuild themselves as the app listens. (Restart the app to apply.)'};
  $('chkBtn').onclick=async function(){
    var o=$('chkOut');o.textContent='Checking…';
    var res=await healthCheck(true);
    try{var d=new Date(),ds=('0'+d.getDate()).slice(-2)+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+d.getFullYear();var rr=await fetchT('https://api.katameros.app/readings/gregorian/'+ds+'?languageId=2',{},8000);res.push({n:"Today's readings",ok:rr.ok,m:rr.ok?'loaded':'not available ('+rr.status+'), the app still works without them'})}catch(e){res.push({n:"Today's readings",ok:false,m:'cannot reach the lectionary service, the app still works without it'})}
    res.push({n:'Microphone permission',ok:true,m:'checked when you press Start'});
    o.textContent=res.map(function(x){return (x.ok?'OK   ':'FAIL ')+x.n+': '+x.m}).join('\n');
  };
  $('dbgBtn').onclick=function(){
    var txt=dbgReport(),b=$('dbgBtn');
    var done=function(ok){b.textContent=ok?'Copied. Paste it into your message.':'Select and copy from the box below';if(!ok){var ta=document.createElement('textarea');ta.value=txt;ta.style.cssText='width:100%;height:160px;margin-top:8px';b.parentNode.appendChild(ta);ta.focus();ta.select()}setTimeout(function(){b.textContent='Copy debug report'},4000)};
    try{navigator.clipboard.writeText(txt).then(function(){done(true)},function(){done(false)})}catch(e){done(false)}
  };
