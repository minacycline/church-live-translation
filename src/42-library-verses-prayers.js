  // ---- library: your pairs, today's readings, the liturgy and the Bible, matched by weighted word overlap ----
  var LIB=null,readStatus='';
  function libNote(){var l=getLib();return (window.COPTIC_LITURGY||[]).length+' liturgy lines'+(window.BIBLE?', '+l.bible+' Bible verses':', Bible still loading')+(l.reading?', '+l.reading+' verses from today\'s readings':'')+'.'}
  var STATW=null,STATKEY='';
  function statWords(){ // the liturgy and the Bible never change while the page is open: split them into words once, so a later rebuild does not freeze the sound capture
    var key=(window.COPTIC_LITURGY||[]).length+'|'+(window.BIBLE?1:0);
    if(STATW&&STATKEY===key)return STATW;
    var out=[];
    (window.COPTIC_LITURGY||[]).forEach(function(p){out.push([p[0],p[1],'lit','',words(p[0]),0])});
    if(window.BIBLE){Object.keys(window.BIBLE).forEach(function(bk){var name=(window.BIBLE_BOOKS||{})[bk]||'';Object.keys(window.BIBLE[bk]).forEach(function(ch){var vs=window.BIBLE[bk][ch];vs.forEach(function(v,i){out.push([v[1],v[2],'bible',name+' '+ch+':'+v[0],words(v[1]),i+1<vs.length?1:-1])})})})}
    STATW=out;STATKEY=key;return out;
  }
  function getLib(){
    if(LIB)return LIB;
    var entries=[],idx={},df={};
    function put(a,b,kind,ref,next,w){w=w||words(a);if(!w.length)return;var id=entries.length;entries.push({a:a,b:b,k:kind,r:ref,w:w,n:next});var seen={};w.forEach(function(x){if(seen[x])return;seen[x]=1;(idx[x]=idx[x]||[]).push(id);df[x]=(df[x]||0)+1})}
    pairs('reading').forEach(function(p){put(p.a,p.b,'user')});
    pairs('prayers').forEach(function(p){put(p.a,p.b,'user')});
    rvFixes().forEach(function(p){put(p.ar,p.fix,'user')});
    var rd=autoReadingPairs();rd.forEach(function(p){put(p[0],p[1],'reading')});
    var nb=0;
    statWords().forEach(function(t){if(t[2]==='bible'){put(t[0],t[1],'bible',t[3],t[5]>0?entries.length+1:-1,t[4]);nb++}else put(t[0],t[1],'lit',undefined,undefined,t[4])});
    var N=entries.length;LIB={entries:entries,idx:idx,df:df,idf:function(w){return Math.log((N+1)/((df[w]||0)+1))+0.3},bible:nb,reading:rd.length};
    return LIB;
  }
  function scorePair(A,B,idf){
    var set={},tot=0,hit=0,wb=0;B.forEach(function(w){set[w]=(set[w]||0)+1;wb+=idf(w)});
    A.forEach(function(w){var x=idf(w);tot+=x;if(set[w]){hit+=x;set[w]--}});
    return {contain:tot?hit/tot:0,cover:wb?hit/wb:0};
  }
  function matchOne(ar){
    var L=getLib(),A=words(ar);if(A.length<2)return null;
    var hits={},seen={};
    A.forEach(function(w){if(seen[w])return;seen[w]=1;var ids=L.idx[w];if(!ids||ids.length>600)return;var x=L.idf(w);ids.forEach(function(id){hits[id]=(hits[id]||0)+x})});
    var cand=Object.keys(hits).sort(function(x,y){return hits[y]-hits[x]}).slice(0,40);
    var best=null,bs=0;
    cand.forEach(function(id){
      var e=L.entries[id],sc=scorePair(A,e.w,L.idf),en=e.b,ref=e.r,wl=e.w.length;
      if(sc.contain<0.72&&e.k==='bible'&&e.n>=0){var nx=L.entries[e.n],sc2=scorePair(A,e.w.concat(nx.w),L.idf);if(sc2.contain>sc.contain){sc=sc2;en=e.b+' '+nx.b;ref=e.r+'-'+nx.r.split(':')[1];wl+=nx.w.length}}
      var ok;
      if(A.length<=3)ok=sc.contain>=0.95&&wl<=A.length+1;
      else if(A.length<=5)ok=sc.contain>=0.85&&wl<=A.length*1.6+2;
      else ok=sc.contain>=0.72&&wl<=A.length*2.5+2;
      if(e.k==='user'&&A.length>3)ok=ok||sc.contain>=0.65&&wl<=A.length*3;
      var total=sc.contain+0.3*sc.cover+(e.k==='user'?0.2:e.k==='reading'?0.1:0);
      if(ok&&total>bs){bs=total;best={b:en,ref:e.k==='bible'?ref:'',k:e.k,n:wl}}
    });
    return best;
  }
  // v118: the opening "In the name of the Father, and the Son, and the Holy Spirit, one God. Amen." The hearing often writes بسم الآب as بسم الله and loses والابن,
  // so any sentence that starts with بسم and reaches الروح القدس within a few words is the opening prayer, shown with its fixed English
  var TRINITY_EN='In the name of the Father, and the Son, and the Holy Spirit, one God. Amen.';
  function trinitySplit(ar){
    var tok=String(ar||'').trim().split(/\s+/),nw=tok.map(function(t){return normAr(t)}),b=-1,q=-1,i;
    for(i=0;i<Math.min(3,nw.length);i++){if(nw[i]==='بسم'||nw[i]==='باسم'){b=i;break}}
    if(b<0)return null;
    for(i=b+1;i<Math.min(b+10,nw.length);i++){if(nw[i]==='القدس'&&(nw[i-1]==='الروح'||nw[i-1]==='والروح'||nw[i-1]==='روح')){q=i;break}}
    if(q<0)return trinityLoose(nw,tok,b);
    var end=q;
    for(i=q+1;i<=Math.min(q+7,nw.length-1);i++){if(/^(ال)?امين$/.test(nw[i])){end=i;break}}
    if(end===q&&nw[q+1]&&/^(ال)?اله$/.test(nw[q+1])&&nw[q+2]&&/^(ال)?واحد$/.test(nw[q+2]))end=q+2;
    var rest=tok.slice(end+1).join(' ').trim();
    return {head:tok.slice(0,end+1).join(' '),rest:words(rest).length?rest:''};
  }
  // v126: when the hearing loses الروح القدس (heard: بسم الله. أبو الابن مرقس الأمين), a short sentence that opens with بسم الله/الآب,
  // has the Son or the Spirit in it and ends in آمين within a few words is still the opening prayer, shown with its fixed English only
  function trinityLoose(nw,tok,b){
    var n1=nw[b+1]||'';if(!/^(الله|الاب|اب|للاب|ابونا)$/.test(n1))return null;
    var end=-1,i,mark=false;
    for(i=b+1;i<Math.min(b+9,nw.length);i++){if(/^(و)?(ال)?(ابن|روح|قدس)$/.test(nw[i]))mark=true;if(/^(ال)?امين$/.test(nw[i])){end=i;break}}
    if(end<0||!mark)return null;
    var rest=tok.slice(end+1).join(' ').trim();
    return {head:tok.slice(0,end+1).join(' '),rest:words(rest).length?rest:''};
  }
  function trinityWhole(ar){var t=trinitySplit(ar);return t&&!t.rest?{b:TRINITY_EN,ref:'',k:'lit'}:null}
  function matchPrayer(ar){
    var tw=trinityWhole(ar);if(tw)return tw;
    var m=matchOne(ar);if(m)return m;
    var parts=ar.split(/[.؟!?:؛]+/).map(function(x){return x.trim()}).filter(function(x){return words(x).length>=3});
    if(parts.length>1&&parts.length<=4){
      var out=[],ref='',total=0,matched=0;
      for(var i=0;i<parts.length;i++){var n=words(parts[i]).length;total+=n;var r=matchOne(parts[i]);if(!r)return null;matched+=n;out.push(r.b);if(r.ref)ref=ref?ref+'; '+r.ref:r.ref}
      if(matched/total>=0.8)return {b:out.join(' '),ref:ref};
    }
    return null;
  }
