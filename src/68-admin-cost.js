  // ---- v120: the Cost table of the admin link: one line per month with its totals; tap a month to see only the days that were used ----
  // v121: the two keys the cost needs are pasted here (Save sends them to the church server, which never sends them back)
  (function(){
    if(!ADMINVIEW)return;
    var b=$('costBtn');if(!b)return;
    var FIRST='2026-11'; // the church app started paying for hearing and translating this month
    var DATA={},OPEN={},busy=false,KEYS={all:false};
    function nowM(){return new Date().toISOString().slice(0,7)}
    function money(v){v=+v||0;return v>0&&v<0.01?'<$0.01':'$'+v.toFixed(2)}
    function mins(v){v=Math.round(+v||0);return v.toLocaleString()+'<span class="u"> min</span>'}
    function mName(m){var x=new Date(Date.UTC(+m.slice(0,4),+m.slice(5,7)-1,15));return '<span class="u">'+esc(x.toLocaleString([], {month:'long',year:'numeric',timeZone:'UTC'}))+'</span><span class="s">'+esc(x.toLocaleString([], {month:'short',year:'numeric',timeZone:'UTC'}))+'</span>'}
    function mStep(m,d){var y=+m.slice(0,4),mo=+m.slice(5,7)-1+d;y+=Math.floor(mo/12);mo=((mo%12)+12)%12;return y+'-'+String(mo+1).padStart(2,'0')}
    function dName(d){var x=new Date(d+'T12:00:00Z');return '<span class="u">'+x.toLocaleString([], {weekday:'short',timeZone:'UTC'})+', </span>'+x.toLocaleString([], {month:'short',day:'numeric',timeZone:'UTC'})}
    function esc(t){return String(t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
    function months(){var out=[],m=nowM();while(m>=FIRST){out.push(m);m=mStep(m,-1)}return out} // newest first
    var dlgC=document.createElement('dialog');dlgC.id='costDlg';
    dlgC.innerHTML='<h2>$ Cost</h2><div id="balBox"><div class="bal" id="balS"></div><div class="bal" id="balC"></div></div>'
      +'<div id="costKeys" hidden><h3>Add the keys (one time)</h3><p>Paste each key and press Save. They are kept on the church server only, never on this device.</p>'
      +'<div id="ckS"><label for="ckSx">Soniox key<a href="https://console.soniox.com" target="_blank" rel="noopener">Get it</a></label><input id="ckSx" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Paste the Soniox API key"><div class="hint">Soniox console, My First Project, API keys.</div></div>'
      +'<div id="ckC"><label for="ckCa">Claude admin key<a href="https://platform.claude.com/settings/keys" target="_blank" rel="noopener">Get it</a></label><input id="ckCa" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Paste the Claude key"><div class="hint">Create key, Scope: Organization, Expires: Never, then Copy.</div></div>'
      +'<div class="row"><button type="button" id="costSave">Save keys</button><span id="ckMsg" role="status"></span></div></div>'
      +'<div id="costWrap"><table><thead><tr><th>Month</th><th><span class="u">Minutes</span><span class="s">Min</span></th><th>Soniox</th><th>Haiku</th><th>Total</th></tr></thead><tbody id="costBody"></tbody></table></div>'
      +'<div id="costMsg" class="cnote" role="status"></div>'
      +'<div class="actions" style="margin-top:12px"><button type="button" id="costRef">Refresh</button><button type="button" id="costChg">Change keys</button><span style="flex:1"></span><button type="button" id="costClose">Close</button></div>';
    document.body.appendChild(dlgC);
    function load(fresh){
      var tk=cfgTok();if(!tk){dlgC.close();admSignOut();return}
      if(busy)return;busy=true;$('costRef').disabled=true;
      var list=months(),i=0,fail='';
      $('costMsg').className='cnote';$('costMsg').textContent='Loading…';
      (function next(){
        if(i>=list.length){busy=false;$('costRef').disabled=false;draw(fail);return}
        var m=list[i++];
        cfgFetch('/cost?month='+m+(fresh?'&fresh=1':''),{headers:{'Authorization':'Bearer '+tk}},25000).then(function(x){
          if(x.s===401){busy=false;dlgC.close();admSignOut();return}
          if(x.s===200&&x.j.days)DATA[m]=x.j;else fail='The server could not get the cost (answer '+x.s+(x.j.error?' '+x.j.error:'')+'). Try Refresh in a minute.';
          draw();next();
        },function(){fail='Could not reach the server. Check the connection and press Refresh.';next()});
      })();
    }
    function used(r,sOk,cOk){return (sOk&&(r.min>=0.5||r.soniox>0))||(cOk&&r.haiku>0)}
    function draw(fail){
      var h='',notes=[],noS='',noC='',other=0,last=null;
      months().forEach(function(m){
        var j=DATA[m];
        if(!j){h+='<tr class="mon"><td>'+mName(m)+'</td><td>…</td><td>…</td><td>…</td><td>…</td></tr>';return}
        last=last||j;
        var sOk=j.soniox&&j.soniox.ok,cOk=j.claude&&j.claude.ok,t=j.total||{},na='–';
        if(!sOk&&!noS)noS=(j.soniox&&j.soniox.error)||'unknown';
        if(!cOk&&!noC)noC=(j.claude&&j.claude.error)||'unknown';
        if(cOk)other+=t.other||0;
        var tot=(sOk?t.soniox:0)+(cOk?t.haiku:0),open=!!OPEN[m];
        h+='<tr class="mon'+(open?' open':'')+'" data-m="'+m+'" tabindex="0" aria-expanded="'+open+'"><td>'+mName(m)+'</td><td>'+(sOk?mins(t.min):na)+'</td><td>'+(sOk?money(t.soniox):na)+'</td><td>'+(cOk?money(t.haiku):na)+'</td><td>'+money(tot)+((sOk&&cOk)?'':'*')+'</td></tr>';
        if(open){
          var ds=(j.days||[]).filter(function(r){return used(r,sOk,cOk)}).reverse();
          if(!ds.length)h+='<tr class="none"><td colspan="5">'+((sOk||cOk)?'No days used this month.':'Nothing can be read until the keys are added.')+'</td></tr>';
          ds.forEach(function(r){h+='<tr class="day"><td>'+dName(r.d)+'</td><td>'+(sOk?mins(r.min):na)+'</td><td>'+(sOk?money(r.soniox):na)+'</td><td>'+(cOk?money(r.haiku):na)+'</td><td>'+money((sOk?r.soniox:0)+(cOk?r.haiku:0))+'</td></tr>'});
        }
      });
      $('costBody').innerHTML=h;
      if(last){var needS=noS==='no_key'||KEYS.all,needC=noC==='no_key'||KEYS.all;$('ckS').hidden=!needS;$('ckC').hidden=!needC;$('costKeys').hidden=!(needS||needC)}
      function why(e,who,key){if(e==='no_key')return who+' is not shown yet: paste the '+key+' in the box above.';return who+' could not be read right now ('+String(e).replace('answer_','server answered ')+').'}
      if(fail)notes.push(fail);
      if(noS)notes.push(why(noS,'Soniox','Soniox key'));
      if(noC)notes.push(why(noC,'Haiku','Claude admin key'));
      if(noS||noC)notes.push('* That total leaves out what could not be read.');
      var bad=!!(fail||noS||noC);
      if(other>=0.005)notes.push('Other Claude use on the same account (not the church app): '+money(other)+', not counted above.');
      if(last){var when='';try{when=new Date(last.at).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}catch(e){}
        notes.push('Tap a month to see the days it was used. Days follow UTC time, so a day here ends at 7 PM (8 PM in summer) Eastern time. Figures as of '+when+'; Soniox and Claude can take a little while to post the newest use.')}
      $('costMsg').className='cnote'+(bad?' bad':'');$('costMsg').innerHTML=notes.map(esc).join('<br>');
    }
    function toggle(tr){var m=tr&&tr.getAttribute('data-m');if(!m)return;OPEN[m]=!OPEN[m];draw()}
    $('costBody').addEventListener('click',function(e){toggle(e.target.closest('tr.mon'))});
    $('costBody').addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle(e.target.closest('tr.mon'))}});
    b.onclick=function(){OPEN={};OPEN[nowM()]=false;try{dlgC.showModal()}catch(e){dlgC.setAttribute('open','')}draw();load(false);BAL.load()};
    $('costRef').onclick=function(){load(true);BAL.load()};
    $('costChg').onclick=function(){KEYS.all=!KEYS.all;draw()};
    $('costSave').onclick=function(){
      var sx=$('ckSx').value.trim(),ca=$('ckCa').value.trim(),tk=cfgTok(),msg=$('ckMsg');
      if(!sx&&!ca){msg.style.color='#9a3412';msg.textContent='Paste a key first.';return}
      if(!tk){dlgC.close();admSignOut();return}
      $('costSave').disabled=true;msg.style.color='#4b4f58';msg.textContent='Saving\u2026';
      cfgFetch('/cost-keys',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tk},body:JSON.stringify({soniox:sx,claude:ca})},12000).then(function(x){
        $('costSave').disabled=false;
        if(x.s===200&&x.j.ok){$('ckSx').value='';$('ckCa').value='';KEYS.all=false;msg.style.color='#166534';msg.textContent='Saved \u2713 Checking the numbers\u2026';DATA={};load(true);return}
        if(x.s===401){dlgC.close();admSignOut();return}
        msg.style.color='#9a3412';msg.textContent='Not saved (the server answered '+x.s+'). Try again.';
      },function(){$('costSave').disabled=false;msg.style.color='#9a3412';msg.textContent='Not saved: no connection. Try again.'});
    };
    $('costClose').onclick=function(){dlgC.close()};
    // ---- v125: money left. Soniox: its real prepaid balance. Claude: Anthropic gives apps no balance, so the admin types what the
    // Claude billing page shows and the church server subtracts the Haiku spend it counted since then (an estimate). Tap a balance to open that billing site. ----
    var BAL=(function(){
      var last=null,edit={};
      function m2(v){return '$'+(+v||0).toFixed(2)}
      function card(id,title,html,low){var el=$(id);el.className='bal'+(low?' low':'');el.innerHTML='<div class="bt">'+title+'</div>'+html}
      function draw(j){
        last=j||last;j=last;if(!j){card('balS','Soniox (hearing)','<span class="bv">…</span>');card('balC','Claude (translating)','<span class="bv">…</span>');return}
        var low=+j.low||5,s=j.soniox||{},c=j.claude||{},h,sl=false,cl=false;
        if(s.ok){sl=s.exhausted||s.usd<low;h='<a class="bv" href="'+esc(s.url)+'" target="_blank" rel="noopener">'+m2(s.usd)+'</a><div class="bs">'+(s.exhausted?'Used up: hearing will stop. Tap to add money.':sl?'Low: tap to add money.':'Left. Tap to open Soniox billing.')+(s.autopay?' Auto top-up is on.':'')+'</div>'}
        else if(s.error==='needs_org_key'||s.error==='no_key'||edit.s){h='<a class="bv" href="'+esc(s.url||'https://console.soniox.com')+'" target="_blank" rel="noopener">–</a><div class="bs">To show the balance, paste a Soniox <b>organization</b> key once (Soniox console, Organization, API keys).</div><div class="bf"><input id="balSx" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Organization key"><button type="button" id="balSxSave">Save</button></div>'}
        else h='<a class="bv" href="'+esc(s.url)+'" target="_blank" rel="noopener">–</a><div class="bs">Could not be read right now ('+esc(String(s.error||'unknown').replace('answer_','server answered '))+'). Tap to open Soniox.</div>';
        card('balS','Soniox (hearing)',h,sl);
        if(c.ok&&!edit.c){cl=c.usd<low;var when='';try{when=new Date(c.setAt).toLocaleString([], {month:'short',day:'numeric'})}catch(e){}
          h='<a class="bv" href="'+esc(c.url)+'" target="_blank" rel="noopener">about '+m2(c.usd)+'</a><div class="bs">'+(cl?'Low: tap to add credit. ':'')+'Estimate: '+m2(c.setUsd)+' typed on '+esc(when)+', minus '+m2(c.spent)+' the app used since. Other Claude use is not counted. <button type="button" class="lnk" id="balCEd">Update</button></div>'}
        else h='<a class="bv" href="'+esc(c.url||'https://console.anthropic.com/settings/billing')+'" target="_blank" rel="noopener">'+(c.ok?'about '+m2(c.usd):'–')+'</a><div class="bs">Type the credit balance the Claude billing page shows (tap above to open it). Do this again after each purchase.</div><div class="bf"><input id="balCa" type="number" inputmode="decimal" min="0" step="0.01" placeholder="e.g. 18.50"><button type="button" id="balCaSave">Save</button></div>';
        card('balC','Claude (translating)',h,cl);
        var bt=$('costBtn');if(bt){bt.classList.toggle('low',sl||cl);bt.title=(sl||cl)?'A balance is low':''}
        var e1=$('balSxSave');if(e1)e1.onclick=function(){var v=$('balSx').value.trim();if(v)save({sonioxOrg:v},'s')};
        var e2=$('balCaSave');if(e2)e2.onclick=function(){var v=$('balCa').value.trim();if(v!==''&&isFinite(+v)&&+v>=0)save({claude:+v},'c');else $('balCa').focus()};
        var e3=$('balCEd');if(e3)e3.onclick=function(){edit.c=true;draw()};
      }
      function save(body,which){
        var tk=cfgTok();if(!tk){try{dlgC.close()}catch(e){}admSignOut();return}
        var btn=$(which==='s'?'balSxSave':'balCaSave');if(btn){btn.disabled=true;btn.textContent='Saving…'}
        cfgFetch('/balance-set',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tk},body:JSON.stringify(body)},20000).then(function(x){
          if(x.s===401){try{dlgC.close()}catch(e){}admSignOut();return}
          if(x.s===200){edit={};draw(x.j);return}
          if(btn){btn.disabled=false;btn.textContent='Save'}$('costMsg').className='cnote bad';$('costMsg').textContent='Not saved (the server answered '+x.s+'). Try again.';
        },function(){if(btn){btn.disabled=false;btn.textContent='Save'}});
      }
      function load(){
        var tk=cfgTok();if(!tk)return;draw();
        cfgFetch('/balance',{headers:{'Authorization':'Bearer '+tk}},20000).then(function(x){if(x.s===200)draw(x.j)},function(){});
      }
      // the $ button turns red when a balance is low, checked after sign-in and every 30 minutes
      setTimeout(load,6000);setInterval(function(){if(!document.hidden&&!document.body.classList.contains('running'))load()},1800000);
      return {load:load};
    })();
  })();

