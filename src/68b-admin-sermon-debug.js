  // ---- v155: Sermon Debug (admin link only). After each sermon Claude writes the mistakes it found into the 'Sermon Debug' tab of the
  // church sheet (weekly, Sunday night). This window lists them per sermon: date, time, device and place on top, then one row per
  // mistake with the minute, the Arabic word, the English that was typed and the English it should be. Colour = how sure the
  // suggestion is: green sure, yellow unsure, red very unsure (no suggestion, Mina types what was said). A checkbox on the side of
  // every row, Select all / Select all green, then Approve, Not a mistake or Dismiss (v156: a slip not worth a fix, e.g. the microphone was far; never taught). Approving teaches nothing by itself: approved rows
  // wait in the sheet until a build uses them. The same list is in the Qik dashboard (Church Translation, Sermon Debug).
  // Road: this page -> n8n webhook church-sermon-debug on the mini (it asks the church server /check whether the sign-in is real
  // before it reads or writes anything) -> the sheet. When the mini is off, the window says so and nothing is lost.
  (function(){
    if(!ADMINVIEW)return;
    var dv=$('devBtn');if(!dv)return;
    var SD_URL='https://mini.tail99f4f6.ts.net/webhook/church-sermon-debug';
    var b=document.createElement('button');b.className='icon';b.id='sdBtn';b.type='button';b.setAttribute('aria-label','Sermon Debug');b.innerHTML='🔎<span id="sdBadge"></span>';
    dv.parentNode.insertBefore(b,dv.nextSibling);
    var st=document.createElement('style');
    st.textContent='#sdBtn{display:none;position:relative}body.adminview.adminok:not(.running) #sdBtn{display:inline-flex;align-items:center;justify-content:center}'
      +'#sdBadge{position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:#2563eb;color:#fff;font:700 12px/20px system-ui,sans-serif;text-align:center;display:none}#sdBadge.on{display:block}'
      +'#sdDlg{width:min(760px,96vw);max-height:92vh;padding:20px;background:#fff;color:#16171a;border:1px solid #e3ddd2;border-radius:14px;font-family:-apple-system,"Segoe UI",system-ui,sans-serif}'
      +'#sdDlg h2{margin:0 0 10px;font-size:24px;color:#16171a;font-family:inherit}'
      +'#sdDlg button{min-height:40px;padding:0 14px;border-radius:10px;border:1px solid #d6d0c4;background:#fff;color:#16171a;font:600 15px system-ui,sans-serif;cursor:pointer}'
      +'#sdDlg button:disabled{opacity:.35;cursor:default}#sdDlg button.go{background:#15803d;border-color:#15803d;color:#fff}#sdDlg button.lnk{min-height:0;padding:0;border:0;background:none;color:#6e6a63;font:500 13px system-ui,sans-serif;text-decoration:underline}'
      +'#sdDlg .cnote{font-size:14px;line-height:1.45;color:#4b4f58;margin:8px 0}#sdDlg .cnote.bad{color:#9a3412;font-weight:600}#sdDlg .cnote.ok{color:#15803d;font-weight:600}'
      +'#sdDlg .sds{border:1px solid #e3ddd2;border-radius:12px;margin:0 0 12px;overflow:hidden}'
      +'#sdDlg .sdh{display:flex;width:100%;gap:10px;align-items:center;text-align:left;border:0;border-radius:0;background:#f4f1ea;padding:10px 12px;min-height:0}'
      +'#sdDlg .sdh span{display:flex;flex-direction:column}#sdDlg .sdh span:first-child{flex:1}#sdDlg .sdh span:last-child{align-items:flex-end;text-align:right}#sdDlg .sdh small{font-weight:500;font-size:13px;color:#6e6a63}'
      +'#sdDlg .sdbar,#sdDlg .sdact{display:flex;flex-wrap:wrap;gap:8px;padding:10px 12px}#sdDlg .sdact{position:sticky;bottom:0;background:#fff;border-top:1px solid #efeae0}'
      +'#sdDlg .sdr{display:flex;gap:10px;border-top:1px solid #efeae0;border-left:6px solid #eab308;padding:10px 12px 10px 8px}#sdDlg .sdr.green{border-left-color:#16a34a}#sdDlg .sdr.red{border-left-color:#dc2626}'
      +'#sdDlg .sdr input[type=checkbox]{width:24px;height:24px;margin:2px 2px 0}#sdDlg .sdb{flex:1;min-width:0}'
      +'#sdDlg .sdt{font-size:13px;color:#6e6a63}#sdDlg .sdt b{color:#16171a;font-variant-numeric:tabular-nums;margin-right:8px}'
      +'#sdDlg .sdar{font-size:20px;line-height:1.5;text-align:right;margin:4px 0}'
      +'#sdDlg .sdl{display:flex;gap:8px;font-size:15px;line-height:1.4;margin:2px 0}#sdDlg .sdl i{flex:0 0 80px;font-style:normal;font-size:13px;color:#6e6a63;padding-top:2px}#sdDlg .sdl b{flex:1;min-width:0;font-weight:600}'
      +'#sdDlg .green .sdl.sg b{color:#15803d}#sdDlg .yellow .sdl.sg b{color:#a16207}#sdDlg .red .sdl.sg b{color:#b91c1c}'
      +'#sdDlg .sdown{width:100%;box-sizing:border-box;margin:6px 0 2px;padding:8px 10px;border:1px solid #d6d0c4;border-radius:10px;font:500 15px system-ui,sans-serif;background:#fff;color:#16171a}'
      +'#sdDlg .sdn{font-size:13px;color:#6e6a63;margin-top:4px}#sdDlg .sdc{font-size:13px;color:#6e6a63;margin-top:6px;padding-top:6px;border-top:1px dashed #e3ddd2}#sdDlg .sdc div:first-child{text-align:right}'
      +'#sdDlg .sdd{display:flex;gap:10px;align-items:baseline;border-top:1px solid #efeae0;padding:8px 12px;font-size:14px}#sdDlg .sdd span{flex:1;min-width:0}#sdDlg .sddn{display:block;margin:6px 12px 10px}';
    document.head.appendChild(st);
    var ROWS=null,AT=0,busy=false,saving=false,SEL={},OWN={},EDIT={},SOPEN={},DOPEN={},MSG='',MSGC='';
    function esc(t){return String(t==null?'':t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
    function sure(v){v=String(v||'').toLowerCase().trim();return v==='green'||v==='red'?v:'yellow'}
    function parse(values){
      var out=[];(values||[]).forEach(function(r,i){
        if(i===0||!r||!String(r[0]||'').trim())return;
        out.push({row:i+1,id:String(r[0]),rep:String(r[1]||''),date:String(r[2]||''),start:String(r[3]||''),device:String(r[4]||''),place:String(r[5]||''),line:String(r[7]||''),min:String(r[8]||''),ar:String(r[9]||''),typed:String(r[10]||''),sug:String(r[11]||''),sure:sure(r[12]),kind:String(r[13]||''),arS:String(r[14]||''),enS:String(r[15]||''),dec:String(r[16]||'').toLowerCase().trim(),own:String(r[17]||''),note:String(r[20]||''),taught:String(r[21]||'')});
      });return out;
    }
    function post(body,ms){
      var ac=('AbortController' in window)?new AbortController():null,o={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'};if(ac)o.signal=ac.signal;
      var t=setTimeout(function(){try{ac&&ac.abort()}catch(e){}},ms||25000);
      return fetch(SD_URL,o).then(function(r){clearTimeout(t);return r.json()},function(e){clearTimeout(t);throw e});
    }
    function say(t,c){MSG=t||'';MSGC=c||''}
    function badge(){var n=ROWS?ROWS.filter(function(r){return !r.dec}).length:0,e=$('sdBadge');if(!e)return;e.textContent=n>99?'99+':String(n);e.classList.toggle('on',n>0);b.setAttribute('aria-label',n?'Sermon Debug, '+n+' to review':'Sermon Debug')}
    function sermons(){
      var m={},order=[];(ROWS||[]).forEach(function(r){var k=r.rep||r.date;if(!m[k]){m[k]={key:k,date:r.date,start:r.start,device:r.device,place:r.place,rows:[]};order.push(k)}m[k].rows.push(r)});
      var list=order.map(function(k){return m[k]});
      list.sort(function(a,c){return (c.date+' '+c.start).localeCompare(a.date+' '+a.start)});
      list.forEach(function(s){s.rows.sort(function(a,c){return (+a.line||0)-(+c.line||0)})});
      return list;
    }
    function dayText(date,start){
      var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(date||'');if(!m)return esc(date||'No date');
      var t=new Date(+m[1],+m[2]-1,+m[3]).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
      var h=/^(\d{1,2}):(\d{2})$/.exec(start||'');if(h){var hh=+h[1],ap=hh>=12?'PM':'AM';hh=hh%12||12;t+=' · '+hh+':'+h[2]+' '+ap}
      return esc(t);
    }
    function ownOf(r){return OWN[r.id]!==undefined?OWN[r.id]:r.own}
    function rowHtml(r){
      var red=r.sure==='red',ed=red||EDIT[r.id],kind=r.kind==='heard'?'Heard wrong':r.kind==='translated'?'Translated wrong':r.kind==='app'?'App':'';
      return '<div class="sdr '+r.sure+'" data-id="'+esc(r.id)+'"><input type="checkbox" data-sd="pick"'+(SEL[r.id]?' checked':'')+' aria-label="Select this row">'
        +'<div class="sdb"><div class="sdt"><b>'+esc(r.min||'?')+'</b>'+(r.sure==='green'?'Sure':red?'Very unsure':'Unsure')+(kind?' · '+kind:'')+'</div>'
        +'<div class="sdar" dir="rtl" lang="ar">'+esc(r.ar)+'</div>'
        +'<div class="sdl"><i>Typed</i><b>'+esc(r.typed)+'</b></div>'
        +'<div class="sdl sg"><i>Should be</i><b>'+(red&&!ownOf(r)?'Not clear. What did he say?':esc(ownOf(r)||r.sug))+'</b></div>'
        +(ed?'<input type="text" class="sdown" data-sd="own" maxlength="300" value="'+esc(ownOf(r))+'" placeholder="'+(red?'Type what it should say':'Your own wording')+'">':'<button type="button" class="lnk" data-sd="edit">Change wording</button>')
        +(r.note?'<div class="sdn">'+esc(r.note)+'</div>':'')
        +(r.arS||r.enS?'<div class="sdc"><div dir="rtl" lang="ar">'+esc(r.arS)+'</div><div>'+esc(r.enS)+'</div></div>':'')
        +'</div></div>';
    }
    function doneHtml(r){
      return '<div class="sdd" data-id="'+esc(r.id)+'"><b>'+esc(r.min||'?')+'</b><span><b>'+(r.dec==='approved'?'Approved':r.dec==='dismissed'?'Dismissed':'Not a mistake')+'</b> '+esc(r.typed)+(r.dec==='approved'?' → '+esc(r.own||r.sug):'')+(r.taught?' <small>(in '+esc(r.taught)+')</small>':'')+'</span>'+(r.taught?'':'<button type="button" class="lnk" data-sd="undo">Undo</button>')+'</div>';
    }
    var dlgS=document.createElement('dialog');dlgS.id='sdDlg';
    dlgS.innerHTML='<h2>🔎 Sermon Debug</h2><div id="sdMsg" class="cnote" role="status"></div><div id="sdBody"></div>'
      +'<div class="actions" style="margin-top:12px;display:flex;gap:8px"><button type="button" id="sdRef">Refresh</button><span style="flex:1"></span><button type="button" id="sdClose">Close</button></div>';
    document.body.appendChild(dlgS);
    function draw(){
      var m=$('sdMsg');m.className='cnote'+(MSGC?' '+MSGC:'');m.textContent=MSG;
      var h='';
      if(!ROWS){$('sdBody').innerHTML='<div class="cnote">'+(busy?'Reading the sermon review list…':'The list has not been read yet.')+'</div>';return}
      var list=sermons();
      if(!list.length)h='<div class="cnote">No sermon has been reviewed yet. A review is added after each sermon of 3 minutes or more (Sunday night).</div>';
      list.forEach(function(s,si){
        var pend=s.rows.filter(function(r){return !r.dec}),done=s.rows.filter(function(r){return r.dec}),open=SOPEN[s.key]!==undefined?SOPEN[s.key]:(si===0||pend.length>0);
        var g=pend.filter(function(r){return r.sure==='green'}).length,y=pend.filter(function(r){return r.sure==='yellow'}).length,rd=pend.length-g-y,nsel=pend.filter(function(r){return SEL[r.id]}).length;
        h+='<div class="sds" data-key="'+esc(s.key)+'"><button type="button" class="sdh" data-sd="serm"><span><b>'+dayText(s.date,s.start)+'</b><small>'+esc([s.device||'Unnamed device',s.place].filter(Boolean).join(' · '))+'</small></span>'
          +'<span>'+(pend.length?'<b>'+pend.length+' to review</b><small>'+g+' sure · '+y+' unsure · '+rd+' very unsure</small>':'<b>All reviewed</b><small>'+done.length+' rows</small>')+'</span></button>';
        if(open){
          if(pend.length){
            h+='<div class="sdbar"><button type="button" data-sd="all">Select all</button><button type="button" data-sd="green">Select all green</button><button type="button" class="lnk" data-sd="none">Clear</button></div>';
            h+=pend.map(rowHtml).join('');
            h+='<div class="sdact"><button type="button" class="go" data-sd="approve"'+(nsel&&!saving?'':' disabled')+'>Approve'+(nsel?' ('+nsel+')':'')+'</button><button type="button" data-sd="reject"'+(nsel&&!saving?'':' disabled')+'>Not a mistake'+(nsel?' ('+nsel+')':'')+'</button><button type="button" data-sd="dismiss"'+(nsel&&!saving?'':' disabled')+'>Dismiss'+(nsel?' ('+nsel+')':'')+'</button></div>';
          }
          if(done.length){h+='<button type="button" class="lnk sddn" data-sd="done">'+(DOPEN[s.key]?'Hide':'Show')+' reviewed ('+done.length+')</button>';if(DOPEN[s.key])h+=done.map(doneHtml).join('')}
        }
        h+='</div>';
      });
      $('sdBody').innerHTML=h;
    }
    function fail(j,what){
      if(j&&j.status===401){try{dlgS.close()}catch(e){}admSignOut();return true}
      say(what+(j&&j.error?' ('+j.error+')':'')+'. Try again.','bad');return false;
    }
    function load(quiet){
      var tk=cfgTok();if(!tk){if(!quiet){try{dlgS.close()}catch(e){}admSignOut()}return}
      if(busy)return;busy=true;if(!quiet){$('sdRef').disabled=true;if(!ROWS)draw()}
      post({t:tk,op:'list'}).then(function(j){
        busy=false;$('sdRef').disabled=false;
        if(j&&j.status===200&&Array.isArray(j.values)&&String((j.values[0]||[])[0]||'')==='id'){ROWS=parse(j.values);AT=Date.now();if(!quiet)say('');badge();if(dlgS.open)draw();return}
        if(quiet)return;
        if(!fail(j,'The list could not be read'))draw();
      },function(){busy=false;$('sdRef').disabled=false;if(quiet)return;say('The list could not be read: the church computer (n8n) did not answer. What you see below is from the last read.','bad');draw()});
    }
    function send(items,okText){
      var tk=cfgTok();if(!tk){try{dlgS.close()}catch(e){}admSignOut();return}
      saving=true;say('Saving…');draw();
      post({t:tk,op:'decide',items:items}).then(function(j){
        saving=false;
        if(!(j&&j.status===200&&Array.isArray(j.saved))){if(!fail(j,'Not saved'))draw();return}
        var ok={};j.saved.forEach(function(id){ok[id]=1});
        items.forEach(function(it){if(!ok[it.id])return;var r=(ROWS||[]).filter(function(x){return x.id===it.id})[0];if(r){r.dec=it.dec;r.own=it.own}delete SEL[it.id];delete OWN[it.id];delete EDIT[it.id]});
        var bad=items.length-j.saved.length;
        say(bad?j.saved.length+' saved, '+bad+' not saved (the list changed). Press Refresh and try those again.':j.saved.length+okText,bad?'bad':'ok');badge();draw();
      },function(){saving=false;say('Not saved: the church computer (n8n) did not answer. Nothing was changed. Try again.','bad');draw()});
    }
    function decide(key,dec){
      if(saving)return;var s=sermons().filter(function(x){return x.key===key})[0];if(!s)return;
      var rows=s.rows.filter(function(r){return !r.dec&&SEL[r.id]});if(!rows.length)return;
      if(dec==='approved'){var need=rows.filter(function(r){return r.sure==='red'&&!String(ownOf(r)||'').trim()});if(need.length){say('Type what it should say on the red row'+(need.length>1?'s':'')+' first, or untick '+(need.length>1?'them':'it')+' ('+need.map(function(r){return r.min}).join(', ')+').','bad');draw();return}}
      send(rows.map(function(r){return {row:r.row,id:r.id,dec:dec,own:dec==='approved'?String(ownOf(r)||'').trim():''}}),dec==='approved'?' approved ✓':dec==='dismissed'?' dismissed ✓':' marked not a mistake ✓');
    }
    $('sdBody').addEventListener('input',function(ev){var t=ev.target;if(t&&t.getAttribute('data-sd')==='own'){var r=t.closest('.sdr');if(r)OWN[r.getAttribute('data-id')]=t.value}});
    $('sdBody').addEventListener('change',function(ev){var t=ev.target;if(t&&t.getAttribute('data-sd')==='pick'){var r=t.closest('.sdr');if(!r)return;var id=r.getAttribute('data-id');if(t.checked)SEL[id]=1;else delete SEL[id];say('');draw()}});
    $('sdBody').addEventListener('click',function(ev){
      var x=ev.target&&ev.target.closest?ev.target.closest('[data-sd]'):null;if(!x)return;var a=x.getAttribute('data-sd');if(a==='pick'||a==='own')return;
      var sEl=x.closest('.sds'),key=sEl?sEl.getAttribute('data-key'):'',rEl=x.closest('.sdr,.sdd'),id=rEl?rEl.getAttribute('data-id'):'';
      var s=key?sermons().filter(function(v){return v.key===key})[0]:null,pend=s?s.rows.filter(function(r){return !r.dec}):[];
      if(a==='serm'){var open=SOPEN[key]!==undefined?SOPEN[key]:(sermons()[0]===s||pend.length>0);SOPEN[key]=!open;draw();return}
      if(a==='all'){pend.forEach(function(r){SEL[r.id]=1});say('');draw();return}
      if(a==='green'){pend.forEach(function(r){if(r.sure==='green')SEL[r.id]=1;else delete SEL[r.id]});say('');draw();return}
      if(a==='none'){pend.forEach(function(r){delete SEL[r.id]});say('');draw();return}
      if(a==='edit'){EDIT[id]=1;draw();var el=$('sdBody').querySelector('.sdr[data-id="'+id.replace(/"/g,'')+'"] .sdown');if(el){try{el.focus()}catch(e){}}return}
      if(a==='done'){DOPEN[key]=!DOPEN[key];draw();return}
      if(a==='approve'){decide(key,'approved');return}
      if(a==='reject'){decide(key,'rejected');return}
      if(a==='dismiss'){decide(key,'dismissed');return}
      if(a==='undo'){var r=(ROWS||[]).filter(function(v){return v.id===id})[0];if(r&&!r.taught&&!saving)send([{row:r.row,id:r.id,dec:'',own:''}],' put back in the list ✓');return}
    });
    b.onclick=function(){if(!cfgTok()){admSignOut();return}say('');draw();try{dlgS.showModal()}catch(e){dlgS.setAttribute('open','')}load()};
    $('sdRef').onclick=function(){say('');load()};
    $('sdClose').onclick=function(){dlgS.close()};
    // the badge on the button: a quiet read after sign-in and every 30 minutes while the page is open and not translating
    setTimeout(function(){load(true)},9000);setInterval(function(){if(!document.hidden&&!document.body.classList.contains('running')&&!dlgS.open)load(true)},1800000);
  })();
