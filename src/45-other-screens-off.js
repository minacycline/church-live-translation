  // ---- other screens: one device listens, the others follow its captions. Only text travels; nothing is recorded or stored on the way ----
  var SHARE={peer:null,conns:[],rows:[],last:'',timer:null},VIEW={on:false,peer:null,conn:null,code:'',timer:null,last:'',got:0,typed:''};
  var MULTI=false; // v70: other screens (phones following a code) are paused; one main screen only. Set to true to bring them back
  function isScreen(){return MULTI&&S.get('role','main')==='screen'}
  function roleChosen(){return !MULTI||S.get('role','')==='main'||S.get('role','')==='screen'}
  function goText(){return (VIEW&&VIEW.on)?'Stop following':(typeof running!=='undefined'&&running)?'Stop':(isScreen()?'Follow':'Start')}
  function validCode(c){return /^[A-Z0-9]{6}$/.test(String(c||''))}
  function roleApply(){ // after the role or the codes change: one main device listens, screens follow
    document.body.classList.toggle('screenrole',isScreen());
    if(isScreen()){try{if(running)stop()}catch(e){}shareStop();if(VIEW.on&&VIEW.code!==S.get('watchCode','')){viewStop()}if(!VIEW.on&&validCode(S.get('watchCode','')))viewStart(S.get('watchCode',''))}
    else{if(VIEW.on)viewStop();shareStart()}
    try{$('go').textContent=goText()}catch(e){}
  }
  function makeMain(){ // a screen becomes the main device: asks for the Owner PIN when one is set
    var pin=S.get('adminPin','');if(pin){var v=window.prompt('Owner PIN');if(v===null)return;if(String(v).trim()!==pin){alert('Wrong PIN.');return}}
    S.set('role','main');roleApply();readyRefresh();
  }
  function roomCode(){var c=String(S.get('room','')).toUpperCase();if(!/^[A-Z0-9]{6}$/.test(c)){var a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',r=new Uint32Array(6);try{crypto.getRandomValues(r)}catch(e){for(var i=0;i<6;i++)r[i]=Math.floor(Math.random()*1e9)}c='';for(var j=0;j<6;j++)c+=a[r[j]%a.length];S.set('room',c)}return c}
  function peerOpts(){var o={debug:0};try{var x=JSON.parse(S.get('peerOpts','')||'null');if(x)for(var k in x)o[k]=x[k]}catch(e){}return o}
  function peerId(code){return 'church-captions-'+String(code).toLowerCase()}
  function shareSnap(){
    if(!running)return {v:1,idle:1,title:S.get('title',CHURCH)};
    return {v:1,title:S.get('title',CHURCH),lines:SHARE.rows||[],live:BIGLIVE||'',dots:(!BIGLIVE&&!(SHARE.rows&&SHARE.rows.length)&&dotsOn)?1:0,st:String(($('status')||{}).textContent||'').slice(0,160),lag:String(($('lag')||{}).textContent||'').slice(0,200)};
  }
  function shareSendNow(force){var s=JSON.stringify(shareSnap());if(!force&&s===SHARE.last)return;SHARE.last=s;SHARE.conns.forEach(function(c){try{if(c.open)c.send(s)}catch(e){}})}
  function shareQueue(){if(!SHARE.peer||SHARE.timer)return;SHARE.timer=setTimeout(function(){SHARE.timer=null;shareSendNow(false)},150)}
  function shareStart(){
    if(!MULTI)return;
    if(SHARE.peer||S.get('share','1')!=='1'||typeof Peer==='undefined'||VIEW.on||isScreen()||!roleChosen())return;
    var p;try{p=new Peer(peerId(roomCode()),peerOpts())}catch(e){dbg('SHARE could not start: '+e.message);return}
    SHARE.peer=p;
    p.on('open',function(){SHARE.err='';SHARE.up=true;dbg('SHARE ready for other screens');readyRefresh()});
    p.on('connection',function(c){
      var drop=function(){SHARE.conns=SHARE.conns.filter(function(x){return x!==c});readyRefresh()};
      c.on('open',function(){if(SHARE.conns.length>=12){try{c.close()}catch(e){}return}SHARE.conns.push(c);dbg('SHARE a screen joined, now '+SHARE.conns.length);readyRefresh();try{c.send(JSON.stringify(shareSnap()))}catch(e){}});
      c.on('close',drop);c.on('error',drop);
    });
    p.on('disconnected',function(){if(SHARE.peer===p)setTimeout(function(){try{if(SHARE.peer===p&&!p.destroyed)p.reconnect()}catch(e){}},3000)});
    p.on('error',function(e){var t=e&&e.type;dbg('SHARE problem: '+t);
      if(t==='unavailable-id'){SHARE.err='Another device is already the Main for this code, and only one can be. On the device that should only show captions, tap Screen only at the top of its start screen. If this device should be the Main, do that on the other one first.';problemText=SHARE.err;problemAt=Date.now();SHARE.peer=null;try{p.destroy()}catch(x){}readyRefresh()}
      else if(t==='network'||t==='server-error'||t==='socket-error'||t==='socket-closed'){if(SHARE.peer===p){SHARE.peer=null;try{p.destroy()}catch(x){}setTimeout(shareStart,8000)}}});
  }
  function shareStop(){var p=SHARE.peer;SHARE.peer=null;SHARE.conns=[];SHARE.last='';SHARE.up=false;SHARE.err='';try{p&&p.destroy()}catch(e){}}
  setInterval(function(){if(SHARE.peer&&SHARE.conns.length)shareSendNow(true)},5000); // a steady beat, so a following screen can tell the main device is still there
  setTimeout(function(){try{document.body.classList.toggle('screenrole',isScreen());if(isScreen()){$('go').textContent=goText();if(!VIEW.on&&validCode(S.get('watchCode','')))viewStart(S.get('watchCode',''))}else shareStart()}catch(e){}},900);
  // -- this device follows another one --
  function viewMsg(t){enEl.innerHTML='<div class="empty ready"><div class="rolebadge scr">Screen only</div><h1>Live Translation</h1><div class="hint">'+esc(t)+'</div><div class="sharecode">Following the main device <b>'+esc(VIEW.code)+'</b></div></div>';VIEW.last='';document.body.classList.remove('livecap')}
  function viewUi(){document.body.classList.toggle('viewing',VIEW.on);document.body.classList.toggle('running',VIEW.on||!!running);var g=$('go');g.textContent=goText();g.classList.toggle('stop',VIEW.on||!!running);var dd=$('dot');if(dd)dd.classList.toggle('on',VIEW.on||!!running)}
  function viewStart(code,temp){ // temp: opened from a ?watch= link, which does not change what this device is
    code=String(code||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
    if(code.length!==6){var w=enEl.querySelector('#watchCodeBox');if(w){w.focus();w.style.borderColor='#b45309'}return}
    if(typeof Peer==='undefined'||running)return;
    if(!temp){S.set('watchCode',code);S.set('role','screen');document.body.classList.add('screenrole')}shareStop();VIEW.on=true;VIEW.code=code;VIEW.typed='';VIEW.got=0;viewUi();viewMsg('Connecting to the main device…');viewConnect();
    try{if(navigator.wakeLock)navigator.wakeLock.request('screen').then(function(w){wake=w}).catch(function(){})}catch(e){}
  }
  function viewDrop(){clearTimeout(VIEW.timer);VIEW.timer=null;var p=VIEW.peer;VIEW.peer=null;VIEW.conn=null;try{p&&p.destroy()}catch(e){}}
  function viewRetry(msg){if(!VIEW.on||VIEW.timer)return;if(msg)viewMsg(msg);var p=VIEW.peer;VIEW.peer=null;VIEW.conn=null;try{p&&p.destroy()}catch(e){}VIEW.timer=setTimeout(function(){VIEW.timer=null;viewConnect()},3000)}
  function viewConnect(){
    if(!VIEW.on||VIEW.peer)return;var p;try{p=new Peer(peerOpts())}catch(e){viewRetry('This device could not start following. Trying again…');return}
    VIEW.peer=p;
    p.on('open',function(){if(VIEW.peer!==p)return;var c=p.connect(peerId(VIEW.code),{reliable:true,serialization:'raw'});VIEW.conn=c;
      c.on('open',function(){VIEW.got=Date.now();dbg('FOLLOW connected')});
      c.on('data',function(d){if(VIEW.peer!==p)return;VIEW.got=Date.now();viewRender(d)});
      c.on('close',function(){if(VIEW.peer===p)viewRetry('The main device stopped sharing. Waiting for it to come back…')});
      c.on('error',function(){if(VIEW.peer===p)viewRetry('The link to the main device broke. Trying again…')})});
    p.on('error',function(e){if(VIEW.peer!==p)return;var t=e&&e.type;dbg('FOLLOW problem: '+t);viewRetry(t==='peer-unavailable'?'No device is sharing with this code yet. Check the code, and that sharing is on at the main device. Trying again…':'Could not reach the main device. Trying again…')});
    p.on('disconnected',function(){if(VIEW.peer===p&&!VIEW.conn)viewRetry('')});
  }
  setInterval(function(){if(VIEW.on&&VIEW.peer&&VIEW.got&&Date.now()-VIEW.got>16000){VIEW.got=0;viewRetry('Lost the main device. Trying to reconnect…')}},4000);
  function viewStop(){document.body.classList.remove('livecap');VIEW.on=false;viewDrop();VIEW.last='';viewUi();try{wake&&wake.release()}catch(e){}$('status').textContent='Ready';var lg=$('lag');if(lg)lg.textContent='';title.textContent=S.get('title',CHURCH);render();if(!isScreen())setTimeout(shareStart,500)}
  function viewRender(d){
    if(typeof d!=='string'||d===VIEW.last||d.length>20000)return;var o;try{o=JSON.parse(d)}catch(e){return}if(!o||o.v!==1)return;VIEW.last=d;
    if(o.title)title.textContent=String(o.title).slice(0,120);
    if(o.idle){viewMsg('Connected. Captions will appear here when the main device starts.');VIEW.last=d;return}
    document.body.classList.add('livecap');enEl.innerHTML='';var pend=false;VIEW.pi=0;
    (Array.isArray(o.lines)?o.lines:[]).slice(0,6).forEach(function(l){
      var p=document.createElement('p'),t=cleanEn(String(l.t||'').slice(0,700)),dr=cleanEn(String(l.d||'').slice(0,700));
      var nPrev=(Array.isArray(o.lines)?o.lines:[]).filter(function(x){return x.r==='prev'}).length;if(l.r==='prev'){VIEW.pi=(VIEW.pi||0)+1}
      p.className=(l.r==='cur'?'cur':l.r==='prev'?'prev p'+Math.max(1,nPrev-VIEW.pi+1)+(VIEW.pi===nPrev?' pl':''):'next')+(t||dr?'':' pending')+(l.f?' fixed':'');
      if(t){p.textContent=t;if(l.ref){var r=document.createElement('span');r.className='ref';r.textContent=String(l.ref).slice(0,60);p.appendChild(document.createTextNode(' '));p.appendChild(r)}}
      else if(dr){var sp=document.createElement('span');sp.className='draft';sp.textContent=dr;p.appendChild(sp)}
      else{p.innerHTML=DOTS;pend=true}
      enEl.appendChild(p)});
    if(o.live){var li=document.createElement('p');li.className='interim cur live';li.textContent=cleanEn(String(o.live).slice(0,700));enEl.appendChild(li)}
    else if(o.dots&&!pend){var dl=document.createElement('p');dl.className='interim next';dl.innerHTML=DOTS;enEl.appendChild(dl)}
    $('status').textContent='Following '+VIEW.code+'. '+String(o.st||'').slice(0,160);var lg=$('lag');if(lg)lg.textContent=String(o.lag||'').slice(0,200);
    fit();
  }
  try{var wm=/[?&]watch=([A-Za-z0-9]{6})/.exec(location.search);if(wm)setTimeout(function(){viewStart(wm[1],true)},600)}catch(e){}
  var lineSeq=0,dotsOn=false;
  setInterval(function(){ // the dots follow his voice: on within a moment of speech, off about a second and a half after he stops
    var want=typeof running!=='undefined'&&running&&Date.now()-lastSpeechAt<1500&&heardAnything();
    if(want!==dotsOn){dotsOn=want;render()}
  },300);
  function heardAnything(){return typeof audioFrames==='undefined'||audioFrames>0}
