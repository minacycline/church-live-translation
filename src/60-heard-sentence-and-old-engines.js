  function dgFinal(text,sx){
    var spokeAt=DG.segAt||Date.now();DG.segAt=0;DG.gen++;lastSentEnd=Date.now();
    var t=applyFixes(fixNames(cleanHeard(text,true)));if(!t){if(String(text||'').trim()){dbg('STREAM piece dropped after cleaning: '+String(text).slice(0,60))}return}if(t===lastText&&Date.now()-lastTextAt<4000){dbg('STREAM same words again within 4 s, shown once: '+t.slice(0,60));return}lastTextAt=Date.now(); // v132: a word he repeats later ("Timothy" said three times) is no longer thrown away as a copy
    dbg('STREAM heard: '+t.slice(0,70));
    lastText=t;lastResult=Date.now();heardCount++;curCut=Date.now();curSpeechStart=spokeAt;curPos=replayEl?Math.max(0,replayEl.currentTime):null;curConf=null;curCo=null;
    curSx=sx||'';curSxOn=sx!==undefined;lastSxItem=null;joinAndFinal(t,'');curSx='';curSxOn=false;liveEn='';liveFirstAt=0;
    if(running)setStatus('Listening (live stream). Heard '+heardCount+' sentences');
  }
  function dgPreview(ar){ // a rough running English line while he is still mid-sentence, paced so it does not eat the translator's allowance
    var now=Date.now();if(DG.trBusy||now-DG.lastTr<(LEARN.gap||2500)||now<groqBlockedUntil||ar.split(/\s+/).length<3)return;
    var fixed=fixNames(ar),p=null;try{p=matchPrayer(fixed)}catch(e){}
    var gen=DG.gen,show=function(d){if(gen!==DG.gen||!running||!d||/^\s*(""|\[.*\])\s*$/.test(d))return;if(!liveFirstAt)liveFirstAt=Date.now();liveEn=d;render()};
    if(p){show(p.b);return}
    if(budgetLeft()<0.25)return;
    DG.trBusy=true;DG.lastTr=now;quick(fixed).then(show).catch(function(){}).then(function(){DG.trBusy=false});
  }
  async function sxCheck(){ // Soniox answers a wrong key after the line opens, so wait for its first word on the matter
    var sk;try{sk=await sxKey()}catch(e){return [false,'no key from the church server: '+e.message]}
    return new Promise(function(done){var ws,fin=false,end=function(ok,m){if(fin)return;fin=true;try{ws.onclose=null;if(ws.readyState===1)ws.send('');ws.close()}catch(e){}done([ok,m])};
      try{ws=new WebSocket('wss://stt-rt.soniox.com/transcribe-websocket',['soniox-api-key',sk])}catch(e){done([false,'could not start: '+e.message]);return}
      ws.onopen=function(){try{ws.send(JSON.stringify(sxStart()))}catch(e){}setTimeout(function(){end(true,'the live line opens and the key is accepted')},2500)};
      ws.onmessage=function(ev){try{var m=JSON.parse(ev.data);if(m.error_code)end(false,'Soniox said: '+String(m.error_message||m.error_type||m.error_code).slice(0,120))}catch(e){}};
      ws.onclose=function(){end(false,'the line was closed: this device may not be able to reach Soniox')};
      setTimeout(function(){end(false,'no answer in time')},9000)});
  }
  function dgCheck(){ // can this device open the line with this key?
    return new Promise(function(done){var ws,fin=false,end=function(ok,m){if(fin)return;fin=true;try{ws.onclose=null;ws.close()}catch(e){}done([ok,m])};
      try{ws=new WebSocket(dgUrl(),['token',S.get('deepgramKey','')])}catch(e){done([false,'could not start: '+e.message]);return}
      ws.onopen=function(){try{ws.send(JSON.stringify({type:'CloseStream'}))}catch(e){}end(true,'the live line opens from this device')};
      ws.onclose=function(){end(false,'the line was refused: the key may be wrong, or this device cannot reach Deepgram')};
      setTimeout(function(){end(false,'no answer in time')},8000)});
  }
  var COH=new WeakMap(); // compare mode: Cohere's hearing of each piece, kept beside Whisper's
  async function whisper(blob,forceAr){
    if(!forceAr&&hearEngine()==='cohere'){
      try{var ct=await cohereHear(blob);try{CONF.set(blob,null)}catch(e){}dbg('COHERE heard: '+ct.slice(0,60));return ct}
      catch(e){dbg('COHERE failed ('+e.message+'): this piece goes to Whisper')}
    }
    var fd=new FormData();
    fd.append('file',blob,'a.wav');
    fd.append('model',S.get('hearSpeed','accurate')==='fast'?MODELS.asrFast:MODELS.asr);if(forceAr||S.get('lang','mixed')!=='mixed')fd.append('language','ar');fd.append('temperature','0');fd.append('response_format','verbose_json');
    var pr=whisperPrompt();if(pr)fd.append('prompt',pr);
    var r=await fetchR('https://api.groq.com/openai/v1/audio/transcriptions',{method:'POST',headers:{'authorization':'Bearer '+S.get('groqKey','')},body:fd},15000);
    if(r.status===429){var ra=parseInt(r.headers.get('retry-after')||'20',10);var wait=ra>120?Math.min(ra,3600):Math.min(Math.max(ra,5),60);whisperBlockedUntil=Date.now()+wait*1000;throw new Error('hearing limit reached, waiting '+wait+' s')}
    if(r.status===401||r.status===403){whisperBlockedUntil=Date.now()+3600000;keyRejected();throw new Error('key not accepted')}
    var j=await r.json();
    if(!r.ok)throw new Error(j.error&&j.error.message||('HTTP '+r.status));
    var lg=String(j.language||'').toLowerCase();
    if(lg&&!/^(ar|arabic|en|english)$/.test(lg)){ // the guess was neither Arabic nor English: hear the same piece again as Arabic instead of losing it
      if(!forceAr){dbg('WRONG LANGUAGE ('+lg+'), hearing it again as Arabic: '+String(j.text||'').slice(0,40));return whisper(blob,true)}
      dbg('WRONG LANGUAGE dropped ('+lg+'): '+String(j.text||'').slice(0,40));return ''}
    var txt=confident(j),c1=lastConf;try{CONF.set(blob,c1)}catch(e){}
    // "Arabic with some English": a piece that came back as shaky English may really be Arabic that was guessed wrong. Hear it once more as Arabic and keep whichever hearing Whisper is surer of.
    if(!forceAr&&S.get('lang','mixed')==='mixed'&&/^(en|english)$/.test(lg)&&txt&&!AR.test(txt)&&typeof c1==='number'&&c1<-0.55){
      try{var t2=await whisper(blob,true),c2=CONF.get(blob);if(t2&&AR.test(t2)&&typeof c2==='number'&&c2>c1){dbg('DOUBTFUL ENGLISH ('+c1.toFixed(2)+') heard again as Arabic ('+c2.toFixed(2)+'): '+t2.slice(0,40));return t2}}catch(e){}
      try{CONF.set(blob,c1)}catch(e){}
    }
    return txt;
  }
  // Whisper reports how sure it is of each part. Unsure parts (mumbled, far away, noise) become nonsense words, so they are dropped rather than shown.
  var CONF=new WeakMap(); // confidence of each piece, kept with that piece: three pieces are heard at once, so one shared value would mix them up
  var lastConf=null; // how sure Whisper was of the last piece (average log-probability of the kept parts; below about -0.7 is shaky)
  function confident(j){
    var segs=j.segments||[];lastConf=null;if(!segs.length)return (j.text||'').trim();
    var keep=[],dropped=[],lp=[];
    segs.forEach(function(s){
      var txt=(s.text||'').trim();if(!txt)return;
      var bad=(s.no_speech_prob>0.6&&s.avg_logprob<-0.6)||s.avg_logprob<-1.1||s.compression_ratio>2.6;
      (bad?dropped:keep).push(txt+(bad?' ('+(s.avg_logprob||0).toFixed(2)+')':''));if(!bad&&typeof s.avg_logprob==='number')lp.push(s.avg_logprob);
    });
    if(lp.length)lastConf=Math.min.apply(null,lp);
    if(dropped.length)dbg('UNSURE dropped: '+dropped.join(' | ').slice(0,120));
    return keep.join(' ').trim();
  }
  var liveEn='',liveGen=0,interimBusy=false,interimAt=0,interimBlockedUntil=0;
  async function whisperLive(blob){
    var fd=new FormData();fd.append('file',blob,'a.wav');fd.append('model',MODELS.asrFast); // faster model with its own free allowance, only for the running preview
    if(S.get('lang','mixed')!=='mixed')fd.append('language','ar');fd.append('temperature','0');fd.append('response_format','json');
    var pr=whisperPrompt();if(pr)fd.append('prompt',pr);
    var r=await fetchR('https://api.groq.com/openai/v1/audio/transcriptions',{method:'POST',headers:{'authorization':'Bearer '+S.get('groqKey','')},body:fd});
    if(r.status===429){interimBlockedUntil=Date.now()+20000;LEARN.gap=Math.min(8000,(LEARN.gap||2500)+1000);learnSave();dbg('LEARNED slower preview gap '+LEARN.gap);throw new Error('limit')}
    if(!r.ok)throw new Error('http '+r.status);
    return ((await r.json()).text||'').trim();
  }
  // Instant preview: the phone's own speech recognizer gives words as they are spoken (less accurate), translated at once with the fast model.
  // Whisper still produces the real line a moment later and replaces the preview.
  var sr2Len=0,sr2Base=0; // sr2Len: results the recognizer has so far; sr2Base: results already covered by a finished Whisper line (never shown again in the preview)
  function srAdvance(mark){if(mark>sr2Base){sr2Base=Math.min(mark,sr2Len||mark);dbg('PREVIEW cleared up to result '+sr2Base)}sr2Text='';clearTimeout(sr2Timer)}
  var sr2=null,sr2On=false,sr2Dead=false,sr2Text='',sr2At=0,sr2Busy=false,sr2Timer=null,sr2StartedAt=0,sr2Gen=0;
  function startPreviewSR(){
    if(NO_BACKUP||!SR||sr2Dead||sr2On||!running||S.get('preview',DEF.preview)!=='1'||S.get('micMode','room')==='tab'||streamEngine())return;
    try{
      sr2=new SR();sr2.lang='ar-EG';sr2.interimResults=true;sr2.continuous=!IOS;sr2.maxAlternatives=1;
      sr2.onresult=function(e){
        sr2Len=e.results.length;if(sr2Base>sr2Len)sr2Base=0;
        var txt='';for(var i=sr2Base;i<e.results.length;i++)txt+=e.results[i][0].transcript+' '; // only what was said since the last finished line
        txt=txt.trim();if(!txt){sr2Text='';return}
        sr2Text=txt;arEl.textContent=cleanAr(txt);dbg('PHONE-SR '+txt.slice(-50));
        clearTimeout(sr2Timer);sr2Timer=setTimeout(previewTranslate,250);
      };
      sr2.onerror=function(e){if(e.error==='not-allowed'||e.error==='service-not-allowed'){sr2Dead=true;sr2On=false}};
      sr2.onend=function(){sr2On=false;sr2Text='';sr2Len=0;sr2Base=0;if(running&&!sr2Dead)setTimeout(startPreviewSR,IOS?150:50)};
      sr2.start();sr2On=true;sr2StartedAt=Date.now();
    }catch(e){sr2On=false}
  }
  function stopPreviewSR(){try{sr2&&(sr2.onend=null);sr2&&sr2.stop()}catch(e){}sr2=null;sr2On=false;sr2Text='';clearTimeout(sr2Timer)}
  function previewTranslate(){
    var txt=sr2Text;if(!txt||sr2Busy||!running||Date.now()<groqBlockedUntil)return;
    if(Date.now()-sr2At<900){clearTimeout(sr2Timer);sr2Timer=setTimeout(previewTranslate,900-(Date.now()-sr2At));return}
    sr2Busy=true;sr2At=Date.now();var gen=++sr2Gen;
    var fixed=fixNames(txt),p=matchPrayer(fixed);
    var done=function(d){sr2Busy=false;if(gen!==sr2Gen||!running||!d)return;if(!liveEn&&!liveFirstAt)liveFirstAt=Date.now();liveEn=d;render()};
    if(p){done(p.b);return}
    quick(fixed).then(function(d){done(d&&!/^\s*(""|\[.*\])\s*$/.test(d)?d:'')}).catch(function(){sr2Busy=false});
  }
  function liveStep(){ // while the speaker is speaking: show a quick running translation of the piece heard so far
    var now=Date.now();
    if(NO_BACKUP||sr2On)return; // the phone's recognizer is giving the instant preview (v83: no Whisper drafts at all)
    if(interimBusy||now<interimBlockedUntil||now<whisperBlockedUntil||now<groqBlockedUntil||now-interimAt<(LEARN.gap||2500))return;
    if(speechSamples/SR16<0.9||sinceVoiceMs>600||bufLen<SR16*1.5)return;
    if(usedToday()>num('dailyCap',240)*60*0.5)return; // keep half of the free allowance for the real pass
    interimBusy=true;interimAt=now;var gen=liveGen,blob=wavBlob(flatten().slice());
    whisperLive(blob).then(function(t){
      t=fixNames(cleanHeard(t));if(!t||gen!==liveGen||!running)return;
      arEl.textContent=cleanAr(t);
      var p=matchPrayer(t);if(p){if(!liveFirstAt)liveFirstAt=Date.now();liveEn=p.b;render();return}
      return quick(t).then(function(d){if(gen!==liveGen||!running||!d||/^\s*(""|\[.*\])\s*$/.test(d))return;if(!liveFirstAt)liveFirstAt=Date.now();liveEn=d;render()});
    }).catch(function(){}).then(function(){interimBusy=false});
  }
  var heldText='',heldAlt='',heldTimerT=null;
