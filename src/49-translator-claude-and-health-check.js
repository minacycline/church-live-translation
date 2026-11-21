  function serviceDown(key,msg){ // one clear message, shown on the screen even during the service, at most once a minute per problem
    dbg('DOWN '+msg);problemText=msg;problemAt=Date.now();try{var d=$('dot');d&&d.classList.add('warn')}catch(e){}
    if(downAt[key]&&Date.now()-downAt[key]<60000)return;downAt[key]=Date.now();
    setStatus(msg);
    // v99: while the service is running the congregation sees one calm line; the owner (unlocked) and the small dot keep the full reason
    var calm=typeof running!=='undefined'&&running&&!document.body.classList.contains('admin');
    showAlert(calm?(/STOPPED|LIMIT/.test(msg)?'Translation is not available right now.':'Translation paused. It will return shortly.'):msg+'\n(tap to hide)',false,0,true);
    try{var al=$('alert');al.dataset.k=key;al.classList.toggle('calm',calm)}catch(e){}
  }
  function alertClear(key){try{var al=$('alert');if(al&&al.style.display!=='none'&&al.dataset.k===key){showAlert('');al.dataset.k=''}delete downAt[key]}catch(e){}}
  // v99: the church server stops the day at its limit; the app then stops listening and says so, instead of retrying all day
  var limitTold=false,MISSED=[]; // MISSED: sentences that were heard but never reached the screen; they go in the report
  function limitHit(m){if(limitTold)return;limitTold=true;dbg('DAILY LIMIT '+m);serviceDown('limit','DAILY LIMIT REACHED: '+String(m||'the church server reached its limit for today').replace(/^Daily limit reached:\s*/i,'').slice(0,160));setTimeout(function(){try{if(running)stop()}catch(e){}try{showAlert(problemText+'\n(tap to hide)',false,0,true)}catch(e){}},300)}
  function aiOK(){return NO_BACKUP?(claudeReady()&&Date.now()>claudeBlockedUntil):(!!S.get('groqKey','')&&Date.now()>groqBlockedUntil)}
  var CLAUDE_MODEL='claude-haiku-5-5',claudeBlockedUntil=0,claudeUse={req:0,inTok:0,outTok:0};
  function claudeReady(){return !!S.get('claudeKey','')||!!CLAUDE_PROXY}
  // v94: the Soniox key lives on the church server too. Each time the app opens the live line it asks the server for a short-lived Soniox key,
  // so no device needs a key pasted. A key pasted on a device in the past is used only if the server cannot give one.
  function sxHaveKey(){return !!CLAUDE_PROXY||!!S.get('sonioxKey','')}
  async function sxKey(){
    if(!CLAUDE_PROXY)return S.get('sonioxKey','');
    var r,j=null;try{var kc=typeof AbortController!=='undefined'?new AbortController():null,kt=setTimeout(function(){try{kc&&kc.abort()}catch(x){}},6000);try{r=await fetch(CLAUDE_PROXY+'/soniox-key?d='+devId()+'&ns='+CFG_NS,{method:'POST',signal:kc?kc.signal:undefined})}finally{clearTimeout(kt)}}catch(e){if(S.get('sonioxKey',''))return S.get('sonioxKey','');var ne=new Error('cannot reach the church server');ne.net=true;throw ne}
    try{j=await r.json()}catch(e){}
    if(r.ok&&j&&j.api_key)return j.api_key;
    if(j&&j.error&&j.error.type==='daily_limit'){limitHit(j.error.message);var lm=new Error('daily limit');lm.limit=true;throw lm}
    if(j&&j.error&&/^device_/.test(j.error.type||'')){devDenied(j.error.type);var dn=new Error('device not allowed');dn.limit=true;throw dn}
    if(S.get('sonioxKey',''))return S.get('sonioxKey','');
    var m=(j&&((j.error&&j.error.message)||j.error_message||j.message))||('server answered '+r.status);var er=new Error(String(m).slice(0,120));er.status=r.status;throw er
  }
  function useClaude(){return S.get('translator',CLAUDE_PROXY?'claude':'groq')==='claude'&&claudeReady()&&Date.now()>claudeBlockedUntil}
  async function claudeCall(msgs,maxTok,temp,ms){
    var sys=msgs.filter(function(m){return m.role==='system'}).map(function(m){return m.content}).join('\n\n'),conv=msgs.filter(function(m){return m.role!=='system'}).map(function(m){return {role:m.role==='assistant'?'assistant':'user',content:String(m.content)}});
    if(!conv.length||conv[0].role!=='user')conv.unshift({role:'user',content:'Translate.'});
    var body={model:CLAUDE_MODEL,max_tokens:Math.max(64,maxTok||300),messages:conv};if(sys)body.system=sys; /* claude-haiku-5-5 refuses a temperature setting */
    var ownKey=S.get('claudeKey','');
    var r=ownKey?await fetchT('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':ownKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify(body)},ms||12000):await fetchT(CLAUDE_PROXY+'/?d='+devId()+'&ns='+CFG_NS,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)},ms||12000);
    if(!r.ok){var em='',et='';try{var ej=await r.json();em=(ej.error&&ej.error.message)||'';et=(ej.error&&ej.error.type)||''}catch(e){}
      if(et==='rate_limit')dbg('RATE LIMIT the church server refused a request: too many in one minute');
      if(et==='daily_limit'){claudeBlockedUntil=Date.now()+3600000;limitHit(em);var le=new Error('Claude is stopped (daily limit)');le.kind='credit';throw le}
      if(/^device_/.test(et)){claudeBlockedUntil=Date.now()+60000;devDenied(et);var de=new Error('This device is not allowed');de.kind='credit';throw de}
      var credit=/credit|balance|billing|payment/i.test(em)||r.status===402,keyBad=r.status===401||r.status===403||/key is not set/i.test(em);
      if(credit||keyBad){claudeBlockedUntil=Date.now()+(NO_BACKUP?20000:600000);
        if(NO_BACKUP)serviceDown('claude',credit?'TRANSLATION STOPPED: the Claude account is out of credit. Add credit at platform.claude.com (Billing), then press Restart.':'TRANSLATION STOPPED: the Claude key on the church server was refused. A new key is needed.');
        else{problemText='Claude: '+(credit?'the credit balance is too low':'the key was not accepted')+'. Groq is translating instead.';problemAt=Date.now();var d=$('dot');d&&d.classList.add('warn')}}
      var er=new Error('Claude '+r.status+(em?': '+em.slice(0,120):''));er.kind=credit?'credit':keyBad?'key':(r.status===429||r.status>=500)?'busy':'other';throw er}
    var j=await r.json(),txt=cleanLLM(((j.content||[]).filter(function(c){return c.type==='text'}).map(function(c){return c.text}).join('')));
    alertClear('claudenet');
    if(j.usage){claudeUse.req++;claudeUse.inTok+=j.usage.input_tokens||0;claudeUse.outTok+=j.usage.output_tokens||0}
    if(!txt)throw new Error('Claude answered with nothing');
    return {text:txt,model:CLAUDE_MODEL};
  }
  async function chatCall(msgs,maxTok,temp,preferFast,deadline,onPartial){ // returns {text, model}; tries other models when one is busy or gone
    if(NO_BACKUP){ // Claude only: no Groq, ever
      if(!claudeReady())throw new Error('no translator');
      if(Date.now()<claudeBlockedUntil)throw new Error('Claude is stopped (credit or key)');
      var cr0=await claudeCall(msgs,maxTok,temp,deadline?Math.max(6000,Math.min(15000,deadline-Date.now())):12000);if(onPartial)try{onPartial(cr0.text)}catch(e){}return cr0}
    if(useClaude()&&(!preferFast||!S.get('groqKey',''))){
      try{var cr=await claudeCall(msgs,maxTok,temp,deadline?Math.max(4000,Math.min(15000,deadline-Date.now())):12000);if(onPartial)try{onPartial(cr.text)}catch(e){}return cr}
      catch(e){dbg('CLAUDE '+e.message+': Groq translates this one');if(!S.get('groqKey',''))throw e}
    }
    var kind=preferFast?'q':'c',est0=estTokens(msgs,maxTok+(preferFast?150:250)),std=(kind==='c'&&maxTok===340)||(kind==='q'&&maxTok===200),est=std&&AVGT[kind]?Math.min(est0,Math.round(Math.max(AVGT[kind]*1.25,est0*0.5))):est0,tried={},waited=0; // budget each request by what such requests really cost, once Groq has told us
    for(var k=0;k<6;k++){
      var m=pickModel(est,preferFast);
      if(!m&&deadline&&waited<2){var w=nextFree(est);if(w>0&&Date.now()+w+1500<=deadline){waited++;dbg('PACING: waiting '+(w/1000).toFixed(1)+'s for a model');await new Promise(function(r){setTimeout(r,w+300)});continue}}
      if(!m||tried[m])break;tried[m]=1;
      var r=await fetchR('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+S.get('groqKey','')},body:chatBody(m,msgs,maxTok,temp,!!onPartial)});
      await chatProblem(r,m);
      if(r.status===429){coolDown(m,r);continue}
      if(r.status===401||r.status===403){groqBlockedUntil=Date.now()+3600000;keyRejected();throw new Error('key not accepted, check it in Settings')}
      if(r.status===404||BAD[m])continue;
      if(r.status===400&&!REASON_OK){r=await fetchR('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+S.get('groqKey','')},body:chatBody(m,msgs,maxTok,temp)})}
      if(!r.ok){var em='';try{em=((await r.json()).error||{}).message||''}catch(e){}if(r.status>=500)continue;throw new Error(em||('HTTP '+r.status))}
      var txt;
      if(onPartial&&r.body&&r.headers.get('content-type')&&/text\/event-stream/.test(r.headers.get('content-type'))){var st=await readStream(r,onPartial);noteUse(m,st.tokens||est);if(st.tokens&&std)AVGT[kind]=AVGT[kind]?AVGT[kind]*0.8+st.tokens*0.2:st.tokens;txt=cleanLLM(st.text)}
      else{var j=await r.json();var ut=j.usage&&j.usage.total_tokens;noteUse(m,ut||est);if(ut&&std)AVGT[kind]=AVGT[kind]?AVGT[kind]*0.8+ut*0.2:ut;txt=cleanLLM(j.choices[0].message.content)}
      if(txt)return {text:txt,model:m};
    }
    throw new Error('rate limit (all free models busy this minute)');
  }
  async function readStream(r,onPartial){ // Groq streams the answer as server-sent events; show the words as they arrive
    var rd=r.body.getReader(),dec=new TextDecoder(),buf='',text='',tokens=0,last=0;
    while(true){var ch=await rd.read();if(ch.done)break;buf+=dec.decode(ch.value,{stream:true});var parts=buf.split('\n');buf=parts.pop();
      for(var i=0;i<parts.length;i++){var ln=parts[i].trim();if(ln.indexOf('data:')!==0)continue;var dj=ln.slice(5).trim();if(dj==='[DONE]')continue;
        try{var o=JSON.parse(dj);var d=o.choices&&o.choices[0]&&o.choices[0].delta;if(d&&d.content)text+=d.content;if(o.usage&&o.usage.total_tokens)tokens=o.usage.total_tokens;if(o.x_groq&&o.x_groq.usage&&o.x_groq.usage.total_tokens)tokens=o.x_groq.usage.total_tokens}catch(e){}}
      if(text.length-last>=6){last=text.length;try{onPartial(text)}catch(e){}}}
    return {text:text,tokens:tokens};
  }
  function chatBody(model,messages,maxTok,temp,stream){ // reasoning models need a small reasoning budget so answers come back fast
    var b={model:model,temperature:temp,max_tokens:maxTok,messages:messages};if(stream){b.stream=true;b.stream_options={include_usage:true}}
    if(!REASON_OK){}
    else if(/gpt-oss/.test(model)){b.reasoning_effort='low';b.include_reasoning=false;b.max_tokens=maxTok+400}
    else if(/qwen3/.test(model)){b.reasoning_effort='none';b.max_tokens=maxTok}
    return JSON.stringify(b);
  }
  function showAlert(msg,ok,ms,force){
    var a=$('alert');if(!a)return;if(!msg){a.style.display='none';return}
    if(running&&!force){problemText=msg.replace(/\n\(tap to hide\)/,'');problemAt=Date.now();var d=$('dot');d&&d.classList.add('warn');return} // the congregation is watching: no banners
    a.textContent=msg;a.className=ok?'ok':'';a.dataset.k='';a.style.display='block';if(ms)setTimeout(function(){if(a.textContent===msg)a.style.display='none'},ms)
  }
  setTimeout(function(){var d=$('dot');if(d)d.onclick=function(){showAlert(problemText?('Last problem: '+problemText+'\n(tap to hide)'):'No problems.\n(tap to hide)',!problemText,7000,true)}},0);
  $('alert').onclick=function(){showAlert('')};
  // Checks every outside service the app depends on and says plainly what is wrong. Runs at Start and from Settings.
  async function healthCheck(full){
    if(NO_BACKUP){var out=[];
      if(!claudeReady())out.push({n:'Translator',ok:false,m:'No translator set up on this device.'});
      else{claudeBlockedUntil=0;try{var c1=await claudeCall([{role:'user',content:'Translate to English, answer with the English only: الرب راعي'}],40,0,12000);out.push({n:'Claude translator',ok:true,m:CLAUDE_MODEL+' works ("'+c1.text.slice(0,40)+'")'})}catch(e){out.push({n:'Claude translator',ok:false,m:e.kind==='credit'?'OUT OF CREDIT. Add credit at platform.claude.com.':e.message})}}
      if(!sxHaveKey())out.push({n:'Soniox hearing',ok:false,m:'No Soniox key on this device. Paste it in Settings.'});
      else if(full){var s1=await sxCheck();out.push({n:'Soniox hearing',ok:s1[0],m:s1[1]+(s1[0]?'':' (no backup hearing)')})}
      else out.push({n:'Soniox hearing',ok:true,m:'key saved'});
      return out}
    var res=[],key=S.get('groqKey','');
    if(!key){res.push({n:'Groq key',ok:false,m:'No key on this device. Paste it in Settings.'});return res}
    var ids=[];
    try{
      var r=await fetchT('https://api.groq.com/openai/v1/models',{headers:{'authorization':'Bearer '+key}},8000);
      if(r.status===401||r.status===403)keyRejected();
      if(r.status===401||r.status===403)res.push({n:'Groq key',ok:false,m:'Groq does not accept this key (it may be wrong or deleted). Make a new one at console.groq.com/keys.'});
      else if(!r.ok)res.push({n:'Groq',ok:false,m:'Groq answered with an error ('+r.status+'). Try again in a minute.'});
      else{res.push({n:'Groq key',ok:true,m:'accepted'});ids=((await r.json()).data||[]).map(function(m){return m.id})}
    }catch(e){res.push({n:'Internet',ok:false,m:'Cannot reach Groq. Check the Wi-Fi or cellular signal.'});return res}
    if(!ids.length)return res;
    await loadModels();
    res.push({n:'Hearing model',ok:ids.indexOf(MODELS.asr)>=0,m:MODELS.asr+(ids.indexOf(MODELS.asr)>=0?'':' is not available to this key')});
    if(full&&claudeReady()){claudeBlockedUntil=0;try{var ck=await claudeCall([{role:'user',content:'Translate to English, answer with the English only: الرب راعي'}],40,0,12000);res.push({n:'Claude translator',ok:true,m:CLAUDE_MODEL+' works ("'+ck.text.slice(0,40)+'")'+(S.get('translator',CLAUDE_PROXY?'claude':'groq')==='claude'?'':'. Choose Claude Haiku as the translator to use it.')})}catch(e){res.push({n:'Claude translator',ok:false,m:e.message+'. Groq is used instead.'})}}
    if(full&&sxHaveKey()){var sc=await sxCheck();res.push({n:'Soniox streaming',ok:sc[0],m:sc[1]+(sc[0]?'':'. Whisper is used instead.')})}
    if(full&&S.get('deepgramKey','')){var dc=await dgCheck();res.push({n:'Deepgram streaming',ok:dc[0],m:dc[1]+(dc[0]?'':'. Whisper is used instead.')})}
    if(full&&S.get('cohereKey','')){try{cohereBlockedUntil=0;await cohereHear(wavBlob(new Float32Array(16000)),12000);res.push({n:'Cohere hearing',ok:true,m:COHERE_MODEL+' answers from this device'})}catch(e){res.push({n:'Cohere hearing',ok:false,m:e.message+'. Whisper is used instead.'})}}
    for(var k=0;k<2;k++){
      var model=k?MODELS.fast:MODELS.chat,label=k?'Quick translator':'Careful translator';
      try{
        var rr=await fetchT('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+key},body:chatBody(model,[{role:'user',content:'Translate to English, answer with the English only: الرب راعي'}],40,0)},12000);
        await chatProblem(rr,model);
        if(!rr.ok){var em='';try{em=((await rr.json()).error||{}).message||''}catch(e){}res.push({n:label,ok:false,m:model+' failed: '+(em||rr.status)});continue}
        var ans=cleanLLM((await rr.json()).choices[0].message.content);
        res.push({n:label,ok:!!ans,m:model+(ans?' works ("'+ans.slice(0,40)+'")':' answered with nothing')});
      }catch(e){res.push({n:label,ok:false,m:model+' did not answer in time'})}
    }
    return res;
  }
  async function healthAtStart(){
    var res=await healthCheck(),bad=res.filter(function(x){return !x.ok});
    dbg('HEALTH '+res.map(function(x){return x.n+':'+(x.ok?'ok':'FAIL '+x.m)}).join(' | '));
    if(bad.length&&running)showAlert('PROBLEM: '+bad.map(function(x){return x.n+' - '+x.m}).join('\n')+'\n(tap to hide)',false,0,true);
  }
  // does the web address hold a newer version of the app than the one on screen?
  async function updateCheck(){
    try{
      var cur=(document.querySelector('meta[name=build]')||{}).content;if(!cur)return;
      var r=await fetch(location.pathname+'?c='+Date.now(),{cache:'no-store'}),h=await r.text(),m=/name="build" content="([^"]+)"/.exec(h);
      if(m&&m[1]!==cur&&!running&&!VIEW.on){var seen='';try{seen=sessionStorage.getItem('upd')||''}catch(e){}if(seen!==m[1]){try{sessionStorage.setItem('upd',m[1])}catch(e){}location.replace(location.pathname+'?v='+Date.now());return}showAlert('A newer version is ready. TAP HERE to update.',true);$('alert').onclick=function(){$('alert').onclick=function(){showAlert('')};location.replace(location.pathname+'?v='+Date.now())}}
    }catch(e){}
  }
  async function fetchR(url,opts,ms){
    try{var r=await fetchT(url,opts,ms);if(r.status<500)return r;dbg('RETRY after server '+r.status)}
    catch(e){dbg('RETRY after '+(e.name||'error'))}
    await new Promise(function(x){setTimeout(x,1200)});
    return fetchT(url,opts,ms);
  }
  function fetchT(url,opts,ms){ // a call that never answers must not freeze everything behind it
    var c=typeof AbortController!=='undefined'?new AbortController():null,tm=setTimeout(function(){try{c&&c.abort()}catch(e){}},ms||12000);
    opts=opts||{};if(c)opts.signal=c.signal;
    return fetch(url,opts).then(function(r){clearTimeout(tm);return r},function(e){clearTimeout(tm);throw e});
  }
  var lastModel='';
  function partialNew(t){var m=/"new"\s*:\s*"((?:[^"\\]|\\.)*)/.exec(t);if(!m)return '';return m[1].replace(/\\"/g,'"').replace(/\\n/g,' ')}
  async function groq(ar,alts,prevItem,item,deadline){
    var arSnd=soundApply(ar);if(arSnd!==ar){dbg('NAME by sound applied: '+arSnd.slice(0,80));ar=arSnd} // v149
    var ctxItems=lines.slice(-4,-1).filter(function(l){return l.en&&!/^\[/.test(l.en)});
    var prev=ctxItems.map(function(l){return l.ar+'\n→ '+l.en}).join('\n\n');
    var canRevise=prevItem&&prevItem.en&&!prevItem.fixed&&!/^\[/.test(prevItem.en); // with two lanes the previous line may still be in flight: then it is simply not revised
    var g=groqGlossary(ar,prev);
    var res=await chatCall([
        {role:'system',content:SYS+(sermonMemo?'\n\nWhat the sermon is about so far (use it to choose the right meaning and names): '+sermonMemo:'')+(readingTitle()?'\n\nToday in the Coptic calendar: '+readingTitle():'')+(SAINT_RE.test(normAr(ar+' '+prev))?saintsToday():'')+(S.get('lang','mixed')==='mixed'?'\n\n'+SYS_MIXED.trim():'')+(S.get('notes','')?'\n\nNotes from the church about today:\n'+S.get('notes',''):'')+g+'\n\nThe speech is cut at pauses, so a piece can start or end mid-sentence and a short word may be missing at a cut. Reply with JSON only, "new" first: {"new":"...",'+(canRevise?'"previous":"...",':'')+'"fixes":[["misheard Arabic copied exactly from the NEW sentence","what the speaker most likely said"]],"unknown":["..."]}. "new": the English of the NEW sentence. '+(canRevise?'"previous": the English of the PREVIOUS sentence, unchanged unless the new sentence shows it was misheard or cut. ':'')+'"fixes": only real mishearings (1-3 words) that you replaced with a similar-sounding church word or name AND that your English actually uses; never a word that already makes sense where it stands, never a style or dialect change, never a negation the speaker did not say, and never a guess for a word you cannot make sense of (that word goes in "unknown"); Arabic only in both parts, one answer each (no slashes, no brackets); [] if none. "unknown": single Arabic words copied exactly from the NEW sentence that are not a real word in Arabic or in the Egyptian dialect and not a name you know, so you cannot tell what was said (usually a name that was misheard). Leave such a word out of "new" (write the sentence without it, with no dots, dash or blank in its place) and never write it in English letters as if it were a name or a place; an ordinary word you understand is never listed; [] if none.'},
        {role:'user',content:(ctxItems.length?'Earlier (context only): '+ctxItems.slice(-2).map(function(l){return l.en}).join(' ')+'\n\n':'')+(canRevise?'PREVIOUS sentence (Arabic → English shown):\n'+prevItem.ar+'\n→ '+prevItem.en+'\n\n':'')+'NEW sentence to correct and translate:\n'+ar+(item&&item.after?'\n\nRight AFTER the NEW sentence he goes on to say (context only: use it to understand what the NEW sentence means, and never translate it or put any of it in your answer):\n'+item.after:'')+(item&&item.verse?'\n\nIn the NEW sentence he quotes only PART of a Bible verse'+(item.verse.ref?' ('+item.verse.ref+')':'')+'. The church\'s English for the whole verse is: "'+String(item.verse.b).slice(0,600)+'". Use that wording for the words he actually said, and leave out every part of the verse that is not in the NEW sentence.':'')+(item&&item.unsure?'\n\nThe recognizer was unsure of these words in the NEW sentence: '+item.unsure.join('، ')+'. Do not build the meaning on them: if a church word or name clearly fits there, use it; otherwise leave that part out rather than guess.':'')+(item&&item.sx&&item.sx.split(/\s+/).length>=3?'\n\nThe hearing service also made its own rough English of the NEW sentence directly from the sound: "'+item.sx.replace(/\b(?:uh+|um+|uhm+)\b,?\s*/gi,'').slice(0,400)+'". It is a hint only, often incomplete, clumsy or wrong, so never copy its wording or its fillers, and when it makes no sense ignore it. Never take a name or a place from it that is not in the Arabic text. Use it for one thing: where it has an ordinary English word (fun, busy, stress, a place, a brand) at a spot where the Arabic text has a word that sounds like it, he said that English word, so write it.':'')+(alts&&alts.length?'\n\nA second recognizer heard the same stretch as (it may include a few words from just before; use whichever reading makes sense in a sermon):\n'+alts.join('\n'):'')}],340,0.2,false,deadline,item?function(t){var pn=partialNew(t);if(pn&&pn.length>(item.draft||'').length&&!item.en){item.draft=pn;if(!item.tDraft)item.tDraft=Date.now();render()}}:null);
    var out=res.text;lastModel=res.model;
    var m=out.match(/\{[\s\S]*\}/);
    if(m){try{var o=JSON.parse(m[0]);if(o&&typeof o.new==='string'){
      if(canRevise&&typeof o.previous==='string'&&o.previous.trim()&&o.previous.trim()!==prevItem.en){var pr=o.previous.trim(),pi=lines.indexOf(prevItem),pp=pi>0&&lines[pi-1].en?lines[pi-1].en.trim():'';if(pp.length>3&&pr.indexOf(pp)===0){pr=pr.slice(pp.length).trim();dbg('REVISE: dropped a repeat of the sentence before')}var ow=prevItem.en.split(/\s+/).length,nw2=pr.split(/\s+/).length;if(pr&&nw2<=ow*1.5+3){prevItem.en=pr;prevItem.revised=true}else dbg('REVISE rejected: the previous sentence would grow from '+ow+' to '+nw2+' words')} // v118
      if(Array.isArray(o.fixes))o.fixes.slice(0,4).forEach(function(fx){if(Array.isArray(fx)&&fx.length===2&&learnFix(String(fx[0]),String(fx[1]),ar,o.new)&&item)item.fixes=(item.fixes||[]).concat([fx[0]+' \u2192 '+fx[1]])});
      var en1=o.new.trim();
      var unk=(Array.isArray(o.unknown)?o.unknown:[]).map(String);if(Array.isArray(o.fixes))o.fixes.slice(0,4).forEach(function(fx){if(Array.isArray(fx)&&fx.length===2)String(fx[0]).split(/\s+/).forEach(function(w){if(w&&unk.indexOf(w)<0)unk.push(w)})}); // v150: a word the translator swapped for a guess is checked too, it rarely lists a word as unknown
      if(unk.length&&en1){if(Array.isArray(o.unknown)&&o.unknown.length)dbg('UNKNOWN word(s): '+o.unknown.slice(0,3).join(' '));try{var en2=await nameBySound(ar,en1,unk,deadline,ctxItems.slice(-2).map(function(l){return l.en}).join(' '));if(en2)en1=en2}catch(e){dbg('NAME by sound failed: '+e.message)}} // v149
      return en1;
    }}catch(e){}}
    var m2=/"new"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(out);if(m2)return m2[1].replace(/\\"/g,'"').trim();
    return out.replace(/^\{[\s\S]*"new"\s*:\s*"/,'').replace(/"\s*\}\s*$/,'');
  }
  function cleanLLM(s){return (s||'').replace(/<think>[\s\S]*?<\/think>/g,'').replace(/^```(?:json)?\s*|\s*```$/g,'').trim()}
  var sermonMemo='',memoCount=0,memoBusy=false;
