  // ---- live test: play a recording in real time through the church path, then report the delays ----
  var testStart=0;
  async function startReplay(f){
    if(!NO_BACKUP&&!S.get('groqKey','')){var bk=await KEYDB.get('groqKey');if(bk)S.set('groqKey',bk)}
    if(!NO_BACKUP&&!S.get('groqKey','')){if(LOCKED){askPassword();setStatus('Unlock first, then pick the recording again.');}else setStatus('Add the Groq key first.');return}
    if(running)stop();
    await new Promise(function(r){setTimeout(r,running?1500:200)});
    var el=document.createElement('audio');el.preload='auto';el.playsInline=true;el.setAttribute('playsinline','');
    replayUrl=URL.createObjectURL(f);el.src=replayUrl;replayName=f.name||'recording';
    lines=[];enEl.innerHTML='';liveEn='';heardCount=0;lastText='';sermonMemo='';memoCount=0;testFixes=[];fixCount=0;
    running=true;ui();lastResult=Date.now();DBG=[];DBG0=Date.now();sessionBegan=Date.now();MISSED=[];dbg('LIVE TEST START '+replayName+' ios='+IOS);setStatus('Live test: starting…');
    replayEl=el;testStart=Date.now();
    var ok=await startWhisper(false,el);
    if(!ok){replayEl=null;running=false;ui();setStatus('Live test could not start');return}
    if(streamEngine())dgOpen();
    try{await el.play()}catch(e){
      if(e&&e.name==='NotAllowedError'){ // iPhone wants one more tap before it plays sound
        setStatus('Live test ready.');showAlert('TAP HERE to start the live test.',true,0,true);
        $('alert').onclick=function(){$('alert').onclick=function(){showAlert('')};showAlert('');try{ctx&&ctx.resume()}catch(x){}el.play().catch(function(x){stop();setStatus('Could not play this file: '+(x.message||x.name))})};
      }else{stop();setStatus('Could not play this file: '+(e.message||e.name));return}
    }
    loadReadings();txBegin();
    el.onended=function(){dbg('LIVE TEST recording ended');replayEnd=setTimeout(function(){if(running&&replayEl===el)stop()},1500)};
    el.onerror=function(){if(running&&replayEl===el){stop();setStatus('This file could not be played. Try an mp3 or m4a.')}};
    lastSpeechAt=Date.now();
    try{if(navigator.wakeLock)wake=await navigator.wakeLock.request('screen')}catch(e){}
    setStatus('Live test running. Press Stop to end early.');
  }
  function med(a){if(!a.length)return null;a=a.slice().sort(function(x,y){return x-y});var m=a.length>>1;return a.length%2?a[m]:(a[m-1]+a[m])/2}
  function sec(ms){return ms==null||!isFinite(ms)?'-':(ms/1000).toFixed(1)+' s'}
  function mmss(t){if(t==null)return '--:--';t=Math.round(t);return ('0'+Math.floor(t/60)).slice(-2)+':'+('0'+t%60).slice(-2)}
  function finishTest(){
    var ls=lines.filter(function(l){return l.t0>=testStart&&l.en});
    var fin=[],first=[],hear=[],basic=0,prayer=0,rows=[],unsure=[];
    ls.forEach(function(l,i){
      var shownAt=[l.tLive,l.tDraft,l.t1].filter(function(x){return x&&x>=(l.tSpeak||0)});var f=shownAt.length?Math.min.apply(null,shownAt):null;
      var dFin=l.t1&&l.tCut?l.t1-l.tCut:null,dFirst=f&&l.tSpeak?f-l.tSpeak:null,dHear=l.tCut?l.t0-l.tCut:null;
      if(dFin!=null)fin.push(dFin);if(dFirst!=null)first.push(dFirst);if(dHear!=null)hear.push(dHear);if(l.basic)basic++;if(l.prayer)prayer++;
      var shaky=typeof l.conf==='number'&&l.conf<-0.7,why=[];if(shaky)why.push('hearing confidence '+l.conf.toFixed(2));if(l.unsure)why.push('unclear words: '+l.unsure.join(' '));if(l.alt&&similarity(normAr(l.alt),normAr(l.ar))<0.6)why.push('the two hearings disagree');if(l.basic)why.push('basic backup translator');if(l.fixes)why.push('translator changed words');if(l.guesses)why.push('possible misheard name: '+l.guesses.map(function(x){return x[0]+' may be '+x[1]+' ('+x[2]+')'}).join(', '));
      if(why.length)unsure.push('['+mmss(l.pos)+'] #'+(i+1)+' '+why.join(', ')+'\n   heard: '+l.ar+(l.alt?'\n   phone: '+l.alt:'')+'\n   shown: '+l.en);
      rows.push('#'+(i+1)+' ['+mmss(l.pos)+']'+(shaky?' UNSURE('+l.conf.toFixed(2)+')':'')+(l.prayer?' PRAYER/BIBLE MATCH':'')+(l.basic?' BASIC BACKUP USED':'')+'\nAR: '+l.ar+(l.alt?'\nALT (phone heard): '+l.alt:'')+(l.co?'\nCOHERE HEARD: '+(l.co.t||'(nothing'+(l.co.err?': '+l.co.err:'')+')'):'')+(l.fixes?'\nCORRECTED: '+l.fixes.join(' | '):'')+'\nEN: '+l.en+(l.ref?' ('+l.ref+')':'')+(l.draft&&l.draft!==l.en?'\nDRAFT: '+l.draft:'')+'\nfirst English '+sec(dFirst)+' after he started | heard '+sec(dHear)+' after he paused | final '+sec(dFin)+' after he paused');
    });
    var cmpL=ls.filter(function(l){return l.co}),cmpNote='',cmpRows=[];
    if(cmpL.length){var both=cmpL.filter(function(l){return l.co.t}),diff=both.filter(function(l){return normAr(l.co.t)!==normAr(l.ar)}); // even one different word counts
      diff.forEach(function(l){cmpRows.push('['+mmss(l.pos)+']\n   WHISPER: '+l.ar+'\n   COHERE:  '+l.co.t+'\n   shown:   '+l.en)});
      cmpNote='\nHearing comparison: '+cmpL.length+' pieces sent to both engines, Cohere answered '+both.length+', the two wrote different words in '+diff.length+'. Typical answer time: Whisper '+sec(med(cmpL.map(function(l){return l.co.wms}).filter(Boolean)))+', Cohere '+sec(med(both.map(function(l){return l.co.ms})))+'. The different pieces are listed below: someone who knows Arabic has to say which one is right.'}
    var tuneNote='';try{tuneNote=tunePause(ls)}catch(e){}
    testStats={n:ls.length,first:med(first),fin:med(fin),finMax:fin.length?Math.max.apply(null,fin):null,hear:med(hear),basic:basic,prayer:prayer};
    var sum='Lines: '+ls.length+'\nWords the translator corrected: '+fixCount+' (learned: '+testFixes.length+')'+'\nTypical time until English first appears: '+sec(testStats.first)+' after the speaker starts the sentence\nTypical time until the final English: '+sec(testStats.fin)+' after he pauses (slowest '+sec(testStats.finMax)+')\nLines that needed the basic backup translator: '+basic+'\nLines matched to a prayer or Bible verse: '+prayer+(tuneNote?'\n'+tuneNote:'')+cmpNote;
    lastReport=['LIVE TEST REPORT','file '+replayName,'build '+(document.querySelector('meta[name=build]')||{content:'?'}).content,'date '+new Date().toLocaleString(),'',sum,'','=== LINES TO CHECK (time in the recording, what was heard, what was shown) ==='].concat(unsure.length?unsure:['none']).concat(cmpRows.length?['','=== WHERE WHISPER AND COHERE HEARD DIFFERENT WORDS ==='].concat(cmpRows):[]).concat(['','=== LINES ==='],rows).concat(['','=== CORRECTIONS LEARNED IN THIS TEST (check these; delete wrong ones in Settings) ==='].concat(testFixes.length?testFixes:['none'])).concat(['','=== ALL ACTIVE CORRECTIONS ==='].concat(activeFixes().map(function(k){return k+' \u2192 '+LEARN.fix[k].to+' ('+LEARN.fix[k].n+'\u00d7)'}))).concat(['','=== DEBUG ===',dbgReport()]).join('\n');
    try{localStorage.setItem('lastReport',lastReport.slice(0,200000));localStorage.setItem('lastReportSum',sum)}catch(e){}
    showReportSum(sum);
    try{rvQueue(ls);rvFlush()}catch(e){dbg('REVIEW queue failed: '+e.message)}
    setStatus('Live test done. Open ✎ and press Share test report.');
    try{openReview()}catch(e){}
  }
  try{window.churchDebug=function(){return dbgReport()};window.churchReport=function(){return lastReport}}catch(e){}
  function showReportSum(sum){if(!sum)return;$('reportRow').style.display='';$('reportSum').textContent='Last live test: '+sum}
  try{lastReport=localStorage.getItem('lastReport')||'';showReportSum(localStorage.getItem('lastReportSum')||'')}catch(e){}
  $('reportBtn').onclick=function(){
    if(!lastReport){alert('No live test has been run on this device yet.');return}
    var name='test-report-'+new Date().toISOString().slice(0,16).replace(/[:T]/g,'-')+'.txt',blob=new Blob([lastReport],{type:'text/plain;charset=utf-8'}),file=new File([blob],name,{type:'text/plain'});
    if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){navigator.share({files:[file],title:name}).catch(function(){})}
    else{var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},2000)}
  };
  $('testlive').addEventListener('change',function(){var f=this.files&&this.files[0];if(!f)return;this.value='';dlg.close();startReplay(f)});

  // ---- test with a recording: whole file to Whisper, then each segment through the usual path ----
  $('testfile').addEventListener('change',async function(){
    var f=this.files&&this.files[0];if(!f)return;this.value='';
    if(!S.get('groqKey','')){setStatus('Add the Groq key first.');return}
    dlg.close();if(running)stop();
    setStatus('Hearing the recording…');lines=[];enEl.innerHTML='';render();
    try{
      var fd=new FormData();fd.append('file',f,f.name||'test.m4a');fd.append('model',MODELS.asr);if(S.get('lang','mixed')!=='mixed')fd.append('language','ar');fd.append('temperature','0');fd.append('response_format','verbose_json');
      var pr=whisperPrompt();if(pr)fd.append('prompt',pr);
      var r=await fetch('https://api.groq.com/openai/v1/audio/transcriptions',{method:'POST',headers:{'authorization':'Bearer '+S.get('groqKey','')},body:fd});
      var j=await r.json();if(!r.ok)throw new Error(j.error&&j.error.message||('HTTP '+r.status));
      var segs=(j.segments||[]).map(function(x){return (x.text||'').trim()}).filter(Boolean);
      if(!segs.length&&j.text)segs=[j.text.trim()];
      if(j.duration)addUsage(j.duration);
      setStatus('Translating '+segs.length+' sentences…');
      segs.forEach(function(t){onFinal(t,[])});
      Promise.all(LANES).then(function(){setStatus('Recording done. Tap ✎ to review and correct.')});
    }catch(e){setStatus('Test problem: '+e.message)}
  });
  // v70: minimizing Chrome or switching tabs must not stop listening. Nothing here stops it; the log notes each change so a test can prove it,
  // and a held lock asks Chrome not to freeze the page while it listens
  var keepLock=null;
  function holdLock(){if(keepLock||!navigator.locks)return;keepLock=new Promise(function(free){window.__freeLock=free});try{navigator.locks.request('church-listening',function(){return keepLock}).catch(function(){})}catch(e){}}
  function freeLock(){if(window.__freeLock){window.__freeLock();window.__freeLock=null}keepLock=null}
  setInterval(function(){if(running)holdLock();else if(keepLock)freeLock()},2000);
  document.addEventListener('visibilitychange',function(){
    if(running)dbg(document.hidden?'PAGE hidden (minimized or another tab): still listening':'PAGE visible again');
    if(document.hidden&&running){if(rec){try{rec.stop()}catch(e){}}}
    else if(running){if(rec&&!useWhisper()){try{rec.start()}catch(e){}};if(navigator.wakeLock)navigator.wakeLock.request('screen').then(function(w){wake=w}).catch(function(){})}
  });
  if(!SR&&!S.get('groqKey',''))setStatus('Add a Groq key in Settings, or open this page in Safari.');
  (function(){var sy=document.createElement('script');sy.src='synaxarium.js';sy.async=true;document.head.appendChild(sy)})();
  (function(){var sc=document.createElement('script');sc.src='bible.js';sc.async=true;sc.onload=function(){LIB=null;setTimeout(function(){try{getLib()}catch(e){}},300)};document.head.appendChild(sc)})();
  loadReadings();
  window.__churchTest={copticDate:copticDate,saintsToday:saintsToday,loadModels:loadModels,chatCall:chatCall,pool:function(){return POOL.slice()},noteUse:noteUse,budgetLeft:budgetLeft,nextFree:nextFree,dbg:function(){return DBG.slice()},caps:function(){return {TPD_SAFE:TPD_SAFE}}}; // for the offline test harness only

