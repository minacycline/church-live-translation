  // v79 hold and resend: when the live line drops or stalls, the sound is kept (up to HOLD_SEC seconds) instead of being lost, the line is retried quickly,
  // and the kept sound is sent as soon as it returns. Soniox reports how much sound it has finished hearing, so only the part it had not finished is sent again.
  // If the line stays away longer than HOLD_MAX, the kept sound goes to the backup hearing (Whisper), as before this change.
  var HOLD_SEC=120,HOLD_MAX=20000,HOLD={on:false,since:0,q:[],n:0,ring:[],sentN:0,finN:0,msgAt:0,jam:0,drain:[],dn:0,told:false,boot:false};
  // v96 weak Wi-Fi: up to 2 minutes of speech is kept during a drop (it was 25 s), it is never thrown away while the line is being retried,
  // and when the line returns the kept sound goes up at a steady pace (about 5 times normal speed) so a weak line is not flooded and dropped again.
  function holdNote(t){try{var g=$('liveTag'),a=$('liveTagA');if(!g||!a)return;a.textContent=t||'Live Translation';g.classList.toggle('weak',!!t)}catch(e){}}
  setInterval(function(){
    if(!HOLD.drain.length)return;var ws=DG.ws;if(!ws||ws.readyState!==1||!DG.live)return;
    var sent=0;while(HOLD.drain.length&&sent<SR16*0.5&&ws.bufferedAmount<48000){var f=HOLD.drain.shift();HOLD.dn-=f.length;sent+=f.length;dgSend(ws,f)}
    if(!HOLD.drain.length){HOLD.dn=0;holdNote('');holdLostSay();dbg('HOLD caught up: all the kept sound has been sent')}
  },100);
  function holdStart(){
    if(HOLD.on||!running||paused)return;
    var q=[],n=0;HOLD.ring.forEach(function(r){var st=r[0],b=r[1];if(st+b.length<=HOLD.finN)return;var from=Math.max(0,HOLD.finN-st),f=new Float32Array(b.length-from);for(var i=from;i<b.length;i++)f[i-from]=b[i]/32768;q.push(f);n+=f.length});
    HOLD.drain.forEach(function(f){q.push(f);n+=f.length});HOLD.drain=[];HOLD.dn=0; // kept sound that had not gone up yet stays in line
    while(n>SR16*HOLD_SEC&&q.length>1){n-=q[0].length;HOLD.lostN=(HOLD.lostN||0)+q[0].length;q.shift()}
    HOLD.on=true;HOLD.boot=false;HOLD.told=false;HOLD.since=Date.now();HOLD.q=q;HOLD.n=n;HOLD.ring=[];HOLD.sentN=0;HOLD.finN=0;holdNote('WEAK WI-FI \u00b7 RECONNECTING');
    dbg('HOLD line lost: keeping the sound ('+(n/SR16).toFixed(1)+' s not yet heard)');
    problemText='The connection dropped: the sound is being kept and is sent when it returns';problemAt=Date.now();var d=$('dot');d&&d.classList.add('warn');
  }
  function holdPush(f){HOLD.q.push(f);HOLD.n+=f.length;while(HOLD.n>SR16*HOLD_SEC&&HOLD.q.length>1){HOLD.n-=HOLD.q[0].length;HOLD.lostN=(HOLD.lostN||0)+HOLD.q[0].length;HOLD.q.shift()}}
  function holdLostSay(){if(HOLD.lostN>0){dbg('HOLD dropped '+(HOLD.lostN/SR16).toFixed(1)+' s of speech: the connection was away longer than the '+HOLD_SEC+' s the app can keep');HOLD.lostN=0}}
  // v116: from the moment the microphone opens until the live line is up, the sound is kept the same way and sent first, so the opening words are heard
  function holdBoot(){if(HOLD.on||DG.live||!running||paused)return;HOLD.on=true;HOLD.boot=true;HOLD.told=false;HOLD.since=Date.now();HOLD.q=[];HOLD.n=0;dbg('START keeping the sound until the live line is up')}
  function holdFlush(){
    if(!HOLD.on)return;var q=HOLD.q,n=HOLD.n,boot=HOLD.boot;HOLD.on=false;HOLD.boot=false;HOLD.q=[];HOLD.n=0;
    holdLostSay();HOLD.drain=q;HOLD.dn=n;holdNote(!boot&&n>SR16*2?'WEAK WI-FI \u00b7 CATCHING UP':'');
    dbg(boot?'START line up '+((Date.now()-HOLD.since)/1000).toFixed(1)+' s after the microphone: sending '+(n/SR16).toFixed(1)+' s of kept sound':'HOLD line back after '+((Date.now()-HOLD.since)/1000).toFixed(1)+' s: sending '+(n/SR16).toFixed(1)+' s of kept sound');
    alertClear('sonioxnet');
    var d=$('dot');d&&d.classList.remove('warn');problemText='';
  }
  function holdGiveUp(){
    if(NO_BACKUP){ // no backup hearing: keep holding the sound and keep retrying; only say so on the screen, once
      if(HOLD.told)return;HOLD.told=true;dbg('HOLD no line for '+Math.round(HOLD_MAX/1000)+' s: still keeping the sound and retrying');
      serviceDown('sonioxnet',navigator.onLine===false?'HEARING PAUSED: no internet on this device. It reconnects by itself and catches up.':'HEARING PAUSED: the Wi-Fi is too weak to reach the hearing service. It reconnects by itself and catches up.');return}
    var q=HOLD.q,n=HOLD.n;HOLD.on=false;HOLD.q=[];HOLD.n=0;
    dbg('HOLD no line for '+Math.round(HOLD_MAX/1000)+' s: '+(n/SR16).toFixed(1)+' s of kept sound goes to the backup hearing');
    if(NO_BACKUP)serviceDown('sonioxnet',navigator.onLine===false?'HEARING PAUSED: no internet on this device. It reconnects by itself.':'HEARING PAUSED: cannot reach Soniox (Wi-Fi?). It reconnects by itself.');
    if(n>SR16*0.7){buf=q;bufLen=n;energy=[];speechSamples=n;chunkMs=n/SR16*1000;try{cutChunk(false)}catch(e){}}
  }
  function holdDrop(){try{holdLostSay()}catch(e){}HOLD.on=false;HOLD.boot=false;HOLD.q=[];HOLD.n=0;HOLD.ring=[];HOLD.sentN=0;HOLD.finN=0;HOLD.jam=0;HOLD.drain=[];HOLD.dn=0;HOLD.told=false;holdNote('')}
  window.addEventListener('online',function(){try{if(HOLD.on&&dgWanted()&&!DG.ws){clearTimeout(DG.timer);dgOpen()}}catch(e){}});
  setInterval(function(){ // a line that is open but no longer carries anything (weak Wi-Fi) is closed and reopened; Soniox answers about once a second even in silence
    var ws=DG.ws;if(!ws||!DG.live||!ws.__sn||!running||paused)return;
    var now=Date.now(),mute=now-HOLD.msgAt>5000&&now-DG.opened>6000&&now-DG.sent<1500;
    HOLD.jam=ws.bufferedAmount>SR16*2*3?HOLD.jam+1:0;
    if(HOLD.jam>=3||mute){HOLD.jam=0;dbg('STREAM line stalled ('+(mute?'no answer for 5 s':'sound is not leaving this device')+'): reconnecting');var h=ws.onclose;ws.onclose=null;try{ws.close()}catch(e){}try{h&&h({code:4000,reason:'stalled'})}catch(e){}}
  },1000);
