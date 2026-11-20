  // ---- v123: "This app is restricted". With "Approved devices only" on for this link, a device that is not approved
  // sees a short form (name and phone), then "Please wait for approval", which checks every 30 seconds and opens by itself.
  // A blocked device sees no form. The admin link never shows this screen (the admin approves devices there). ----
  var gateTimer=0,gateMode='',gateWhy='';
  function gateEl(){
    var g=document.getElementById('gateScr');if(g)return g;
    g=document.createElement('div');g.id='gateScr';g.setAttribute('role','dialog');g.setAttribute('aria-modal','true');
    g.innerHTML='<div class="gbox"><div class="glock" aria-hidden="true">🔒</div><h1 id="gTitle"></h1><p id="gText"></p>'
      +'<div id="gSpin" class="gspin" hidden></div>'
      +'<form id="gForm" hidden novalidate><label>Your name<input id="gName" autocomplete="name" maxlength="80" required></label>'
      +'<label>Phone number<input id="gPhone" type="tel" inputmode="tel" autocomplete="tel" maxlength="30" required></label>'
      +'<button type="submit" id="gSend">Request access</button><div class="gmsg" id="gMsg" role="status"></div></form>'
      +'<button type="button" class="lnk" id="gEdit" hidden>Change my name or phone</button>'
      +'<div class="gcode" id="gCode"></div></div>';
    document.body.appendChild(g);
    $('gForm').addEventListener('submit',function(e){e.preventDefault();gateSend()});
    $('gEdit').onclick=function(){gateRender('form')};
    return g;
  }
  function gateRender(mode){
    gateMode=mode;var g=gateEl();g.classList.add('on');
    $('gCode').textContent='Device code '+devCode();
    $('gForm').hidden=mode!=='form';$('gSpin').hidden=mode!=='wait';$('gEdit').hidden=mode!=='wait';
    if(mode==='form'&&gateWhy==='total'){$('gTitle').textContent='Your time is used up';$('gText').textContent='This device has used the time it was given. To ask for more, send your name and phone number.';$('gMsg').textContent='';$('gSend').textContent='Ask for more time'}
    else if(mode==='form'){$('gTitle').textContent='This app is restricted';$('gText').textContent='To use Live Translation on this device, send your name and phone number. You can use it as soon as the admin approves.';$('gMsg').textContent='';$('gSend').textContent='Request access'}
    if(mode==='daily'){$('gTitle').textContent='Today\u2019s time is used up';$('gText').textContent='This device has used its time for today. It works again tomorrow.'}
    if(mode==='wait'){$('gTitle').textContent='Please wait for approval';$('gText').textContent='Your request was sent. This screen opens by itself once the admin approves this device.'}
    if(mode==='blocked'){$('gTitle').textContent='This app is restricted';$('gText').textContent='This device does not have access.'}
  }
  function gateShow(j){
    if(!j||ADMINVIEW)return;
    if(j.allowed){if(gateMode){gateMode='';var g=document.getElementById('gateScr');if(g)g.classList.remove('on');setStatus('Approved. Press Start when ready.')}clearInterval(gateTimer);gateTimer=0;return}
    gateWhy=j.out||'';
    gateRender(j.status==='blocked'?'blocked':(j.out==='daily'?'daily':(j.requested&&gateMode!=='form'?'wait':(gateMode==='form'?'form':(j.requested?'wait':'form')))));
    try{if(running)stop()}catch(e){}
    if(!gateTimer)gateTimer=setInterval(gateCheck,30000);
  }
  function gateCheck(){
    if(document.visibilityState==='hidden')return;
    fetch(CFG_URL+'/status',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({id:devId(),ns:CFG_NS}),cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(j){if(j&&gateMode!=='form'||j&&j.allowed)gateShow(j)},function(){});
  }
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'&&gateMode)gateCheck()});
  function gateSend(){
    var n=$('gName').value.trim(),p=$('gPhone').value.trim(),m=$('gMsg');
    if(n.length<2){m.textContent='Please type your name.';$('gName').focus();return}
    if(p.replace(/\D/g,'').length<7){m.textContent='Please type a phone number.';$('gPhone').focus();return}
    $('gSend').disabled=true;m.style.color='#4b4f58';m.textContent='Sending…';
    fetch(CFG_URL+'/request',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({id:devId(),name:n,phone:p,ns:CFG_NS}),cache:'no-store'}).then(function(r){return r.json().catch(function(){return {}}).then(function(j){return {s:r.status,j:j}})}).then(function(x){
      $('gSend').disabled=false;m.style.color='';
      if(x.s===200&&x.j.ok){gateMode='wait';gateShow(x.j);return}
      if(x.s===403){gateRender('blocked');return}
      if(x.s===409&&x.j.out==='daily'){gateWhy='daily';gateRender('daily');return}
      m.textContent=x.s===429?'Too many tries. Please wait a few minutes and try again.':'Not sent (the server answered '+x.s+'). Please try again.';
    },function(){$('gSend').disabled=false;m.style.color='';m.textContent='Not sent: no internet connection. Please try again.'});
  }
  function devDenied(type){if(devTold)return;devTold=true;setTimeout(function(){devTold=false},60000);dbg('DEVICE refused: '+type);
    serviceDown('device',({device_blocked:'THIS DEVICE IS BLOCKED. Ask the admin',device_not_approved:'THIS DEVICE IS NOT APPROVED YET. Ask the admin to approve it',device_daily_limit:'THIS DEVICE HAS USED ITS TIME FOR TODAY. It works again tomorrow',device_time_used:'THIS DEVICE HAS USED THE TIME IT WAS GIVEN. Ask the admin for more'}[type]||'THIS DEVICE IS NOT ALLOWED')+' (device '+devCode()+').');
    setTimeout(function(){try{if(running)stop()}catch(e){}if(ADMINVIEW){try{showAlert(problemText+'\n(tap to hide)',false,0,true)}catch(e){}}else gateCheck()},300)}
  // v83: NO BACKUPS. Hearing is Soniox only and translating is Claude only. When either one fails, the screen says so plainly
  // (for example that an account needs more credit) instead of switching to Groq, Whisper, the browser's recognizer or a basic translator.
  var NO_BACKUP=true,downAt={};
