  // ---- transcripts: saved automatically on this iPad, last 10 services kept ----
  var txId=null,txTimer=null,PAGE=Date.now().toString(36);
  function txAll(){try{return JSON.parse(S.get('transcripts','[]'))||[]}catch(e){return []}}
  function txWrite(list){
    list.sort(function(a,b){return a.start-b.start});
    while(list.length>10){var gone=list.shift();try{dbg('TRANSCRIPT from '+new Date(gone.start).toISOString().slice(0,10)+' removed from this device: only the last 10 are kept here (the Google Sheet keeps every one)')}catch(e){}} // v104: said in the log
    for(;;){var str=JSON.stringify(list);if(str.length<800000||list.length<=1){try{localStorage.setItem('transcripts',str);break}catch(e){dbg('transcript save failed, trimming')}}if(list.length<=1)break;var g2=list.shift();try{dbg('TRANSCRIPT from '+new Date(g2.start).toISOString().slice(0,10)+' removed from this device to make room (the Google Sheet keeps every one)')}catch(e){}}
  }
  function txBegin(){
    var list=txAll(),last=list[list.length-1];
    if(last&&last.end&&Date.now()-last.end<20*60000){txId=last.start;return} // same service, resumed within 20 minutes
    txId=Date.now();list.push({start:txId,end:0,title:$('title').textContent.trim(),lines:[]});txWrite(list);
  }
  function txSave(final){
    clearTimeout(txTimer);
    var run=function(){
      if(!txId)return;var list=txAll(),cur=null;list.forEach(function(t){if(t.start===txId)cur=t});if(!cur)return;
      var pos={};cur.lines.forEach(function(x,i){if(x[2])pos[x[2]]=i});
      lines.forEach(function(l){if(!l.en||/^\[/.test(l.en))return;if(!l.id)l.id='l'+(++lineSeq);var k=PAGE+':'+l.id;var te=l.en+(l.ref?' ('+l.ref+')':'');if(k in pos)cur.lines[pos[k]]=[l.ar,te,k];else{pos[k]=cur.lines.length;cur.lines.push([l.ar,te,k])}});
      cur.title=$('title').textContent.trim();if(final)cur.end=Date.now();
      txWrite(list);
    };
    if(final)run();else txTimer=setTimeout(run,1500);
  }
  // after a service: a short summary of the sermon, kept with its transcript
  var sumBusy=false;
  async function txSummarize(id){
    if(sumBusy||!id||!aiOK())return;
    var list=txAll(),cur=null;list.forEach(function(t){if(t.start===id)cur=t});if(!cur||cur.lines.length<8)return;
    var all=cur.lines.map(function(l){return l[1]}).join(' ');if(all.length<400)return;
    if(all.length>7000){var m=Math.floor(all.length/2);all=all.slice(0,2500)+' […] '+all.slice(m-1000,m+1000)+' […] '+all.slice(-2500)}
    sumBusy=true;
    try{
      var res=await chatCall([{role:'system',content:'Write a short summary of this sermon for someone who missed it. The text is a live machine translation from Arabic, so it has gaps and mistakes. Give the main message in one sentence, then at most five short points, then any Bible passages that were named. Use only what the text says: do not add teaching of your own, and if the text is too unclear to summarize, say so. Plain text, no formatting.'},{role:'user',content:all}],380,0.2,false);
      var sm=(res&&res.text||'').trim();if(sm&&sm.length<2500){var l2=txAll();l2.forEach(function(t){if(t.start===id)t.sum=sm});txWrite(l2);dbg('SUMMARY saved ('+sm.length+' characters)')}
    }catch(e){dbg('SUMMARY failed: '+e.message)}
    sumBusy=false;
  }
  function txText(t){return t.title+' \u2014 '+new Date(t.start).toLocaleString()+'\n\n'+(t.sum?'SUMMARY (written by AI from the English translation, so it can contain mistakes)\n'+t.sum+'\n\n':'')+t.lines.map(function(l){return l[0]+'\n\u2192 '+l[1]}).join('\n\n')}
  function txShare(t){
    var name='translation-'+new Date(t.start).toISOString().slice(0,10)+'.txt',blob=new Blob([txText(t)],{type:'text/plain;charset=utf-8'});
    var file=new File([blob],name,{type:'text/plain'});
    if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){navigator.share({files:[file],title:name}).catch(function(){})}
    else{var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},2000)}
  }
  function renderTx(){
    var box=$('txList');box.innerHTML='';var list=txAll().slice().reverse();
    if(!list.length){box.innerHTML='<div class="help">No saved services yet.</div>';return}
    list.forEach(function(t){
      var d=document.createElement('div');d.className='rv';
      d.innerHTML='<div class="e"></div><div class="fixrow"><button class="primary">Share</button><button class="ghost">Delete</button><span class="saved"></span></div>';
      d.querySelector('.e').textContent=new Date(t.start).toLocaleString()+' \u00b7 '+t.title+' \u00b7 '+t.lines.length+' lines'+(t.sum?' \u00b7 summary included':'')+(t.end?'':' (in progress)');
      var bs=d.querySelectorAll('button');
      bs[0].onclick=function(){txShare(t)};
      bs[1].onclick=function(){if(!confirm('Delete this saved service?'))return;txWrite(txAll().filter(function(x){return x.start!==t.start}));if(t.start===txId)txId=null;renderTx()};
      box.appendChild(d);
    });
  }
  $('reviewClose').onclick=function(){rdlg.close()};

  // ---- usage: seconds of speech sent today, kept on this iPad ----
  function today(){return new Date().toISOString().slice(0,10)}
  function usedToday(){return S.get('useDay','')===today()?parseFloat(S.get('useSec','0'))||0:0}
  function addUsage(sec){S.set('useDay',today());S.set('useSec',String(usedToday()+sec))}
  function num(k,d){var v=parseInt(S.get(k,d),10);return isFinite(v)&&v>0?v:d}

