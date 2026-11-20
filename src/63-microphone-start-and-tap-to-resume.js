  // v100: when the device needs a touch before it may listen again (iPhone and iPad rule), one large button fills the screen
  var tapFn=null;
  function askTap(fn,why){tapFn=fn;try{$('resumeWhy').textContent=why||'';$('resume').hidden=false}catch(e){}dbg('TAP asked: '+(why||''))}
  function tapDone(){tapFn=null;try{$('resume').hidden=true}catch(e){}}
  try{$('resumeBtn').onclick=function(){var f=tapFn;tapDone();dbg('TAP given');try{f&&f()}catch(e){}}}catch(e){}
  function resumeOrAsk(c){ // a browser can hold sound until the screen is touched: never hang silently, ask for one tap
    return new Promise(function(done){
      var fin=false;function ok(){if(fin)return;fin=true;showAlert('');done()}
      try{c.resume().then(ok,function(){})}catch(e){}
      setTimeout(function(){if(fin)return;if(c.state!=='suspended'){ok();return}dbg('AUDIO waiting for a tap');setStatus('Tap the screen to start.');
        askTap(function(){try{c.resume().then(ok,ok)}catch(e){ok()}},'This device needs one touch before it can listen.');},2500);
    });
  }
  async function startWhisper(retrying,mediaEl){
    var mode=S.get('micMode','room'),direct=mode!=='room';
    if(mediaEl)return startReplayAudio(mediaEl);
    if(mode==='tab')return startTabAudio();
    var pre=new (window.AudioContext||window.webkitAudioContext)(); // created inside the tap so iOS allows sound; recreated after the mic is open so the rate matches
    try{if(pre.state==='suspended')pre.resume()}catch(e){}
    try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:!direct,noiseSuppression:!direct,autoGainControl:!direct,channelCount:1}})}
    catch(e){try{pre.close()}catch(e2){}if(retrying){dbg('mic open failed on retry: '+(e&&e.name));return false}running=false;ui();setStatus(micMsg(e));return false}
    try{pre.close()}catch(e){}
    ctx=new (window.AudioContext||window.webkitAudioContext)();
    try{if(ctx.state==='suspended')ctx.resume()}catch(e){}
    if(ctx.state==='suspended')await resumeOrAsk(ctx);
    return wireAudio(ctx.createMediaStreamSource(stream));
  }
  // Test with a sermon playing in another tab (YouTube, a livestream): its sound is taken digitally, no speaker and no microphone
  async function startTabAudio(){
    function fail(m){running=false;ui();setStatus(m);return false}
    if(!navigator.mediaDevices||!navigator.mediaDevices.getDisplayMedia)return fail('This device cannot listen to a tab. Use Chrome on a computer, or change Microphone in Settings.');
    var ds;
    try{ds=await navigator.mediaDevices.getDisplayMedia({video:true,audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}})}
    catch(e){return fail('No tab was shared. Press Start again and pick the tab that is playing the sermon.')}
    var at=ds.getAudioTracks();
    if(!at.length){ds.getTracks().forEach(function(t){t.stop()});return fail('The tab was shared without its sound. Press Start again, pick the tab, and switch on "Also share tab audio".')}
    stream=ds;ctx=new (window.AudioContext||window.webkitAudioContext)();
    try{if(ctx.state==='suspended')ctx.resume()}catch(e){}
    if(ctx.state==='suspended')await resumeOrAsk(ctx);
    var ok=wireAudio(ctx.createMediaStreamSource(new MediaStream(at)));
    ds.getTracks().forEach(function(tr){tr.onmute=null;tr.onended=function(){if(running&&stream===ds){stop();setStatus('Stopped: the shared tab was closed or sharing ended.');showAlert('Sharing stopped, so listening stopped. Press Start to listen again (and leave Chrome\'s Stop sharing button alone).',false,0,true)}}});
    dbg('TAB AUDIO started');return ok;
  }
  // Live test: the recording goes through the very same graph the microphone uses
  async function startReplayAudio(el){
    ctx=new (window.AudioContext||window.webkitAudioContext)();
    if(ctx.state==='suspended')await resumeOrAsk(ctx);
    var s=ctx.createMediaElementSource(el);s.connect(ctx.destination); // so you hear it while it runs
    return wireAudio(s);
  }
  function wireAudio(source){
    src=source;proc=ctx.createScriptProcessor(2048,1,1);
    var hp=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=85;hp.Q.value=0.7;
    // keep the whole speech band up to about 7.5 kHz: the sounds that tell س ص ث ش ف apart live between 4 and 8 kHz, and Whisper was trained on that full band.
    // (the old single filter at 4.8 kHz cut 6 kHz by 4 dB and 7 kHz by 8 dB.) Two stages make a steep edge so nothing above 8 kHz folds back when the sound is reduced to 16 kHz.
    var lp0=ctx.createBiquadFilter();lp0.type='lowpass';lp0.frequency.value=7600;lp0.Q.value=-5.33;
    var lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=7600;lp.Q.value=2.32;
    var qOk=true;try{qOk=Math.abs(lp0.Q.value+5.33)<0.1&&!(lp0.Q.minValue>-5.33)}catch(e){qOk=false}
    if(!qOk){lp0.type='allpass';lp.Q.value=0;dbg('FILTER: single stage on this browser')}
    var an=ctx.createAnalyser();an.fftSize=1024;an.smoothingTimeConstant=0.2;var spec=new Float32Array(an.frequencyBinCount),binHz=ctx.sampleRate/an.fftSize;
    src.connect(hp);hp.connect(lp0);lp0.connect(lp);lp.connect(an);lp.connect(proc);proc.connect(ctx.destination);
    // the neural voice detector is off: on iPhone/iPad it kept deciding the speaker had stopped. Loudness alone decides now.
    var noisy=S.get('noise','normal')==='noisy';
    function voiceBand(){
      an.getFloatFrequencyData(spec);var low=0,high=0;
      for(var i=1;i<spec.length;i++){var hz=i*binHz,pw=Math.pow(10,spec[i]/10);if(hz>=85&&hz<1000)low+=pw;else if(hz>=1000&&hz<5000)high+=pw}
      return low/(low+high+1e-12);
    }
    FRAME_MS=2048/ctx.sampleRate*1000;audioFrames=0;clearTimeout(audioCheck);
    audioCheck=setTimeout(function(){if(running&&audioFrames===0){setStatus('No sound is reaching the app. Tap the screen once, or close the app fully and open it again.');try{ctx.resume()}catch(e){}}},4000);
    var kick=function(){try{if(ctx&&ctx.state!=='running')ctx.resume()}catch(e){}};if(!window.__kickOn){window.__kickOn=1;document.addEventListener('touchend',kick);document.addEventListener('click',kick);}
    if(window.__kickOn===1){window.__kickOn=2;document.addEventListener('visibilitychange',kick)}try{ctx.onstatechange=kick}catch(e){}
    try{stream.getTracks().forEach(function(tr){tr.onended=function(){if(running)restartAudio('The microphone was interrupted')};tr.onmute=function(){setTimeout(function(){if(running&&tr.muted)restartAudio('The microphone was muted')},2500)}})}catch(e){}
    clearInterval(audioWatch);var lastF=-1,stuck=0;
    audioWatch=setInterval(function(){
      if(!running)return;
      var tn=Date.now();if(tn-(window.__modelsAt||0)>20*60000){window.__modelsAt=tn;loadModels()}
      if(!wake||wake.released){try{navigator.wakeLock&&navigator.wakeLock.request('screen').then(function(w){wake=w}).catch(function(){})}catch(e){}}
      if(audioFrames===lastF&&sr2On){sr2Dead=true;stopPreviewSR();setStatus('Instant preview is off on this device (it blocked the microphone).')}
      if(replayEl){lastF=audioFrames;return}
      if(audioFrames===lastF){stuck++;kick();if(stuck===2)setStatus('Sound stopped arriving, trying to recover…');if(stuck>=4)restartAudio('Sound stopped arriving')}else{stuck=0}
      lastF=audioFrames;
    },1500);
    buf=[];bufLen=0;energy=[];speechSamples=0;sinceVoiceMs=0;chunkMs=0;noiseFloor=LEARN.floor||0.004;peakLvl=0;quietAt=Date.now();lastSpeechAt=Date.now();
    proc.onaudioprocess=function(e){if(!ctx)return; // v103: a late sound frame after the microphone closed is ignored
      var d=e.inputBuffer.getChannelData(0),sum=0;for(var i=0;i<d.length;i++)sum+=d[i]*d[i];
      var rms=Math.sqrt(sum/d.length),now=Date.now();
      if(paused){audioFrames++;buf=[];bufLen=0;energy=[];chunkMs=0;speechSamples=0;sinceVoiceMs=0;try{meterTick(0,false,now)}catch(x){}return}
      // voice = clearly louder than the quiet moments, and not tiny next to the loudest recent speech
      // the noise floor only learns from quiet moments and never rises while someone is talking (a long sentence must not become "noise")
      peakLvl=Math.max(rms,peakLvl*0.98);
      if(rms<noiseFloor*1.6){noiseFloor=Math.min(0.012,noiseFloor*0.92+rms*0.08);quietAt=now}
      else if(now-quietAt>20000){noiseFloor=Math.min(0.012,noiseFloor*1.02)} // a steady hum for 20 s: slowly accept it as background
      var thresh=Math.max(noisy?0.004:0.0016,noiseFloor*(noisy?3:2.5),peakLvl*0.04,(LEARN.speech||0)*0.15),voice=rms>thresh;
      if(voice&&noisy&&voiceBand()<0.55)voice=false; // mostly high-pitched energy: a cry or scream, not an adult voice
      if(voice&&!replayEl){speechSum+=rms;speechN++;if(speechN>=400){LEARN.speech=Math.round(((LEARN.speech||speechSum/speechN)*0.7+(speechSum/speechN)*0.3)*1e5)/1e5;LEARN.floor=Math.round(Math.min(0.012,noiseFloor)*1e5)/1e5;learnSave();dbg('LEARNED mic: speech level '+LEARN.speech+' room floor '+LEARN.floor);speechSum=0;speechN=0}}
      meterTick(rms,voice,now);dbgAudio(rms,voice,thresh,now);
      var s16=resample(d,ctx.sampleRate);buf.push(s16);bufLen+=s16.length;energy.push(rms);chunkMs+=FRAME_MS;audioFrames++;
      if(voice){if(now-lastVoiceAt>700)uttStart=now;lastVoiceAt=now}
      if(voice){if(!chunkSpeechStart)chunkSpeechStart=now;speechSamples+=s16.length;sinceVoiceMs=0;lastSpeechAt=Date.now()}else sinceVoiceMs+=FRAME_MS;
      if(DG.live){ // the live line is hearing: send the sound up, keep only a short tail (so Whisper can take over cleanly) and save the recording in 5 s pieces
        dgFeed(s16);
        if(bufLen>SR16*5){if(!replayEl)recPut(flatten());buf=[];bufLen=0}
        energy=[];speechSamples=0;chunkMs=0;sinceVoiceMs=0;return;
      }
      if(HOLD.on){if(sinceVoiceMs<1200)holdPush(s16);buf=[];bufLen=0;energy=[];speechSamples=0;chunkMs=0;if(now-HOLD.since>HOLD_MAX)holdGiveUp();return} // the line is away: keep what is said (long silences are skipped) and resend it when the line returns
      var spoken=speechSamples/SR16*1000;liveStep();
      if(spoken>1000&&sinceVoiceMs>PAUSE_MS&&chunkMs>minChunk())cutChunk(false);           // natural pause (the minimum piece length tunes itself, see tunePause)
      else if(spoken>700&&chunkMs>MAXCHUNK_MS)cutChunk(true);                     // fast talker: cut at the quietest instant
      else if(chunkMs>HARD_MS){if(spoken>700)cutChunk(true);else{var keep=flatten().slice(-OVERLAP);buf=[keep];bufLen=keep.length;energy=[];chunkMs=0;speechSamples=0}} // long silence: drop it
    };
    return true;
  }

  function makeRec(){
    var r=new SR();
    r.lang='ar-EG';r.interimResults=true;r.continuous=!IOS;r.maxAlternatives=3;
    r.onresult=function(e){
      lastResult=Date.now();
      var interim='';
      for(var i=e.resultIndex;i<e.results.length;i++){
        var res=e.results[i],t=res[0].transcript.trim();
        if(res.isFinal){var alts=[];for(var k=1;k<res.length;k++){var a=(res[k].transcript||'').trim();if(a&&a!==t)alts.push(a)}onFinal(t,alts)}else interim+=t+' ';
      }
      if(interim.trim())arEl.textContent=cleanAr(interim.trim());
    };
    r.onerror=function(e){
      if(e.error==='not-allowed'||e.error==='service-not-allowed'){running=false;ui();setStatus(micMsg({name:'NotAllowedError'}));return}
      if(e.error==='network')setStatus('No connection for speech recognition.');
    };
    r.onend=function(){if(running&&!paused){clearTimeout(restartTimer);restartTimer=setTimeout(function(){if(running){try{rec.start()}catch(e){}}},IOS?250:50)}};
    return r;
  }
  async function startApple(){
    if(!SR){running=false;ui();setStatus('This iPad browser has no speech recognition. Use Safari, or add a Groq key.');return false}
    try{var s=await navigator.mediaDevices.getUserMedia({audio:true});s.getTracks().forEach(function(t){t.stop()})}catch(e){running=false;ui();setStatus(micMsg(e));return false}
    rec=rec||makeRec();
    try{rec.start()}catch(e){}
    watchdog=setInterval(function(){if(running&&Date.now()-lastResult>25000){try{rec.stop()}catch(e){}lastResult=Date.now()}},5000);
    return true;
  }

  var LOCKED=null; // the Groq key, locked with a password (AES-GCM). Without the password it is unreadable.
  async function unlockKey(pw){
    try{
      var u=function(b){return Uint8Array.from(atob(b),function(c){return c.charCodeAt(0)})};
      var km=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw.trim().toLowerCase().replace(/\s+/g,' ')),'PBKDF2',false,['deriveKey']);
      var k=await crypto.subtle.deriveKey({name:'PBKDF2',salt:u(LOCKED.s),iterations:LOCKED.n,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['decrypt']);
      var pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:u(LOCKED.i)},k,u(LOCKED.c));
      return new TextDecoder().decode(pt);
    }catch(e){return ''}
  }
  function askPassword(){
    var d=$('pwDlg');$('pwMsg').textContent='';$('pwIn').value='';
    try{d.showModal()}catch(e){}
    setTimeout(function(){try{$('pwIn').focus()}catch(e){}},200);
  }
  async function tryUnlock(){
    var pw=$('pwIn').value;if(!pw.trim())return;
    $('pwMsg').textContent='Checking…';
    var k=await unlockKey(pw);
    if(!k){$('pwMsg').textContent='Wrong password. Try again.';return}
    saveKey(k);groqBlockedUntil=0;whisperBlockedUntil=0;$('pwIn').value='';$('pwDlg').close();start();
  }
  $('pwGo').onclick=tryUnlock;$('pwIn').addEventListener('keydown',function(e){if(e.key==='Enter')tryUnlock()});
  // Groq refused the saved key (wrong, old or deleted): forget it everywhere and ask for the password, which unlocks the built-in key
  var rejectedOnce=false;
  function keyRejected(){
    if(rejectedOnce)return;rejectedOnce=true;
    dbg('KEY REJECTED by Groq');
    try{localStorage.removeItem('groqKey')}catch(e){}
    try{KEYDB.put('groqKey','')}catch(e){}
    try{document.cookie='gk=;max-age=0;path=/'}catch(e){}
    try{if(window.caches)caches.delete('church-kv')}catch(e){}
    groqBlockedUntil=0;whisperBlockedUntil=0;
    setTimeout(function(){rejectedOnce=false;if(typeof LOCKED!=='undefined'&&LOCKED){try{if(running)stop()}catch(e){}askPassword()}},300);
  }
