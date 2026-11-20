  // ---- captions ----
  var lines=[],enEl=$('en'),arEl=$('ar');
  function esc(s){return s.replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})}
  // ---- language filter: nothing crude reaches a screen. Whole words only, so Bible words such as Shittim wood, the cock crowed, hell, or a donkey are never touched ----
  var HIDE={key:null,en:null,ar:null};
  var HIDE_EN=['(?:mother|dip)?fuck\\w*','(?:bull|horse|dip|holy)?shit(?:s|ty|ting|head|heads|hole|holes|storm)?','bitch(?:es|y|ing)?','bastards?','cunts?','(?:ass|arse)-?holes?','(?:dumb|smart)-?ass(?:es)?','whores?','sluts?','piss(?:ed|es|ing)?(?:\\s+off)?','crap(?:py|s)?','douch(?:e|es|ebags?)','god ?-?damn(?:ed|\\s+it)?','damn (?:it|you)','wank(?:er|ers|ing)?','twats?','dick-?heads?','nigg(?:er|ers|a|as|az)','fag(?:got|gots|s)?','retard(?:s|ed)?','wtf','stfu','omfg'];
  var HIDE_AR=['كس ?[اأإ]مك','كسمك','شرموط(?:ة|ه)?','شراميط','متناك(?:ة|ه)?','منيوك','منيك','ولاد ال?قحبة','ولاد ال?قحبه','قحبة','قحبه','قحاب','طيز'];
  function hideBuild(){
    var raw=String(S.get('hideWords','')),k=raw;if(HIDE.key===k)return;HIDE.key=k;
    var en=HIDE_EN.slice(),ar=HIDE_AR.slice();
    raw.split(/[,\n;،]+/).forEach(function(w){w=w.trim();if(!w||w.length>40)return;var e=w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+');if(/[\u0600-\u06FF]/.test(w))ar.push(e);else en.push(e)});
    HIDE.en=new RegExp('\\b(?:'+en.join('|')+')\\b','gi');
    HIDE.ar=new RegExp('(^|[^\\u0600-\\u06FF])(?:[وفلب])?(?:'+ar.join('|')+')(?![\\u0600-\\u06FF])','g');
  }
  function cleanEn(t){if(!t)return t;try{hideBuild();var r=String(t).replace(HIDE.en,'…');if(HIDE.ar.test(r)){HIDE.ar.lastIndex=0;r=r.replace(HIDE.ar,'$1…')}HIDE.ar.lastIndex=0;return r.replace(/…(?:\s*…)+/g,'…').replace(/\\("|')/g,'$1').replace(/,?\s*\b(?:uh+|um+|uhm+)\b,?/gi,function(m,off){return off===0?'':(/,/.test(m)?',':'')}).replace(/^[\s,]+/,'').replace(/^[a-z]/,function(c){return c.toUpperCase()})}catch(e){return t}}
  function cleanAr(t){if(!t)return t;try{hideBuild();HIDE.ar.lastIndex=0;var r=String(t).replace(HIDE.ar,'$1…');HIDE.ar.lastIndex=0;return r.replace(HIDE.en,'…')}catch(e){return t}}
  var MAXL=4,shownIds=[],BIGHOLD='',BIGLIVE='';
  var DOTS='<span class="dots" aria-label="listening"><i></i><i></i><i></i></span>';
  function lineHtml(l){return l.en?esc(cleanEn(l.en))+(l.ref?' <span class="ref">'+esc(l.ref)+'</span>':''):l.draft?'<span class="draft">'+esc(cleanEn(l.draft))+'</span>':DOTS}
  function lineClass(l,idx,n){return (l.en||l.draft?'':'pending ')+(l.fixed?'fixed ':'')+(idx<n-2?'old':'')}
  function micMsg(e){var n=e&&e.name;
    if(n==='NotFoundError'||n==='OverconstrainedError'||n==='DevicesNotFoundError')return 'No microphone found on this device. Plug one in, or set this device to Screen only.';
    if(n==='NotReadableError'||n==='TrackStartError'||n==='AbortError')return 'The microphone is busy or unavailable. Close other apps or tabs using it, then try again.';
    return 'Microphone blocked. Click the icon at the left of the address bar and set Microphone to Allow (on iPhone: Settings > Safari > Microphone), then reload.'}
  function rolePick(){if(!MULTI)return '';var m=S.get('role','')==='main';return '<div class="rolepick" role="group" aria-label="What this device does"><button type="button" id="pickMain"'+(m?' class="on" aria-pressed="true"':' aria-pressed="false"')+'><b>Main</b><span>listens</span></button><button type="button" id="pickScreen"'+(m?' aria-pressed="false"':' class="on" aria-pressed="true"')+'><b>Screen only</b><span>shows captions</span></button></div>'}
  function readyHtml(){ // the screen before Start: one title, plain checks, nothing else
    function row(ok,t){return '<div class="chk'+(ok?'':' no')+'"><span></span>'+esc(t)+'</div>'}
    var key=NO_BACKUP?sxHaveKey():!!S.get('groqKey',''),rd=0,on=navigator.onLine!==false;try{rd=autoReadingPairs().length}catch(e){}
    var rows=READYCHK.rows.length?READYCHK.rows.map(function(x){return row(x[0],x[1])}).join(''):row(on,on?'Internet connected':'No internet connection')+row(key,key?(NO_BACKUP?(CLAUDE_PROXY?'Hearing and translating ready (church server)':'Hearing key saved on this device'):'Translation key saved on this device'):(NO_BACKUP?'No Soniox key on this device':'Password needed: it is asked when you press Start'));
    rows+=(S.get('autoRead','1')==='1'?row(rd>0,rd?"Today's readings loaded":"Today's readings not loaded yet"):'');
    readyDots([[on,on?'Internet connected':'No internet connection'],[key,key?(NO_BACKUP?(CLAUDE_PROXY?'Hearing and translating ready (church server)':'Hearing key saved on this device'):'Translation key saved on this device'):(NO_BACKUP?'No Soniox key on this device':'Password needed: it is asked when you press Start')],[rd>0,rd?"Today's readings loaded":"Today's readings not loaded yet"],[MICDOT.ok,MICDOT.busy?'Testing the microphone: say a few words…':MICDOT.msg]].concat(typeof repDotText==='function'&&repDotText()?[[false,repDotText()]]:[]));
    var note=READYCHK.busy?'Checking: say a few words near the microphone…':READYCHK.at?'Checked at '+new Date(READYCHK.at).toTimeString().slice(0,5)+'.':'Press Check before the service to test the microphone, the hearing and the translator.';
    if(!roleChosen())return '<div class="empty ready"><h1>Live Translation</h1><div class="sharecode big">What is this device for?</div><div class="pick"><button type="button" id="pickMain"><b>Main device</b><span>Listens and makes the captions. Only one.</span></button><button type="button" id="pickScreen"><b>Screen only</b><span>Does not listen. Shows the captions.</span></button></div></div>';
    if(isScreen())return '<div class="empty ready">'+rolePick()+'<h1>Live Translation</h1><div class="sharecode">This device shows what the main device sends. It does not listen.</div><div class="follow"><input id="watchCodeBox" aria-label="Code of the main device" placeholder="CODE" maxlength="6" autocomplete="off" autocapitalize="characters" value="'+esc((VIEW&&VIEW.typed)||S.get('watchCode',''))+'"><button type="button" id="watchBtn">Follow the main device</button></div><div><button type="button" id="makeMain" class="linkbtn">Use this device as the main device instead</button></div></div>';
    return '<div class="empty ready">'+rolePick()+'<h1>Live Translation</h1>'+(MULTI&&S.get('share','1')==='1'&&typeof Peer!=='undefined'?(SHARE.err?'<div class="sharecode warnc">'+esc(SHARE.err)+'</div>':(SHARE.show?'<div class="sharecode big">To show captions on another screen, open this same link there, tap Follow and type the code <b>'+esc(roomCode())+'</b>'+(SHARE.conns.length?' \u00b7 '+SHARE.conns.length+' following now':'')+' <button type="button" id="hideCode" class="linkbtn">Hide</button></div>':'<div class="sharecode"><button type="button" id="showCode" class="linkbtn">Show code for other screens</button>'+(SHARE.conns.length?' \u00b7 '+SHARE.conns.length+' following now':'')+'</div>')):'')+(MULTI?'<div class="follow"><span class="sharecode">Only a screen? Type the code shown on the main device:</span><input id="watchCodeBox" aria-label="Code of the main device" placeholder="CODE" maxlength="6" autocomplete="off" autocapitalize="characters" value="'+esc((VIEW&&VIEW.typed)||'')+'"><button type="button" id="watchBtn">Follow</button></div>':'')+'</div>';
  }
  // ---- three dots next to Start: green when ready, tap one to see what it means ----
  var DOTTIP=-1,MICDOT={ok:null,msg:'Microphone not tested yet. Tap this dot to test it.',busy:false};
  // the fourth dot is the microphone: grey until tested; a tap listens for about 3 seconds and says what it heard
  function micDotTest(){if(MICDOT.busy||running)return;MICDOT.busy=true;DOTTIP=3;readyRefresh();
    micTest().then(function(r){MICDOT={ok:!!r[0],msg:r[1],busy:false}},function(){MICDOT={ok:false,msg:'The microphone could not be tested on this device',busy:false}}).then(function(){dbg('MIC DOT '+(MICDOT.ok?'ok ':'FAIL ')+MICDOT.msg);DOTTIP=3;readyRefresh()})}
  function readyDots(list){var el=document.getElementById('readyDots');if(!el)return;
    el.innerHTML=list.map(function(x,i){return '<button type="button" data-i="'+i+'" class="'+(x[0]===null?'idle':x[0]?'':'no')+'" aria-label="'+esc(x[1])+'"><i></i></button>'}).join('')+(DOTTIP>=0&&list[DOTTIP]?'<div id="dotTip" role="status">'+esc(list[DOTTIP][1])+'</div>':'');}
  document.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('#readyDots button');if(MICDOT.busy)return;if(b&&+b.getAttribute('data-i')===3&&(MICDOT.ok!==true||DOTTIP===3)){micDotTest();return}var was=DOTTIP;DOTTIP=b?(+b.getAttribute('data-i')===DOTTIP?-1:+b.getAttribute('data-i')):-1;if(was!==DOTTIP)readyRefresh()});
  // ---- check before the service: opens the microphone for a few seconds and asks each outside service for a real answer ----
  var READYCHK={at:0,rows:[],busy:false};
  async function micTest(){
    var st=null,c=null;
    try{st=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:1}})}catch(e){return [false,micMsg(e)+' Then check again.']}
    try{
      c=new (window.AudioContext||window.webkitAudioContext)();try{if(c.state==='suspended')c.resume()}catch(e){}
      for(var w=0;w<8&&c.state!=='running';w++)await new Promise(function(r){setTimeout(r,100)});
      if(c.state!=='running'){dbg('READY CHECK: this device holds sound until Start is pressed');return [true,'Microphone allowed. Its sound is checked when you press Start']} // iPhone and iPad can hold sound back until a tap: say so, never report a broken microphone
      var an=c.createAnalyser();an.fftSize=2048;c.createMediaStreamSource(st).connect(an);var d=new Float32Array(an.fftSize),mx=0,n=0;
      await new Promise(function(done){var t0=Date.now(),iv=setInterval(function(){an.getFloatTimeDomainData(d);var s2=0;for(var i=0;i<d.length;i++)s2+=d[i]*d[i];var r=Math.sqrt(s2/d.length);if(r>mx)mx=r;n++;if(Date.now()-t0>3500){clearInterval(iv);done()}},100)});
      dbg('READY CHECK mic peak level '+mx.toFixed(4)+' over '+n+' readings');
      if(mx<0.0005)return [false,'No sound is coming from the microphone'];
      if(mx<0.004)return [true,'Microphone works but hears very little: speak near it and check again'];
      return [true,'Microphone hears sound'];
    }catch(e){return [false,'The microphone could not be tested on this device']}
    finally{try{st.getTracks().forEach(function(t){t.stop()})}catch(e){}try{c&&c.close()}catch(e){}}
  }
  async function runReadyCheck(){
    if(READYCHK.busy||running)return;READYCHK.busy=true;readyRefresh();
    var rows=[],on=navigator.onLine!==false;
    try{
      rows.push(await micTest());
      if(!on)rows.push([false,'No internet connection']);
      else{
        var NM={'Groq key':['Translation key accepted','Translation key'],'Hearing model':['Hearing service ready','Hearing service'],'Careful translator':['Translator answers','Translator'],'Quick translator':['Quick translator answers','Quick translator'],'Internet':['Internet connected','Internet'],'Groq':['Groq answers','Groq']};
        var res=await healthCheck(NO_BACKUP);
        if(!res.some(function(x){return x.n==='Internet'}))rows.push([true,'Internet connected']);
        res.forEach(function(x){var m=NM[x.n]||[x.n,x.n];rows.push([x.ok,x.ok?m[0]:m[1]+': '+String(x.m).replace(/\s+/g,' ').slice(0,110)])});
      }
    }catch(e){rows.push([false,'The check could not finish: '+(e.message||e.name)])}
    READYCHK={at:Date.now(),rows:rows,busy:false};dbg('READY CHECK '+rows.map(function(r){return (r[0]?'ok ':'FAIL ')+r[1]}).join(' | '));readyRefresh();
  }
  enEl.addEventListener('click',function(e){var t=e.target;if(t&&t.id==='chkReady')runReadyCheck();if(t&&t.id==='watchBtn'){var wc=enEl.querySelector('#watchCodeBox');viewStart(wc?wc.value:'')}if(t&&t.id==='makeMain')makeMain();if(t&&(t.id==='showCode'||t.id==='hideCode')){SHARE.show=t.id==='showCode';readyRefresh()}var pb=t&&t.closest&&t.closest('#pickMain,#pickScreen,#toScreen');if(pb){S.set('role',pb.id==='pickMain'?'main':'screen');roleApply();readyRefresh()}});
  enEl.addEventListener('input',function(e){var t=e.target;if(t&&t.id==='watchCodeBox')VIEW.typed=t.value});
  enEl.addEventListener('keydown',function(e){var t=e.target;if(t&&t.id==='watchCodeBox'&&e.key==='Enter')viewStart(t.value)});
  function readyRefresh(){try{if(!running&&!lines.length)render()}catch(e){}}
  var DWELL=4000,relAt=0,relTimer=null;
  function releaseLines(){ // used when captions are not running (the plain list): everything finished is shown
    var now=Date.now();lines.forEach(function(l){if(l.en&&!l.rel)l.rel=now});
  }
  // v83: the yellow box. The sentence on screen sits big in a yellow box filling the bottom third; when the next one comes it glides up
  // into the history above, smaller and gray, and the history moves up smoothly.
  // v89: one letter size, always. A sentence too long for the box is shown as two or more calm pages, one after the other. How long a page
  // stays follows its length (a comfortable reading speed), never less than 2.5 s, and short waiting sentences share one page instead of flashing by.
  var BOX_UI=true,UNITS=[],PEND=[],unitSeq=0;
  function wc(t){return String(t||'').trim().split(/\s+/).filter(Boolean).length}
  function unitHtml(u){return esc(u.t)+(u.ref?' <span class="ref">'+esc(u.ref)+'</span>':'')}
  function boxMeasure(){var m=$('cmeas'),box=$('cbox');if(!box)return null;if(!m||m.parentNode!==enEl){m=document.createElement('div');m.id='cmeas';enEl.appendChild(m)}m.style.width=box.clientWidth+'px';m.style.height=box.clientHeight+'px';return m}
  function boxFits(m,t){m.innerHTML='<span class="bt">'+esc(t)+'</span>';return m.scrollHeight<=m.clientHeight+1}
  // v131: pages cut the way a captioner would. Before, a long sentence was filled page by page and whatever was left went alone on the last page
  // (seen on an iPhone: a page holding only "we" and one holding "that we deserve."), and a cut page ended in dots.
  // Now the words are shared evenly over the pages the sentence needs, no page has fewer than four words when the box can hold four,
  // a page ends at a comma or full stop when one is near, never on a small joining word (the, of, that, we ...) when that can be avoided, and there are no dots.
  var PG_WEAK=/^(a|an|the|of|to|in|on|at|for|from|with|by|and|or|but|that|which|who|whom|whose|is|are|was|were|be|been|as|if|so|than|we|he|she|they|i|you|it|his|her|their|our|my|your|its|this|these|those|not|no|will|would|can|could|shall|should|may|might|must|has|have|had|do|does|did|into|about|over|under|when|where|while|because|until|unless)$/i;
  function boxPages(text){
    var m=boxMeasure(),t=String(text||'').replace(/\s+/g,' ').trim();if(!m||!t||boxFits(m,t))return [t];
    var w=t.split(' '),W=w.length,memo={};
    function fits(i,n){return boxFits(m,w.slice(i,i+n).join(' '))}
    function cap(i){if(memo[i])return memo[i];var lo=1,hi=W-i;if(fits(i,hi))lo=hi;else{while(lo<hi){var mid=Math.ceil((lo+hi)/2);if(fits(i,mid))lo=mid;else hi=mid-1}}return memo[i]=Math.max(1,lo)}
    var N=0,i=0,g=0;while(i<W&&g++<80){i+=cap(i);N++} // the fewest pages the sentence needs
    var out=[];i=0;g=0;
    while(i<W&&g++<80){
      var left=W-i,c=cap(i);if(c>=left){out.push(w.slice(i).join(' '));i=W;break}
      var pl=Math.max(2,N-out.length),MIN=Math.min(4,c),target=Math.max(MIN,Math.min(c,Math.ceil(left/pl))),loK=MIN,hiK=Math.min(c,left-4),n;
      if(hiK<loK)n=Math.max(1,Math.min(c,Math.ceil(left/2))); // too few words left for two full pages: share them
      else{target=Math.max(loK,Math.min(hiK,target));var best=1e9;n=target;
        for(var k=Math.min(hiK,target+3);k>=Math.max(loK,target-3);k--){var last=w[i+k-1],sc=Math.abs(k-target);
          if(/[.!?]["”’)]?$/.test(last))sc-=4;else if(/[,;:]["”’)]?$/.test(last))sc-=3;else if(PG_WEAK.test(last.replace(/[^A-Za-z']/g,'')))sc+=3;
          if(sc<best){best=sc;n=k}}}
      out.push(w.slice(i,i+n).join(' '));i+=n}
    if(i<W)out.push(w.slice(i).join(' '));
    return out}
  function unitDwell(u){return Math.max(2500,Math.min(9000,1200+wc(u.t)*330))} // about three words a second, plus a moment to find the line
  function unitQueue(){
    var now=Date.now();
    for(var i=0;i<lines.length;i++){var l=lines[i];if(l.q)continue;
      if(!l.en){if(now-(l.t0||now)<16000)break;continue} // an earlier sentence is still being translated: keep the order (but never wait on it for long)
      l.q=1;if(!l.id)l.id='l'+(++lineSeq);var pg=boxPages(cleanEn(l.en));
      pg.forEach(function(t,j){PEND.push({id:'u'+(++unitSeq),t:t,ref:j===pg.length-1?(l.ref||''):'',n:pg.length,lid:l.id,src:cleanEn(l.en)})})}
    // two short sentences waiting together share one page
    for(var k=0;k<PEND.length-1;k++){var a=PEND[k],b=PEND[k+1];if(a.n===1&&b.n===1&&!a.ref&&wc(a.t)+wc(b.t)<=16){var mm=boxMeasure();if(mm&&boxFits(mm,a.t+' '+b.t)){a.t=a.t+' '+b.t;a.src=a.t;a.ref=b.ref;PEND.splice(k+1,1);k--}}}
  }
  function unitRelease(){
    unitQueue();clearTimeout(relTimer);
    var now=Date.now(),cur=UNITS.length?UNITS[UNITS.length-1]:null;
    if(!PEND.length){if(lines.some(function(l){return !l.q&&!l.en}))relTimer=setTimeout(render,700);return}
    var need=cur?unitDwell(cur):0;if(cur&&PEND.length>2)need=Math.max(2500,Math.round(need*0.7)); // falling behind: a little quicker, never rushed
    if(now-relAt>=need){UNITS.push(PEND.shift());relAt=now;if(UNITS.length>40)UNITS.splice(0,UNITS.length-40);if(PEND.length)relTimer=setTimeout(render,Math.max(2500,Math.round(unitDwell(UNITS[UNITS.length-1])*(PEND.length>2?0.7:1)))+30)}
    else relTimer=setTimeout(render,need-(now-relAt)+30);
  }
  function renderBox(){
    var hist=$('hist'),box=$('cbox');
    if(!hist||!box||hist.parentNode!==enEl){enEl.innerHTML='';hist=document.createElement('div');hist.id='hist';box=document.createElement('div');box.id='cbox';enEl.appendChild(hist);enEl.appendChild(box);
      UNITS=[];PEND=[];relAt=0;relayWH=(window.innerWidth||0)+'x'+(window.innerHeight||0);lines.forEach(function(l){if(l.en)l.q=1})} // a fresh screen starts clean: sentences from before are not played again
    unitRelease();
    var cur=UNITS.length?UNITS[UNITS.length-1]:null,histN=Math.min(window.innerWidth||9999,window.innerHeight||9999)<=500?2:6,past=UNITS.slice(-(histN+1),-1); // v131: on a phone only the last two sentences stay above the box
    // v130: the history is only touched when a sentence joins or leaves it. Before, every redraw (they come many times a second while he speaks)
    // took each history line out and put it back, which stopped the roll half way (reported from an iPhone): lines jumped, sat on top of each other
    // or were cut off by the yellow box. Lines already in place are now left alone, so a roll always runs to its end.
    var before={},keep={};past.forEach(function(l){keep['h'+l.id]=1});
    var histHave=Array.prototype.filter.call(hist.children,function(el){return !el.classList.contains('out')}).map(function(el){return el.id}).join(','),histNeed=past.map(function(l){return 'h'+l.id}).join(','),histSame=histHave===histNeed;
    if(!histSame)Array.prototype.forEach.call(hist.children,function(el){before[el.id]=el.getBoundingClientRect().top});
    Array.prototype.slice.call(hist.children).forEach(function(el){if(!keep[el.id]&&!el.classList.contains('out')){el.classList.add('out');setTimeout(function(){el.remove()},520)}});
    var HR=0.58,mm0=boxMeasure(),mcs=mm0?getComputedStyle(mm0):null,HW=mcs?Math.max(60,mm0.clientWidth-parseFloat(mcs.paddingLeft)-parseFloat(mcs.paddingRight)):300,HFS=mcs?parseFloat(mcs.fontSize):30;
    past.forEach(function(l){var id='h'+l.id,el=document.getElementById(id);
      if(!el){el=document.createElement('p');el.id=id;el.className='hw in'; // v90: the same line breaks as in the box (the box layout, scaled down), so a sentence leaves the box as one solid block
        el.innerHTML='<span class="hi" style="width:'+HW+'px;margin-left:'+(-HW/2)+'px;font-size:'+HFS+'px;transform:scale('+HR+')">'+unitHtml(l)+'</span>';hist.appendChild(el);
        el.style.height=Math.ceil(el.firstChild.offsetHeight*HR)+'px';requestAnimationFrame(function(){requestAnimationFrame(function(){el.classList.remove('in')})});setTimeout(function(){el.classList.remove('in')},400)}});
    if(!histSame)past.forEach(function(l){var el=document.getElementById('h'+l.id),b=before['h'+l.id];if(!el||b===undefined)return;var d=b-el.getBoundingClientRect().top;if(Math.abs(d)<1)return;
      el.style.transition='none';el.style.transform='translateY('+d+'px)';void el.offsetHeight;el.style.transition='';el.style.transform=''});
    var want=cur?cur.id:(dotsOn?'dots':'');
    if(box.dataset.id!==want){var prevId=box.dataset.id,oldBx=box.lastElementChild,oldR=null,oldF=0,glide=null;
      if(oldBx&&prevId&&prevId!=='dots'){var ot=oldBx.querySelector('.bt');if(ot){oldR=ot.getBoundingClientRect();oldF=parseFloat(getComputedStyle(oldBx).fontSize)||0}}
      glide=oldR?document.getElementById('h'+prevId):null;var hi=glide?glide.querySelector('.hi'):null,ROLL='transform 1s cubic-bezier(.45,0,.2,1)';
      // v90: conveyor. The sentence rolls up out of the top of the box and carries straight on into the history, shrinking as it goes, while the next one rolls in from below. One continuous movement.
      if(hi&&oldR){var dy=oldR.top-hi.getBoundingClientRect().top,ot2=oldBx.querySelector('.bt');
        glide.classList.remove('in');hi.style.transition='none';hi.style.transform='translateY('+dy+'px) scale(1)';
        ot2.style.display='block';ot2.style.width=HW+'px';ot2.style.transformOrigin='50% 0';ot2.style.transition='none';ot2.style.transform='translateY(0px) scale(1)';
        void hi.offsetHeight;hi.style.transition=ROLL;hi.style.transform='translateY(0px) scale('+HR+')';ot2.style.transition=ROLL;ot2.style.transform='translateY('+(-dy)+'px) scale('+HR+')';
        oldBx.classList.add('roll');(function(g){setTimeout(function(){g.style.transition=''},1100)})(hi)}
      box.dataset.id=want;
      Array.prototype.slice.call(box.children).forEach(function(el){if(!el.classList.contains('out')){el.classList.add('out');setTimeout(function(){el.remove()},el.classList.contains('roll')?1080:520)}});
      if(want){var sp=document.createElement('div');sp.className='bx in'+(hi&&cur?' rollin':'');sp.innerHTML=cur?'<span class="bt">'+unitHtml(cur)+'</span>':DOTS;box.appendChild(sp);void sp.offsetHeight;setTimeout(function(){sp.classList.remove('in')},30)}}
    BIGLIVE='';lagShow();
    SHARE.rows=UNITS.slice(-3).map(function(l){return {r:l===cur?'cur':'prev',t:l.t,d:'',ref:l.ref||'',f:0}});shareQueue();
    if(txId)txSave(false);
  }
  function render(){
    if(VIEW&&VIEW.on)return;
    if(BOX_UI&&running){renderBox();return} // this device is following another one: its screen is drawn from what that device sends
    if(!lines.length){shownIds=[];if(SHARE){SHARE.rows=[];shareQueue()}
      if(!running){enEl.innerHTML=readyHtml();return}
      enEl.innerHTML='';BIGLIVE='';if(dotsOn){var p0=document.createElement('span');p0.className='dotrow';p0.innerHTML=DOTS;enEl.appendChild(p0)} // v82: before the first finished sentence only the listening sign shows
      return}
    // v82: calm captions. Only finished (careful) sentences show, never the rough live draft. They are released one at a time, in order,
    // each staying at least DWELL ms before the next one pushes it up. Text sits at the bottom like subtitles; older lines slide up smoothly.
    var bigLive='';releaseLines();
    var shown=lines.filter(function(l){return l.en&&l.rel}).slice(-3),prevs=shown.slice(0,-1),bigLine=shown.length?shown[shown.length-1]:null;
    shown.forEach(function(l){if(!l.id)l.id='l'+(++lineSeq)});
    var keep={},before={};shown.forEach(function(l){keep[l.id]=1});
    Array.prototype.slice.call(enEl.children).forEach(function(el){if(el.id)before[el.id]=el.getBoundingClientRect().top});
    Array.prototype.slice.call(enEl.children).forEach(function(el){
      if(el.classList.contains('empty')||el.classList.contains('interim')||el.classList.contains('dotrow')){el.remove();return}
      if(!keep[el.id]&&!el.classList.contains('out')){el.classList.add('out');setTimeout(function(){el.remove()},480)}
    });
    shown.forEach(function(l,i){
      var el=document.getElementById(l.id);
      if(!el){el=document.createElement('p');el.id=l.id;el.className='in';enEl.appendChild(el);requestAnimationFrame(function(){requestAnimationFrame(function(){el.classList.remove('in')})})}
      var isBig=bigLine&&l===bigLine,age=prevs.length-i,h=lineHtml(l);
      if(el.innerHTML!==h)el.innerHTML=h;el.className=(el.classList.contains('in')?'in ':'')+(l.fixed?'fixed ':'')+(isBig?'cur':'prev p'+age+(age===1?' pl':''));
      enEl.appendChild(el);
    });
    shown.forEach(function(l){var el=document.getElementById(l.id),b=before[l.id];if(!el||b===undefined)return;var d=b-el.getBoundingClientRect().top;if(Math.abs(d)<1)return;
      el.style.transition='none';el.style.transform='translateY('+d+'px)';void el.offsetHeight;el.style.transition='';el.style.transform=''}); // slide from where it was
    if(running&&dotsOn){var dl=document.createElement('span');dl.className='dotrow';dl.innerHTML=DOTS;enEl.appendChild(dl)} // he is speaking: a small sign at the bottom, in its own reserved space, so nothing moves
    BIGLIVE=bigLive;
    lagShow();
    SHARE.rows=shown.map(function(l,i){return {r:(bigLine&&l===bigLine)?'cur':'prev',t:cleanEn(l.en||''),d:l.en?'':cleanEn(l.draft||''),ref:l.ref||'',f:l.fixed?1:0}});shareQueue();
    fit();setTimeout(fit,520);
    if(txId)txSave(false);
  }
