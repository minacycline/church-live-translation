  // ---- for whoever runs it: how far the captions are behind him, from the last few sentences ----
  function lagShow(){
    var el=$('lag');if(!el)return;
    var ls=lines.filter(function(l){return l.en&&l.t1&&!l.rep}).slice(-6),first=[],fin=[];
    ls.forEach(function(l){var sh=[l.tLive,l.tDraft,l.t1].filter(function(x){return x&&l.tSpeak&&x>=l.tSpeak});if(sh.length)first.push(Math.min.apply(null,sh)-l.tSpeak);if(l.tCut)fin.push(l.t1-l.tCut)});
    if(ls.length<2||!first.length){el.textContent='';return}
    el.textContent=(SHARE&&SHARE.peer?SHARE.conns.length+' screen'+(SHARE.conns.length===1?'':'s')+' following. ':'')+'English starts about '+sec(med(first))+' after the speaker begins a sentence'+(fin.length?', final wording '+sec(med(fin))+' after a pause':'')+' (last '+ls.length+' lines)';
  }
  function fit(){
    if(!enEl)return;
    var root=document.documentElement,base=parseInt(S.get('size','46'),10)||46;
    // phones and small tablets: scale the chosen size to the screen, so the text starts at a sensible size on every device and A-/A+ still make it smaller or larger
    var vw=window.innerWidth||1024,vh=window.innerHeight||768,k=Math.min(1,Math.min(vw,vh*1.2)/15/46);base=Math.max(16,Math.round(base*k));var fs=base;
    root.style.setProperty('--fs',fs+'px');
    function over(){var ps=enEl.querySelectorAll('p');if(!ps.length)return false;var f=ps[0],l=ps[ps.length-1];return (l.offsetTop+l.offsetHeight-f.offsetTop)>enEl.clientHeight+1} // layout positions, not on-screen ones: a new line slides in from slightly below, and counting that slide made every new line shrink all the text to the smallest size for half a second
    if(document.body.classList.contains('running')&&$('cbox')){enEl.classList.remove('over');return}
    if(document.body.classList.contains('running')){enEl.classList.toggle('over',over());return} // v74: while captions run the text never changes size; when it does not fit, the oldest row slides off the top
    enEl.classList.remove('over');while(fs>16&&over()){fs-=2;root.style.setProperty('--fs',fs+'px')}
  }
  // v127: turning the device (or resizing the window) while captions run. Everything on the caption screen was measured for the old size:
  // the pages of the sentence in the box, the width and letter size of each line in the history, and the place a rolling sentence was heading to.
  // A roll caught by the turn froze half way, small, on top of the next sentence, and history lines made sideways were cut off at the edges.
  // Now the screen is laid out again for the new size: any roll in progress is finished at once, the history is drawn again at the new width,
  // and the sentence on screen and the ones waiting are cut into pages again for the new box. Nothing is dropped and nothing is played twice.
  var relayT=null,relayWH='';
  function boxRelayout(){
    var box=$('cbox'),hist=$('hist');if(!running||!box||!hist)return;
    var wh=(window.innerWidth||0)+'x'+(window.innerHeight||0);if(wh===relayWH)return;relayWH=wh;
    Array.prototype.slice.call(box.children).forEach(function(el){if(el.classList.contains('out'))el.remove()});
    hist.innerHTML='';
    var cur=UNITS.length?UNITS[UNITS.length-1]:null;
    if(cur&&cur.src){ // the sentence on screen and its waiting pages are cut again; its later pages go to the front of the queue
      var rest=[];while(PEND.length&&PEND[0].lid===cur.lid)rest.push(PEND.shift());
      var pg=boxPages(cur.src),done=0;
      // pages of this sentence already shown are not shown again: skip the words they held
      var shownW=0;UNITS.slice(0,-1).forEach(function(u){if(u.lid===cur.lid)shownW+=wc(String(u.t).replace(/ …$/,''))});
      if(shownW){var left=String(cur.src).split(' ').slice(shownW).join(' ');pg=left?boxPages(left):[cur.t]}
      cur.t=pg[0];cur.n=pg.length;var ref=(rest.length?rest[rest.length-1].ref:cur.ref)||'';cur.ref=pg.length===1?ref:'';
      for(var i=pg.length-1;i>=1;i--)PEND.unshift({id:'u'+(++unitSeq),t:pg[i],ref:i===pg.length-1?ref:'',n:pg.length,lid:cur.lid,src:cur.src});
    }
    for(var k=0;k<PEND.length;k++){var a=PEND[k];if(!a.src||(cur&&a.lid===cur.lid))continue; // waiting sentences: cut again from their full text
      var j=k;while(j+1<PEND.length&&PEND[j+1].lid===a.lid)j++;var rf=PEND[j].ref||'',pp=boxPages(a.src),nu=pp.map(function(t,x){return {id:'u'+(++unitSeq),t:t,ref:x===pp.length-1?rf:'',n:pp.length,lid:a.lid,src:a.src}});
      PEND.splice.apply(PEND,[k,j-k+1].concat(nu));k+=nu.length-1}
    box.innerHTML='';box.dataset.id=''; // the box is drawn fresh, with no roll from the old size
    dbg('SCREEN turned or resized to '+wh+': caption screen laid out again');
    render();
  }
  function onResize(){try{fit()}catch(e){}try{if(running)Array.prototype.slice.call(document.querySelectorAll('#cbox .bx.out')).forEach(function(el){el.remove()})}catch(e){}clearTimeout(relayT);relayT=setTimeout(function(){try{boxRelayout()}catch(e){dbg('SCREEN relayout failed: '+e.message)}},250)}
  window.addEventListener('resize',onResize);window.addEventListener('orientationchange',function(){setTimeout(onResize,300)});
  // The app tunes itself from what it observes and remembers it on this device (it cannot rewrite its own code, but it can adjust its settings)
  var LEARN={};try{LEARN=JSON.parse(localStorage.getItem('learn')||'{}')||{}}catch(e){LEARN={}}
  function learnSave(){try{localStorage.setItem('learn',JSON.stringify(LEARN))}catch(e){}}
  var DBG=[],DBG0=Date.now();
  // Self-correction: when the translator fixes a misheard word, the pair is remembered on this device.
  // After the same mishearing is fixed twice it is applied automatically and the right form is given to Whisper as vocabulary.
  var testFixes=[],fixCount=0;
  function fixKey(a){return normAr(a).replace(/\s+/g,' ').trim()}
  function knownTerm(k){var hit=false;(window.COPTIC_TERMS||[]).forEach(function(x){if(!hit&&normAr(x[0])===k)hit=true});pairs('terms').forEach(function(p){if(!hit&&AR.test(p.a)&&normAr(p.a)===k)hit=true});return hit}
  // v128: a fix is learned only when it is safe. Seen in report 15: the translator "fixed" الهادية (calm) to الهاوية (Sheol), الصح (right) to الفصح (Passover),
  // تلوم (blame) to شلوم (Shallum) and افتكره ضعيف to its opposite, while its English kept the right meaning. Learned twice, such a pair is applied to the
  // Arabic automatically and would have turned "the calm spirit" into "the abyss". Now a pair is refused when the corrected part holds English, slashes
  // or brackets, when it adds a negation the speaker did not say, or when it turns a word into a Bible name that the English never uses.
  var NEG_RE=/(^| )(ما|مش|مو|لا|لم|لن|ليس|مافيش)( |$)|(^| )ما[^ ]+ش( |$)/;
  function fixSafe(heard,to,en){
    if(/[A-Za-z/\\()\[\]]/.test(to))return 'it holds English, a slash or brackets';
    var nh=fixKey(heard),nt=fixKey(to);
    if(NEG_RE.test(' '+nt+' ')&&!NEG_RE.test(' '+nh+' '))return 'it adds a negation';
    var ix=nameIdx(),hw=nh.split(' ');
    var bad=nt.split(' ').filter(function(w){var k=ix.map[w]||(/^[وبلفك]/.test(w)&&ix.map[w.slice(1)]);if(!k||hw.indexOf(w)>=0)return false;
      if(en===undefined)return true;var e=String(k.en||'').toLowerCase().split(/[^a-z]+/).filter(function(x){return x.length>2});return !e.some(function(x){return String(en).toLowerCase().indexOf(x)>=0})});
    if(bad.length)return 'it turns a word into the Bible name '+bad.join(' ')+(en===undefined?'':' that the English does not use');
    return '';
  }
  function learnFix(heard,to,ar,en){
    heard=(heard||'').trim();to=(to||'').trim();if(!heard||!to||!AR.test(heard)||!AR.test(to))return false;
    var why=fixSafe(heard,to,en);if(why){dbg('FIX refused '+heard+' -> '+to+': '+why);return false}
    var k=fixKey(heard),kt=fixKey(to);
    if(k===kt||k.length<4||k.split(' ').length>3||kt.split(' ').length>4)return false;
    if((' '+fixKey(ar)+' ').indexOf(' '+k+' ')<0)return false; // must be a phrase that really was in the heard sentence
    if(knownTerm(k)||(LEARN.fixNo||[]).indexOf(k)>=0)return false; // a real church term, or one Mina deleted, is never learned
    LEARN.fix=LEARN.fix||{};var e=LEARN.fix[k];
    if(e&&fixKey(e.to)!==kt){if(e.n>=2)return false;e.alt=(e.alt||0)+1;if(e.alt>=2){e.to=to;e.n=1;e.alt=0}learnSave();return false} // the model is not consistent: do not learn yet
    if(!e){e=LEARN.fix[k]={to:to,n:0,at:0};var ks=Object.keys(LEARN.fix);if(ks.length>200){ks.sort(function(x,y){return (LEARN.fix[x].n-LEARN.fix[y].n)||(LEARN.fix[x].at-LEARN.fix[y].at)});delete LEARN.fix[ks[0]]}}
    e.n++;e.at=Date.now();learnSave();fixCount++;
    if(replayEl)testFixes.push(heard+' \u2192 '+to+(e.n>=2?' (now applied automatically)':' (seen once, applied after it is confirmed again)'));
    dbg('LEARNED fix '+heard+' -> '+to+' x'+e.n);return true;
  }
  (function(){try{var f=LEARN.fix||{},gone=[];Object.keys(f).forEach(function(k){var e=f[k];if(!e||!e.to)return;var w=fixSafe(k,e.to,e.n>=2?e.to:undefined);if(w&&!(e.n>=2&&/Bible name/.test(w))){gone.push(k+' -> '+e.to);delete f[k]}});
    if(gone.length){learnSave();setTimeout(function(){dbg('FIX cleanup: removed '+gone.length+' unsafe learned correction(s): '+gone.join(' | ').slice(0,300))},0)}}catch(e){}})(); // v128
  function activeFixes(){var f=LEARN.fix||{};return Object.keys(f).filter(function(k){return f[k].n>=2}).sort(function(a,b){return f[b].n-f[a].n})}
  function applyFixes(txt){
    if(!txt)return txt;var f=LEARN.fix||{},keys=activeFixes();if(!keys.length)return txt;
    var out=txt,n=0;
    keys.forEach(function(k){var re=new RegExp('(^|[^\u0600-\u06FF])'+arPat(k)+'(?![\u0600-\u06FF])','g');var before=out;out=out.replace(re,function(m,pre){n++;return pre+f[k].to});if(out!==before)f[k].used=(f[k].used||0)+1});
    if(n){dbg('APPLIED '+n+' learned correction(s): '+out.slice(0,50));learnSave()}
    return out;
  }
  function forgetFix(k){if(LEARN.fix)delete LEARN.fix[k];LEARN.fixNo=LEARN.fixNo||[];if(LEARN.fixNo.indexOf(k)<0)LEARN.fixNo.push(k);if(LEARN.fixNo.length>300)LEARN.fixNo.shift();learnSave()}
  function renderFixes(){
    var box=$('fixList');if(!box)return;box.innerHTML='';var f=LEARN.fix||{},keys=Object.keys(f).sort(function(a,b){return (f[b].n-f[a].n)||(f[b].at-f[a].at)});
    if(!keys.length){box.innerHTML='<div class="help">Nothing learned yet. Corrections appear here as the app hears sermons.</div>';return}
    keys.forEach(function(k){
      var d=document.createElement('div');d.className='rv';
      d.innerHTML='<div class="a"></div><div class="e"></div><div class="fixrow"><button class="ghost" type="button">Delete</button><span class="saved"></span></div>';
      d.querySelector('.a').textContent=k+'  \u2192  '+f[k].to;
      d.querySelector('.e').textContent=(f[k].n>=2?'Applied automatically':'Seen once, not applied yet')+' \u00b7 corrected '+f[k].n+'\u00d7'+(f[k].used?' \u00b7 used '+f[k].used+'\u00d7':'');
      d.querySelector('button').onclick=function(){forgetFix(k);renderFixes()};
      box.appendChild(d);
    });
  }
  var curCo=null,replayEl=null,replayName='',replayUrl='',replayEnd=null,curConf=null,curCut=0,curSpeechStart=0,curPos=null,chunkSpeechStart=0,liveFirstAt=0,lastReport='',testStats=null;
  var DBGDROP=0;function dbg(m){if(!DBG.length)DBGDROP=0;var s=((Date.now()-DBG0)/1000).toFixed(1);DBG.push(s+'s '+m);if(DBG.length>20000){DBG.shift();DBGDROP++}} // v101: 20,000 lines (it was 3,000); lines pushed out are counted and reported
  function dbgReport(){
    return ['Church translation debug report','page '+(document.querySelector('meta[name=build]')||{content:'?'}).content,'ua '+navigator.userAgent,'ios '+IOS+' SR '+!!SR,
      'key '+(S.get('groqKey','')?'yes':'NO')+' | opens on this copy '+LAUNCHES+' | home-screen app '+(STANDALONE?'yes':'NO')+(KEYSRC?' | '+KEYSRC:''),'engine '+S.get('engine','whisper')+' | hearing '+hearEngine(),'noise '+S.get('noise','normal')+' mic '+S.get('micMode','room')+' lang '+S.get('lang','mixed'),'preview '+S.get('preview',DEF.preview),'memo '+sermonMemo.slice(0,200),'usage today '+(claudeUse.req?'claude-haiku '+claudeUse.req+'req/'+Math.round((claudeUse.inTok+claudeUse.outTok)/1000)+'k this session, ':'')+POOL.map(function(m){var u=useOf(m);return m.replace(/^.*\//,'')+' '+u.day.req+'req/'+Math.round(u.day.tok/1000)+'k'}).join(', '),'learned '+JSON.stringify({speech:LEARN.speech,floor:LEARN.floor,gap:LEARN.gap,junk:(LEARN.junk||[]).length,fixes:Object.keys(LEARN.fix||{}).length,active:activeFixes().length,models:LEARN.models}),'status: '+($('status')||{}).textContent,'---'].concat(DBG).join('\n');
  }
  // While the service is running nothing but the English may appear for the congregation: problems only turn the small dot amber.
  var problemText='',PROBLEM_RE=/problem|busy|limit|paused|no sound|recover|reconnect|interrupted|slow connection|not accepted|could not|isn.t|failed|blocked|stopped arriving|microphone/i;
  function setStatus(t){
    dbg('STATUS '+t);
    if(typeof running!=='undefined'&&running&&PROBLEM_RE.test(t)&&!/^Listening/.test(t)){problemText=t;problemAt=Date.now();var d=$('dot');d&&d.classList.add('warn');return}
    if(/^Listening/.test(t)&&typeof running!=='undefined'&&running){var dd=$('dot');if(dd&&Date.now()-problemAt>8000){dd.classList.remove('warn');problemText=''}}
    $('status').textContent=t;
    try{if(!(typeof running!=='undefined'&&running)&&t&&t!=='Stopped'&&(PROBLEM_RE.test(t)||/^Stopped.{3,}/.test(t)))showAlert(t+'\n(tap to hide)',false,0,true)}catch(e){}
  }
  var problemAt=0;

