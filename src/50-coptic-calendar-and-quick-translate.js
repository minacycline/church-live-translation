  // ---- Coptic calendar: today's date and the saints of the day from the Synaxarium ----
  var COPTIC_MONTHS=['Tout','Baba','Hatour','Kiahk','Touba','Amshir','Baramhat','Baramouda','Bashans','Paona','Epep','Mesra','Nasie'];
  function copticDate(dt){
    dt=dt||new Date();var y=dt.getFullYear(),m=dt.getMonth()+1,d=dt.getDate(),a=Math.floor((14-m)/12),yy=y+4800-a,mm=m+12*a-3;
    var jdn=d+Math.floor((153*mm+2)/5)+365*yy+Math.floor(yy/4)-Math.floor(yy/100)+Math.floor(yy/400)-32045,EPOCH=1825030;
    var cy=Math.floor((4*(jdn-EPOCH)+1463)/1461),start=EPOCH-1+365*(cy-1)+Math.floor(cy/4);
    var doy=jdn-start-1,cm=Math.floor(doy/30)+1,cd=doy%30+1;
    return {y:cy,m:cm,d:cd,name:cd+' '+COPTIC_MONTHS[cm-1]+' '+cy};
  }
  function saintsToday(){
    var S2=window.SYNAXARIUM;if(!S2)return '';var c=copticDate(),k=('0'+c.m).slice(-2)+'-'+('0'+c.d).slice(-2),a=(S2[k]||[]).slice(0,6),e=((window.SYNAXARIUM_EN||{})[k]||[]).slice(0,6);
    if(!a.length&&!e.length)return '';var out=a.join('؛ ');if(out.length>450)out=out.slice(0,450);var oe=e.join('; ');if(oe.length>450)oe=oe.slice(0,450);
    return '\n\nToday is '+c.name+' in the Coptic calendar. The Synaxarium commemorates today (the speaker may name these saints or feasts):'+(out?'\nArabic: '+out:'')+(oe?'\nEnglish (use these spellings for the names): '+oe:'');
  }
  function readingTitle(){try{var o=JSON.parse(S.get('autoReading','{}'));return o.date===today()?(o.title||''):''}catch(e){return ''}}
  function updateMemo(){
    if(memoBusy||!aiOK())return;
    var recent=lines.filter(function(l){return l.en&&!/^\[/.test(l.en)}).slice(-12).map(function(l){return l.en}).join(' ');
    if(recent.length<80)return;
    memoBusy=true;
    chatCall([{role:'system',content:'You keep a running summary of a Coptic Orthodox sermon so a translator understands the context. In at most 3 short sentences give: the main theme, the Bible passage or story being discussed (book and chapter if clear), and the saints or people named. Output only the summary.'},
        {role:'user',content:(sermonMemo?'Summary so far: '+sermonMemo+'\n\n':'')+'Latest sentences: '+recent}],160,0,true)
    .then(function(res){var s=res&&res.text;if(s&&s.length<600&&!/^\s*(I can(not|'t|\u2019t)|I'm (unable|not able)|I am (unable|not able)|Sorry|Unfortunately|There is not enough|The text (is|does))/i.test(s)){sermonMemo=s;dbg('MEMO '+s.slice(0,120))}})
    .catch(function(){}).then(function(){memoBusy=false});
  }
  async function quick(ar,deadline){
    var res=await chatCall([
        {role:'system',content:(sermonMemo?'Context: '+sermonMemo.slice(0,200)+'\n':'')+'Translate this piece of a Coptic Orthodox church service (a sermon, sometimes ordinary announcements) from Egyptian Arabic to natural English for a screen. If the piece is about faith and a word makes no sense, it may be a misheard religious word: pick the church word it most likely was; in an announcement keep the plain everyday meaning. Never write the name of a person that is not in the Arabic, and never drop a name that is. Translate only the NEW sentence: never repeat the previous sentence in front of it. If the NEW sentence is a meaningless scrap (a lone joining word, or two or three words that say nothing), answer with an empty string instead of inventing a meaning or a name. Keep every negation, number, amount of money, date, time and name exactly as said. Do not add anything that was not said and do not complete a verse he only paraphrased; leave out a garbled part rather than guess. أحبائي = "my beloved", المعرض = "festival". Never write profanity or crude words; use a clean, dignified word or leave it out. This is a Christian church: never write Quran, Koran, Islam, Muslim, Mohammed or Allah unless the Arabic plainly says those exact words (the Arabic word الله is God). If a word sounds like one of those but the sentence is about Christian things, it is almost certainly a misheard name or word, so use the Bible or Church name that fits. '+V110_RULES+' Output only the English.'+groqGlossary(ar,'')},
        {role:'user',content:ar}],200,0,true,deadline,null);
    return res.text;
  }
  // v69: English the speaker says is shown at once, then given one quick second look for words the hearing got wrong (deceased for diseased in a healing story)
  function enCheck(it){
    var t=it.en;if(!t||t.split(/\s+/).length<3||!aiOK()||(!NO_BACKUP&&budgetLeft()<0.15))return;
    var ctx=lines.slice(-4,-1).map(function(l){return l.en}).filter(Boolean).join(' ').slice(-400);
    chatCall([{role:'system',content:'This English was said live by the speaker in a Coptic Orthodox church and written down by speech recognition. Fix only words the recognizer clearly got wrong (a similar-sounding word that does not fit, for example "deceased" for "diseased" in a healing story) and drop clear filler such as "like" or "you know". The sentence may begin or end in the middle of a thought: keep all of it. Never remove real words, and leave a part that looks garbled exactly as written. Do not rephrase, do not add anything, and keep every negation, number, date and name exactly. If nothing needs fixing, return it unchanged. Output only the sentence.'},
      {role:'user',content:(ctx?'Earlier (context only): '+ctx+'\n\n':'')+'Sentence: '+t}],160,0,true,Date.now()+6000,null).then(function(res){
      var d=String(res&&res.text||'').trim().replace(/^["\u201c]|["\u201d]$/g,'');
      if(!d||d===t)return;var a=t.split(/\s+/).length,b=d.split(/\s+/).length;
      if(b<a*0.8||b>a*1.2){dbg('EN CHECK rejected (length changed too much: '+a+' words became '+b+')');return} // v110: was 0.5, which let half a sentence disappear
      var wA=t.toLowerCase().match(/[a-z0-9']+/g)||[],wB=d.toLowerCase().match(/[a-z0-9']+/g)||[],kept=wB.filter(function(w){return wA.indexOf(w)>=0}).length,had=wA.filter(function(w){return wB.indexOf(w)>=0}).length;
      if(!wB.length||kept<wB.length*0.7||had<wA.length*0.7){dbg('EN CHECK rejected (words changed too much: '+kept+' of '+wB.length+' kept)');return} // v140
      if(it.en!==t)return;it.en=d;it.fixedEn=t;dbg('EN CHECK '+t.slice(0,50)+' \u2192 '+d.slice(0,50));render();
    }).catch(function(e){dbg('EN CHECK skipped: '+(e&&e.message))});
  }
  function allTermsAll(){
    var list=pairs('terms');
    if(S.get('builtin','1')==='1'){var seen={};list.forEach(function(p){seen[p.a]=1});(window.COPTIC_TERMS||[]).forEach(function(t){if(!seen[t[0]]){seen[t[0]]=1;list.push({a:t[0],b:t[1],c:!!t[2]})}})}
    return list;
  }
  function aheadText(item){var i=lines.indexOf(item),nx=[];for(var k=i+1;i>=0&&k<lines.length&&nx.length<2;k++)if(lines[k].ar)nx.push(lines[k].ar);var live='';try{live=((SX.ar||'')+(SX.nfAr||'')).replace(/\s+/g,' ').trim()}catch(e){}if(live)nx.push(live);return nx.join(' ').slice(0,400)}
  // v116: the first sentence after Start waits less (3 more words, 0.8 s of quiet, at most 2.5 s) so the first caption comes sooner; later sentences are unchanged
  var sessFirst=false;
