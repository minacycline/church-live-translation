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
  // v157: the app knows where today falls in the church year. The hearing is told the month, the season's words and the day's saints first, and the translator is always told the date.
  var COPTIC_MONTHS_AR=['توت','بابه','هاتور','كيهك','طوبة','أمشير','برمهات','برمودة','بشنس','بؤونة','أبيب','مسرى','النسيء'];
  function orthodoxEaster(y){var a=y%4,b=y%7,c=y%19,d=(19*c+15)%30,e=(2*a+4*b-d+34)%7,s=d+e+114;return new Date(y,Math.floor(s/31)-1,s%31+1+13)} // Julian reckoning plus 13 days: right for 1900 to 2099
  function monthsNear(c){var o=[c.m];if(c.d>=24)o.push(c.m%13+1);if(c.d<=6)o.push((c.m+11)%13+1);return o} // this month, and the next or the last one when the day is close to it
  function churchSeasons(dt){
    dt=dt||new Date();var c=copticDate(dt),m=c.m,d=c.d,out=[],E=orthodoxEaster(dt.getFullYear()),n=Math.round((new Date(dt.getFullYear(),dt.getMonth(),dt.getDate())-E)/86400000);
    function add(en,ar){out.push({en:en,ar:ar})}
    if(m===1&&d<=16)add('the Coptic New Year (Nayrouz)',['عيد النيروز','النيروز','السنة القبطية','عيد الشهداء']);
    if(m===1&&d>=15&&d<=19)add('the Feast of the Cross',['عيد الصليب','الصليب المقدس','الملكة هيلانة']);
    if((m===3&&d>=16)||(m===4&&d<=28))add('the Nativity Fast',['صوم الميلاد']);
    if(m===4)add('the month of Kiahk and its Midnight Praises',['تسبحة كيهك','سبعة وأربعة','الثيؤطوكية']);
    if((m===4&&d>=26)||(m===5&&d<=6))add('the Feast of the Nativity',['عيد الميلاد','برامون الميلاد','الميلاد المجيد','بيت لحم','المجوس']);
    if(m===5&&d>=4&&d<=7)add('the Feast of the Circumcision',['عيد الختان']);
    if(m===5&&d>=8&&d<=13)add('the Feast of Theophany',['عيد الغطاس','برامون الغطاس','اللقان','يوحنا المعمدان','نهر الأردن','عرس قانا الجليل']);
    if(m===6&&d>=6&&d<=8)add('the Feast of the Entry into the Temple',['عيد دخول المسيح الهيكل','سمعان الشيخ']);
    if(m===7&&d>=27)add('the Feast of the Annunciation',['عيد البشارة','الملاك غبريال']);
    if(m===9&&d>=22&&d<=24)add('the Feast of the Entry into Egypt',['عيد دخول المسيح أرض مصر','العائلة المقدسة']);
    if(m===11&&d>=3&&d<=5)add('the Feast of the Apostles',['عيد الرسل','بطرس وبولس']);
    if(m===12&&d<=16)add('the Fast of the Virgin',['صوم العذراء','عيد العذراء','صعود جسد العذراء']);
    if(m===12&&d>=11&&d<=13)add('the Feast of the Transfiguration',['عيد التجلي','جبل طابور']);
    if(n>=-69&&n<=-66)add('the Fast of Jonah (Nineveh)',['صوم يونان','صوم نينوى','يونان النبي','أهل نينوى','فصح يونان']);
    if(n>=-62&&n<=-56)add('the week before Great Lent',['أحد الرفاع','الصوم الكبير']);
    if(n>=-55&&n<=-9){var ar=['الصوم الكبير','الصوم الأربعيني'];[[-49,'أحد الكنوز'],[-42,'أحد التجربة'],[-35,'أحد الابن الضال'],[-28,'أحد السامرية'],[-21,'أحد المخلع'],[-14,'أحد المولود أعمى'],[-7,'أحد الشعانين']].forEach(function(x){if(Math.abs(n-x[0])<=6)ar.push(x[1])});add('Great Lent',ar)}
    if(n>=-8&&n<=-1)add('Holy Week',['سبت لعازر','أحد الشعانين','أسبوع الآلام','البصخة المقدسة','خميس العهد','الجمعة العظيمة','سبت النور','ليلة أبو غلمسيس','الجلجثة']);
    if(n>=0&&n<=49)add('the Holy Fifty Days after the Resurrection',['عيد القيامة','الخماسين المقدسة','المسيح قام','بالحقيقة قام','أحد توما']);
    if(n>=35&&n<=42)add('the Feast of the Ascension',['عيد الصعود']);
    if(n>=43&&n<=50)add('the Feast of Pentecost',['عيد العنصرة','حلول الروح القدس','صلاة السجدة']);
    if(n>=50&&m>=9&&(m<11||(m===11&&d<=4)))add("the Apostles' Fast",['صوم الرسل','عيد الرسل']);
    return out;
  }
  function saintNames(dt){ // the saints of the day as short names the hearing can expect (القديس يوسطس), taken from the Synaxarium lines
    var S2=window.SYNAXARIUM;if(!S2)return [];var c=copticDate(dt),k=('0'+c.m).slice(-2)+'-'+('0'+c.d).slice(-2),out=[];
    (S2[k]||[]).forEach(function(e){
      e=String(e).replace(/(^|\s)أل/g,'$1ال').replace(/[.,،:؛()]/g,' ');var re=/(?:^|\s)(القديس[ةه]?|البابا|ال[أا]نبا|الشهيد[ةه]?|الملاك)\s+([\u0621-\u064A]+)(?:\s+([\u0621-\u064A]+))?/g,x;
      while((x=re.exec(e))){var t=x[1].replace(/ه$/,'ة').replace('الانبا','الأنبا'),w=x[2];if(/^(?:[أا]بو|[أا]با|[أا]بي|مار|عبد)$/.test(w)&&x[3])w+=' '+x[3];var s=t+' '+w;if(w.length>=3&&out.indexOf(s)<0&&out.length<6)out.push(s)}
    });
    return out;
  }
  function dateTerms(dt){ // Arabic words the hearing is told to expect today
    var c=copticDate(dt),out=[];function put(t){if(t&&out.indexOf(t)<0&&out.length<24)out.push(t)}
    monthsNear(c).forEach(function(i){put('شهر '+COPTIC_MONTHS_AR[i-1]);put(COPTIC_MONTHS_AR[i-1])});
    churchSeasons(dt).forEach(function(s){s.ar.forEach(put)});
    try{saintNames(dt).forEach(put)}catch(e){}
    return out;
  }
  function dateTT(dt){var c=copticDate(dt);return monthsNear(c).map(function(i){return ['شهر '+COPTIC_MONTHS_AR[i-1],'the month of '+COPTIC_MONTHS[i-1]]})}
  function dateNote(dt){
    var c=copticDate(dt),s=churchSeasons(dt).map(function(x){return x.en});
    return '\n\nToday is '+c.name+' in the Coptic calendar (Arabic: '+c.d+' '+COPTIC_MONTHS_AR[c.m-1]+')'+(s.length?', in '+s.join(' and '):'')+'. When he names the month, a fast or a feast, it is most likely this one.';
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
