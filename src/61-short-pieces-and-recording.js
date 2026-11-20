  function joinAndFinal(t,alt){ // a 1-3 word piece that does not end a sentence is joined to the next piece instead of translated alone
    clearTimeout(heldTimerT);
    var txt=heldText?(heldText+' '+t):t;heldText='';alt=alt||'';if(heldAlt&&alt.indexOf(heldAlt)<0)alt=(heldAlt+' '+alt).trim();heldAlt='';
    var words=txt.trim().split(/\s+/).length,ends=/[.!?؟。]\s*$/.test(txt);
    if(words<3){
      var prev=lines[lines.length-1];
      var gapOk=!(SX.t0&&SX.pEnd)||SX.t0-SX.pEnd<3000; /* v133: a short piece said after a real pause is its own line, it is no longer glued onto the sentence before it ("Love is Zimsius") */
      if(prev&&gapOk&&!prev.fixed&&prev.ar&&prev.en&&Date.now()-(prev.t0||0)<15000&&!/[.!?؟]\s*$/.test(prev.ar)){prev.ar=prev.ar+' '+txt;if(alt&&(prev.alt||'').indexOf(alt)<0)prev.alt=((prev.alt||'')+' '+alt).trim();retranslate(prev);return} // it finishes the sentence before it
      if(skipHold){onFinal(txt,alt?[alt]:[]);return} // v133: it already waited 3.6 s for the rest, no second wait
      heldText=txt;heldAlt=alt;heldTimerT=setTimeout(function(){var h=heldText,ha=heldAlt;heldText='';heldAlt='';if(h)onFinal(h,ha?[ha]:[])},2500);return
    }
    onFinal(txt,alt?[alt]:[]);
  }
  function retranslate(item){
    dbg('JOINED fragment into previous line: '+item.ar.slice(-40));
    var idx=lines.indexOf(item),before=idx>0?lines[idx-1]:null;
    LANES[0]=LANES[0].then(function(){return groq(item.ar,item.alt?[item.alt]:[],null,item).then(function(en){if(en&&!AR.test(en)){item.en=en;item.revised=true;render()}}).catch(function(){})});
  }
  var REC={on:true,max:12*60}; // minutes of audio kept on the device, oldest dropped first
  function recPut(samples){
    if(!REC.on)return;
    var copy=new Int16Array(samples.length);for(var i=0;i<samples.length;i++){var x=Math.max(-1,Math.min(1,samples[i]));copy[i]=x<0?x*0x8000:x*0x7fff}
    KEYDB.open().then(function(db){var tx=db.transaction('kv','readwrite'),st=tx.objectStore('kv');st.put({t:Date.now(),n:copy.length,d:copy.buffer},'rec:'+Date.now()+':'+Math.random().toString(36).slice(2,6))}).catch(function(){});
  }
  function recList(){return KEYDB.open().then(function(db){return new Promise(function(res){var out=[],q=db.transaction('kv').objectStore('kv').openCursor();q.onsuccess=function(){var c=q.result;if(!c){res(out);return}if(String(c.key).indexOf('rec:')===0)out.push({k:c.key,v:c.value});c.continue()};q.onerror=function(){res(out)}})}).catch(function(){return []})}
  function recTrimFast(){ // during a long service: drop saved sound older than the limit, reading only the names of the pieces
    if(!REC.on)return;var cut=Date.now()-REC.max*1000;
    KEYDB.open().then(function(db){var st=db.transaction('kv','readwrite').objectStore('kv'),q=st.openKeyCursor?st.openKeyCursor():st.openCursor();
      q.onsuccess=function(){var c=q.result;if(!c)return;var k=String(c.key);if(k.indexOf('rec:')===0){var t=parseInt(k.split(':')[1],10);if(t&&t<cut){st.delete(c.key);if(!REC.told){REC.told=true;dbg('SOUND older than '+Math.round(REC.max/60)+' minutes is no longer kept on this device: only the newest '+Math.round(REC.max/60)+' minutes are saved for replay. The words are not affected')}}}c.continue()}}).catch(function(){});
  }
  function recDropAll(){KEYDB.open().then(function(db){var st=db.transaction('kv','readwrite').objectStore('kv'),q=st.openKeyCursor?st.openKeyCursor():st.openCursor();q.onsuccess=function(){var c=q.result;if(!c)return;if(String(c.key).indexOf('rec:')===0)st.delete(c.key);c.continue()}}).catch(function(){})}
  function storageGuard(){ // if the device is ever close to full, saved sound is the first thing to go: captions matter more than the recording
    try{if(!navigator.storage||!navigator.storage.estimate)return;navigator.storage.estimate().then(function(e){
      if(e&&e.quota&&e.usage/e.quota>0.8){if(REC.on){REC.on=false;dbg('STORAGE nearly full ('+Math.round(e.usage/1048576)+' of '+Math.round(e.quota/1048576)+' MB): sound is no longer saved on this device')}recDropAll()}}).catch(function(){})}catch(e){}
  }
  setInterval(function(){try{if(typeof running!=='undefined'&&running){recTrimFast();storageGuard()}}catch(e){}},90000);
  setTimeout(function(){try{recTrimFast();storageGuard()}catch(e){}},5000);
  try{window.churchTrimNow=recTrimFast}catch(e){}
  function recTrim(){recList().then(function(all){all.sort(function(a,b){return a.v.t-b.v.t});var total=0,drop=[];for(var i=all.length-1;i>=0;i--){total+=all[i].v.n/SR16;if(total>REC.max)drop.push(all[i].k)}if(!drop.length)return;KEYDB.open().then(function(db){var tx=db.transaction('kv','readwrite'),st=tx.objectStore('kv');drop.forEach(function(k){st.delete(k)})})})}
  function recShare(){
    recList().then(function(all){
      if(!all.length){alert('No recording kept yet. Start, speak, then try again.');return}
      all.sort(function(a,b){return a.v.t-b.v.t});var n=0;all.forEach(function(x){n+=x.v.n});
      var pcm=new Int16Array(n),o=0;all.forEach(function(x){pcm.set(new Int16Array(x.v.d),o);o+=x.v.n});
      var buf=new ArrayBuffer(44+n*2),v=new DataView(buf);function str(p,s){for(var i=0;i<s.length;i++)v.setUint8(p+i,s.charCodeAt(i))}
      str(0,'RIFF');v.setUint32(4,36+n*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,SR16,true);v.setUint32(28,SR16*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,n*2,true);
      new Uint8Array(buf,44).set(new Uint8Array(pcm.buffer));
      var name='church-audio-'+new Date().toISOString().slice(0,16).replace(/[:T]/g,'-')+'.wav',blob=new Blob([buf],{type:'audio/wav'}),file=new File([blob],name,{type:'audio/wav'});
      if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){navigator.share({files:[file],title:name}).catch(function(){})}
      else{var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},2000)}
    });
  }
  var hearQueue=Promise.resolve(),heardCount=0,hearPending=0,hearStart=0,audioWatch=null,restarting=false,lastHearMs=0;
  var hearInFlight=0,hearWaiters=[],heldChunks=[],heldTimer=null;
  function flushHeld(){heldTimer=null;if(!running){heldChunks=[];return}if(Date.now()<whisperBlockedUntil){heldTimer=setTimeout(flushHeld,Math.max(500,whisperBlockedUntil-Date.now()+300));return}var h=heldChunks;heldChunks=[];dbg('resending '+h.length+' held pieces');h.forEach(function(c){sendChunk(c[0],c[1],c[2])})}
  function hearSlot(){if(hearInFlight<3){hearInFlight++;return Promise.resolve()}return new Promise(function(r){hearWaiters.push(r)})}
  function hearFree(){var w=hearWaiters.shift();if(!w)hearInFlight=Math.max(0,hearInFlight-1);else w()}
  // a short internet or Groq hiccup must not lose a sentence: the same piece is tried again for up to about 20 s before it is given up
  function hearTry(blob,n,t0){
    return whisper(blob).catch(function(e){
      var msg=String(e&&e.message||'');
      if(/key not accepted/.test(msg)||!running)throw e;
      if(/limit reached/.test(msg)){var w=Math.max(0,whisperBlockedUntil-Date.now());if(w>0&&w<25000)return new Promise(function(x){setTimeout(x,w+200)}).then(function(){return whisper(blob)});throw e}
      if(n>=3||Date.now()-t0>20000)throw e;
      dbg('HEARING failed ('+(msg||e.name)+'), trying the same piece again');
      return new Promise(function(x){setTimeout(x,1500*(n+1))}).then(function(){return hearTry(blob,n+1,t0)});
    });
  }
  function sendChunk(samples,speechSec,loud){
    if(NO_BACKUP){if(!replayEl&&samples.length>SR16)recPut(samples);dbg('CHUNK kept, not heard: no backup hearing ('+(samples.length/16000).toFixed(1)+'s)');return}
    if(speechSec<0.6||samples.length<16000*0.8){dbg('CHUNK dropped (too little speech) '+(samples.length/16000).toFixed(1)+'s speech '+speechSec.toFixed(1)+'s');return}
    if(Date.now()<whisperBlockedUntil){setStatus('Hearing paused, limit reached. Try again shortly.');if(heldChunks.length<6){heldChunks.push([samples,speechSec,loud]);if(!heldTimer)heldTimer=setTimeout(flushHeld,Math.max(500,whisperBlockedUntil-Date.now()+300))}return}
    var secs=samples.length/16000;dbg('CHUNK sent '+secs.toFixed(1)+'s speech '+speechSec.toFixed(1)+'s');if(!replayEl)recPut(samples);
    var srMark=sr2Len,cutAt=Date.now(),spokeAt=chunkSpeechStart||cutAt-secs*1000,posAt=replayEl?Math.max(0,replayEl.currentTime-secs):null;
    if(usedToday()+secs>num('dailyCap',240)*60){stop();setStatus('Stopped: today\'s limit of '+num('dailyCap',240)+' minutes of speech is used up.');return}
    addUsage(secs);
    var blob=wavBlob(samples);liveGen++;
    hearPending++;var sent=Date.now();if(!hearStart)hearStart=sent;
    // each piece is sent at once (up to 3 in flight) so a slow answer never delays the next piece; results are shown in order
    var cmp=hearEngine()==='compare'?(function(){var c0=Date.now();return cohereHear(blob,8000).then(function(x){return {t:x,ms:Date.now()-c0}},function(e){dbg('COMPARE: Cohere gave nothing ('+e.message+')');return /trial pace|resting/.test(e.message)?null:{t:'',ms:0,err:e.message}})})():null;
    var p=hearSlot().then(function(){return hearTry(blob,0,Date.now())}).then(function(t){hearFree();return t},function(e){hearFree();throw e});
    var wDone=0;p.then(function(){wDone=Date.now()},function(){});
    hearQueue=hearQueue.then(function(){return p}).then(function(t){var wms=(wDone||Date.now())-sent;return cmp?cmp.then(function(c){curCo=c;if(!c)return t;curCo.wms=wms;if(c.t)dbg('COMPARE '+(normAr(c.t)!==normAr(t||'')?'DIFFERENT':'same')+' | Whisper '+wms+' ms, Cohere '+c.ms+' ms: '+c.t.slice(0,50));return t}):(curCo=null,t)}).then(function(t){hearPending=Math.max(0,hearPending-1);if(!hearPending)hearStart=0;var alt=sr2On?sr2Text.trim():'',conf=CONF.has(blob)?CONF.get(blob):null;srAdvance(srMark);
      lastHearMs=Date.now()-sent;dbg('WHISPER '+(lastHearMs/1000).toFixed(1)+'s: '+(t||'').slice(0,70));
      if(t&&speechSec<0.9&&loud!==undefined&&loud<Math.max(0.0015,noiseFloor*2)&&!looksLiturgical(t)){var nk=normAr(t);LEARN.seen=LEARN.seen||{};LEARN.seen[nk]=(LEARN.seen[nk]||0)+1;if(LEARN.seen[nk]>=3){LEARN.junk=LEARN.junk||[];if(LEARN.junk.indexOf(nk)<0&&LEARN.junk.length<60){LEARN.junk.push(nk);dbg('LEARNED made-up phrase to ignore: '+t.slice(0,40))}}var ks=Object.keys(LEARN.seen);if(ks.length>80)delete LEARN.seen[ks[0]];learnSave()}t=applyFixes(fixNames(cleanHeard(t,speechSec>=2&&typeof conf==='number'&&conf>-0.5)));if(!t)return;if(t===lastText&&!(speechSec>=1.2&&(loud===undefined||loud>=Math.max(0.0015,noiseFloor*2))))return; // an identical piece is dropped only when it is quiet or very short (a loop on silence); a real repeat is shown
      if(alt&&similarity(normAr(alt),normAr(t))>0.9)alt='';
      lastText=t;lastResult=Date.now();heardCount++;curCut=cutAt;curSpeechStart=spokeAt;curPos=posAt;curConf=conf;joinAndFinal(t,alt);liveEn='';liveFirstAt=0;sr2Gen++;if(running)setStatus('Listening. Heard '+heardCount+' pieces, last took '+(lastHearMs/1000).toFixed(1)+' s, '+Math.round(usedToday()/60)+' min today');
    }).catch(function(e){hearPending=Math.max(0,hearPending-1);if(!hearPending)hearStart=0;srAdvance(srMark);setStatus('Hearing problem: '+(e.name==='AbortError'?'slow connection, skipped one piece':e.message))});
  }

