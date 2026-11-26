  // -- audio capture: 16 kHz samples, cut at pauses or at the quietest instant, with overlap so no word is split --
  var SR16=16000,buf=[],bufLen=0,energy=[],noiseFloor=LEARN.floor||0.004,peakLvl=0,quietAt=0,speechSum=0,speechN=0,speechSamples=0,sinceVoiceMs=0,chunkMs=0;
  var OVERLAP=Math.round(SR16*0.3),MAXCHUNK_MS=8000,HARD_MS=14000,FRAME_MS=0,PAUSE_MS=500;
  function minChunk(){var v=parseInt(LEARN.minChunk,10);return v>=2200&&v<=3000?v:2200}
  function tunePause(ls){ // self-tuning: very short pieces mean the cut is too eager (raise), long waits before English mean it is too lazy (lower)
    if(!ls||ls.length<12)return '';var w=ls.map(function(l){return words(l.ar||'').length}).sort(function(a,b){return a-b}),mw=w[w.length>>1];
    var hear=ls.map(function(l){return l.tCut&&l.t0?l.t0-l.tCut:null}).filter(function(x){return x!=null}).sort(function(a,b){return a-b}),mh=hear.length?hear[hear.length>>1]:0;
    var cur=minChunk(),nv=cur;
    if(mw<5)nv=Math.min(3000,cur+200);else if(mw>14&&mh<1500)nv=Math.max(2200,cur-200);
    if(nv!==cur){LEARN.minChunk=nv;learnSave();dbg('TUNED minimum piece '+cur+' -> '+nv+' ms (median words '+mw+')');return 'Minimum piece length tuned '+cur+' -> '+nv+' ms (median '+mw+' words per piece).'}
    return 'Minimum piece length kept at '+cur+' ms (median '+mw+' words per piece).';
  }
  function resample(data,rate){
    var ratio=rate/SR16,len=Math.floor(data.length/ratio),out=new Float32Array(len);
    for(var i=0;i<len;i++){var a=Math.floor(i*ratio),b=Math.min(Math.floor((i+1)*ratio),data.length),sum=0,n=0;for(var j=a;j<b;j++){sum+=data[j];n++}out[i]=n?sum/n:0}
    return out;
  }
  var meterAt=0,meterEl=null,audioFrames=0,audioCheck=null;
  var dA={n:0,v:0,sum:0,max:0,at:0};
  function dbgAudio(rms,voice,thresh,now){
    dA.n++;if(voice)dA.v++;dA.sum+=rms;if(rms>dA.max)dA.max=rms;
    if(!dA.at)dA.at=now;
    if(now-dA.at>=3000){dbg('audio frames '+dA.n+' voiced '+Math.round(dA.v/dA.n*100)+'% avg '+(dA.sum/dA.n).toFixed(4)+' max '+dA.max.toFixed(4)+' floor '+noiseFloor.toFixed(4)+' thresh '+thresh.toFixed(4)+' chunk '+(chunkMs/1000).toFixed(1)+'s spoken '+(speechSamples/SR16).toFixed(1)+'s ctx '+(ctx?ctx.state:'none'));dA={n:0,v:0,sum:0,max:0,at:now}}
  }
  // v78: two small gauges at the top right. The microphone bars move with the sound the app is receiving (green while it hears a voice).
  // The connection bars are a measurement, not the Wi-Fi radio (a web page cannot read that): every few seconds a tiny request is timed, and the bars show how quickly the internet answers
  function barsSet(id,n){var e=$(id);if(!e)return;var k=e.children;for(var i=0;i<k.length;i++)k[i].classList.toggle('on',i<n)}
  var NET={ms:[],bars:-1};
  function netShow(n,ms){var e=$('netBars');if(!e)return;barsSet('netBars',n);e.classList.toggle('low',n>0&&n<=2);e.classList.toggle('off',n===0);var g=$('netG');if(g)g.title=n?('Connection: the internet answers in about '+ms+' ms'):'No connection';if(n!==NET.bars){NET.bars=n;try{dbg('NET '+(n?ms+' ms, ':'no answer, ')+n+' of 5 bars')}catch(e){}}}
  function netProbe(){
    if(document.hidden&&!(typeof running!=='undefined'&&running))return;
    if(navigator.onLine===false){NET.ms=[];netShow(0,0);return}
    var t0=performance.now(),ac=window.AbortController?new AbortController():null,to=setTimeout(function(){try{ac&&ac.abort()}catch(e){}},4000);
    fetch('manifest.json?p='+Date.now(),{method:'HEAD',cache:'no-store',signal:ac?ac.signal:undefined}).then(function(){
      clearTimeout(to);NET.ms.push(Math.round(performance.now()-t0));if(NET.ms.length>3)NET.ms.shift();
      var s=NET.ms.slice().sort(function(a,b){return a-b}),m=s[Math.floor(s.length/2)];netShow(m<=120?5:m<=250?4:m<=500?3:m<=1000?2:1,m);
    }).catch(function(){clearTimeout(to);NET.ms=[];netShow(navigator.onLine===false?0:1,4000)});
  }
  setInterval(netProbe,6000);setTimeout(netProbe,800);window.addEventListener('online',netProbe);window.addEventListener('offline',netProbe);
  setTimeout(function(){var g=$('netG');if(g)g.onclick=function(){var d=$('dot');d&&d.click()}},0);
  function meterTick(rms,voice,now){
    if(now-meterAt<90)return;meterAt=now;meterEl=meterEl||$('meter');if(!meterEl)return;
    var db=20*Math.log10(Math.max(rms,1e-5)),pct=Math.max(0,Math.min(100,Math.round((db+52)/44*100))); // -52 dB (silence) to -8 dB (very loud)
    barsSet('micBars',pct<=4?0:Math.min(5,Math.ceil(pct/20)));var mb=$('micBars');if(mb)mb.classList.toggle('voice',!!voice);
    meterEl.firstChild.style.width=pct+'%';meterEl.classList.toggle('voice',!!voice);var dv=$('dot');if(dv)dv.classList.toggle('voice',!!voice);var sm=$('sideMeter');if(sm){sm.firstChild.style.height=pct+'%';sm.classList.toggle('voice',!!voice);document.body.classList.add('listening')}
  }
  // v159 low sound: the sound is looked at in 3 s windows. A window counts as speech when 30% or more of it is voice.
  // Three speech windows in a row quieter than -36 dB on average = the speaker is far from the microphone: the bottom tag says so.
  // It clears after two speech windows at -33 dB or louder, or after about 20 s with nobody speaking.
  // Measured on the saved reports up to 26 Nov 2026: the church sermon of 22 Nov sat at about -23 dB (never under -36), one quiet test on 20 Nov sat at -41 dB.
  var MIC_TIP='Best accuracy when the speaker is close to the microphone.',MIC_LOW='Speaker is far from the microphone. Some words may be missed.';
  var LOWS={at:0,n:0,v:0,sum:0,low:0,good:0,quiet:0,on:false};
  function lowShow(on){if(LOWS.on===on)return;LOWS.on=on;try{var n=$('betaNote'),b=$('betaNoteB');if(n)n.classList.toggle('low',on);if(b)b.textContent=on?MIC_LOW:MIC_TIP}catch(e){}}
  function lowReset(){LOWS.at=0;LOWS.n=0;LOWS.v=0;LOWS.sum=0;LOWS.low=0;LOWS.good=0;LOWS.quiet=0;lowShow(false)}
  function lowTick(rms,voice,now){
    if(!LOWS.at)LOWS.at=now;LOWS.n++;if(voice)LOWS.v++;LOWS.sum+=rms;
    if(now-LOWS.at<3000)return;
    var db=20*Math.log10(Math.max(LOWS.sum/LOWS.n,1e-5)),speech=LOWS.v/LOWS.n>=0.3;LOWS.at=now;LOWS.n=0;LOWS.v=0;LOWS.sum=0;
    if(speech){LOWS.quiet=0;if(db<-36){LOWS.low++;LOWS.good=0}else if(db>=-33){LOWS.good++;LOWS.low=0}else{LOWS.low=0;LOWS.good=0}
      if(!LOWS.on&&LOWS.low>=3){lowShow(true);dbg('MIC LOW: the speaker sounds far from the microphone (about '+Math.round(db)+' dB), notice shown')}
      else if(LOWS.on&&LOWS.good>=2){lowShow(false);dbg('MIC OK again (about '+Math.round(db)+' dB), notice removed')}}
    else{LOWS.quiet++;LOWS.low=0;if(LOWS.on&&LOWS.quiet>=7){lowShow(false);dbg('MIC LOW notice removed: nobody speaking')}}
  }
  function flatten(){var out=new Float32Array(bufLen),o=0;buf.forEach(function(x){out.set(x,o);o+=x.length});return out}
  function cutChunk(atQuietest){
    var all=flatten(),cut=all.length;
    if(atQuietest&&energy.length>6){
      // find the quietest frame in the last 2.5 s and cut there
      var frames=Math.min(energy.length,Math.round(2500/FRAME_MS)),best=0,bi=energy.length-1;
      for(var i=energy.length-frames;i<energy.length;i++){if(i===energy.length-frames||energy[i]<best){best=energy[i];bi=i}}
      var keepFrames=energy.length-bi;cut=Math.max(SR16,all.length-keepFrames*Math.round(FRAME_MS*SR16/1000));
    }
    var send=all.subarray(0,cut),rest=all.subarray(Math.max(0,cut-OVERLAP));
    var sp=speechSamples/SR16,chunkLoud=0;if(energy.length){energy.forEach(function(x){chunkLoud+=x});chunkLoud/=energy.length}
    if(energy.length>8){var me=0;energy.forEach(function(x){me+=x});me/=energy.length;if(sp<0.6&&me>Math.max(0.0015,noiseFloor*2.5)&&send.length>SR16*1.5)sp=Math.max(sp,0.8)} // loud overall: it is speech
    chunkSpeechStart=0;buf=[rest.slice()];bufLen=rest.length;energy=energy.slice(-Math.round(OVERLAP/SR16*1000/FRAME_MS)-1);
    speechSamples=atQuietest?Math.round(rest.length*0.5):0;chunkMs=rest.length/SR16*1000;
    sendChunk(send,sp,chunkLoud);
    if(sp<0.7){liveEn='';liveGen++;render()}
  }

  var micFails=0;
  async function restartAudio(why){
    if(restarting||!running)return;restarting=true;
    try{
      setStatus(why+', reconnecting the microphone…');
      try{proc&&(proc.onaudioprocess=null);proc&&proc.disconnect();src&&src.disconnect();ctx&&ctx.close()}catch(e){}
      try{stream&&stream.getTracks().forEach(function(tr){tr.onended=null;tr.stop()})}catch(e){}
      stream=null;ctx=null;proc=null;src=null;vadOk=false;vadQ=[];
      await new Promise(function(r){setTimeout(r,400)});
      if(!running)return;
      var ok=await startWhisper(true);
      if(ok&&running){micFails=0;if(tapFn)tapDone();setStatus('Listening again. Heard '+heardCount+' pieces')}
      else if(running){micFails++;
        if(micFails>=2&&!tapFn)askTap(function(){restarting=false;micFails=0;restartAudio('Screen tapped')},'The microphone was interrupted (a call, another app, or the screen locked).');
        setTimeout(function(){restarting=false;restartAudio('Still no microphone')},3000);return}
    }finally{if(restarting&&running!==false)restarting=false}
  }
