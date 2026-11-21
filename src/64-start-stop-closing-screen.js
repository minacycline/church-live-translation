  async function start(){
    try{closingHide();document.body.classList.remove('closed')}catch(e){}
    if(!roleChosen()){readyRefresh();return} // pick Main or Screen first
    if(isScreen()){viewStart(S.get('watchCode',''));return} // a screen never listens
    if(NO_BACKUP){
      if(!S.get('sonioxKey','')){var sb=await KEYDB.get('sonioxKey');if(sb)S.set('sonioxKey',sb)}
      if(!sxHaveKey()){setStatus('No Soniox key on this device. Paste it in ⚙ Settings (Hearing and keys), then press Start.');showAlert('No Soniox key on this device: there is no backup hearing. Paste it in Settings.\n(tap to hide)',false,0,true);return}
      if(!claudeReady()){setStatus('No translator set up on this device.');return}
    }
    if(!NO_BACKUP&&S.get('groqKey','')&&(!window.__modelsAt||Date.now()-window.__modelsAt>20*60000)){window.__modelsAt=Date.now();loadModels().catch(function(){})}
    if(!NO_BACKUP&&S.get('engine','whisper')==='whisper'&&!S.get('groqKey','')){var bk=await KEYDB.get('groqKey');if(bk){S.set('groqKey',bk);dbg('key restored from backup copy')}}
    if(!NO_BACKUP&&S.get('engine','whisper')==='whisper'&&!S.get('groqKey','')&&LOCKED){askPassword();return}
    if(!NO_BACKUP&&S.get('engine','whisper')==='whisper'&&!S.get('groqKey','')){
      setStatus('NO GROQ KEY on this device. Paste it in ⚙ Settings, then press Start. (Without it the app is much worse.)');
      try{$('gear').onclick();setTimeout(function(){var k=$('groqKey');k&&k.focus()},300)}catch(e){}
      return;
    }
    running=true;SOUNDMAP={};ui();lastResult=Date.now();DBG=[];DBG0=Date.now();sessionBegan=Date.now();limitTold=false;MISSED=[];setTimeout(function(){try{qFlush()}catch(e){}},8000);if(!txId||Date.now()-(txAll().slice(-1)[0]||{end:0}).end>20*60000){sermonMemo='';memoCount=0}dbg('START ios='+IOS);setStatus('Starting microphone…');txBegin();setTimeout(function(){try{var w0=Date.now();matchOne('الرب راعي فلا يعوزني شيء');fixNames('الرب راعي فلا يعوزني شيء');nameGuesses('الرب راعي فلا يعوزني شيء');dbg('LIBRARY of verses, prayers and names ready in '+(Date.now()-w0)+' ms')}catch(e){}},30); /* v138: built at Start, not when the first sentence arrives */
    sessFirst=true;var early=NO_BACKUP&&useWhisper()&&!!streamEngine()&&!replayEl;
    if(early){try{dgOpen()}catch(e){}try{healthAtStart()}catch(e){}} // v116 warm-up: the live line and the translator start getting ready while the microphone opens
    var ok=useWhisper()?await startWhisper():await startApple();
    if(!ok){try{dgClose()}catch(e){}return}
    if(early)holdBoot();
    setStatus(useWhisper()?'Listening. Used today: '+Math.round(usedToday()/60)+' min':'Listening (iPad recognizer)');
    loadReadings();if(!early)healthAtStart();
    if(useWhisper())setTimeout(startPreviewSR,600);
    if(useWhisper()&&streamEngine())dgOpen();
    lastSpeechAt=Date.now();clearInterval(idleTimer);
    idleTimer=setInterval(function(){
      var ref=useWhisper()?lastSpeechAt:lastResult;
      if(running&&!paused&&Date.now()-ref>num('idleMin',10)*60000){autoStop('Nothing was heard for '+num('idleMin',10)+(num('idleMin',10)===1?' minute':' minutes')+', so listening stopped.')}
    },15000);
    var mins=parseInt(S.get('maxMin','240'),10)||240;
    maxTimer=setTimeout(function(){autoStop('Listening stopped by itself after '+mins+(mins===1?' minute.':' minutes.'))},mins*60000);
    try{if(navigator.wakeLock)wake=await navigator.wakeLock.request('screen')}catch(e){}
  }
  function stop(){
    running=false;ui();if($('meter')){$('meter').firstChild.style.width='0';$('meter').classList.remove('voice')}if($('sideMeter')){$('sideMeter').firstChild.style.height='0';$('sideMeter').classList.remove('voice');document.body.classList.remove('listening')}clearTimeout(maxTimer);clearTimeout(restartTimer);clearInterval(watchdog);clearInterval(idleTimer);
    try{rec&&rec.stop()}catch(e){}
    try{dgClose()}catch(e){}
    if(proc&&speechSamples/SR16>0.7&&usedToday()<num('dailyCap',240)*60){try{cutChunk(false)}catch(e){}}
    buf=[];bufLen=0;energy=[];speechSamples=0;
    vadOk=false;vadQ=[];liveEn='';liveGen++;stopPreviewSR();
    if(heldText){clearTimeout(heldTimerT);var hz=heldText,hza=heldAlt;heldText='';heldAlt='';onFinal(hz,hza?[hza]:[])}
    clearInterval(audioWatch);hearPending=0;hearStart=0;hearInFlight=0;hearWaiters=[];restarting=false;
    try{proc&&(proc.onaudioprocess=null);proc&&proc.disconnect();src&&src.disconnect();ctx&&ctx.close()}catch(e){}
    try{stream&&stream.getTracks().forEach(function(t){t.stop()})}catch(e){}
    stream=null;ctx=null;proc=null;src=null;
    if(replayEl){var wasReplay=replayEl;replayEl=null;clearTimeout(replayEnd);try{wasReplay.pause();wasReplay.removeAttribute('src');wasReplay.load()}catch(e){}setTimeout(function(){try{URL.revokeObjectURL(replayUrl)}catch(e){}},1000);hearQueue.then(function(){return new Promise(function(r){setTimeout(r,3000)})}).then(function(){return queue}).then(function(){setTimeout(finishTest,1500)},function(){setTimeout(finishTest,1500)})}
    try{wake&&wake.release()}catch(e){}
    recTrim();
    var endingId=txId;setTimeout(function(){if(txId===endingId){txSave(true);if(!running)txId=null}try{if(!running&&!replayEl)txSummarize(endingId)}catch(e){}try{rvQueue(lines);rvFlush()}catch(e){}try{if(!replayEl)tunePause(lines.filter(function(l){return l.en&&l.t0}))}catch(e){}},4000); // wait for the last sentences to finish translating
    setStatus('Stopped');try{localStorage.removeItem('liveAt')}catch(e){}if(tapFn)tapDone();micFails=0;
    try{var rb=sessionBegan,rr=!!replayName&&/LIVE TEST/.test(DBG[0]||''),snap={log:DBG,lines:lines.slice(),missed:MISSED,drop:DBGDROP,use:{req:claudeUse.req,inTok:claudeUse.inTok,outTok:claudeUse.outTok}};sessionBegan=0;repSafe(rb,rr,snap,'Stop was pressed but the page closed before the report was sent');setTimeout(function(){try{localStorage.removeItem('pendingReport')}catch(e){}reportSend(rb,rr,snap)},6000)}catch(e){}
  }
  $('pause').onclick=function(){if(!running)return;paused?resumeListening():pauseListening()};
  $('go').onclick=function(){if(VIEW.on){viewStop();return}if(!running&&isScreen()){viewStart(S.get('watchCode',''));return}if(running){if(replayEl){stop();return}softStop()}else{goFull();start()}};
  // v104: pressing Stop shows only the closing line on a clean white screen; one tap goes back to the start screen
  // v113: the closing screen keeps the device awake (30 minutes at most) and shows only the line, no logo
  // v141: the closing screen has two buttons. Stop first only pauses (the sentence in progress is finished and still translated); Return within 2 minutes carries on where it was,
  // after that the service is closed for real and Return only shows the last captions again. Start over closes the service and goes to the start screen.
  // v151: the report used to leave only when the service closed for real, 2 minutes after Stop (or never, if the phone was locked first). It now leaves 6 seconds after Stop.
  // If Return is pressed after that, what follows is reported as a second part with its own start time, so nothing is sent twice.
  var softOn=false,softT=0,softWasPaused=false,SOFT_MS=120000,closeDimT=0,softRepT=0,SOFT_REP_MS=6000;
  function softReport(){if(!softOn||!running||!sessionBegan||replayEl)return;
    try{dbg('REPORT sent at Stop (the Return button stays for the rest of the '+Math.round(SOFT_MS/1000)+' s)');var rb=sessionBegan,snap={log:DBG.slice(),lines:lines.slice(),missed:MISSED.slice(),drop:DBGDROP,use:{req:claudeUse.req,inTok:claudeUse.inTok,outTok:claudeUse.outTok}};
      sessionBegan=0;try{localStorage.removeItem('pendingReport')}catch(e){}reportSend(rb,false,snap)}catch(e){}}
  function softStop(){softWasPaused=!!paused;softOn=true;dbg('STOP pressed: paused, the closing screen offers Return for '+Math.round(SOFT_MS/1000)+' s');try{pauseListening()}catch(e){}closingShow();try{repSafeNow()}catch(e){}clearTimeout(softRepT);softRepT=setTimeout(softReport,SOFT_REP_MS);clearTimeout(softT);softT=setTimeout(function(){if(softOn&&running){softOn=false;dbg('STOP final: Return was not pressed');stop()}},SOFT_MS)}
  function closeBack(){clearTimeout(softT);clearTimeout(softRepT);closingHide();document.body.classList.remove('closed');if(softOn&&running){softOn=false;if(!sessionBegan){sessionBegan=Date.now();DBG=[];MISSED=[];dbg('SECOND PART: the first part of this service was already reported at Stop; this report holds what came after Return')}dbg('RETURN pressed: carrying on');if(!softWasPaused)resumeListening();else ui()}else{softOn=false;dbg('RETURN pressed: the service had ended, last captions shown');try{ui();render()}catch(e){}}}
  function closeNew(){clearTimeout(softT);clearTimeout(softRepT);if(softOn&&running){softOn=false;stop()}softOn=false;dbg('START OVER pressed');closingHide()}
  function closeWakeUp(){try{var b=$('closingBtns');b.classList.remove('dim');clearTimeout(closeDimT);closeDimT=setTimeout(function(){b.classList.add('dim')},6000)}catch(e){}}
  var closeWake=null,closeWakeT=0;
  function closeWakeOff(){clearTimeout(closeWakeT);try{closeWake&&closeWake.release()}catch(e){}closeWake=null}
  function closingShow(){try{document.body.classList.add('closed');document.body.classList.remove('idle');$('closing').hidden=false;dbg('CLOSING shown');closeShownAt=Date.now();closeWakeUp()}catch(e){}
    try{closeWakeOff();if(navigator.wakeLock)navigator.wakeLock.request('screen').then(function(w){if($('closing').hidden){try{w.release()}catch(e){}return}closeWake=w;closeWakeT=setTimeout(closeWakeOff,30*60000)}).catch(function(){})}catch(e){}}
  function closingHide(){try{$('closing').hidden=true}catch(e){}closeWakeOff()}
  // v115: a screen lock is dropped whenever the page is hidden, so the closing screen takes it again when the page comes back (still 30 minutes in all)
  var closeShownAt=0;
  document.addEventListener('visibilitychange',function(){try{if(document.hidden||$('closing').hidden||(closeWake&&!closeWake.released)||!navigator.wakeLock||Date.now()-closeShownAt>30*60000)return;navigator.wakeLock.request('screen').then(function(w){if($('closing').hidden){try{w.release()}catch(e){}return}closeWake=w;clearTimeout(closeWakeT);closeWakeT=setTimeout(closeWakeOff,Math.max(1000,30*60000-(Date.now()-closeShownAt)))}).catch(function(){})}catch(e){}});
  // v113: clean screen for the projector (user view only). Start goes full screen where the device allows it; while translating, the top bar and the buttons fade out after 4 seconds without a touch, and the first touch only brings them back
  var CLEANVIEW=((document.querySelector('meta[name="view"]')||{}).content||'')!=='admin';
  function goFull(){try{if(!CLEANVIEW)return;var de=document.documentElement,rq=de.requestFullscreen||de.webkitRequestFullscreen;if(!rq||document.fullscreenElement||document.webkitFullscreenElement)return;if((window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone)return;var r=rq.call(de,{navigationUI:'hide'});if(r&&r.catch)r.catch(function(){})}catch(e){}}
  (function(){
    if(!CLEANVIEW)return;
    var last=Date.now(),revealAt=0,B=document.body;
    function fsOn(){return !!(document.fullscreenElement||document.webkitFullscreenElement)}
    ['pointerdown','touchstart'].forEach(function(ev){window.addEventListener(ev,function(){if(B.classList.contains('idle')&&B.classList.contains('running')&&!B.classList.contains('paused'))revealAt=Date.now()},true)}); // v115: a press only; moving a mouse first no longer blocks the click that follows
    window.addEventListener('click',function(e){if(Date.now()-revealAt>700)return;try{if(e.target&&e.target.closest&&e.target.closest('header,footer')){e.stopPropagation();e.preventDefault()}}catch(x){}},true);
    ['mousemove','pointerdown','touchstart','keydown'].forEach(function(ev){document.addEventListener(ev,function(){last=Date.now();B.classList.remove('idle')},{passive:true})});
    setInterval(function(){
      if(!B.classList.contains('running')){if(!fsOn())B.classList.remove('idle');return}
      if(B.classList.contains('paused')||document.querySelector('dialog[open]')||!$('resume').hidden){B.classList.remove('idle');return}
      if(Date.now()-last>4000)B.classList.add('idle');
    },500);
  })();
  try{$('closeBack').onclick=closeBack;$('closeNew').onclick=closeNew;['pointerdown','mousemove','touchstart'].forEach(function(ev){$('closing').addEventListener(ev,closeWakeUp,{passive:true})})}catch(e){}

  $('rst').onclick=function(){try{$('rstDlg').showModal()}catch(e){if(confirm('Restart the app?'))doRestart()}};
  $('rstNo').onclick=function(){$('rstDlg').close()};
  $('rstYes').onclick=function(){$('rstDlg').close();doRestart()};
