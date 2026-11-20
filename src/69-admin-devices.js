  // ---- v122: Devices. Every device gets its own id (kept on the device). It checks in with the church server when the page
  // opens, when Start is pressed, every 2 minutes of translating (v124; was 5) and at the end, so the admin sees which phones and computers
  // use the app, roughly where (by internet address) and for how many minutes. Minutes not yet sent are kept and sent later. ----
  (function(){
    var PEND_KEY='devMinPending',BEAT_MIN=2,wasRun=false,acc=0,lastTick=Date.now();
    function pend(){return parseFloat(S.get(PEND_KEY,'0'))||0}
    function setPend(v){S.set(PEND_KEY,String(Math.round(v*100)/100))}
    function seen(ev,min,beacon){
      var body=JSON.stringify({id:devId(),ev:ev,min:min||0,ns:CFG_NS,view:ADMINVIEW?'admin':'user',touch:(navigator.maxTouchPoints||0)>1,build:(document.querySelector('meta[name="build"]')||{}).content||''});
      try{
        if(beacon&&navigator.sendBeacon){return Promise.resolve(navigator.sendBeacon(CFG_URL+'/seen',new Blob([body],{type:'text/plain'})))}
        return fetch(CFG_URL+'/seen',{method:'POST',headers:{'Content-Type':'text/plain'},body:body,keepalive:true,cache:'no-store'}).then(function(r){return r.json().catch(function(){return {}}).then(function(j){return r.ok?j:null})},function(){return null});
      }catch(e){return Promise.resolve(null)}
    }
    function sendMin(ev,beacon){ // the minutes go out with this check-in; if it does not arrive they stay on the device for the next one
      var m=pend();if(m<0.05&&ev==='min')return;
      if(beacon){if(seen(ev,m,true))setPend(0);return}
      setPend(0);
      seen(ev,m).then(function(j){if(!j){setPend(pend()+m);dbg('DEVICE minutes kept for later: '+m.toFixed(1))}});
    }
    seen('open').then(function(j){
      if(!j)return;DEVSTATE=j;
      if(pend()>=0.05)sendMin('min'); // minutes left over from last time
      gateShow(j);
    });
    setInterval(function(){
      var now=Date.now(),dt=Math.min(now-lastTick,60000);lastTick=now;
      if(running&&!wasRun){wasRun=true;acc=0;seen('start')}
      if(running&&!paused){setPend(pend()+dt/60000);acc+=dt/60000}
      if(running&&acc>=BEAT_MIN){acc=0;sendMin('min')}
      if(!running&&wasRun){wasRun=false;acc=0;sendMin('stop')}
    },15000);
    function bye(){if(pend()>=0.05)sendMin(running?'min':'stop',true)}
    window.addEventListener('pagehide',bye);
    document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')bye()});
  })();

  // ---- v122: the Devices window of the admin link: every device that opened the app, where it was (approximate, from its
  // internet address), its minutes, and Approve / Block. With "Approved devices only" on, a device that is not approved
  // cannot hear or translate (the church server refuses it), even if someone forwards the link. ----
  (function(){
    if(!ADMINVIEW)return;
    var b=$('devBtn');if(!b)return;
    var LIST=[],CFGD={approvedOnly:false,dailyDefault:120},OPEN={},busy=false;
    function esc(t){return String(t==null?'':t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
    function when(iso){if(!iso)return '';var d=new Date(iso),s=(Date.now()-d.getTime())/1000;if(s<90)return 'just now';if(s<3600)return Math.round(s/60)+' min ago';
      var t=d.toLocaleString([], {hour:'numeric',minute:'2-digit'});if(new Date().toDateString()===d.toDateString())return 'today '+t;
      return d.toLocaleString([], {month:'short',day:'numeric'})+', '+t}
    function place(x){var a=[x.city,x.region].filter(Boolean).join(', ');if(x.country&&x.country!=='US')a+=(a?', ':'')+x.country;return a||'Unknown place'}
    function mins(v){v=+v||0;return v<1&&v>0?'<1':String(Math.round(v))}
    function times(n){n=+n||0;return n===1?'once':n+' times'}
    function sums(d){var t=new Date().toISOString().slice(0,10),m=t.slice(0,7),o={today:0,month:0,all:0};for(var k in (d.days||{})){var v=+d.days[k]||0;o.all+=v;if(k===t)o.today+=v;if(k.slice(0,7)===m)o.month+=v}return o}
    function pending(d){return !!(d.req&&d.status!=='blocked')} // v124: the server removes a request once it is answered, so any request left is waiting
    function lim(d){var u=d.use||{};return u.daily>0?u.daily:0}
    function limBox(d){var u=d.use||{},L=d.limits||{},dl=lim(d),pc=dl?Math.min(100,Math.round(100*(u.today||0)/dl)):0,
        al=u.allow!=null?u.allow:null,pa=al?Math.min(100,Math.round(100*(u.used||0)/al)):0;
      return '<p><b>Today:</b> '+mins(u.today)+(dl?' of '+dl+' min':' min (no daily limit)')+(dl?'<span class="bar'+(pc>=90?' hot':'')+'"><i style="width:'+pc+'%"></i></span>':'')+'</p>'
        +(al!=null?'<p><b>Time given:</b> '+mins(u.used)+' of '+al+' min used<span class="bar'+(pa>=90?' hot':'')+'"><i style="width:'+pa+'%"></i></span></p>':'')
        +'<div class="lims"><label>Daily limit (minutes)<input type="number" class="dvDaily" min="0" max="1440" inputmode="numeric" value="'+(L.daily!=null?L.daily:'')+'" placeholder="Default ('+CFGD.dailyDefault+')"><small>Empty = default. 0 = no daily limit.</small></label>'
        +'<label>Total time given (minutes)<input type="number" class="dvAllow" min="0" inputmode="numeric" value="'+(L.allow!=null?L.allow:'')+'" placeholder="No limit"><small>When used up, they must ask again.</small></label></div>'
        +'<div class="row"><button type="button" data-act="limits">Save limits</button></div>'}
    function stLabel(d){var u=d.use||{};if(d.status==='blocked')return ['Blocked','bl'];if(d.req)return [d.status==='approved'?'Asked for more time':'Requested access','rq'];if(u.out==='daily')return ['Done for today','tu'];if(u.out==='total')return ['Time used up','tu'];if(d.status==='approved')return ['Approved','ok'];return CFGD.approvedOnly?['Not approved','wt']:['Allowed','nw']}
    var dlgD=document.createElement('dialog');dlgD.id='devDlg';
    dlgD.innerHTML='<h2>📍 Devices</h2>'
      +'<label class="dvsw"><input type="checkbox" id="dvOnly"><span><b>Approved devices only ('+(CFG_NS==='test'?'test link':'church link')+')</b><br><small>When on, only devices you approve below can hear and translate on the '+(CFG_NS==='test'?'test':'church')+' link. Anyone else sees "This app is restricted" and can ask for access with their name and phone. Approve the church device first.</small></span></label>'
      +'<div class="dvdef"><label for="dvDef"><b>Daily limit for each device:</b></label><input id="dvDef" type="number" min="0" max="1440" inputmode="numeric"> minutes <button type="button" id="dvDefSave">Save</button><small>0 = no daily limit. A device can have its own limit below.</small></div>'
      +'<div id="dvSum" class="cnote"></div>'
      +'<div id="dvList"></div>'
      +'<div id="dvMsg" class="cnote" role="status"></div>'
      +'<div class="actions" style="margin-top:12px"><button type="button" id="dvRef">Refresh</button><span style="flex:1"></span><button type="button" id="dvClose">Close</button></div>';
    document.body.appendChild(dlgD);
    function msg(t,bad){$('dvMsg').className='cnote'+(bad?' bad':'');$('dvMsg').textContent=t||''}
    function load(){
      var tk=cfgTok();if(!tk){dlgD.close();admSignOut();return}
      if(busy)return;busy=true;$('dvRef').disabled=true;msg('Loading…');
      cfgFetch('/devices?ns='+CFG_NS,{headers:{'Authorization':'Bearer '+tk}},25000).then(function(x){
        busy=false;$('dvRef').disabled=false;
        if(x.s===401){dlgD.close();admSignOut();return}
        if(x.s!==200||!x.j.devices){msg('The server could not list the devices (answer '+x.s+'). Press Refresh.',true);return}
        LIST=x.j.devices;CFGD.approvedOnly=!!x.j.approvedOnly;if(typeof x.j.dailyDefault==='number')CFGD.dailyDefault=x.j.dailyDefault;msg('');draw();devBadge(LIST);
      },function(){busy=false;$('dvRef').disabled=false;msg('Could not reach the server. Check the connection and press Refresh.',true)});
    }
    function draw(){
      $('dvOnly').checked=CFGD.approvedOnly;if(document.activeElement!==$('dvDef'))$('dvDef').value=CFGD.dailyDefault;
      LIST.sort(function(a,b){return (pending(b)-pending(a))||String(b.last||'').localeCompare(String(a.last||''))});
      var me=devId(),today=0,month=0,usedToday=0,h='';
      LIST.forEach(function(d){
        var s=sums(d),st=stLabel(d),open=!!OPEN[d.id],mine=d.id===me;
        today+=s.today;month+=s.month;if(s.today>0)usedToday++;
        var title=d.name||(d.req&&d.req.name)||d.kind||'Device',pend=pending(d);
        h+='<div class="dv'+(open?' open':'')+(pend?' rq':'')+'" data-id="'+esc(d.id)+'">'
          +'<button type="button" class="dvh" aria-expanded="'+open+'"><span class="dvt">'+esc(title)+' \u00b7 '+esc(String(d.id).slice(0,6).toUpperCase())+(mine?' <i>(this device)</i>':'')+'</span><span class="pill '+st[1]+'">'+st[0]+'</span>'
          +(d.req?'<span class="dvl">'+esc(d.req.phone)+' · '+esc(d.kind||'')+'</span>':'')
          +'<span class="dvl">'+esc(place(d))+' · '+esc(d.ip||'')+'</span>'
          +'<span class="dvl">Last seen '+esc(when(d.last))+' \u00b7 '+mins((d.use||{}).today!=null?d.use.today:s.today)+(lim(d)?' of '+lim(d):'')+' min today \u00b7 '+mins(s.month)+' this month</span></button>';
        if(open){
          var pl=(d.places||[]).map(function(p){return '<li>'+esc(place(p))+' · '+esc(p.ip)+(p.isp?' · '+esc(p.isp):'')+' · last '+esc(when(p.at))+'</li>'}).join('');
          h+='<div class="dvb">'
            +'<label>Name <input type="text" class="dvName" maxlength="60" value="'+esc(d.name||'')+'" placeholder="e.g. Church iPad"></label>'
            +((d.req||d.contact)?'<p><b>'+(d.req?(d.status==='approved'?'Asked for more time:':'Asked for access:'):'Contact:')+'</b> '+esc((d.req||d.contact).name)+' \u00b7 <a href="tel:'+esc(String((d.req||d.contact).phone).replace(/[^0-9+]/g,''))+'">'+esc((d.req||d.contact).phone)+'</a> \u00b7 '+esc(when((d.req||d.contact).at))+'</p>':'')
            +limBox(d)
            +'<p><b>Device:</b> '+esc(d.kind||'')+' · code '+esc(String(d.id).slice(0,6).toUpperCase())+(d.view==='admin'?' · admin link':'')+(d.ns==='test'?' · test link':'')+'</p>'
            +'<p><b>Used:</b> '+mins(s.all)+' min in total · opened '+times(d.opens)+' · started '+times(d.starts)+' · first seen '+esc(when(d.first))+'</p>'
            +'<p><b>Places it connected from</b> ('+((d.places||[]).length)+'):</p><ul>'+pl+'</ul>'
            +'<div class="row">'
            +(d.status==='blocked'?'<button type="button" data-act="approved">Unblock</button>'
              :(d.status!=='approved'?'<button type="button" data-act="approved">Approve</button>':((pend||(d.use&&d.use.out==='total'))?'<button type="button" data-act="more">Give more time</button>':''))+'<button type="button" data-act="blocked" class="warn">'+(pend?'Deny':'Block')+'</button>')
            +(d.status==='approved'?'<button type="button" data-act="new">Remove approval</button>':'')
            +'<button type="button" data-act="name">Save name</button>'
            +'<span style="flex:1"></span><button type="button" data-act="forget" class="quiet">Forget</button></div>'
            +'</div>';
        }
        h+='</div>';
      });
      $('dvList').innerHTML=h||'<p class="cnote">No device has opened the app since tracking started.</p>';
      var nreq=LIST.filter(pending).length;
      $('dvSum').innerHTML=(nreq?'<b style="color:#1e40af">'+nreq+' waiting for your approval (shown first)</b><br>':'')+esc(LIST.length+' device'+(LIST.length===1?'':'s')+' · '+usedToday+' used today · '+mins(today)+' min today · '+mins(month)+' min this month')
        +'<br><small>Places come from each internet address and are approximate (usually the right city; phones on cell data can show a far-away city). Minutes are counted by the app while it translates.</small>';
    }
    function setDev(id,body,okText,reload){
      var tk=cfgTok();if(!tk){dlgD.close();admSignOut();return}
      body.id=id;msg('Saving…');
      cfgFetch('/device',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tk},body:JSON.stringify(body)},12000).then(function(x){
        if(x.s===401){dlgD.close();admSignOut();return}
        if(x.s!==200||!x.j.ok){msg('Not saved (the server answered '+x.s+'). Try again.',true);return}
        if(body.forget){LIST=LIST.filter(function(d){return d.id!==id})}
        else LIST.forEach(function(d){if(d.id===id){if(body.status!==undefined)d.status=body.status;if(body.name!==undefined)d.name=body.name}});
        msg(okText);draw();devBadge(LIST);if(reload||body.status==='approved'||body.status==='blocked')setTimeout(function(){var keep=$('dvMsg').textContent;load();setTimeout(function(){if(!$('dvMsg').textContent)msg(keep)},1500)},300);
      },function(){msg('Not saved: no connection. Try again.',true)});
    }
    $('dvList').addEventListener('click',function(e){
      var card=e.target.closest('.dv');if(!card)return;var id=card.getAttribute('data-id');
      if(e.target.closest('.dvh')){OPEN[id]=!OPEN[id];draw();return}
      var a=e.target.closest('button[data-act]');if(!a)return;var act=a.getAttribute('data-act');
      if(act==='name'){setDev(id,{name:card.querySelector('.dvName').value},'Name saved \u2713');return}
      if(act==='limits'){var dv=card.querySelector('.dvDaily').value.trim(),av=card.querySelector('.dvAllow').value.trim(),dn=dv===''?null:Number(dv),an=av===''?null:Number(av);
        if((dn!==null&&!(dn>=0&&dn<=1440))||(an!==null&&!(an>=0))){msg('Type minutes as a number (daily up to 1440).',true);return}
        setDev(id,{daily:dn,allow:an},'Limits saved \u2713 They apply within about a minute.',true);return}
      if(act==='more'){setDev(id,{status:'approved',reset:true},'More time given \u2713 Their allowance starts again from now.',true);return}
      if(act==='forget'){
        if(a.getAttribute('data-sure')!=='1'){a.setAttribute('data-sure','1');a.textContent='Tap again to forget';return}
        setDev(id,{forget:true},'Removed from the list. If it opens the app again it comes back as a new device.');return}
      setDev(id,{status:act},act==='blocked'?'Blocked ✓ It is stopped within about a minute and cannot ask again.':act==='approved'?'Approved ✓ Their screen opens by itself within about a minute.':'Approval removed ✓');
    });
    $('dvOnly').onchange=function(){
      var on=$('dvOnly').checked,tk=cfgTok();if(!tk){dlgD.close();admSignOut();return}
      if(on){var mine=LIST.filter(function(d){return d.id===devId()})[0];
        if(!LIST.some(function(d){return d.status==='approved'})){ $('dvOnly').checked=false;msg('Approve at least one device first (the one the church uses), then turn this on.',true);return}
        if(mine&&mine.status!=='approved')msg('Note: this device is not approved, so it would not be able to translate. Approve it too if you use it.',true)}
      cfgFetch('/devcfg',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tk},body:JSON.stringify({approvedOnly:on,ns:CFG_NS})},12000).then(function(x){
        if(x.s===401){dlgD.close();admSignOut();return}
        if(x.s!==200||!x.j.ok){$('dvOnly').checked=!on;msg('Not changed (the server answered '+x.s+').',true);return}
        CFGD.approvedOnly=on;draw();msg(on?'On ✓ Only approved devices can translate on the '+(CFG_NS==='test'?'test':'church')+' link (takes up to a minute).':'Off ✓ Every device that is not blocked can translate on the '+(CFG_NS==='test'?'test':'church')+' link.');
      },function(){$('dvOnly').checked=!on;msg('Not changed: no connection.',true)});
    };
    function devBadge(list){var n=(list||[]).filter(pending).length,e=$('devBadge');if(!e)return;e.textContent=n>99?'99+':String(n);e.classList.toggle('on',n>0);b.setAttribute('aria-label',n?'Devices, '+n+' waiting for approval':'Devices')}
    function badgeCheck(){var tk=cfgTok();if(!tk||running||busy||!document.body.classList.contains('adminok')||document.visibilityState==='hidden')return;
      cfgFetch('/devices?ns='+CFG_NS,{headers:{'Authorization':'Bearer '+tk}},25000).then(function(x){if(x.s===200&&x.j.devices){if(!dlgD.open){LIST=x.j.devices;CFGD.approvedOnly=!!x.j.approvedOnly}devBadge(x.j.devices)}},function(){})}
    setTimeout(badgeCheck,4000);setInterval(badgeCheck,120000);
    b.onclick=function(){OPEN={};try{dlgD.showModal()}catch(e){dlgD.setAttribute('open','')}draw();load()};
    $('dvRef').onclick=load;
    $('dvDefSave').onclick=function(){var v=$('dvDef').value.trim(),n=Number(v),tk=cfgTok();if(!tk){dlgD.close();admSignOut();return}
      if(v===''||!(n>=0&&n<=1440)){msg('Type the daily minutes as a number from 0 to 1440.',true);return}
      cfgFetch('/devcfg',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tk},body:JSON.stringify({dailyDefault:Math.round(n),ns:CFG_NS})},12000).then(function(x){
        if(x.s===401){dlgD.close();admSignOut();return}
        if(x.s!==200||!x.j.ok){msg('Not saved (the server answered '+x.s+').',true);return}
        CFGD.dailyDefault=x.j.dailyDefault;msg('Saved \u2713 Each device now gets '+(CFGD.dailyDefault?CFGD.dailyDefault+' minutes a day':'no daily limit')+' unless it has its own limit.');var kept=$('dvMsg').textContent;load();setTimeout(function(){if(!$('dvMsg').textContent)msg(kept)},1500);
      },function(){msg('Not saved: no connection.',true)})};
    $('dvClose').onclick=function(){dlgD.close()};
  })();
})();
</script>
</body>
</html>
