  // v99 service report: when listening stops, a summary and the full debug log go to the church server (kept 90 days), so problems can be studied later.
  var sessionBegan=0;
  function reportBuild(began,test,snap){
    snap=snap||{log:DBG,lines:lines,missed:MISSED,drop:DBGDROP,use:claudeUse};
    var log=snap.log.slice(),cnt=function(re){return log.filter(function(x){return re.test(x)}).length};
    var ls=snap.lines.filter(function(l){return l.en&&!l.rp&&(!l.t0||l.t0>=began-2000)}), /* v118: earlier sessions' captions brought back on screen are not this session */lat=ls.filter(function(l){return l.t0&&l.t1}).map(function(l){return (l.t1-l.t0)/1000}).sort(function(a,b){return a-b});
    return {app:(document.querySelector('meta[name=build]')||{}).content,page:location.pathname,test:!!test,began:new Date(began).toISOString(),ended:new Date().toISOString(),minutes:Math.round((Date.now()-began)/6000)/10,
      device:navigator.userAgent,devCode:devCode(),sentences:ls.length, /* v129 */
      delay:{median:lat.length?lat[Math.floor(lat.length/2)]:null,slowest:lat.length?lat[lat.length-1]:null},
      drops:cnt(/HOLD line lost/),longDrops:cnt(/HOLD no line for/),stalls:cnt(/STREAM line stalled/),down:log.filter(function(x){return /\sDOWN /.test(x)}).map(function(x){return x.slice(0,300)}),
      translateFails:cnt(/TRANSLATE hiccup|careful translator failed|Translation problem/),claude:{requests:snap.use.req,inTokens:snap.use.inTok,outTokens:snap.use.outTok},missed:(snap.missed||[]).slice(),
      logLinesDropped:snap.drop,logShortened:false,sentencesLeftOut:0,
      text:ls.map(function(l){return {ar:String(l.ar||'').slice(0,4000),en:String(l.en||'').slice(0,4000),s:(l.t0&&l.t1)?Math.round((l.t1-l.t0)/100)/10:null}}),log:log.join('\n')};
  }
  // v101: a report is never cut quietly. If it is too large for the server, the middle of the debug log goes first, then the oldest sentences, and the report says exactly what was left out.
  var REPORT_MAX=3500000; // v103: the server now takes 4 MB (it was 0.9 MB)
  function reportFit(o){
    var body=JSON.stringify(o);if(body.length<=REPORT_MAX)return body;
    var over=body.length-REPORT_MAX+2000,L=o.log||'';
    if(L.length>60000){var keep=Math.max(50000,L.length-over),head=Math.floor(keep*0.3);o.log=L.slice(0,head)+'\n0.0s LOG dropped: the middle of this log was left out to fit\n'+L.slice(L.length-(keep-head));o.logShortened=true;body=JSON.stringify(o)}
    while(body.length>REPORT_MAX&&o.text&&o.text.length>20){var n=Math.ceil(o.text.length*0.2);o.text=o.text.slice(n);o.sentencesLeftOut=(o.sentencesLeftOut||0)+n;body=JSON.stringify(o)}
    return body;
  }
  // the waiting list of reports on this device (kept in the device's database, which holds far more than the small settings store)
  function qGet(){return KEYDB.get('pendingReports').then(function(v){try{var a=JSON.parse(v||'[]');return Array.isArray(a)?a:[]}catch(e){return []}})}
  function qPut(a){return KEYDB.put('pendingReports',JSON.stringify(a)).then(function(ok){if(ok)try{localStorage.setItem('reportsWaiting',String(a.length))}catch(e){}return ok})}
  function qAdd(body){return qGet().then(function(a){a.push(body);return qPut(a).then(function(ok){if(ok)return true;
    // the device's database refused it: keep at least the summary in the small store, and count it so it is shown
    try{var o=JSON.parse(body);o.log='0.0s LOG dropped: this device could not keep the full report';o.logShortened=true;o.sentencesLeftOut=(o.sentencesLeftOut||0)+(o.text||[]).length;o.text=[];var sm=JSON.parse(localStorage.getItem('pendingSmall')||'[]');sm.push(JSON.stringify(o));localStorage.setItem('pendingSmall',JSON.stringify(sm));return true}
    catch(e){try{localStorage.setItem('reportsLost',String((+localStorage.getItem('reportsLost')||0)+1))}catch(x){}return false}})})}
  function reportPost(body){return fetch(CLAUDE_PROXY+'/report',{method:'POST',headers:{'content-type':'application/json'},body:body}).then(function(r){return r.json().catch(function(){return {}}).then(function(j){return {ok:r.ok,status:r.status,type:(j&&j.error&&j.error.type)||''}})})}
  var qBusy=false;
  function qFlush(){ // sends everything waiting on this device, oldest first; stops at the first one the server cannot take right now
    if(qBusy||!CLAUDE_PROXY)return Promise.resolve();qBusy=true;
    var step=function(){return qGet().then(function(a){
      try{var sm=JSON.parse(localStorage.getItem('pendingSmall')||'[]');if(sm.length){a=sm.concat(a);localStorage.removeItem('pendingSmall');return qPut(a).then(step)}}catch(e){}
      if(!a.length)return;
      var body=a[0];try{var o=JSON.parse(body);if(!o.sentLate&&o.ended&&Date.now()-Date.parse(o.ended)>600000){o.sentLate='it waited on the device since '+o.ended;body=JSON.stringify(o)}}catch(e){}
      return reportPost(body).then(function(r){
        if(r.ok){a.shift();return qPut(a).then(step)}
        if(r.status===413){try{var o2=JSON.parse(body);REPORT_MAX=Math.max(200000,Math.floor(body.length*0.7));a[0]=reportFit(o2);return qPut(a).then(step)}catch(e){return}}
        dbg('REPORT still waiting on this device (server said '+r.status+' '+r.type+')');
      })})};
    return step().catch(function(){}).then(function(){qBusy=false;repStat()});
  }
  // v109: safety copy. A report used to exist only after Stop plus 6 seconds, so a page closed, reloaded or put away without Stop lost the whole session.
  // While a session runs, a copy of the report is kept on this device every 30 seconds and whenever the page is hidden. The next time the app opens it goes to the waiting list like any report.
  function repSafe(began,test,snap,why){
    if(!CLAUDE_PROXY||!began)return;
    try{var o=reportBuild(began,test,snap);o.sentLate=why+' (safety copy kept '+new Date().toISOString()+')';o.log+='\n0.0s REPORT safety copy: '+why;
      var body=reportFit(o);
      try{localStorage.setItem('pendingReport',body)}catch(e){ // the small store is full: keep the newest part of the log and say so
        o.log='0.0s LOG dropped: the start of this log was left out so the safety copy fits on this device\n'+o.log.slice(-150000);o.logShortened=true;
        try{localStorage.setItem('pendingReport',JSON.stringify(o))}catch(e2){o.sentencesLeftOut=(o.sentencesLeftOut||0)+(o.text||[]).length;o.text=[];o.log=o.log.slice(-20000);try{localStorage.setItem('pendingReport',JSON.stringify(o))}catch(e3){}}}
    }catch(e){}
  }
  function partNew(b){return lines.some(function(l){return !l.rp&&l.t0&&l.t0>=b-2000})||MISSED.length>0}
  function repSafeNow(){if(sessionBegan&&running&&(!partNo||partNew(sessionBegan)))repSafe(sessionBegan,!!replayName&&/LIVE TEST/.test(DBG[0]||''),null,'the page was closed or reloaded without Stop')}
  setInterval(repSafeNow,30000);
  // v152: a report used to leave the device only after Stop (or the next time the app was opened). When the page is hidden or closed and something was translated,
  // the report is now sent at that moment. It is first kept in the small store (pendingParts) and leaves it only when the server confirms; with no answer it joins the normal waiting list.
  // If the service carries on after that (the page comes back), what follows is a new part with its own start time; a sentence already reported (l.rp) is never reported again.
  var partNo=0,partFly={};
  function partList(){try{var a=JSON.parse(localStorage.getItem('pendingParts')||'[]');return Array.isArray(a)?a:[]}catch(e){return []}}
  function partKey(b){var m=/"began":"([^"]+)"/.exec(b);return m?m[1]:''}
  function partDrop(key){try{var a=partList().filter(function(b){return partKey(b)!==key});if(a.length)localStorage.setItem('pendingParts',JSON.stringify(a));else localStorage.removeItem('pendingParts')}catch(e){}}
  function partsToQueue(){ // parts whose direct send got no answer go to the normal waiting list (kept there first, removed here second, so none is lost)
    var a=partList().filter(function(b){return !partFly[partKey(b)]});if(!a.length)return Promise.resolve();
    return a.reduce(function(p,b){return p.then(function(){return qAdd(b)}).then(function(){partDrop(partKey(b))})},Promise.resolve()).then(function(){return qFlush()}).catch(function(){});
  }
  function hideSend(){
    if(!CLAUDE_PROXY||!sessionBegan||!running||replayEl)return false;
    var b0=sessionBegan,soft=!!softOn,mine=function(l){return !l.rp&&l.t0&&l.t0>=b0-2000};
    if(!lines.some(function(l){return l.en&&mine(l)}))return false; // nothing translated in this part: the safety copy is enough
    try{
      dbg('REPORT sent because the page was hidden or closed'+(soft?' after Stop':' (if the page comes back, what follows is a new part)'));
      var o=reportBuild(b0,false,null),body=reportFit(o),key=o.began,kept=false;
      try{var a=partList();a.push(body);localStorage.setItem('pendingParts',JSON.stringify(a));kept=true}catch(e){}
      try{localStorage.removeItem('pendingReport')}catch(e){}
      if(!kept)qAdd(body).then(function(){return qFlush()}); // too large for the small store: straight to the waiting list
      else{partFly[key]=1;var big=true;try{big=new Blob([body]).size>60000}catch(e){}
        fetch(CLAUDE_PROXY+'/report',{method:'POST',headers:{'content-type':'application/json'},body:body,keepalive:!big}).then(function(r){delete partFly[key];if(r.ok)partDrop(key);else partsToQueue()},function(){delete partFly[key];partsToQueue()})}
      var wait=lines.filter(function(l){return !l.en&&mine(l)}).map(function(l){return l.t0});
      lines.forEach(function(l){if(l.en&&mine(l))l.rp=1});partNo++;
      if(soft){clearTimeout(softRepT);sessionBegan=0}
      else{sessionBegan=wait.length?Math.min.apply(null,wait)+2000:Date.now();DBG=[];MISSED=[];dbg('NEXT PART: what came before was reported when the page was hidden')}
      return true;
    }catch(e){return false}
  }
  function repHide(){var sent=false;try{sent=hideSend()}catch(e){}if(!sent)repSafeNow()}
  window.addEventListener('pagehide',repHide);
  document.addEventListener('visibilitychange',function(){if(document.hidden)repHide();else partsToQueue()});
  function reportSend(began,test,snap){
    if(!CLAUDE_PROXY||!began)return; // v103: every session is reported, short ones too (the sheet marks them as short)
    var body;try{body=reportFit(reportBuild(began,test,snap))}catch(e){dbg('REPORT could not be built: '+e.message);try{localStorage.setItem('reportsLost',String((+localStorage.getItem('reportsLost')||0)+1))}catch(x){}return}
    qAdd(body).then(function(){return qFlush()}); // always through the waiting list: it leaves the list only when the server confirms it
  }
  // what is waiting, and where: shown as an orange dot on the start screen (only when something is waiting) and in the owner's settings
  var REPSTAT={device:0,server:0,lost:0,deviceLost:0,received:0,inSheet:0,ok:false};
  function repStat(){
    try{REPSTAT.deviceLost=+localStorage.getItem('reportsLost')||0}catch(e){}
    return qGet().then(function(a){REPSTAT.device=a.length;try{REPSTAT.device+=JSON.parse(localStorage.getItem('pendingSmall')||'[]').length}catch(e){}
      if(!CLAUDE_PROXY)return;
      return fetch(CLAUDE_PROXY+'/usage',{method:'POST'}).then(function(r){return r.json()}).then(function(j){REPSTAT.usage=j;if(j&&j.reports){REPSTAT.server=j.reports.waiting||0;REPSTAT.lost=j.reports.lost||0;REPSTAT.received=j.reports.received||0;REPSTAT.inSheet=j.reports.inSheet||0;REPSTAT.ok=true}},function(){})
    }).catch(function(){}).then(function(){readyRefresh()});
  }
  function repDotText(){var t=[];if(!REPSTAT)return '';
    if(REPSTAT.device)t.push(REPSTAT.device+(REPSTAT.device===1?' report is':' reports are')+' still on this device. It is sent when the app is open with a connection.');
    if(REPSTAT.server)t.push(REPSTAT.server+(REPSTAT.server===1?' report has':' reports have')+' not reached the Google Sheet yet (the mini PC may be off). The server tries again every hour.');
    if(REPSTAT.lost||REPSTAT.deviceLost)t.push((REPSTAT.lost+REPSTAT.deviceLost)+' report(s) could not be kept. Tell Claude.');
    return t.join(' ')}
  setTimeout(function(){partsToQueue().then(function(){try{var pr=localStorage.getItem('pendingReport');if(pr){localStorage.removeItem('pendingReport');qAdd(pr).then(qFlush);return}}catch(e){}qFlush()})},7000);
  // v99 usage: the owner's settings show how much of today's limit is used
  function usageShow(){
    if(!CLAUDE_PROXY)return;var ow=document.getElementById('ownerArea');if(!ow)return;var el=document.getElementById('usageNote');
    if(!el){el=document.createElement('div');el.id='usageNote';el.className='help';el.style.cssText='margin:10px 0;font-weight:700;color:var(--fg)';ow.insertBefore(el,ow.firstChild)}
    el.textContent='Use today: checking…';
    fetch(CLAUDE_PROXY+'/usage',{method:'POST'}).then(function(r){return r.json()}).then(function(j){if(j&&typeof j.today==='number'){var rp=j.reports,rl='';if(rp)rl=' Reports: '+rp.received+' received by the server, '+rp.inSheet+' in the Google Sheet, '+rp.waiting+' waiting on the server, '+REPSTAT.device+' waiting on this device, '+((rp.lost||0)+REPSTAT.deviceLost)+' lost.';el.textContent='Used today: '+j.today+' of '+j.cap+' minutes. This month: '+j.month+' minutes.'+rl}else el.textContent='Use today: not available.'},function(){el.textContent='Use today: could not reach the church server.'});
  }
  try{$('gear').addEventListener('click',function(){setTimeout(usageShow,200)})}catch(e){}
  // v100: a mark is kept while listening; if the page comes back without Stop having been pressed (a reload, a crash), it offers one tap to carry on
  setInterval(function(){try{if(running&&!replayEl&&!isScreen())localStorage.setItem('liveAt',String(Date.now()))}catch(e){}},10000);
  setTimeout(function(){try{var la=+localStorage.getItem('liveAt')||0;localStorage.removeItem('liveAt');if(la&&Date.now()-la<180000&&!running&&roleChosen()&&!isScreen()){dbg('RELOAD in the middle of listening: asking for a tap');askTap(function(){if(!running)start()},'The app restarted. Tap to carry on.')}}catch(e){}},1200);
  // v103: when the app stops listening by itself, it says why on the whole screen and one tap starts it again
  function autoStop(why){dbg('AUTO STOP '+why);try{stop()}catch(e){}setTimeout(function(){askTap(function(){if(!running)start()},why+' Tap to start again.')},500)}
  function doRestart(){try{if(running)stop()}catch(e){}setTimeout(function(){location.replace(location.pathname+'?r='+Date.now())},running?1500:100)}
  try{if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'))navigator.serviceWorker.register('sw.js').catch(function(){})}catch(e){}
  setTimeout(updateCheck,1500);
  setTimeout(function(){try{if(!running){matchOne('الرب راعي فلا يعوزني شيء');fixNames('الرب راعي فلا يعوزني شيء');nameGuesses('الرب راعي فلا يعوزني شيء')}}catch(e){}},3500); // v138: the verse, prayer and name lists are built while the start screen is showing
  setTimeout(function(){readyRefresh();if(!running)loadReadings()},500);window.addEventListener('online',readyRefresh);window.addEventListener('offline',readyRefresh);
  setTimeout(function(){
    if(running||!IOS)return;
    var standalone=window.navigator.standalone===true||matchMedia('(display-mode: standalone)').matches;
    var inApp=!/Safari\//.test(navigator.userAgent)||/CriOS|FxiOS|Claude|GSA|FBAN|Instagram/.test(navigator.userAgent);
    if(standalone)return;
    if(false)showAlert((inApp?'This page is open inside another app\'s browser, which forgets settings. ':'')+'For church, open the app from its Home Screen icon so the key stays saved. (In Safari: Share, then Add to Home Screen.)\n(tap to hide)',false,15000);
  },2500);

