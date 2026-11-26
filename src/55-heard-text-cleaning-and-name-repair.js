  // ---- speech: Whisper through Groq, or the iPad's own recognizer ----
  var paused=false; // v72: Pause keeps the microphone or the shared tab open but sends nothing; Resume carries on without asking again
  var running=false,rec=null,wake=null,maxTimer=null,restartTimer=null,lastResult=0,watchdog=null;
  var ctx=null,stream=null,proc=null,src=null,lastText='',whisperBlockedUntil=0,lastSpeechAt=0,idleTimer=null;
  // Silero voice detector, fed straight from our own audio samples (no second microphone source: Safari dislikes that)
  var vadSess=null,vadState=null,vadSr=null,vadCtx=null,vadQ=[],vadBusy=false,vadProb=0,vadAt=0,vadOk=false,vadHeard=0,vadTail=new Float32Array(0);
  async function startVad(){
    vadOk=false;vadProb=0;vadHeard=0;vadQ=[];vadTail=new Float32Array(0);
    if(!window.ort)return;
    try{
      window.ort.env.wasm.numThreads=1;window.ort.env.wasm.wasmPaths=new URL('vad/',location.href).href;
      vadSess=vadSess||await window.ort.InferenceSession.create(new URL('vad/silero_vad_v5.onnx',location.href).href);
      vadState=new window.ort.Tensor('float32',new Float32Array(256),[2,1,128]);vadSr=new window.ort.Tensor('int64',[BigInt(16000)]);vadCtx=new Float32Array(64);
      vadOk=true;
      if(running&&/^Listening \(Whisper\)/.test($('status').textContent))setStatus($('status').textContent.replace('(Whisper)','(Whisper, voice detector on)'));
    }catch(e){vadOk=false}
  }
  function vadFeed(s16){
    if(!vadOk)return;
    var all=new Float32Array(vadTail.length+s16.length);all.set(vadTail,0);all.set(s16,vadTail.length);
    var i=0;for(;i+512<=all.length;i+=512)vadQ.push(all.slice(i,i+512));
    vadTail=all.slice(i);
    while(vadQ.length>8)vadQ.shift(); // stay real-time: drop old frames if the model falls behind
    vadPump();
  }
  function vadPump(){
    if(vadBusy||!vadQ.length||!vadOk)return;
    vadBusy=true;var frame=vadQ.shift(),withCtx=new Float32Array(576);withCtx.set(vadCtx,0);withCtx.set(frame,64);vadCtx=frame.slice(-64);
    vadSess.run({input:new window.ort.Tensor('float32',withCtx,[1,576]),state:vadState,sr:vadSr}).then(function(out){
      vadState=out.stateN;var p=out.output.data[0];vadProb=p;vadAt=Date.now();if(p>0.5)vadHeard=vadAt;
      vadBusy=false;vadPump();
    }).catch(function(){vadBusy=false;vadOk=false});
  }
  function ui(){try{shareQueue()}catch(e){}if(!running){paused=false;try{barsSet('micBars',0)}catch(e){}}document.body.classList.toggle('running',!!running);document.body.classList.toggle('paused',!!(running&&paused));try{$('pause').textContent=paused?'Resume':'Pause'}catch(e){}$('go').textContent=goText();$('go').classList.toggle('stop',running);$('dot').classList.toggle('on',running);if(!running){$('dot').classList.remove('warn');$('dot').classList.remove('voice')}}
  function useWhisper(){return NO_BACKUP||(S.get('engine','whisper')==='whisper'&&!!S.get('groqKey',''))} // v83: the sound pipeline (it feeds Soniox); with NO_BACKUP nothing is sent to Whisper

  // -- Whisper hints: a few terms, then today's notes, then the last thing heard (Whisper keeps the END of the prompt) --
  var NAME_RE=/^(St\.|Pope|Anba|Archangel|His (Holiness|Grace)|Hegumen|the (Monastery|Theotokos|Agpeya|Psalmody|Synaxarium|Difnar|Katameros|Euchologion|Midnight Praise|Praxis|Pauline|Catholic Epistle|Koiak))/;
  function nameTerms(){ // the words speech recognition gets wrong: names and Coptic words, user terms first
    var out=[],seen={};
    pairs('terms').forEach(function(p){if(AR.test(p.a)&&!seen[p.a]){seen[p.a]=1;out.push(p.a)}});
    if(S.get('builtin','1')==='1')var seenEn={};(window.COPTIC_TERMS||[]).forEach(function(x){if(!x[2]&&NAME_RE.test(x[1])&&!seen[x[0]]){var ek=String(x[1]).toLowerCase();if(seenEn[ek])return;seenEn[ek]=1;seen[x[0]]=1;out.push(x[0])}}); /* v137: only the first (correct) spelling of each name goes to the hearing; the other spellings are mishearings kept for translating, and sending them taught the hearing to write them (Athanasius heard as Synaxarium) */
    return out;
  }
  function whisperPrompt(){
    var terms=[],len=0;
    nameTerms().forEach(function(a){if(len>150)return;terms.push(a);len+=a.length+2});
    var f=LEARN.fix||{},fl=0;activeFixes().forEach(function(k){var t=f[k].to;if(fl>80||terms.indexOf(t)>=0)return;terms.push(t);fl+=t.length+2});
    var notes=S.get('notes','').trim().slice(0,100);
    var tail=lastText.slice(-120);
    return [terms.join('، '),notes,tail].filter(Boolean).join('. ');
  }
  // Whisper sometimes invents text on near-silence: echoes the hint list, loops one word, or writes English/subtitle filler
  // never learn to ignore real prayers: anything in the prayer library, the term list, or the user's own terms is safe
  function looksLiturgical(txt){
    try{if(matchPrayer(txt))return true}catch(e){}
    var n=' '+normAr(txt)+' ',hit=false;
    (window.COPTIC_TERMS||[]).forEach(function(x){if(!hit&&n.indexOf(normAr(x[0]))>=0&&normAr(x[0]).length>=3)hit=true});
    pairs('terms').forEach(function(p){if(!hit&&AR.test(p.a)&&n.indexOf(normAr(p.a))>=0)hit=true});
    return hit||/^(امين|آمين|هلليلويا|كيرياليسون|يا رب ارحم|ارحمنا|المجد لك|يارب)/.test(normAr(txt));
  }
  function cleanHeard(txt,clear){ // clear: this piece was plain, confident speech, so a word like "translation" in it is the speaker talking, not Whisper inventing a credit line
    txt=(txt||'').trim();if(!txt)return '';
    if((LEARN.junk||[]).indexOf(normAr(txt))>=0)return '';
    if(S.get('lang','mixed')!=='mixed'&&!AR.test(txt))return '';
    if(!AR.test(txt)&&((!clear&&/^(thank you|thanks|bye|goodbye|you|okay|ok|merci|danke|gracias)[.! ]*$/i.test(txt))||/for watching|subscribe|subtitles|amara\.org/i.test(txt)))return '';
    if(!clear&&/^(شكرا|شكراً|شكرا لكم|شكرا جزيلا)[.!؟]*$/.test(txt))return ''; // v133: these filters were for the old hearing (Whisper); the live hearing keeps real words like these // Whisper's favourite invention on noise
    if(/اشترك[وا]* في القناة|ترجمة نانسي|شكرا للمشاهدة|شكراً للمشاهدة|subscribe|thank you for watching/i.test(txt)&&txt.length<45)return '';
    if(!clear&&/اشترك|القناة|ترجمة|مترجم/.test(txt)&&txt.length<45)return '';
    var w=txt.split(/\s+/).filter(Boolean);
    if(clear)return txt;
    if(w.length>=6){ // one word or phrase repeated over and over
      var cnt={},top=0;w.forEach(function(x){cnt[x]=(cnt[x]||0)+1;if(cnt[x]>top)top=cnt[x]});
      if(top/w.length>0.6)return w.slice(0,Math.min(3,w.length)).join(' ');
    }
    var hint={};(whisperPrompt()||'').split(/[\s،.]+/).forEach(function(x){if(x)hint[normAr(x)]=1});
    if(w.length>=5){var inHint=w.filter(function(x){return hint[normAr(x)]}).length;if(inHint/w.length>0.85&&txt.length>25&&lastText.indexOf(txt.slice(0,12))<0&&looksLikeTermList(txt))return ''}
    return txt;
  }
  function looksLikeTermList(txt){var terms=(window.COPTIC_TERMS||[]).map(function(t){return t[0]}),n=0;terms.forEach(function(x){if(txt.indexOf(x)>=0)n++});return n>=3}
  // speech recognition often misspells names (أثناسيوس, تواضروس, شنودة...). Snap near-misses to the known spelling.
  var nameWordsCache=null,nameWordsKey='';
  function nameWords(){
    var key=S.get('terms','')+'|'+S.get('builtin','1');
    if(nameWordsCache&&nameWordsKey===key)return nameWordsCache;
    var m={};nameTerms().forEach(function(a){a.split(/\s+/).forEach(function(w){var n=normAr(w);if(n.length>=5&&!/^(القديس|القديسه|الانبا|البابا|الملاك|رئيس|الشهيد|الشهيده|الكنيسه|العذراء|السيده|الرسول|البشير|الكبير|النبي|الحكيم|الصديق|المعمدان|الحبيب|الدير|الكاتدرائيه|الاسقف|المطران|القمص|ابونا|معلمنا|الاباء|الكهنه|الرهبان|الخدام|التسبحه|الاجبيه|السنكسار|الدفنار|القطمارس|الخولاجي|البولس|الكاثوليكون|الابركسيس|كيهك|الملائكه|والده|الاله|الثاني|الثالث|السادس|الاول|الاولي|الصالح|الاعظم|الاسود|العظيم|الجديد|الدين|الليل|الامير|المصريه|الشهداء|الروماني|المتوحدين|واولادها|الرسولي|الرسول|الرسل|البطريرك|الاعظم|المعترف|العريان|القبطي)$/.test(n))m[n]=w})});
    nameWordsKey=key;nameWordsCache=Object.keys(m).map(function(n){return [n,m[n]]});return nameWordsCache;
  }
  function editDist(a,b){
    if(Math.abs(a.length-b.length)>2)return 9;
    var prev=[],cur=[],i,j;for(j=0;j<=b.length;j++)prev[j]=j;
    for(i=1;i<=a.length;i++){cur[0]=i;for(j=1;j<=b.length;j++){cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1))}prev=cur;cur=[]}
    return prev[b.length];
  }
  // real words are never "corrected" into a name: anything used at least twice in the Bible or the liturgy is a word in its own right
  // (before this, the everyday word for "today" was rewritten as the town of Fayoum, "the Nazarene" as a family name, and so on)
  var EVERYDAY='النهارده النهاردة امبارح بكره بكرة علشان عشان كويس كويسة كويسين دلوقتي دلوقت برضه برضو ازاي إزاي ليه فين امتى إمتى حاجة حاجات كتير كثير شوية شويه خالص اوي أوي قوي جدا يعني طبعا ممكن لازم عايز عايزة عايزين عاوز عاوزة نفسي بتاع بتاعة بتوع اللي الذي التي الذين هناك هنالك عندنا عندكم عندهم معانا معاكم معاهم بتاعنا حضرتك حضراتكم الناس الواحد الواحدة واحدة اتنين تلاتة اربعة خمسة الكنيسة الكنايس ابونا أبونا سيدنا قداسة القداس الصلاة الصلوات الانجيل الإنجيل الكتاب المقدس المسيح يسوع العدرا العذراء القديس القديسة القديسين الشهيد الشهيدة الشهداء الملاك الملايكة الرسول الرسل التلاميذ المحبة السلام الفرح الرجاء الايمان الإيمان التوبة الاعتراف التناول الصوم الصيام العيد الاعياد القيامة الميلاد الغطاس الصليب الخلاص الابدية الأبدية الملكوت السما السماء الارض الأرض الدنيا العالم الحياة الموت الخطية الخطايا النعمة البركة الروح القدس الاب الآب الابن ربنا يارب الهنا إلهنا حبيبي حبايبي احبائي أحبائي اخواتي إخوتي ولادي اولادي الاسرة الأسرة البيت الشغل المدرسة الجامعة الخدمة الخدام الشباب الاطفال الأطفال الكبار الستات الرجالة انسان إنسان الانسان الإنسان القلب العقل النفس الجسد الفكر الكلام الكلمة الكلمات الحقيقة الحق الباطل الخير الشر النور الظلمة الطريق الباب الراعي الخروف القطيع الكرمة المزمور المزامير الرسالة الرسايل البشارة النبوة الانبياء الأنبياء الوصية الوصايا الناموس الشريعة العهد القديم الجديد النهاية البداية دايما دائما ابدا أبدا احيانا أحيانا ساعات مرات كمان تاني ثاني برضك علينا عليكم عليهم بينا بينكم بينهم قدامنا قدامه قدامك وراه ورانا جنبنا فوق تحت جوه جوة بره برة يقول بيقول نقول قال قالت قالوا يعمل بيعمل نعمل عمل يعرف بيعرف نعرف عرف يشوف بيشوف نشوف شاف يسمع بيسمع نسمع سمع يحب بيحب نحب يصلي بيصلي نصلي صلى يصوم بيصوم نصوم يتوب نتوب يعيش بيعيش نعيش يموت يقوم يقعد يروح بيروح نروح راح ييجي بييجي نيجي تعالى تعالوا خليك خليكم خلينا المهم الموضوع القصة الحكاية المثل الدرس التأمل العظة الوعظة الاحد الأحد السبت الجمعة الخميس الاربعاء الأربعاء التلات الثلاثاء الاتنين الاثنين الاسبوع الأسبوع الشهر السنة الصبح الضهر العصر المغرب بالليل الفجر مصر القاهرة اسكندرية الإسكندرية الصعيد امريكا أمريكا المهجر'; // everyday Egyptian and church words that are not names
  var REALW=null,REALKEY=null;
  function realWords(){
    var st=statWords();if(REALW&&REALKEY===STATKEY)return REALW;
    var c={},o={};st.forEach(function(t){t[4].forEach(function(w){if(w.length>=5)c[w]=(c[w]||0)+1})});
    Object.keys(c).forEach(function(w){if(c[w]>=2)o[w]=1});
    EVERYDAY.split(' ').forEach(function(w){var n=normAr(w);if(n.length>=5)o[n]=1});
    REALW=o;REALKEY=STATKEY;return o;
  }
  function fixNames(txt){return hardNames(fixNames0(txt))}
  // v157: a Coptic month misheard after شهر (22 Nov 2026 sermon: شهر غفور for شهر هاتور, shown three times as 'the month of Ghafour') is repaired when it sounds like this month or a neighbouring one
  var MONTH_KEEP=/^(?:يناير|فبراير|مارس|ابريل|مايو|يونيو|يونيه|يوليو|يوليه|اغسطس|سبتمبر|اكتوبر|نوفمبر|ديسمبر|رمضان|شعبان|رجب|شوال|محرم|كامل|واحد|واحده|ونص|ونصف|او|من|في|علي|ده|دا|دي|اللي|كل|زي|مع|عن|قبل|بعد|هو|هي|كده|تاني|ثاني|مريم|فات|جاي|قادم|ماضي|سرور|شهور|بخور)$/;
  function monthRepair(txt,dt){
    if(txt.indexOf('شهر')<0)return txt;
    try{var c=copticDate(dt),near=monthsNear(c).map(function(i){return COPTIC_MONTHS_AR[i-1]}),all=COPTIC_MONTHS_AR.map(normAr);
      return txt.replace(/((?:^|\s)(?:[وفبل]|لل)?شهر\s+)([\u0621-\u064A\u064B-\u0652]+)/g,function(m,a,w){
        var n=normAr(w);if(n.length<3||/^ال/.test(n)||MONTH_KEEP.test(n)||all.indexOf(n)>=0)return m;
        for(var i=0;i<near.length;i++){var t=normAr(near[i]);if(Math.abs(t.length-n.length)<=1&&((n.length>=4&&n.slice(-2)===t.slice(-2))||soundAlike(n,t)>=0.75)){dbg('MONTH repaired: '+w+' after شهر is '+near[i]);return a+near[i]}}
        return m});
    }catch(e){return txt}
  }
  function fixNames0(txt){
    txt=monthRepair(txt);
    txt=txt.replace(/(^|\s)سرا[بج]\s+لرجل[يى]?\s+كلامك/g,function(m,a){if(/سراج لرجلي كلامك/.test(m))return m;dbg('WORD repaired: a lamp to my feet (Psalm 119:105)');return a+'سراج لرجلي كلامك'}); // v157: Sermon Debug, 22 Nov 2026
    // v144: mishearings from the 2026-11-20 sermon (the first one also on 2026-11-18)
    txt=txt.replace(/(^|\s)(?:ه[اآأ]|ل[اآأ]|[آأ])رس(\s+الحيا[ةه]\s+ال[أا]بدي[ةه])/g,function(m,a,b){dbg('WORD repaired: inherit eternal life');return a+'لأرث'+b});
    txt=txt.replace(/(^|\s)[اإ]تكتبوا\s+و?(الفريسي[يو]ن)/g,function(m,a,b){dbg('WORD repaired: the scribes and Pharisees');return a+'الكتبة و'+b});
    txt=txt.replace(/(^|\s)لا\s+تركي(?=\s*(?:$|[.,،!؟?:]))/g,function(m,a){dbg('WORD repaired: do not weep');return a+'لا تبكي'});
    txt=txt.replace(/((?:^|\s)(?:ال)?(?:قديس|[أا]نبا|بابا)\s+)(?:ال)?س[يى]?نكس[اي]?ر(?:يوس|ي|ى)?(?=\s|$|[.,،!؟?])/g,function(m,a){dbg('NAME repaired: a saint called Synaxarium is Athanasius');return a+'أثناسيوس'}); // v137
    txt=txt.replace(/(^|\s)(?:ال)?س[يى]?نكس[اي]?ر(?:يوس|ي|ى)?(\s+الرسول[يى])(?=\s|$|[.,،!؟?])/g,function(m,a,b){dbg('NAME repaired: Synaxarium the Apostolic is Athanasius');return a+'أثناسيوس'+b}); // v140
    // "Athanasius the Apostolic": Whisper writes it many ways (السنسيس، أسنانيس، أسنس يسر...) but the title that follows is steady
    txt=txt.replace(/(^|\s)(?:ال)?[اأإ]?[سث]ن[ا]?[نس]{0,2}[يى]?[سش]{0,2}(?:وس)?(?:\s+يس[يى]?ر)?\s+(?=(?:ال)?رسولي?(?:\s|$))/g,'$1أثناسيوس ').replace(/(أثناسيوس)\s+رسولي?(?=\s|$|[.,،!؟?])/g,'$1 الرسولي');
    txt=txt.replace(/(يوحنا|يوحان|يوحانا|يوحنَّا)\s+(?:ال)?(?:معبد|معمد|مبعد|معبدي|معمدي)[يىاا]?[نن]?(?=\s|[.,،!؟?]|$)/g,'يوحنا المعمدان').replace(/العهد\s+(?:ال)?[اأ]تيم/g,'العهد العتيق');
    txt=txt.replace(/(^|\s)([وبلف]{0,2})(?:زيمسيوس|زيموسيوس|زيموثاوس|زيمثاوس|تيموسيوس|تيموتاوس|تيمثاوس|تيموثيوس|طيموثاوس|تيموزاوس)(?=[\s.,،!؟?:]|$)/g,'$1$2تيموثاوس'); // v132: Timothy as the hearing wrote it on 2026-11-19
    txt=txt.replace(/معلم\s+نبولس/g,'معلمنا بولس').replace(/(^|\s)نبولس/g,'$1بولس').replace(/معلم\s+نبطرس/g,'معلمنا بطرس');
    var names=nameWords();if(!names.length)return txt;
    var real=realWords();
    return txt.split(/(\s+)/).map(function(w){
      var n=normAr(w);if(n.length<5)return w;
      var lead=/^(و|ل|ب|ف|ال|وال|بال|لل)/.exec(n),core=n,pre='';
      if(real[n]||(lead&&real[n.slice(lead[0].length)])||(/^[وفبل]/.test(n)&&real[n.slice(1)]))return w;
      for(var k=0;k<names.length;k++){if(names[k][0]===n)return w}
      var best=null,bd=9;
      names.forEach(function(p){var d=editDist(n,p[0]);if(d<bd){bd=d;best=p;pre=''}
        if(lead){var d2=editDist(n.slice(lead[0].length),p[0]);if(d2<bd&&n.length-lead[0].length>=5){bd=d2;best=p;pre=lead[0]}}});
      var allow=(n.length>=7&&best&&best[0].length>=7&&Math.abs((pre?n.length-pre.length:n.length)-best[0].length)<=1)?2:1;
      if(best&&bd>0&&(pre?n.slice(pre.length):n)[0]!==best[0][0])best=null; // must start with the same letter // short words must at least start with the same letter
      if(best&&bd<=allow&&bd>0){var keepPre=pre&&bd===editDist(n.slice(pre.length),best[0])?w.slice(0,pre.length):'';return keepPre+best[1]}
      return w;
    }).join('');
  }
  // ---- a name Whisper spelled wrongly is put right before translating: only a word that is not a real Arabic word, one sound-alike letter away from one clear name in the church list
  // (Timothy written تيموساوس). Single capitalised names only, never a title or a common word, so ordinary words are never touched.
  var HARDN=null,NOTNAME=/^(?:Pelagian|Arian|Nestorian|Apollinarian|Melkites|Jacobites|Euchologion|Anaphora|Alleluia|Paremhat|Parmouti)$/;
  function hardNameList(){if(HARDN)return HARDN;var out=[];(window.COPTIC_TERMS||[]).forEach(function(t){var a=String(t[0]||''),e=String(t[1]||'');if(/\s/.test(a)||!/^(?:St\. )?[A-Z][a-z]+(?: [A-Z][a-z]+)?$/.test(e))return;if(NOTNAME.test(e))return;var n=normAr(a);if(n.length<6||/^ال/.test(n))return;out.push({a:a,n:n,e:e})});return HARDN=out}
  function hardNames(txt){
    try{
      if(!txt||!/[؀-ۿ]/.test(txt))return txt;
      var bw=bibleWords(),ix=nameIdx(),list=hardNameList();if(!bw||!list.length)return txt;
      var litw=LITWORDS||(LITWORDS=(function(){var w={};(window.COPTIC_LITURGY||[]).forEach(function(p){normAr(p[0]).split(' ').forEach(function(x){w[x]=1})});(window.COPTIC_TERMS||[]).forEach(function(t){normAr(t[0]).split(' ').forEach(function(x){w[x]=1})});return w})());
      var real=realWords();
      function known(n){return !!(bw[n]||litw[n]||ix.map[n]||real[n]||COMMONDIALECT.indexOf(n)>=0)}
      function same1(a,b){return a===b||(a==='ت'&&b==='ط')||(a==='ط'&&b==='ت')}
      return txt.split(/(\s+)/).map(function(w){
        var m=/^([^.,،!؟?:;]*)([.,،!؟?:;]*)$/.exec(w);if(!m)return w;var body=m[1],tail=m[2],n=normAr(body);
        if(n.length<6||known(n))return w;
        var pre='',core=n;if(/^[وبلفك]/.test(n)&&n.length>6){if(known(n.slice(1)))return w;pre=body.charAt(0);core=n.slice(1)}
        var best=null,second=9;
        list.forEach(function(c){if(Math.abs(c.n.length-core.length)>1||!same1(c.n[0],core[0]))return;var d=wdist(core,c.n);if(!best||d<best.d){second=best?best.d:9;best={d:d,c:c}}else if(d<second)second=d});
        if(best&&best.d>0&&best.d<=1&&second-best.d>=0.5){dbg('NAME FIXED '+body+' -> '+best.c.a+' ('+best.c.e+')');return pre+best.c.a+tail}
        return w;
      }).join('');
    }catch(e){return txt}
  }
  function wavBlob(samples){
    var pk=0,k;for(k=0;k<samples.length;k+=7){var a0=Math.abs(samples[k]);if(a0>pk)pk=a0}
    if(pk>0.004&&pk<0.5){var g=Math.min(30,0.6/pk),o=new Float32Array(samples.length);for(k=0;k<samples.length;k++)o[k]=samples[k]*g;samples=o} // quiet phone microphone: bring the loudest part to a healthy level
    var n=samples.length,buf=new ArrayBuffer(44+n*2),v=new DataView(buf);
    function str(o,t){for(var i=0;i<t.length;i++)v.setUint8(o+i,t.charCodeAt(i))}
    str(0,'RIFF');v.setUint32(4,36+n*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
    v.setUint32(24,16000,true);v.setUint32(28,32000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,n*2,true);
    for(var i=0;i<n;i++){var x=Math.max(-1,Math.min(1,samples[i]));v.setInt16(44+i*2,x<0?x*0x8000:x*0x7fff,true)}
    return new Blob([buf],{type:'audio/wav'});
  }
  // ---- second hearing engine: Cohere Transcribe Arabic (text only: it gives no confidence and takes no vocabulary hint) ----
  var cohereBlockedUntil=0,COHERE_MODEL='cohere-transcribe-arabic-07-2026';
  function hearEngine(){if(NO_BACKUP)return 'soniox';var e=S.get('hearEngine','whisper');if(e==='deepgram')return S.get('deepgramKey','')?e:'whisper';if(e==='soniox')return sxHaveKey()?e:'whisper';return (e==='cohere'||e==='compare')&&S.get('cohereKey','')?e:'whisper'}
  var cohereAt=[],COHERE_PER_MIN=4; // Cohere's free trial key allows 5 hearing requests a minute (their rate-limit page, read 2026-11-11): stay just under it, the other pieces go to Whisper
  async function cohereHear(blob,ms){
    if(Date.now()<cohereBlockedUntil)throw new Error('Cohere is resting');
    var now=Date.now();cohereAt=cohereAt.filter(function(t){return now-t<60000});
    if(cohereAt.length>=COHERE_PER_MIN)throw new Error('Cohere trial pace, '+COHERE_PER_MIN+' pieces a minute');
    cohereAt.push(now);
    var fd=new FormData();fd.append('file',blob,'a.wav');fd.append('model',COHERE_MODEL);fd.append('language','ar');fd.append('temperature','0');
    var r;try{r=await fetchT('https://api.cohere.com/v2/audio/transcriptions',{method:'POST',headers:{'authorization':'Bearer '+S.get('cohereKey','')},body:fd},ms||15000)}
    catch(e){throw new Error(e&&e.name==='AbortError'?'Cohere did not answer in time':'this device could not reach Cohere')}
    if(r.status===429){var ra=parseInt(r.headers.get('retry-after')||'30',10);if(!(ra>0))ra=30;cohereBlockedUntil=Date.now()+Math.min(ra,600)*1000;throw new Error('Cohere limit reached, resting '+Math.min(ra,600)+' s')}
    if(r.status===401||r.status===403||r.status===498){cohereBlockedUntil=Date.now()+3600000;throw new Error('Cohere does not accept this key')}
    if(!r.ok){var em='';try{em=(await r.json()).message||''}catch(e){}throw new Error('Cohere error '+r.status+(em?': '+em.slice(0,80):''))}
    return String((await r.json()).text||'').trim();
  }
