  // ---- today's readings from the Coptic lectionary (api.katameros.app, free, MIT) ----
  function autoReadingPairs(){try{var o=JSON.parse(S.get('autoReading','{}'));return o.date===today()&&o.pairs?o.pairs:[]}catch(e){return []}}
  function verseMap(day){
    var m={};(day.sections||[]).forEach(function(sec){(sec.subSections||[]).forEach(function(ss){(ss.readings||[]).forEach(function(r){(r.passages||[]).forEach(function(p){(p.verses||[]).forEach(function(v){m[sec.id+'/'+ss.id+'/'+r.id+'/'+p.bookId+'/'+p.chapter+'/'+v.number]=(v.text||'').trim()})})})})});
    return m;
  }
  function loadReadings(){
    if(S.get('autoRead','1')!=='1'){readStatus='';return}
    if(autoReadingPairs().length){readStatus='Loaded for today ('+autoReadingPairs().length+' verses).';return}
    var d=new Date(),ds=('0'+d.getDate()).slice(-2)+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+d.getFullYear();
    readStatus='Loading…';
    Promise.all([2,3].map(function(l){return fetch('https://api.katameros.app/readings/gregorian/'+ds+'?languageId='+l).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})}))
      .then(function(res){
        var en=verseMap(res[0]),ar=verseMap(res[1]),pairsOut=[];
        Object.keys(ar).forEach(function(k){if(en[k]&&ar[k])pairsOut.push([ar[k],en[k]])});
        S.set('autoReading',JSON.stringify({date:today(),title:res[0].title||'',pairs:pairsOut}));LIB=null;setTimeout(function(){try{getLib()}catch(e){}},0);
        readStatus=pairsOut.length?'Loaded for today ('+pairsOut.length+' verses). '+(res[0].title||''):'Nothing came back for today.';readyRefresh();
        if($('readStatus'))$('readStatus').textContent=readStatus;
      }).catch(function(e){readStatus='Could not load today\'s readings ('+e.message+'). Paste them under Today\'s reading if you need them.';if($('readStatus'))$('readStatus').textContent=readStatus});
  }
  function allTerms(){
    var list=pairs('terms');
    if(S.get('builtin','1')==='1'){
      var seen={};list.forEach(function(p){seen[p.a]=1});
      (window.COPTIC_TERMS||[]).forEach(function(t){if(!t[2]&&!seen[t[0]]){seen[t[0]]=1;list.push({a:t[0],b:t[1]})}});
    }
    return list.sort(function(x,y){return y.a.length-x.a.length});
  }
  function applyTerms(ar){
    var list=allTerms();
    list.forEach(function(p){
      if(AR.test(p.a)){
        // whole word only, allowing one attached prefix letter (و ب ل ف ك)
        var re=new RegExp('(^|[^\u0600-\u06FF])([وبلفك]?)'+arPat(p.a)+'(?![\u0600-\u06FF])','g');
        ar=ar.replace(re,function(m,pre,letter){return pre+(letter==='و'?'و ':'')+' '+p.b+' '});
      }
    });
    return {ar:ar,fixEn:function(text){
      text=text.replace(/\s+/g,' ').trim();
      list.forEach(function(p){if(!AR.test(p.a))text=text.replace(new RegExp('\\b'+escRe(p.a)+'\\b','gi'),p.b)});
      return text;
    }};
  }
  $('builtinList').textContent=(window.COPTIC_TERMS||[]).map(function(p){return p[0]+' = '+p[1]}).join('\n');

