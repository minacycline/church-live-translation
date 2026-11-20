  // v110: English said fast used to come out in blocks of 26 words that could cut a word in half ("their l" / "ove for us"). A finished English sentence now goes up as soon as the next one has begun,
  // and a long run with no pause is cut at the end of a sentence when there is one, otherwise between whole words, never inside a word.
  function sxCutAt(tk,forced,nf){
    var acc='',best=-1,lastWord=-1,lat=0,let_=0,i,x;
    for(i=0;i<tk.length;i++){x=String(tk[i][0]);lat+=(x.match(/[A-Za-z]/g)||[]).length;let_+=(x.match(/[A-Za-z؀-ۿ]/g)||[]).length}
    var english=let_>0&&lat/let_>0.7;
    for(i=0;i<tk.length-1;i++){x=String(tk[i][0]);acc+=x;var nx=String(tk[i+1][0]);
      if(!/^\s/.test(nx)&&!/\s$/.test(x))continue; // the next piece continues this word
      var head=acc.replace(/\s+/g,' ').trim();if(!head)continue;
      lastWord=i;
      if(!/[.!?؟]["')\]]?$/.test(head))continue;
      if(/(^|\s)(?:St|Fr|Dr|Mr|Mrs|Ms|vs|No|Rev|Jr|Sr|[A-Z])\.$/.test(head)||/\d\.$/.test(head))continue; // "St. George", "3.5": not the end of a sentence
      var words=head.split(' ').length;
      if(english?words>=5:(forced&&words>=7))best=i;
    }
    if(best>=0)return best;
    if(forced&&lastWord>=0&&nf&&!/^\s/.test(nf)&&!/\s$/.test(String(tk[tk.length-1][0])))return lastWord; // the last word is still being heard: it goes with the next piece
    return -1;
  }
  function sxCommaAt(tk){ // v136: the last comma in the Arabic heard so far with at least 5 words before it; -2 means the comma is at the very end (close all of it)
    var acc='',best=-1,lat=0,let_=0,i,x;
    for(i=0;i<tk.length;i++){x=String(tk[i][0]);lat+=(x.match(/[A-Za-z]/g)||[]).length;let_+=(x.match(/[A-Za-z\u0600-\u06FF]/g)||[]).length}
    if(!let_||lat/let_>0.3)return -1; // Arabic only: English already closes at its own sentence ends
    for(i=0;i<tk.length;i++){x=String(tk[i][0]);acc+=x;var nx=i+1<tk.length?String(tk[i+1][0]):' ';
      if(!/^\s/.test(nx)&&!/\s$/.test(x)&&!/[\u060C,\u061B]\s*$/.test(x))continue;
      var head=acc.replace(/\s+/g,' ').trim();if(!/[\u060C,\u061B]$/.test(head))continue;
      if(head.split(' ').length<5)continue;
      best=(i===tk.length-1)?-2:i;
    }
    if(best>=0&&!acc.slice(tk.slice(0,best+1).map(function(y){return y[0]}).join('').length).trim())return -2;
    return best;
  }
  function sxLibMid(hd){ // v137: true while what he has said so far is the first part of a Bible verse, a reading or a fixed prayer (the opening prayer included)
    if(SX.lmK===hd)return SX.lmV;var v=false;
    try{var A=words(hd);
      if(A.length<12&&(A[0]==='بسم'||A[0]==='باسم'||A[1]==='بسم'||A[1]==='باسم')&&!/(^| )(ال)?امين( |$)/.test(A.join(' ')))v=true;
      else{var r=matchOne(hd);if(r&&r.n>A.length+2)v=true}
    }catch(e){}
    if(v&&!SX.lmV)dbg('STREAM no cut at this comma: in the middle of a verse or prayer');
    SX.lmK=hd;SX.lmV=v;return v;
  }
  function wordsIn(a,b,arabic){ // v137: how much of a is inside b, word by word (0 to 1)
    var f=arabic?words:function(s){return String(s||'').toLowerCase().replace(/[^a-z0-9' ]+/g,' ').split(' ').filter(Boolean)};
    var A=f(a),B=f(b),set={},hit=0;if(!A.length)return 0;B.forEach(function(w){set[w]=(set[w]||0)+1});A.forEach(function(w){if(set[w]){hit++;set[w]--}});return hit/A.length;
  }
  function sxSplit(i){
    var tk=SX.tk||[],h=tk.slice(0,i+1),r=tk.slice(i+1),head=h.map(function(x){return x[0]}).join('').replace(/\s+/g,' ').trim(),rest=r.map(function(x){return x[0]}).join('');
    if(!head||!rest.trim())return false;
    var eng=(head.match(/[A-Za-z]/g)||[]).length>(head.match(/[؀-ۿ]/g)||[]).length,sx=eng?'':SX.en.replace(/\s+/g,' ').trim();if(SX.noEn&&!eng)sx=undefined; /* v137: after a comma cut the hearing's own English no longer lines up with the piece, so it is not used as a draft or a hint */
    SX.heldAt=0;clearTimeout(SX.holdT);DG.segAt=SX.at;SX.en='';curUnsure=sxUnsure(h);
    SX.tk=r;SX.ar=rest;SX.at=Date.now();SX.t0=SX.at;SX.pEnd=SX.at;
    dgFinal(head,sx);curUnsure=null;SX.tail=null;
    return true;
  }
  function sxMessage(m,ws){
    if(m.error_code){dbg('STREAM Soniox refused: '+m.error_code+' '+(m.error_type||'')+' '+String(m.error_message||'').slice(0,90));if(m.error_code===401||m.error_code===402||m.error_code===403){DG.tries=Math.max(DG.tries,4);problemText='Soniox: '+String(m.error_message||m.error_type||m.error_code).slice(0,120);problemAt=Date.now();if(NO_BACKUP)serviceDown('soniox',(m.error_code===402||/credit|balance|billing|payment|quota/i.test(String(m.error_message||'')))?'HEARING STOPPED: the Soniox account is out of credit. Add credit at console.soniox.com (Billing), then press Restart.':'HEARING STOPPED: Soniox refused the key ('+String(m.error_message||m.error_code).slice(0,60)+').')}
      else if(m.error_code===400&&SXCUT<4){SXCUT++;DG.tries=0;dbg('STREAM Soniox did not accept the opening message: trying a simpler one (step '+SXCUT+')')}
      return}
    HOLD.msgAt=Date.now();if(typeof m.final_audio_proc_ms==='number')HOLD.finN=Math.round(m.final_audio_proc_ms*16);
    var tk=m.tokens||[],end=false,tailR=false;SX.nfAr='';SX.nfEn='';
    for(var i=0;i<tk.length;i++){var k=tk[i],tx=String(k.text||'');
      if(tx==='<end>'||tx==='<fin>'){if(tx==='<end>')end=true;continue}
      var tr=k.translation_status==='translation';
      if(!tr&&tx.trim())SX.tail=null; // new speech has begun: the previous sentence is complete
      if(tr&&SX.tail&&!SX.ar&&!SX.nfAr){ // late English for the sentence that was just closed
        if(k.is_final){var it=SX.tail;it.sx=((it.sx||'')+tx).replace(/\s+/g,' ').replace(/^ /,'');if(!it.en){it.draft=it.sx;if(!it.tDraft)it.tDraft=Date.now();tailR=true}else if(it.viaStream){it.en=it.sx;tailR=true}}
        continue}
      if(k.is_final){if(tr)SX.en+=tx;else{SX.ar+=tx;(SX.tk=SX.tk||[]).push([tx,k.confidence]);if(!SX.at){SX.at=sentStart();SX.t0=Date.now();SX.pEnd=sxTok}sxTok=Date.now()}}else{if(tr)SX.nfEn+=tx;else{SX.nfAr+=tx;if(!SX.at&&tx.trim()){SX.at=sentStart();SX.t0=Date.now();SX.pEnd=sxTok}if(tx.trim())sxTok=Date.now()}}}
    var ar=(SX.ar+SX.nfAr).replace(/\s+/g,' ').trim(),en=(SX.en+SX.nfEn).replace(/\s+/g,' ').trim(),fa=SX.ar.replace(/\s+/g,' ').trim();
    if(ar){lastSpeechAt=Date.now();arEl.textContent=cleanAr(ar)}
    var nw=fa?fa.split(' ').length:0;
    if(fa&&!end&&SX.tk&&SX.tk.length>3){var ci=sxCutAt(SX.tk,nw>=26,SX.nfAr);if(ci>=0&&sxSplit(ci)){if(tailR)render();return}}
    // v136: a long Arabic sentence (a prayer joined by commas) no longer waits for its very end: once it has 10 words or has run 6 s, it closes at a comma, so each clause shows in a few seconds
    if(fa&&!end&&SX.tk&&SX.tk.length>3&&(nw>=10||(SX.t0&&Date.now()-SX.t0>6000))){var cc=sxCommaAt(SX.tk);if(cc!==-1){var hd=cc===-2?fa:SX.tk.slice(0,cc+1).map(function(x){return x[0]}).join('').replace(/\s+/g,' ').trim();if(sxLibMid(hd))cc=-1} /* v137: a Bible verse or a fixed prayer is never cut in the middle, or its English would be shown twice */if(cc===-2){SX.noEn=true;dbg('STREAM long sentence closed at a comma ('+nw+' words)');sxClose(fa);if(tailR)render();return}if(cc>=0){var ne0=SX.noEn;SX.noEn=true;if(sxSplit(cc)){dbg('STREAM long sentence cut at a comma');if(tailR)render();return}SX.noEn=ne0}}
    if(fa&&(end||(nw>=7&&/[.!?؟]\s*$/.test(fa)&&!SX.nfAr.trim())||nw>=26)){ // a finished thought: at his pause, at the end of a sentence, or when it is getting long
      // v88: a pause in the middle of a thought must not put a stray piece on the screen ("From."): a piece of one or two words, or one that ends on a joining word, waits up to 3.5 s for the rest
      var dangling=nw<=2||/(^|\s)(من|في|على|إلى|الى|عن|مع|و|أو|ان|أن|إن|اللي|الذي|التي|لكن|بس|يعني|زي|كان|ده|دي|لما|عشان|علشان|حتى|ثم|بعد|قبل)[.،,؟!]*\s*$/.test(fa);
      clearTimeout(SX.holdT);
      if(end&&dangling&&nw<26&&!(SX.heldAt&&Date.now()-SX.heldAt>3400)){
        if(!SX.heldAt)SX.heldAt=Date.now();SX.ar=SX.ar.replace(/[.؟!]\s*$/,' ');dbg('STREAM piece held for the rest: '+fa.slice(-30));
        var held0=SX.ar.replace(/\s+/g,' ').trim();var holdChk=function(){try{if(DG.ws!==ws)return;var f2=SX.ar.replace(/\s+/g,' ').trim();if(!f2)return;if(f2!==held0){SX.heldAt=0;return} /* v134: he carried on, so the sentence closes the normal way and is not cut in the middle */if(SX.nfAr.trim()&&Date.now()-SX.heldAt<9000){SX.holdT=setTimeout(holdChk,1000);return}if(SX.nfAr.trim())dbg('STREAM held piece sent after 9 s: '+f2.slice(-30));skipHold=true;try{sxClose(f2)}finally{skipHold=false;SX.noEn=false}}catch(e){}};SX.holdT=setTimeout(holdChk,3600);return} // v132: it used to give up for good when a half-heard word was there at 3.6 s
      sxClose(fa);if(end)SX.noEn=false;return}
    if(tailR)render();
    if(en&&Date.now()-SX.shown>180){SX.shown=Date.now();if(!liveFirstAt)liveFirstAt=Date.now();if(liveEn!==en){liveEn=en;render()}}
    if(m.finished)dbg('STREAM Soniox finished the stream');
  }
  function dgUrl(){
    var q='model=nova-3&language=ar-EG&encoding=linear16&sample_rate=16000&channels=1&interim_results=true&smart_format=true&endpointing=350&utterance_end_ms=1200';
    try{nameTerms().slice(0,24).forEach(function(t){q+='&keyterm='+encodeURIComponent(t)})}catch(e){}
    return 'wss://api.deepgram.com/v1/listen?'+q;
  }
