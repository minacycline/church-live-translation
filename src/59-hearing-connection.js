  function dgOpen(){ // v94: Soniox first gets a fresh short-lived key from the church server, then the line opens
    if(!dgWanted()||DG.ws||DG.keyWait)return;
    if(streamEngine()!=='soniox'){dgOpenWith('');return}
    DG.keyWait=true;
    sxKey().then(function(k){DG.keyWait=false;dgOpenWith(k)},function(e){DG.keyWait=false;dbg('STREAM no Soniox key: '+e.message);
      if(e.limit)return; // the day's limit: no retry
      if(NO_BACKUP&&!(e.net&&HOLD.on&&Date.now()-HOLD.since<HOLD_MAX))serviceDown(e.net?'sonioxnet':'soniox',e.net?(navigator.onLine===false?'HEARING PAUSED: no internet on this device. It reconnects by itself.':'HEARING PAUSED: cannot reach the church server (Wi-Fi?). It reconnects by itself.'):(e.status===402||/credit|balance|billing|payment|quota/i.test(e.message)?'HEARING STOPPED: the Soniox account is out of credit. Add credit at console.soniox.com (Billing), then press Restart.':'HEARING STOPPED: the church server could not get a Soniox key ('+e.message.slice(0,70)+').'));
      dgRetry()});
  }
  function dgOpenWith(sk){
    if(!dgWanted()||DG.ws)return;
    var sn=streamEngine()==='soniox',ws;
    try{ws=sn?new WebSocket('wss://stt-rt.soniox.com/transcribe-websocket',['soniox-api-key',sk]):new WebSocket(dgUrl(),['token',S.get('deepgramKey','')])}catch(e){dbg('STREAM could not start: '+e.message);dgRetry();return}
    if(sn){ws.addEventListener('open',function(){try{ws.send(JSON.stringify(sxStart()))}catch(e){}});SX={ar:'',en:'',nfAr:'',nfEn:'',at:0,shown:0}}
    ws.__sn=sn;HOLD.ring=[];HOLD.sentN=0;HOLD.finN=0;HOLD.msgAt=Date.now();HOLD.jam=0;
    ws.binaryType='arraybuffer';DG.ws=ws;
    ws.onopen=function(){setTimeout(function(){ // the line counts as up only once it has stayed open for a moment: a line that opens and is shut at once must not disturb Whisper
      if(DG.ws!==ws||ws.readyState!==1||!dgWanted())return;DG.live=true;DG.seg=[];DG.interim='';DG.opened=Date.now();DG.sent=Date.now();dbg('STREAM line is up');
      try{if(proc&&speechSamples/SR16>0.7)cutChunk(false)}catch(e){} // what Whisper was in the middle of hearing is not thrown away
      buf=[];bufLen=0;energy=[];speechSamples=0;chunkMs=0;sinceVoiceMs=0;
      if(ws.__sn)holdFlush();
      clearInterval(DG.keep);DG.keep=setInterval(function(){try{if(DG.live&&Date.now()-DG.sent>4000)ws.send(JSON.stringify({type:ws.__sn?'keepalive':'KeepAlive'}))}catch(e){}if(DG.live&&Date.now()-DG.opened>15000)DG.tries=0},4000)},ws.__sn?300:1200)};
    ws.onmessage=function(ev){if(DG.ws!==ws||typeof ev.data!=='string')return;var m;try{m=JSON.parse(ev.data)}catch(e){return}if(ws.__sn)sxMessage(m,ws);else dgMessage(m)};
    ws.onerror=function(){dbg('STREAM line error')};
    ws.onclose=function(ev){if(DG.ws!==ws)return;var was=DG.live;DG.live=false;DG.ws=null;clearInterval(DG.keep);dbg('STREAM line closed ('+ev.code+(ev.reason?' '+String(ev.reason).slice(0,60):'')+')'+(was?'':' before it opened: the key may be wrong, or this device cannot reach Deepgram'));
      if(was){try{var tl=flatten();if(!replayEl&&tl.length>SR16)recPut(tl);var kp=tl.slice(-Math.round(SR16*1.2));buf=[kp];bufLen=kp.length;energy=[];speechSamples=0;chunkMs=0;sinceVoiceMs=0}catch(e){}}
      if(DG.seg.length){var t=DG.seg.join(' ');DG.seg=[];dgFinal(t)}DG.interim='';
      var sa=SX.ar.replace(/\s+/g,' ').trim();if(sa){var se=SX.en.replace(/\s+/g,' ').trim();SX.ar='';SX.en='';SX.at=0;dgFinal(sa,se)}
      if(was&&ws.__sn&&dgWanted())holdStart();
      if(dgWanted())dgRetry()};
  }
  function dgRetry(){clearTimeout(DG.timer);DG.tries++;var w=HOLD.on?(DG.tries<=5?600:1500):Math.min(30000,1500*Math.pow(2,Math.min(DG.tries,4)));dbg('STREAM retry in '+(w/1000).toFixed(1)+' s, '+(HOLD.on?'the sound is being kept meanwhile':'Whisper is hearing meanwhile'));DG.timer=setTimeout(function(){if(dgWanted())dgOpen()},w)}
  function dgClose(){clearTimeout(DG.timer);clearInterval(DG.keep);var ws=DG.ws;DG.ws=null;DG.live=false;DG.tries=0;holdDrop();
    if(DG.seg.length&&running===false){var t=DG.seg.join(' ');DG.seg=[];try{dgFinal(t)}catch(e){}}DG.seg=[];DG.interim='';
    clearTimeout(SX.holdT);SX.heldAt=0;var sa=(running===false?SX.ar+SX.nfAr:SX.ar).replace(/\s+/g,' ').trim();if(sa&&running===false){var se=(SX.en+SX.nfEn).replace(/\s+/g,' ').trim();dbg('STOP: sending the words still being heard: '+sa.slice(-40));try{dgFinal(sa,se)}catch(e){try{MISSED.push({ar:sa.slice(0,4000),why:'could not be sent at Stop: '+String(e&&e.message||e).slice(0,120)})}catch(x){}}}SX.ar='';SX.en='';SX.nfAr='';SX.nfEn='';SX.at=0;
    try{if(ws){ws.onclose=null;if(ws.readyState===1)ws.send(ws.__sn?'':JSON.stringify({type:'CloseStream'}));ws.close()}}catch(e){}}
  function dgFeed(s16){ // 16 kHz samples in, 16-bit sound out
    var ws=DG.ws;if(!ws||ws.readyState!==1)return;
    if(HOLD.drain.length&&ws.__sn){HOLD.drain.push(s16);HOLD.dn+=s16.length;while(HOLD.dn>SR16*HOLD_SEC&&HOLD.drain.length>1){HOLD.dn-=HOLD.drain[0].length;HOLD.lostN=(HOLD.lostN||0)+HOLD.drain[0].length;HOLD.drain.shift()}return} // kept sound goes first, in order
    dgSend(ws,s16)}
  function dgSend(ws,s16){
    var b=new Int16Array(s16.length);for(var i=0;i<s16.length;i++){var x=Math.max(-1,Math.min(1,s16[i]));b[i]=x<0?x*0x8000:x*0x7fff}
    try{ws.send(b.buffer);DG.sent=Date.now()}catch(e){}
    if(ws.__sn){HOLD.ring.push([HOLD.sentN,b]);HOLD.sentN+=b.length;while(HOLD.ring.length>1&&(HOLD.ring[0][0]+HOLD.ring[0][1].length<=HOLD.finN||HOLD.sentN-HOLD.ring[0][0]>SR16*HOLD_SEC))HOLD.ring.shift()}
  }
  function dgMessage(m){
    if(m.type==='UtteranceEnd'){if(DG.seg.length){var u=DG.seg.join(' ');DG.seg=[];DG.interim='';dgFinal(u)}return}
    if(m.type!=='Results'||!m.channel||!m.channel.alternatives||!m.channel.alternatives[0])return;
    var t=String(m.channel.alternatives[0].transcript||'').trim();
    if(t){lastSpeechAt=Date.now();if(!DG.segAt)DG.segAt=sentStart()}
    if(m.is_final){
      if(t)DG.seg.push(t);DG.interim='';
      var all=DG.seg.join(' '),nw=all?all.split(/\s+/).length:0;
      // a finished thought goes to the translator at a pause, at sentence punctuation, or when it is getting long: never one endless line
      if(all&&(m.speech_final||(nw>=7&&/[.!?؟]\s*$/.test(all))||nw>=26)){DG.seg=[];dgFinal(all)}
      else if(all)arEl.textContent=cleanAr(all);
    }else if(t){DG.interim=t;var cur=(DG.seg.join(' ')+' '+t).trim();arEl.textContent=cleanAr(cur);dgPreview(cur)}
  }
  var lastSxItem=null,curSx='',curUnsure=null,uttStart=0,lastVoiceAt=0,lastSentEnd=0;
  var curSxOn=false;
  function sentStart(){var t=Math.max(uttStart||0,lastSentEnd||0);return t&&Date.now()-t<30000?t:Date.now()}
  var lastTextAt=0,skipHold=false,sxTok=0;
