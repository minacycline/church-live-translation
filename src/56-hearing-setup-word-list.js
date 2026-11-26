  // ---- streaming hearing engine (Deepgram Nova-3, Egyptian Arabic): one open line, sound goes up as it happens, words come back while he is still speaking ----
  // While the line is up the pieces-and-Whisper path rests; if the line drops, Whisper takes over at once and the line is retried in the background.
  var DG={ws:null,live:false,seg:[],segAt:0,interim:'',tries:0,timer:null,sent:0,lastTr:0,trBusy:false,gen:0,keep:null,opened:0};
  function streamEngine(){var e=hearEngine();return e==='deepgram'||e==='soniox'?e:''}
  function dgWanted(){return running&&!paused&&!!streamEngine()}
  function pauseListening(){
    if(!running||paused)return;paused=true;dbg('PAUSED');
    try{clearTimeout(SX.holdT);SX.heldAt=0;var sa=(SX.ar+SX.nfAr).replace(/\s+/g,' ').trim();if(sa){var se=(SX.en+SX.nfEn).replace(/\s+/g,' ').trim();SX.ar='';SX.en='';SX.nfAr='';SX.nfEn='';SX.tk=[];dgFinal(sa,se)}}catch(e){} // the sentence he was in the middle of is finished first
    try{if(!DG.live&&speechSamples/SR16>0.7)cutChunk(false)}catch(e){}
    try{dgClose()}catch(e){}try{rec&&rec.stop()}catch(e){}
    liveEn='';ui();render();setStatus('Paused. Press Resume to carry on.');
  }
  function resumeListening(){
    if(!running||!paused)return;paused=false;dbg('RESUMED');lastSpeechAt=Date.now();lastResult=Date.now();
    try{if(useWhisper()&&streamEngine())dgOpen()}catch(e){}try{if(rec&&!useWhisper())rec.start()}catch(e){}
    ui();setStatus('Listening');
  }
  var SXCUT=0; // 0 full opening message; 1 fewer terms; 2 no context; 3 no built-in English; 4 the previous model
  var SX={ar:'',en:'',nfAr:'',nfEn:'',at:0,shown:0}; // Soniox sends small word pieces: finished ones are added once, unfinished ones are replaced by every message
  var EN_MIX=['translate','translation','translator','fun','stress','busy','meeting','weekend','okay','already','sorry','please','thank you','of course','actually','anyway','problem','project','budget','schedule','deadline','email','message','online','website','link','phone','job','work','boss','team','family','kids','teenagers','youth','school','college','homework','party','trip','retreat','camp','volunteer','service','community','relationship','communication','attitude','priority','balance','challenge','depression','anxiety','social media','video','game','mall','shopping','business','money','mortgage','insurance','parking','basement','building','fundraiser','donation']; // v148: translate, translation, translator first (Mina's English "translate" was heard as تنازلات, concessions)
  var BIBLE_NAMES=[["تيموثاوس", "Timothy"], ["تيطس", "Titus"], ["فليمون", "Philemon"], ["كورنثوس", "Corinth"], ["أهل كورنثوس", "the Corinthians"], ["أفسس", "Ephesus"], ["أهل أفسس", "the Ephesians"], ["فيلبي", "Philippi"], ["أهل فيلبي", "the Philippians"], ["كولوسي", "Colossae"], ["أهل كولوسي", "the Colossians"], ["غلاطية", "Galatia"], ["أهل غلاطية", "the Galatians"], ["رومية", "Rome"], ["أهل رومية", "the Romans"], ["تسالونيكي", "Thessalonica"], ["أهل تسالونيكي", "the Thessalonians"], ["العبرانيين", "the Hebrews"], ["برنابا", "Barnabas"], ["سيلا", "Silas"], ["أبلوس", "Apollos"], ["أكيلا", "Aquila"], ["بريسكلا", "Priscilla"], ["أنسيمس", "Onesimus"], ["أنطاكية", "Antioch"], ["أورشليم", "Jerusalem"], ["السامرة", "Samaria"], ["الناصرة", "Nazareth"], ["كفرناحوم", "Capernaum"], ["بيت لحم", "Bethlehem"], ["بيت عنيا", "Bethany"], ["لعازر", "Lazarus"], ["مرثا", "Martha"], ["زكا", "Zacchaeus"], ["نيقوديموس", "Nicodemus"], ["بيلاطس", "Pilate"], ["هيرودس", "Herod"], ["إيليا", "Elijah"], ["أليشع", "Elisha"], ["إشعياء", "Isaiah"], ["إرميا", "Jeremiah"], ["حزقيال", "Ezekiel"], ["دانيال", "Daniel"], ["يونان", "Jonah"], ["صموئيل", "Samuel"], ["سليمان", "Solomon"], ["نحميا", "Nehemiah"], ["أيوب", "Job"], ["أستير", "Esther"], ["راعوث", "Ruth"]]; // v132: names and places the hearing did not know (it wrote تيموثاوس as زيمسيوس)
  try{BIBLE_NAMES.slice().reverse().forEach(function(t){(window.COPTIC_TERMS=window.COPTIC_TERMS||[]).push(t)})}catch(e){}
  var CHURCH_WORDS=[["شهر توت","the month of Tout"],["شهر بابه","the month of Baba"],["شهر طوبة","the month of Touba"],["شهر أمشير","the month of Amshir"],["شهر برمهات","the month of Baramhat"],["شهر برمودة","the month of Baramouda"],["شهر بشنس","the month of Bashans"],["شهر بؤونة","the month of Paona"],["شهر أبيب","the month of Epep"],["شهر مسرى","the month of Mesra"],["الشهر الصغير","the Little Month (Nasie)",true],["سبت الفرح","Joyous Saturday"],["شم النسيم","Sham El-Nessim (the spring holiday after Easter)"],["الخماسين","the Holy Fifty Days (after Easter)",true],["ليلة أبو غلمسيس","Apocalypse Night (the eve of Joyous Saturday)"],["أبو غلمسيس","Apocalypse Night"],["صلاة القسمة","the Fraction prayer"],["القسمة","the Fraction (a prayer in the Liturgy); otherwise sharing or dividing",true],["المستير","the Communion spoon"],["الأغنسطس","the reader (Anagnostis)"],["عيد العذراء","the Feast of the Virgin Mary"],["صعود جسد العذراء","the Assumption of the body of the Virgin Mary"],["عيد الملاك ميخائيل","the Feast of Archangel Michael"],["الطلبة","the Litany (in church prayers); otherwise the students",true],["أرباع الناقوس","the Verses of the Cymbals"],["الهيتنيات","the Hitens (intercessions)"],["مرد الإنجيل","the Gospel response"],["مرد الإبركسيس","the Praxis response"],["مرد المزمور","the Psalm response"],["الأسبسمس","the Aspasmos (hymn at the kiss of peace)"],["الزفة","the procession (in church); otherwise a wedding procession",true],["التمجيد","the glorification (hymns for a saint)",true],["صلاة الستار","the Prayer of the Veil"],["صلاة نصف الليل","the Midnight prayer"],["صلاة الساعة الثالثة","the Third Hour prayer"],["صلاة الساعة السادسة","the Sixth Hour prayer"],["صلاة الساعة التاسعة","the Ninth Hour prayer"],["ميطانيات","metanoias (prostrations)"],["مطانيات","metanoias (prostrations)"],["الإيغومانوس","the Hegumen"],["الخوري إبسكوبس","the chorbishop"],["المكرسة","the consecrated woman",true],["أمين الخدمة","the head of the service"],["درس الكتاب المقدس","Bible study"],["درس الكتاب","Bible study"]]; // v157: every Coptic month after the word for month, and church words the word file did not have (kept here so they reach the test link first)
  try{CHURCH_WORDS.forEach(function(t){(window.COPTIC_TERMS=window.COPTIC_TERMS||[]).push(t)})}catch(e){}
  var LITURGY_TERMS=['أيها السيد الرب الإله ضابط الكل','ضابط الكل','ابنك الوحيد','ابنك الوحيد الجنس','أبو ربنا وإلهنا ومخلصنا يسوع المسيح','المجد للآب والابن والروح القدس','الآن وكل أوان وإلى دهر الدهور آمين','كيرياليصون','السلام لجميعكم','ومع روحك أيضا','قدوس قدوس قدوس','الإنجيل المقدس','الناموس والوصايا'];
  function sxStart(){ // what Soniox is told before the sound starts: the language, the kind of talk, the church words, and how certain terms must be translated
    var mixed=S.get('lang','mixed')==='mixed',terms=[],tt=[],seen={};
    try{nameTerms().slice(0,80).forEach(function(t){terms.push(t)})}catch(e){}
    BIBLE_NAMES.forEach(function(t){if(terms.indexOf(t[0])<0)terms.push(t[0])});
    terms.slice().forEach(function(t){var m=/^(?:القديس|القديسة|الأنبا|البابا|الشهيد|الشهيدة)\s+([^\s]{4,})/.exec(t);if(m&&terms.indexOf(m[1])<0)terms.push(m[1])}); // v137: the name on its own (أثناسيوس), not only inside a title
    LITURGY_TERMS.forEach(function(t){if(terms.indexOf(t)<0)terms.unshift(t)}); // v136: standard prayer phrases, so the hearing expects them
    try{dateTerms().slice().reverse().forEach(function(t){var i=terms.indexOf(t);if(i>=0)terms.splice(i,1);terms.unshift(t)})}catch(e){} // v157: today's Coptic month, the season's words and the day's saints, ahead of the general names
    terms.unshift('بسم الآب والابن والروح القدس الإله الواحد آمين','الآب','الابن'); // v118: the opening prayer, so بسم الآب is not heard as بسم الله
    if(mixed&&SXCUT<1)EN_MIX.forEach(function(t){terms.push(t)}); // v87: English words Egyptian speakers mix into Arabic, so the hearing writes them in English letters
    try{dateTT().forEach(function(p){if(!seen[p[0]]){seen[p[0]]=1;tt.push({source:p[0],target:p[1]})}})}catch(e){} // v157: 'the month of Hatour' first, so it is never the pair cut for size
    try{allTermsAll().forEach(function(t){if(tt.length>=110||t.c||!AR.test(t.a)||seen[t.a])return;seen[t.a]=1;tt.push({source:t.a,target:t.b})})}catch(e){}
    if(SXCUT>=1){terms=terms.slice(0,30);tt=[]}
    var ctx={general:[{key:'domain',value:'Coptic Orthodox Christian sermon and liturgy'},{key:'language',value:'Egyptian Arabic'+(mixed?' with some English':'')},{key:'organization',value:String(S.get('title','')).slice(0,80)}],terms:terms,translation_terms:tt};
    var notes=S.get('notes','').trim();ctx.text='The speaker usually opens with: بسم الآب والابن والروح القدس الإله الواحد آمين (In the name of the Father, the Son and the Holy Spirit, one God, Amen).'+(notes?' '+notes.slice(0,600):'');
    var cl=function(){return JSON.stringify(ctx).length},c0=cl();while(cl()>8500&&ctx.translation_terms.length>40)ctx.translation_terms.pop();if(cl()!==c0)dbg('STREAM word list trimmed to fit the hearing service: '+c0+' to '+cl()+' characters'); // v137: Soniox refuses a list past about 10,000 characters, and 8,562 is the size that ran in church tests
    var cfg={model:SXCUT>=4?'stt-rt-v5':'stt-rt-v6',audio_format:'pcm_s16le',sample_rate:16000,num_channels:1,language_hints:mixed?['ar','en']:['ar'],enable_endpoint_detection:true};
    if(mixed&&SXCUT<1)cfg.enable_language_identification=true; // v86: the hearing decides word by word whether he spoke Arabic or English, so English words are written in English letters
    if(SXCUT<2)cfg.context=ctx;
    if(SXCUT<3)cfg.translation={type:'one_way',target_language:'en'};
    return cfg;
  }
  var UNSURE_AT=0.5; // v68: a word the live hearing scored below this is treated as unclear (a starting value, not yet tuned on church recordings)
  function sxUnsure(tk){ // the small pieces are joined back into words; a word is as sure as its least sure piece
    var out=[],w='',c=1,push=function(){var x=w.trim();if(x&&c<UNSURE_AT&&AR.test(x)&&out.indexOf(x)<0)out.push(x);w='';c=1};
    (tk||[]).forEach(function(k){var t=String(k[0]||'');if(/^\s/.test(t))push();w+=t;if(typeof k[1]==='number'&&k[1]<c)c=k[1];if(/\s$/.test(t))push()});push();
    return out.slice(0,6);
  }
  function sxClose(fa){SX.heldAt=0;clearTimeout(SX.holdT);DG.segAt=SX.at;SX.ar='';SX.at=0;var sx=SX.en.replace(/\s+/g,' ').trim();SX.en='';var ne=!!SX.noEn;if(ne)sx=undefined;curUnsure=sxUnsure(SX.tk);SX.tk=[];dgFinal(fa,sx);curUnsure=null;SX.tail=ne?{en:'-'}:lastSxItem}
