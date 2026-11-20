  // ---- viewer mode: the main screen only shows captions and the text size; settings need a press-and-hold (and a PIN if one is set) ----
  var adminUntil=0,adminTimer=null;
  function setAdmin(on){
    adminUntil=on?Date.now()+600000:0;document.body.classList.toggle('admin',!!on);
    var t=$('title');if(t)t.setAttribute('contenteditable',on?'true':'false');
    clearInterval(adminTimer);if(on)adminTimer=setInterval(function(){if(Date.now()>adminUntil){var open=false;try{open=$('settings').open||$('review').open}catch(e){}if(!open)setAdmin(false)}},15000);
  }
  function askAdmin(){
    var pin=S.get('adminPin','');
    if(pin){var v=window.prompt('Owner PIN');if(v===null)return;if(String(v).trim()!==pin){alert('Wrong PIN.');return}}
    setAdmin(true);
  }
  (function(){
    var t=$('title'),h=null;
    function down(e){return; /* v102: the settings are reached from the admin link, not by holding the title */ if(document.body.classList.contains('admin'))return;clearTimeout(h);h=setTimeout(function(){h=null;askAdmin()},2000)}
    function up(){clearTimeout(h);h=null}
    ['pointerdown','touchstart','mousedown'].forEach(function(n){t.addEventListener(n,down,{passive:true})});
    ['pointerup','pointercancel','pointerleave','touchend','touchmove','mouseup','mouseleave'].forEach(function(n){t.addEventListener(n,up,{passive:true})});
    t.addEventListener('contextmenu',function(e){if(!document.body.classList.contains('admin'))e.preventDefault()});
    setAdmin(false); // v102: ?admin=1 no longer opens anything
    function bump(d){var v=Math.max(28,Math.min(90,(parseInt(S.get('size','46'),10)||46)+d));S.set('size',String(v));applyView()}
    $('fsDown').onclick=function(){bump(-4)};$('fsUp').onclick=function(){bump(4)};


  // v59: full screen for the projector
  (function(){
    var b=$('fsBtn'),de=document.documentElement,idleT=0;
    var can=!!(de.requestFullscreen||de.webkitRequestFullscreen);
    var standalone=(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone;
    if(standalone){b.style.display='none';return}
    function isFs(){return !!(document.fullscreenElement||document.webkitFullscreenElement)}
    function wake(){document.body.classList.remove('idle');clearTimeout(idleT);if(isFs())idleT=setTimeout(function(){document.body.classList.add('idle')},4000)}
    function sync(){var f=isFs();document.body.classList.toggle('fs',f);b.textContent=f?'✕':'⛶';b.setAttribute('aria-label',f?'Exit full screen':'Full screen');wake();try{fit()}catch(e){}}
    b.onclick=function(){
      if(!can){alert('On iPhone: tap Share, then Add to Home Screen, then open Live Translation from its icon. It opens with no browser bar.');return}
      try{if(isFs()){(document.exitFullscreen||document.webkitExitFullscreen).call(document)}else{var r=(de.requestFullscreen||de.webkitRequestFullscreen).call(de,{navigationUI:'hide'});if(r&&r.catch)r.catch(function(){})}}catch(e){}
    };
    document.addEventListener('fullscreenchange',sync);document.addEventListener('webkitfullscreenchange',sync);
    ['mousemove','pointerdown','touchstart','keydown'].forEach(function(ev){document.addEventListener(ev,wake,{passive:true})});
  })();
    $('go').addEventListener('click',function(){if(document.body.classList.contains('admin')&&!(($('settings')||{}).open))setAdmin(false)});
  })();

