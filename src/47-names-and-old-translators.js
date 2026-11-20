  // ---- free translation (MyMemory) ----
  function chunk(t){var w=t.split(/\s+/),out=[],cur='';w.forEach(function(x){if((cur+' '+x).length>450){out.push(cur);cur=x}else cur=cur?cur+' '+x:x});if(cur)out.push(cur);return out}
  async function mymemory(text){
    var parts=chunk(text),out=[];
    for(var i=0;i<parts.length;i++){
      var u='https://api.mymemory.translated.net/get?q='+encodeURIComponent(parts[i])+'&langpair=ar|en'+(S.get('email','')?'&de='+encodeURIComponent(S.get('email','')):'');
      var r=await fetch(u),j=await r.json();
      if(j.responseStatus&&j.responseStatus!==200)throw new Error(j.responseDetails||('code '+j.responseStatus));
      out.push(j.responseData.translatedText);
    }
    return out.join(' ');
  }
  var SYS_MIXED=' The speaker sometimes switches to English: if the new sentence is already English, return it as he said it, lightly cleaned, do not translate it into anything else. He also drops English words and short English phrases into Arabic sentences, and every English word he says must appear on the screen exactly as that English word, spelled correctly. English that arrives in English letters is kept as it is, never translated or replaced. He also uses English words that the recognizer writes in Arabic letters: these are English, not Arabic, and the recognizer often writes them in Arabic letters, where they can look like a different Arabic word: فن or فان is usually the English word fun (not art) when he talks about enjoyment or says "as they say", and the same goes for words like ستريس (stress), بيزي (busy), ميتنج (meeting), ويك إند (weekend), أوكيه (okay). When an Arabic-looking word sounds like an English word and that English word fits the sentence better, write the English word he said.';
  var SYS='You translate a live Coptic Orthodox church service, spoken in Egyptian Arabic, into natural English for a screen. Most of it is a sermon, but the speaker also makes ordinary announcements (tickets, the festival, building repairs, money, dates, schedules): translate those plainly in everyday words and do not turn them into religious language. The Arabic comes from speech recognition and can have misheard words. Only when the sentence is about faith, Scripture, saints or prayer and a word makes no sense there, treat it as a religious word that sounds similar (examples: المعبدين = المعمدان the Baptist, الأتيم = العتيق the Old Testament, نبولس = Paul, أسنانيس = Athanasius). In an announcement or an everyday sentence, keep the plain meaning of the words. Use the earlier sentences and the usual Coptic English forms for saints, popes, feasts and terms. Always translate أحبائي as "my beloved" and المعرض as "festival". Meaning comes before polish. Write what he means as clear, natural English that a listener can follow at once. Drop hesitation sounds and fillers (آآ, اه, امم, uh, um) and the filler يعني ("I mean", "that is", "you know") when it carries no meaning. Drop false starts and words he repeats by accident (ده ده, إن إن), and put the words in normal English order. Never translate word by word when that gives English that makes no sense: work out what he is saying from the whole sentence and the earlier ones, and say that plainly. This never allows adding, guessing or leaving out real content. When الوعظ does what a person does (says, tells, speaks), it is الواعظ, the preacher; and الواعظ يحل في الكلمة is يحلّي الكلمة, the preacher makes the talk pleasant. Keep every negation exactly (مش, ما...ش, لا, لم, لن, ولا, عمره ما): never turn "did not" into "did" or the reverse. Keep every number, amount of money, currency, date, day, time and percentage exactly as said, and whether money was collected, owed, promised or spent. Never write the name of a person that is not in the Arabic: a garbled or unknown word must never become a name (no Boaz, Judas or any other person he did not say), so leave that part out instead. When several people are named in a row (prayers, condolences, thanks), every word is part of a name: write each first name and family name in English letters and do not drop or translate any of them (ياسر سيدهم is Yasser Sedhom). Keep every name as said, never swap one person for another, and keep a title (Abouna, Anba, Pope, Saint) with the name it was said with; بابا can mean Dad or the Pope, so decide from the sentence. If the speaker corrects himself ("Friday, sorry, Saturday"), keep the correction. Keep repetition he uses for emphasis. In a story or quotation keep clear who is speaking: words said by a person in a story must not read as advice from the speaker himself. Do not add anything that was not said: no extra details, explanation, theology or verse. Scripture: when the speaker is clearly quoting a verse word for word, render it in NKJV wording; when he paraphrases, retells or only alludes to a passage, translate what he actually said and do not complete the verse. Never add a chapter and verse reference he did not say. If part of the sentence is garbled and you cannot tell what was said, leave that part out rather than invent a plausible sentence. Ignore noise and anything that is not the speaker; if there are no words, reply with an empty string. Never write profanity or crude words: if the speaker says one, use a clean, dignified word or leave it out. This is a Christian church: never write Quran, Koran, Islam, Muslim, Mohammed or Allah unless the Arabic plainly says those exact words (the Arabic word الله is God). If a word sounds like one of those but the sentence is about Christian things, it is almost certainly a misheard name or word, so use the Bible or Church name that fits. Output only the English of the NEW sentence.';
  var LITURGY_RULES=" Liturgy and prayers: parts of the talk can be prayers from the Coptic liturgy, said quickly and sometimes misheard. When the Arabic is plainly a standard church prayer and a word is missing or misheard, write the standard wording of that prayer. Fixed wording: أيها السيد الرب الإله ضابط الكل = O Master, Lord God the Pantocrator; ضابط الكل = the Pantocrator (Almighty); ابنك الوحيد / ابنك الوحيد الجنس = Your only-begotten Son, and in a prayer to the Father, الوحيد on its own (the Only-begotten) means His only Son, never 'You alone'; أبو ربنا وإلهنا ومخلصنا يسوع المسيح = the Father of our Lord, God and Savior Jesus Christ; المجد للآب والابن والروح القدس = Glory be to the Father and to the Son and to the Holy Spirit; الآن وكل أوان وإلى دهر الدهور آمين = now and forever and unto the ages of all ages, Amen; كيرياليصون = Lord have mercy; السلام لجميعكم = Peace be with you all; ومع روحك أيضا = And with your spirit; قدوس قدوس قدوس = Holy, Holy, Holy; الإنجيل المقدس = the Holy Gospel; الناموس = the Law. Only restore a word when you are sure which prayer it is; never add a line of prayer that was not said. Translate only what the NEW sentence itself says: when the prayer goes on in the text given as coming AFTER, stop where the NEW sentence stops and never finish the prayer ahead of the speaker."; // v136: standard prayer wording, so a word the hearing drops (ابنك) is put back
  var V110_RULES=" Fixed wording for this church: ما شاء الله = 'God willing'. السرياني / السريان / السريانية = Syriac (the Syriac Orthodox Church), never Syrian. الآباء الأساقفة = the bishops, الآباء الكهنة = the priests. The priests here are Father Rofail (أبونا روفائيل) and Father Mina Shaheid (أبونا مينا شهيد: Shaheid is his family name, not 'martyr'); the deacons are Deacon Botros, Deacon Boules, Deacon Antonious and Deacon Bishoy: when الشماس comes before بطرس, بولس, أنطونيوس or بيشوي, use those spellings (without الشماس, بطرس is Peter and بولس is Paul). جابوا ليسوع / قدموا ليسوع / أحضروا إليه means they brought someone TO Jesus: Jesus is never the one who was brought. In a Gospel healing story مجنون means demon-possessed (not mad), أخرس mute, أعمى blind. حفظ الألحان means learning the hymns by heart and تحفيظ الألحان teaching them, never keeping them. About a day or an event, ما بتتكررش / ما كانتش تتكرر (أبداً) / مش بتتكرر كتير describes a rare day: write 'that hardly ever comes around' (or 'that is hardly ever repeated'); never write that it never came again or never happened again. When he begins a verse and stops (for example حينئذ أحضر, the opening of 'Then one was brought to Him'), translate only the words he said and stop there: never add what happened next (no 'He healed him'). The word صحيح in the middle of a sentence means 'it is true that' or 'admittedly' (وهي كنائس صحيح بالنسبة للكنائس الإيسترن أقل بكثير = It is true that these churches are far fewer than the Eastern churches). أقل and أكتر about churches, people or things mean fewer and more in number. When he compares stories or Sundays, الأول / التاني mean in the first one / in the second one. English words he says inside the Arabic, even when written in Arabic letters (بيرفكت, البيج إيفينتس), are written as those English words with nothing added. Never add a word the Arabic does not contain: when a phrase sounds garbled, translate only the clear words and never guess a church word (baptize, communion, confession and the like) that was not said. Never give alternatives in brackets or slashes; write one plain wording. بسم الآب والابن والروح القدس الإله الواحد آمين is always: In the name of the Father, and the Son, and the Holy Spirit, one God. Amen. (the hearing often writes it as بسم الله). تيموثاوس is Timothy, one person (St. Paul wrote two letters to him): لأهل تيموثاوس or إلى تيموثاوس = to Timothy. Never turn a word you do not recognize into a new English name or place that does not exist (no 'Zimsius'): if a name is not a real person, place or Bible book you know, leave that word out of the English."+LITURGY_RULES;SYS=SYS.replace(' Output only the English of the NEW sentence.',V110_RULES+' Output only the English of the NEW sentence.');
  var groqBlockedUntil=0;

  // -- Bible names: a local list (names.js) used to hint the translator and to repair names speech recognition got slightly wrong --
  var NAMEIDX=null,BIBLEWORDS=null,LITWORDS=null,COMMONDIALECT='اللي الي ليه ايوه ايوا كمان تاني دلوقتي النهارده امبارح بكره عشان علشان بتاع بتاعه بتاعت اللى الذي التي الذين هذا هذه ذلك تلك كانت كانوا يكون تكون نكون ماذا لماذا كيف اين متي حين اذا لكن بيقول بتقول هيكون هتكون ممكن لازم مش مفيش فيه فيها فيهم منهم منها منه عنهم عنها عنه بينهم بينها'.split(' ');
  function nameIdx(){
    if(NAMEIDX)return NAMEIDX;
    var m={},keys=[];Object.keys(window.BIBLE_NAMES||{}).forEach(function(a){var n=normAr(a);if(n&&!m[n]){m[n]={ar:a,en:window.BIBLE_NAMES[a]};keys.push(n)}});
    NAMEIDX={map:m,keys:keys};return NAMEIDX;
  }
  function bibleWords(){ // every word of the Arabic Bible, so only words that are NOT real Arabic words get repaired
    if(BIBLEWORDS)return BIBLEWORDS;if(!window.BIBLE)return null;
    var w={};Object.keys(window.BIBLE).forEach(function(bk){Object.keys(window.BIBLE[bk]).forEach(function(ch){window.BIBLE[bk][ch].forEach(function(v){normAr(v[1]).split(' ').forEach(function(x){w[x]=(w[x]||0)+1})})})});
    BIBLEWORDS=w;return w;
  }
  var SOFT={'ذ':'زد','ز':'ذس','د':'ذض','ض':'دظ','ظ':'ضز','ث':'سش','س':'ثصش','ص':'س','ش':'س','ط':'ت','ت':'ط','ق':'كء','ك':'ق','ع':'ءا','ء':'عا','ه':'ا','ي':'ا'};
  function wdist(a,b){ // letter distance where sound-alike letters and the soft letters ا ي و ه cost half
    var m=a.length,n=b.length,p=[],i,j;for(j=0;j<=n;j++)p[j]=j*(/[اويه]/.test(b[j-1]||'')?0.5:1)*(j?1:0);p[0]=0;
    var cum=0;for(j=1;j<=n;j++){cum+=/[اويه]/.test(b[j-1])?0.5:1;p[j]=cum}
    for(i=1;i<=m;i++){var prev=p[0];p[0]+=/[اويه]/.test(a[i-1])?0.5:1;
      for(j=1;j<=n;j++){var t=p[j],ca=a[i-1],cb=b[j-1],sub=ca===cb?0:((SOFT[ca]||'').indexOf(cb)>=0?0.5:1);
        p[j]=Math.min(p[j]+(/[اويه]/.test(ca)?0.5:1),p[j-1]+(/[اويه]/.test(cb)?0.5:1),prev+sub);prev=t}}
    return p[n];
  }
  function nameGuesses(txt){ // words that are not real Bible or church words but sound like one Bible name: offered to the translator as a maybe, never rewritten
    var bw=bibleWords(),ix=nameIdx(),out=[];if(!bw||!ix.keys.length)return out;
    var litw=LITWORDS||(LITWORDS=(function(){var w={};(window.COPTIC_LITURGY||[]).forEach(function(p){normAr(p[0]).split(' ').forEach(function(x){w[x]=1})});(window.COPTIC_TERMS||[]).forEach(function(t){normAr(t[0]).split(' ').forEach(function(x){w[x]=1})});return w})());
    var seen={};
    normAr(txt).split(' ').forEach(function(n){
      if(n.length<4||seen[n]||bw[n]||litw[n]||ix.map[n]||COMMONDIALECT.indexOf(n)>=0)return;seen[n]=1;
      if(/^[وبلفك]/.test(n)&&n.length>4){var rest=n.slice(1);if(bw[rest]||litw[rest]||ix.map[rest])return}
      var best=null,second=9;
      ix.keys.forEach(function(k){if(k.length<4||Math.abs(k.length-n.length)>2)return;var d=wdist(n,k);if(!best||d<best.d){second=best?best.d:9;best={d:d,k:k}}else if(d<second)second=d});
      if(best&&best.d<=1&&second-best.d>=0.5&&bw[best.k]>=8)out.push([n,ix.map[best.k].ar,ix.map[best.k].en]);
    });
    return out.slice(0,4);
  }
  function namesInSentence(txt){
    var ix=nameIdx(),seen={},out=[];
    normAr(txt).split(' ').forEach(function(w){var k=ix.map[w]||(/^[وبلفك]/.test(w)&&ix.map[w.slice(1)]);if(k&&!seen[k.ar]){seen[k.ar]=1;out.push(k.ar+' = '+k.en)}});
    return out.slice(0,12);
  }
  var SAINT_RE=/قديس|شهيد|شهدا|بابا|انبا|تذكار|نياح|استشهاد|عيد|اعياد|سنكسار|ابونا|البطريرك|الاسقف|الراهب/; // the day's saints cost about 400 tokens: sent only when the sentence is about a saint, a feast or a clergyman
  // "training" that costs nothing: lines the church has already corrected are shown to the translator as examples when a new sentence resembles them,
  // so one approved correction teaches the wording for many later sentences (a near-identical line is still replaced outright by the prayer library)
  function fewShots(ar){
    var c=[];try{rvFixes().forEach(function(p){if(p&&p.ar&&p.fix)c.push([p.ar,p.fix])})}catch(e){}
    try{pairs('prayers').forEach(function(p){if(AR.test(p.a))c.push([p.a,p.b])})}catch(e){}
    if(!c.length)return '';
    var n=normAr(ar),sc=[];c.forEach(function(x){var v=similarity(normAr(x[0]),n);if(v>=0.4&&v<0.95)sc.push([v,x])});
    if(!sc.length)return '';
    sc.sort(function(a,b){return b[0]-a[0]});
    return '\n\nThe church corrected these similar lines before; keep the same wording and names where they apply:\n'+sc.slice(0,3).map(function(y){return y[1][0].slice(0,160)+' = '+y[1][1].slice(0,160)}).join('\n');
  }
  var GLRE={};
  function groqGlossary(ar,prev){
    var hay=' '+normAr(prev+' '+ar)+' ',ex=[],cx=[];
    // whole words only (an attached "and / in / to / the" is allowed): before this, "forever" pulled in "the Father", "the field" pulled in "the truth" and "Benjamin" pulled in "Amen"
    allTermsAll().forEach(function(t){var n=normAr(t.a);if(!n||hay.indexOf(n)<0)return;var re=GLRE[n]||(GLRE[n]=new RegExp('(^| )(?:و|ف|ب|ل|ك)?(?:ال|لل)?'+escRe(n)+'( |$)'));if(!re.test(hay))return;(t.c?cx:ex).push(t.a+' = '+t.b)});
    var out='',nm=namesInSentence(ar),ng=nameGuesses(ar);
    if(nm.length)out+='\n\nBible names in this sentence (spell them this way): '+nm.join('; ');
    if(ng.length)out+='\n\nThese words are not normal Arabic and sound like Bible names; they were almost certainly misheard as these names, so use the name unless the sentence clearly means something else: '+ng.map(function(x){return x[0]+' = '+x[1]+' ('+x[2]+')'}).join('; ');
    if(ex.length)out+='\n\nTranslate these terms exactly this way:\n'+ex.join('\n');
    if(cx.length)out+='\n\nIn church context these words usually mean the following; use it when it fits the sentence:\n'+cx.join('\n');
    try{out+=fewShots(ar)}catch(e){}
    return out;
  }
  // Groq retires models from time to time (llama-3.3-70b-versatile and llama-3.1-8b-instant ended 16 Aug 2026): ask Groq what this key can use
  var MODELS={chat:'openai/gpt-oss-120b',fast:'openai/gpt-oss-20b',asr:'whisper-large-v3',asrFast:'whisper-large-v3-turbo',ready:false};
  var PREF_CHAT=['openai/gpt-oss-120b','qwen/qwen3.6-27b','llama-3.3-70b-versatile','llama-3.1-70b-versatile'];
  var PREF_FAST=['openai/gpt-oss-20b','llama-3.1-8b-instant','openai/gpt-oss-120b'];
  var PREF_ASR=['whisper-large-v3','whisper-large-v3-turbo'];
  var BAD={},REASON_OK=LEARN.reasonOk!==false;
  if(LEARN.pool&&LEARN.pool.length)POOL=LEARN.pool;
  if(LEARN.models){MODELS.chat=LEARN.models.chat||MODELS.chat;MODELS.fast=LEARN.models.fast||MODELS.fast;MODELS.asr=LEARN.models.asr||MODELS.asr;MODELS.asrFast=LEARN.models.asrFast||MODELS.asrFast}
  function pick(ids,pref,fallback){for(var i=0;i<pref.length;i++)if(ids.indexOf(pref[i])>=0&&!BAD[pref[i]])return pref[i];return fallback}
  async function chatProblem(r,model){ // a model that is gone, or a setting this model dislikes: learn from it so the next piece works
    if(r.ok)return;
    var msg='';try{msg=((await r.clone().json()).error||{}).message||''}catch(e){}
    if(r.status===404||/does not exist|not have access|decommission|model_not_found/i.test(msg)){BAD[model]=1;dbg('MODEL unavailable: '+model+' ('+msg.slice(0,80)+')');await loadModels()}
    else if(r.status===400&&REASON_OK&&/reason|include|effort|param/i.test(msg)){REASON_OK=false;LEARN.reasonOk=false;learnSave();dbg('Reasoning options refused, retrying plain: '+msg.slice(0,80))}
  }
  async function loadModels(){
    if(NO_BACKUP||!S.get('groqKey',''))return; // v84: no Groq at all, not even its list of models
    try{
      var r=await fetchT('https://api.groq.com/openai/v1/models',{headers:{'authorization':'Bearer '+S.get('groqKey','')}},8000);
      if(!r.ok){dbg('MODELS list failed '+r.status);return}
      var j=await r.json(),ids=(j.data||[]).map(function(m){return m.id});
      MODELS.chat=pick(ids,PREF_CHAT,MODELS.chat);MODELS.fast=pick(ids,PREF_FAST,MODELS.fast);
      MODELS.asr=pick(ids,PREF_ASR,MODELS.asr);MODELS.asrFast=ids.indexOf('whisper-large-v3-turbo')>=0?'whisper-large-v3-turbo':MODELS.asr;MODELS.ready=true;
      dbg('MODELS chat='+MODELS.chat+' fast='+MODELS.fast+' asr='+MODELS.asr+' ('+ids.length+' available)');
      POOL=POOL_ORDER.filter(function(x){return ids.indexOf(x)>=0&&!BAD[x]});ids.forEach(function(x){if(/^qwen\/qwen3/.test(x)&&!BAD[x]&&POOL.indexOf(x)<0)POOL.splice(Math.min(1,POOL.length),0,x)});if(!POOL.length)POOL=[MODELS.chat,MODELS.fast];dbg('POOL '+POOL.join(', '));
      LEARN.models={chat:MODELS.chat,fast:MODELS.fast,asr:MODELS.asr,asrFast:MODELS.asrFast};LEARN.pool=POOL;learnSave();
    }catch(e){dbg('MODELS list error '+e.message)}
  }
  // Free plan: each chat model has its own allowance (about 30 requests and 8,000 tokens a minute, 1,000 requests and 200,000 tokens a day).
  // Spread the work across every suitable model the key can use, so a long service never runs one dry.
  var POOL_ORDER=['openai/gpt-oss-120b','qwen/qwen3.8-27b','qwen/qwen3.6-27b','moonshotai/kimi-k2-instruct','meta-llama/llama-4-maverick-17b-128e-instruct','llama-3.3-70b-versatile','openai/gpt-oss-20b','meta-llama/llama-4-scout-17b-16e-instruct','llama-3.1-8b-instant'];
  var POOL=['openai/gpt-oss-120b','openai/gpt-oss-20b'],USE={},COOL={};
  var TPM_SAFE=6500,RPM_SAFE=26,TPD_SAFE=185000,RPD_SAFE=950;
  function useOf(m){var u=USE[m];if(!u){u=USE[m]={min:[],day:{d:today(),tok:0,req:0}};try{var sv=JSON.parse(localStorage.getItem('use_'+m)||'null');if(sv&&sv.d===today())u.day=sv}catch(e){}}if(u.day.d!==today())u.day={d:today(),tok:0,req:0};var cut=Date.now()-60000;while(u.min.length&&u.min[0][0]<cut)u.min.shift();return u}
  function canUse(m,est){
    if(BAD[m]||(COOL[m]&&Date.now()<COOL[m]))return false;
    var u=useOf(m),tok=0;u.min.forEach(function(x){tok+=x[1]});
    return tok+est<TPM_SAFE&&u.min.length<RPM_SAFE&&u.day.tok+est<TPD_SAFE&&u.day.req<RPD_SAFE;
  }
  function noteUse(m,tokens){var u=useOf(m);u.min.push([Date.now(),tokens]);u.day.tok+=tokens;u.day.req++;try{localStorage.setItem('use_'+m,JSON.stringify(u.day))}catch(e){}}
  function budgetLeft(){var tot=0,left=0;POOL.forEach(function(m){if(BAD[m])return;var u=useOf(m);tot+=TPD_SAFE;left+=Math.max(0,TPD_SAFE-u.day.tok)});return tot?left/tot:1}
  function minuteRoom(m){var u=useOf(m),tok=0;u.min.forEach(function(x){tok+=x[1]});return TPM_SAFE-tok}
  function nextFree(est){ // ms until some model can take a request of this size, or Infinity
    var best=Infinity,now=Date.now();
    POOL.forEach(function(m){if(BAD[m])return;var u=useOf(m);if(u.day.tok+est>=TPD_SAFE||u.day.req>=RPD_SAFE)return;var t=0;if(COOL[m]&&now<COOL[m])t=COOL[m]-now;
      var tok=0;u.min.forEach(function(x){tok+=x[1]});var need=tok+est-TPM_SAFE,i=0;while((need>0||u.min.length-i>=RPM_SAFE)&&i<u.min.length){need-=u.min[i][1];t=Math.max(t,u.min[i][0]+60000-now);i++}
      if(t<best)best=t});
    return best;
  }
  var basicCount=0,AVGT={c:0,q:0};
  function pickModel(est,preferFast){
    var order=preferFast?POOL.slice().reverse():POOL;
    for(var i=0;i<order.length;i++)if(canUse(order[i],est))return order[i];
    return null;
  }
  function coolDown(m,r){var ra=parseInt(r.headers.get('retry-after')||'20',10);if(!(ra>0))ra=20;COOL[m]=Date.now()+Math.min(ra,3600)*1000;dbg('MODEL busy, resting '+m+' '+ra+'s')}
  function estTokens(msgs,maxTok){var c=0;msgs.forEach(function(m){c+=m.content.length});return Math.round(c/2.6)+maxTok} // Arabic and English mixed: about 2.6 characters a token
  // v79 Claude Haiku: when it is chosen in Settings and its key is saved, every careful call (finished sentences, the sermon memo) goes to Claude.
  // The quick live words stay on Groq. Any Claude failure falls back to Groq for that call, and a rejected key or empty balance pauses Claude for 10 minutes.
  var CLAUDE_PROXY='https://church-captions.minaypharmd.workers.dev';
  // v122: this device's own id (made once, kept on the device). The church server uses it to show the admin which devices use the app and to refuse a blocked one.
  var DEVSTATE=null,devTold=false;
  function devId(){var v=S.get('devId','');if(/^[a-z0-9]{20}$/.test(v))return v;var a='abcdefghijklmnopqrstuvwxyz0123456789',r=new Uint8Array(20),o='';try{crypto.getRandomValues(r)}catch(e){for(var i=0;i<20;i++)r[i]=Math.floor(Math.random()*256)}for(var j=0;j<20;j++)o+=a[r[j]%36];S.set('devId',o);return o}
  function devCode(){return devId().slice(0,6).toUpperCase()}

