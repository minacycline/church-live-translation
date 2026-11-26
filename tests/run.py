#!/usr/bin/env python3
"""Tests run before any page is written. A fake hearing stream and a fake translator drive the real page in a browser. Exit 1 = a test failed."""
import asyncio, functools, http.server, json, os, re, shutil, sys, tempfile, threading, time
from playwright.async_api import async_playwright
PAGE = sys.argv[1] if len(sys.argv) > 1 else "test/index.html"
EXPORT = ("window.__h={fix:function(t){return applyFixes(fixNames(cleanHeard(t,true)))},terms:function(){return sxStart().context.terms},"
 "ctxLen:function(){return JSON.stringify(sxStart().context).length},sxMessage:function(m){return sxMessage(m,DG.ws)},onFinal:onFinal,"
 "lines:function(){return lines},DG:DG,setSX:function(x){SX=x},dbg:function(){return DBG.slice()},run:function(v){running=v;DBG0=Date.now()},state:function(){return (running?1:0)+(paused?2:0)},began:function(v){if(v!==undefined)sessionBegan=v;return sessionBegan},cy:{date:copticDate,seasons:churchSeasons,terms:dateTerms,note:dateNote,saints:saintNames,month:monthRepair},safe:function(a,b){return fixSafe(a,b,'')},gloss:function(a){return groqGlossary(a,'')}};")
M = {"delay": 0.3, "fail_until": 0, "replies": [], "n": 0, "part": 0}
FAILS = []
def check(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else "  -> " + str(detail)[:300])); sys.stdout.flush()
    if not ok: FAILS.append(name)
async def route(r):
    q = r.request; H = {"access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*"}
    if q.method == "OPTIONS": return await r.fulfill(status=204, headers=H)
    if "/?d=" in q.url and q.method == "POST":
        M["n"] += 1
        if time.time() < M["fail_until"]:
            return await r.fulfill(status=529, content_type="application/json", headers=H, body='{"error":{"type":"overloaded_error","message":"Overloaded"}}')
        u = json.loads(q.post_data or "{}").get("messages", [{}])[-1].get("content", "")
        if "only PART of a Bible verse" in u: M["part"] += 1
        M.setdefault("users", []).append(u)
        t = M["replies"].pop(0) if M["replies"] else "Line %d of the talk, %s." % (M["n"], "with hint" if "rough English" in u else "no hint")
        await asyncio.sleep(M["delay"])
        return await r.fulfill(status=200, content_type="application/json", headers=H,
            body=json.dumps({"content": [{"type": "text", "text": t[4:] if t.startswith("RAW:") else json.dumps({"new": t})}], "usage": {"input_tokens": 1, "output_tokens": 1}}))
    if q.url.endswith("/report") and q.method == "POST": M.setdefault("reports", []).append(json.loads(q.post_data or "{}"))
    await r.fulfill(status=200, content_type="application/json", headers=H, body="{}")
STREAM = r"""async(sc)=>{const H=window.__h;H.run(true);H.DG.ws={__sn:true};H.DG.live=true;H.setSX({ar:'',en:'',nfAr:'',nfEn:'',at:0,shown:0});
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));const arW=sc.ar.split(' '),enW=sc.en.split(' ');let ei=0,done=0;const total=arW.filter(w=>!w.startsWith('<')).length;
 const pushEn=u=>{const tk=[];while(ei<u&&ei<enW.length){tk.push({text:(ei?' ':'')+enW[ei],is_final:true,translation_status:'translation'});ei++}if(tk.length)H.sxMessage({tokens:tk})};
 for(const w of arW){if(w==='<end>'){await sleep(700);pushEn(Math.floor(enW.length*done/total));H.sxMessage({tokens:[{text:'<end>',is_final:true}]})}
  else if(w.startsWith('<gap')){await sleep(parseInt(w.slice(4))*1000)}
  else{H.sxMessage({tokens:[{text:' '+w,is_final:false}]});await sleep(sc.gap||200);H.sxMessage({tokens:[{text:(done?' ':'')+w,is_final:true,confidence:0.9}]});done++;pushEn(Math.floor(enW.length*Math.max(0,done-5)/total));await sleep(sc.gap||200)}}
 pushEn(enW.length);await sleep(sc.tail||6000);
 return {lines:H.lines().map(l=>({ar:l.ar,en:l.en||'',draft:l.en?'':(l.draft||''),fx:l.fixed?1:0,late:l.t1?(l.t1-l.t0)/1000:null})),lost:H.dbg().filter(l=>/SENTENCE (dropped|not translated)/.test(l)).length}}"""
PIECES = r"""async(p)=>{const H=window.__h;H.run(true);H.setSX({ar:'',en:'',nfAr:'',nfEn:'',at:0,shown:0});for(const x of p){H.onFinal(x,[]);await new Promise(r=>setTimeout(r,1600))}
 await new Promise(r=>setTimeout(r,3500));return H.lines().map(l=>l.en||'')}"""
SC = {
 "prayer": {"ar": "حين أيضًا <end> <gap3> أيها السيد الرب الإله، ضابط الكل الذي أرسلته الوحيد إلى العالم، علم الناموس والوصايا، المكتوبة في الإنجيل، <gap1> المقدس. <end>",
            "en": "When also. O Lord, God, the commander of the whole which you alone sent into the world, taught the law and the commandments, written in the gospel, the holy."},
 "verse": {"ar": "لأنه هكذا أحب الله العالم حتى بذل ابنه الوحيد، لكي لا يهلك كل من يؤمن به، بل تكون له الحياة الأبدية. <end> <gap2> وده معناه إن ربنا بيحبنا كلنا، وإن محبته مالهاش حدود، وإن إحنا لازم نحب بعض زي ما هو حبنا. <end>",
           "en": "For God so loved the world that he gave his only son, so that everyone who believes in him will not perish, but have eternal life. And this means that God loves us all, and that his love has no limits, and that we must love each other as he loved us."},
 "opening": {"ar": "بسم الآب <gap2> والابن <gap2> والروح القدس، <gap2> الإله الواحد، <gap1> آمين. <end>", "en": "In the name of the Father and the Son and the Holy Spirit, one God, amen."},
 "sermon": {"ar": "النهارده يا أحبائي عايزين نتكلم عن المحبة، المحبة اللي ربنا علمها لنا، واللي لازم تكون في قلوبنا كل يوم، مش بس في الكنيسة، لكن في البيت وفي الشغل ومع كل الناس اللي حوالينا. <end>",
            "en": "Today my beloved we want to talk about love, the love that God taught us, and which must be in our hearts every day, not only in church, but at home and at work and with all the people around us."},
}
LONG = " ".join((w + ("،" if i % 7 == 6 else "") + (". <end>" if i % 23 == 22 else "")) for i, w in enumerate(("النهارده يا أحبائي عايزين نتكلم عن المحبة اللي ربنا علمها لنا في حياتنا كل يوم".split()) * 6))
async def main():
    site = tempfile.mkdtemp()
    for f in os.listdir("."):
        if f.endswith((".js", ".json", ".png")) and os.path.isfile(f): shutil.copy(f, site)
    s = open(PAGE, encoding="utf-8").read().replace('<base href="../">', "")
    check("page has the test hook point", s.count("window.__churchTest={") == 1)
    ver = (re.search(r'name="build" content="([^"]+)"', s) or [None, ""])[1]; ch = open("CHANGES.txt", encoding="utf-8").read() if os.path.exists("CHANGES.txt") else ""
    check("this build has its line in CHANGES.txt", bool(ver) and any(l.startswith(ver + " |") for l in ch.splitlines()), ver)
    open(os.path.join(site, "index.html"), "w", encoding="utf-8").write(s.replace("window.__churchTest={", EXPORT + "window.__churchTest={"))
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Q, directory=site))
    threading.Thread(target=srv.serve_forever, daemon=True).start(); url = "http://127.0.0.1:%d/index.html" % srv.server_address[1]
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []
        async def page():
            pg = await b.new_page(viewport={"width": 1180, "height": 820}); pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.route("**/*workers.dev/**", route); await pg.route("**/api.katameros.app/**", lambda r: r.abort())
            await pg.route("**/fonts.g*/**", lambda r: r.abort())
            await pg.goto(url); await pg.wait_for_timeout(5000); return pg
        async def stream(name, **kw):
            M.update(delay=1.0, fail_until=0, replies=[], n=0); M.update(kw.pop("m", {})); pg = await page()
            r = await pg.evaluate(STREAM, dict(SC.get(name, {}), **kw)); await pg.close(); return r
        async def pieces(p, replies=()):
            M.update(delay=0.3, fail_until=0, replies=list(replies), n=0); pg = await page(); r = await pg.evaluate(PIECES, p); await pg.close(); return r
        pg = await page()
        v = await pg.evaluate("()=>{const H=window.__h,t=H.terms();return {syn:t.filter(x=>/نكس|نكز/.test(x)).length,ath:t.includes('أثناسيوس'),tr:['translate','translation','translator'].every(x=>t.includes(x)),ctx:H.ctxLen(),fix:H.fix('إلى أهل القديس سينكسار.'),keep:H.fix('قرأنا في السنكسار عن القديس'),fix2:H.fix('هنتكلم على القديس العظيم السنكسار الرسولي،')}}")
        await pg.close()
        check("hearing word list: one spelling of Synaxarium", v["syn"] == 1, v); check("hearing word list: Athanasius on its own", v["ath"], v)
        check("hearing word list: translate, translation, translator", v["tr"], v); check("hearing word list under 8,600 characters", v["ctx"] <= 8600, v["ctx"]); check("Saint Synaxarium repaired to Athanasius", "أثناسيوس" in v["fix"], v["fix"])
        check("the word Synaxarium itself is kept", "السنكسار" in v["keep"], v["keep"])
        check("great saint Synaxarium the Apostolic repaired to Athanasius", "أثناسيوس الرسولي" in v["fix2"] and "نكس" not in v["fix2"], v["fix2"])
        pg = await page()
        y = await pg.evaluate("""()=>{const H=window.__h,C=H.cy,d=(a,b,c)=>new Date(a,b-1,c),N=d(2026,11,22);return {
          cd:C.date(N).name,t:C.terms(N),note:C.note(N),fast:C.terms(d(2026,11,25)),palm:C.seasons(d(2026,4,5)).map(x=>x.en),east:C.seasons(d(2026,4,12)).map(x=>x.en),lent:C.terms(d(2027,3,28)),
          kiahk:C.terms(d(2026,12,20)),edge:C.terms(d(2026,12,8)),m1:C.month('شهر غفور بيتكلم عن كلمة ربنا.',N),m2:C.month('قعد هناك شهر كامل وبعدين رجع',N),m3:C.month('في شهر نوفمبر اللي فات',N),m4:C.month('من شهر هتور',N),m5:C.month('شهر غفور',d(2026,7,1)),
          ps:H.fix('بيقول: سراب لرجل كلامك.'),live:H.terms().slice(0,30),today:C.terms()[0],ctx:H.ctxLen(),sn:C.saints(d(2026,11,26)),gl:H.gloss('النهارده في شهر بشنس')}}""")
        await pg.close()
        check("church year: 22 Nov 2026 is 13 Hatour 1743", y["cd"] == "13 Hatour 1743", y["cd"])
        check("church year: the hearing is told this month, and no fast before it begins", "شهر هاتور" in y["t"] and "هاتور" in y["t"] and "صوم الميلاد" not in y["t"], y["t"])
        check("church year: the Nativity Fast from 16 Hatour, Kiahk words in Kiahk, next month near the end of a month", "صوم الميلاد" in y["fast"] and "تسبحة كيهك" in y["kiahk"] and "شهر كيهك" in y["kiahk"] and "شهر كيهك" in y["edge"] and "شهر هاتور" in y["edge"], [y["fast"], y["kiahk"], y["edge"]])
        check("church year: Holy Week, the Holy Fifty Days and the Lent Sunday follow the Easter date", "Holy Week" in y["palm"] and any("Holy Fifty" in x for x in y["east"]) and "أحد الابن الضال" in y["lent"] and "الصوم الكبير" in y["lent"], [y["palm"], y["east"], y["lent"]])
        check("church year: the translator is told today's Coptic date", "Today is 13 Hatour 1743 in the Coptic calendar" in y["note"], y["note"])
        check("church year: the saints of the day are offered to the hearing as short names", "البابا يوحنا" in y["sn"], y["sn"])
        check("church year: today's month is at the top of the live hearing list and the list still fits", y["today"] in y["live"] and y["ctx"] <= 8600, [y["today"], y["ctx"], y["live"][:8]])
        check("month misheard after the word for month is repaired (Ghafour to Hatour)", y["m1"].startswith("شهر هاتور ") and y["m4"] == "من شهر هاتور", [y["m1"], y["m4"]])
        check("month repair leaves ordinary words, other calendars and other seasons alone", y["m2"] == "قعد هناك شهر كامل وبعدين رجع" and y["m3"] == "في شهر نوفمبر اللي فات" and y["m5"] == "شهر غفور", [y["m2"], y["m3"], y["m5"]])
        check("heard word repaired: a lamp to my feet", "سراج لرجلي كلامك" in y["ps"], y["ps"])
        check("every Coptic month after the word for month has its English", "the month of Bashans" in y["gl"], y["gl"])
        pg = await page()
        w = await pg.evaluate("()=>{const H=window.__h;return {inh:H.fix('اللي قال له: ماذا أفعل؟ هارس الحياة الأبدية.'),inh2:H.fix('ماذا أصنع لآرس الحياة الأبدية؟'),scr:H.fix('اتكتبوا الفريسيين خانوهم.'),weep:H.fix('المرأة دي قال لها أول حاجة: لا تركي.'),s1:H.safe('مرشد','راعي'),s2:H.safe('فيسوع','يسوع'),s3:H.safe('لا تركي','لا تخافي'),s4:H.safe('والعياد','والعيد'),s5:H.safe('عجابة','عجيبة')}}")
        await pg.close()
        check("heard word repaired: inherit eternal life", "لأرث الحياة" in w["inh"] and "لأرث الحياة" in w["inh2"], w)
        check("heard word repaired: the scribes and Pharisees", "الكتبة والفريسيين" in w["scr"], w["scr"]); check("heard word repaired: do not weep", "لا تبكي" in w["weep"], w["weep"])
        check("learned fix refused when the words do not sound alike", bool(w["s1"]) and bool(w["s3"]), w); check("learned fix refused when it only drops 'so' or 'and'", bool(w["s2"]), w)
        check("learned fix still allowed for a real mishearing", w["s4"] == "" and w["s5"] == "", w)
        HEN = "How often I would have gathered your children together, even as a hen gathers her chicks under her wings, and you would not!"
        M["part"] = 0; e = await pieces(["كم مرة أردت أن أجمع بنيك؟ كما تجمع الدجاجة تحت جناحيها فلم تريده."], [HEN])
        check("later part of a verse: only what he said is shown", len(e) == 1 and e[0] == HEN and "prophets" not in e[0], e); check("later part of a verse: the verse goes to the translator as a guide", M["part"] >= 1, M["part"])
        SHORT = "النهارده يا أحبائي عايزين نتكلم عن محبة ربنا لينا كلنا. <end> فيسوع بكى وتحنن عليهم. <end> " + " ".join("وبعدين يسوع وقف في المكان ده وشاف المدينة كلها قدامه والشعب ماشي من غير راعي ومن غير مرشد يقودهم في الطريق".split())
        r = await stream("x", ar=SHORT, en="", gap=600, tail=7000); L = [l for l in r["lines"] if l["ar"].startswith("فيسوع")]
        check("short finished sentence is not held 4 s", len(L) == 1 and L[0]["late"] is not None and L[0]["late"] < 3.2, r["lines"])
        EN = "Today we are going to talk about the deceased man who was healed."
        r = await stream("x", ar=EN + " <end>", en="", tail=4000, m={"replies": ["RAW:" + EN.replace("deceased", "diseased")]}); L = r["lines"]
        check("English sentence: one misheard word corrected", len(L) == 1 and "diseased" in L[0]["en"], L)
        r = await stream("x", ar=EN + " <end>", en="", tail=4000, m={"replies": ["RAW:The priest then spoke about a completely different story this morning here."]}); L = r["lines"]
        check("English sentence: a different sentence from the check is refused", len(L) == 1 and L[0]["en"].strip() == EN, L)
        pg = await page()
        c = await pg.evaluate("""async()=>{const H=window.__h,$=i=>document.getElementById(i),w=ms=>new Promise(r=>setTimeout(r,ms)),o={};H.run(true);H.onFinal('ربنا موجود معانا النهارده',[]);
          $('go').click();await w(300);o.shown=!$('closing').hidden;o.btns=$('closeBack').textContent+'|'+$('closeNew').textContent;o.paused=H.state();
          $('closeBack').click();await w(2500);o.backHidden=$('closing').hidden;o.backState=H.state();o.backLines=H.lines().length;o.backEn=!!(H.lines()[0]||{}).en;o.closedClass=document.body.classList.contains('closed');
          $('go').click();await w(300);$('closeNew').click();await w(300);o.newHidden=$('closing').hidden;o.newState=H.state();
          H.run(true);$('go').click();await w(300);H.run(false);$('closeBack').click();await w(300);o.lateHidden=$('closing').hidden;o.lateState=H.state();o.lateClosed=document.body.classList.contains('closed');return o}""")
        await pg.close()
        check("closing screen: Stop shows it with Return and Start over, listening paused", c["shown"] and c["btns"] == "Return|Start over" and c["paused"] == 3, c)
        check("closing screen: Return carries on, caption kept and still translated", c["backHidden"] and c["backState"] == 1 and c["backLines"] == 1 and c["backEn"] and not c["closedClass"], c)
        check("closing screen: Start over ends the service", c["newHidden"] and c["newState"] == 0, c)
        check("closing screen: Return after the service ended shows the captions, not listening", c["lateHidden"] and c["lateState"] == 0 and not c["lateClosed"], c)
        M["reports"] = []; pg = await page()
        await pg.evaluate("""async()=>{const H=window.__h,$=i=>document.getElementById(i),w=ms=>new Promise(r=>setTimeout(r,ms));H.run(true);H.began(Date.now());H.onFinal('ربنا موجود معانا النهارده',[]);await w(2500);
          $('go').click();await w(2000);$('closeBack').click();await w(500);$('go').click();await w(7500)}"""); n1 = len(M["reports"]); r1 = (M["reports"] or [{}])[0]
        check("report leaves 6 s after Stop, not after the 2 minute wait (Return in the first seconds sends nothing)", n1 == 1 and len(r1.get("text", [])) == 1 and "REPORT sent at Stop" in r1.get("log", ""), [n1, str(r1)[:200]])
        b0 = await pg.evaluate("""async()=>{const H=window.__h,$=i=>document.getElementById(i),w=ms=>new Promise(r=>setTimeout(r,ms)),o={b0:H.began()};$('closeBack').click();await w(300);o.b1=H.began();o.st=H.state();
          H.onFinal('المحبة لا تسقط أبدا يا أحبائي',[]);await w(2500);$('go').click();await w(7500);$('closeNew').click();await w(7500);return o}"""); R = M["reports"]; r2 = R[1] if len(R) > 1 else {}
        await pg.close()
        check("Return after the report was sent: the rest is a second part, nothing sent twice", b0["b0"] == 0 and b0["b1"] > 0 and b0["st"] == 1 and len(R) == 2 and len(r2.get("text", [])) == 1 and r2["text"][0]["ar"] != r1["text"][0]["ar"] and r2.get("log", "").split("s ", 1)[-1].startswith("SECOND PART"), [b0, len(R), str(r2)[:300]])
        M["reports"] = []; pg = await page()
        h = await pg.evaluate("""async()=>{const H=window.__h,$=i=>document.getElementById(i),w=ms=>new Promise(r=>setTimeout(r,ms)),o={};let hid=false;Object.defineProperty(document,'hidden',{get:()=>hid,configurable:true});
          const hide=v=>{hid=v;document.dispatchEvent(new Event('visibilitychange'))};await w(3000);H.run(true);H.began(Date.now());hide(true);await w(800);o.safe=!!localStorage.getItem('pendingReport');hide(false);
          H.onFinal('ربنا موجود معانا النهارده',[]);await w(2500);const b=H.began();hide(true);window.dispatchEvent(new Event('pagehide'));await w(1200);o.moved=H.began()>b;o.st=H.state();o.left=localStorage.getItem('pendingParts');o.safe2=!!localStorage.getItem('pendingReport');hide(false);
          H.onFinal('المحبة لا تسقط أبدا يا أحبائي',[]);await w(2500);$('go').click();await w(1500);hide(true);await w(1200);o.b3=H.began();hide(false);await w(7500);return o}"""); R = M["reports"]
        await pg.close()
        check("page hidden before anything was translated: nothing sent, safety copy kept", h["safe"], h)
        check("page hidden or closed: the report leaves at once and the service carries on", len(R) >= 1 and len(R[0].get("text", [])) == 1 and "REPORT sent because the page was hidden" in R[0].get("log", "") and h["moved"] and h["st"] == 1 and not h["left"] and not h["safe2"], [h, len(R), str(R[:1])[:200]])
        check("page left right after Stop: the rest leaves at once, no sentence twice, nothing more later", len(R) == 2 and len(R[1].get("text", [])) == 1 and R[1]["text"][0]["ar"] != R[0]["text"][0]["ar"] and h["b3"] == 0, [h, len(R), str(R[1:])[:300]])
        pg = await page()
        g = await pg.evaluate("""()=>{const H=window.__h,t=document.getElementById('liveTag'),s=()=>getComputedStyle(t).display;H.run(true);document.body.classList.add('running');const a=s();t.classList.add('weak');const b=s();t.classList.remove('weak');document.body.classList.remove('running');H.run(false);return {normal:a,weak:b,top:t.textContent,note:document.getElementById('betaNote').textContent,title:document.getElementById('title').textContent}}""")
        await pg.close()
        check("top: Live Translation and the excuse note; bottom: the church name", g["normal"] == "block" and g["weak"] == "block" and g["top"] == "Live TranslationPlease excuse any mistakes." and g["note"] == "St. George Coptic Orthodox Church of Norristown, PA" and g["title"] == g["note"], g)
        r = await stream("prayer"); L = r["lines"]
        check("long prayer shown in 3 pieces", len(L) == 3, [l["ar"] for l in L]); check("long prayer: all translated, none lost", all(l["en"] for l in L) and r["lost"] == 0, L)
        check("long prayer: no shifted draft or hint", all("no hint" in l["en"] and not l["draft"] for l in L), L)
        r = await stream("verse"); L = r["lines"]
        check("verse: fixed text shown once", sum(l["fx"] for l in L) == 1 and L[0]["en"].startswith("For God so loved"), L); check("verse then talk: 3 lines", len(L) == 3, [l["ar"] for l in L])
        r = await stream("opening"); L = r["lines"]
        check("slow opening prayer: one fixed line", len(L) == 1 and L[0]["fx"] == 1 and L[0]["en"].startswith("In the name of the Father"), L)
        r = await stream("sermon"); L = r["lines"]
        check("sermon sentence: 4 pieces, all translated", len(L) == 4 and all(l["en"] for l in L), L)
        U1 = 'RAW:{"new":"As our teacher Paul the Apostle said, to,","unknown":["المساوس"]}'
        M["users"] = []; e = await pieces(["كما قال معلمنا بولس الرسول إلى المساوس،", "وهؤلاء المساوس."], [U1, 'RAW:{"new":"As our teacher Paul the Apostle said, to Timothy,","names":[["المساوس","تيموثاوس"]]}', "And these, Timothy."])
        check("unknown word that sounds like a name: the name is used", len(e) == 2 and "to Timothy" in e[0], e)
        check("unknown word: names that sound like it were offered", any("Names that sound like it" in u and "تيموثاوس (Timothy)" in u for u in M["users"]), [u[-200:] for u in M["users"]])
        check("the same word later in the service is written as the name", any("NEW sentence" in u and "وهؤلاء تيموثاوس" in u for u in M["users"]), [u[:200] for u in M["users"]])
        e = await pieces(["كما قال معلمنا بولس الرسول إلى المساوس،"], [U1, 'RAW:{"new":"As our teacher Paul the Apostle said, to Boaz,","names":[["المساوس","بوعز"]]}'])
        check("a name that was not offered is refused", len(e) == 1 and "Boaz" not in e[0] and e[0].startswith("As our teacher Paul"), e)
        e = await pieces(["كما قال معلمنا بولس الرسول إلى المساوس،"], ['RAW:{"new":"As our teacher Paul the Apostle said, to the Ephesians,","fixes":[["المساوس","أفسس"]]}', 'RAW:{"new":"As our teacher Paul the Apostle said, to Timothy,","names":[["المساوس","تيموثاوس"]]}'])
        check("a word the translator swapped for a guess is settled by sound too", len(e) == 1 and "to Timothy" in e[0] and "Ephes" not in e[0], e)
        e = await pieces(["الكنيسة فرحانة النهارده بيكم كلكم."], ['RAW:{"new":"The church is happy with all of you today.","unknown":["الكنيسة"]}', "SECOND REQUEST MADE"])
        check("a real Arabic word listed as unknown starts no second request", M["n"] == 1 and e == ["The church is happy with all of you today."], [M["n"], e])
        e = await pieces(["الرب راعي فلا يعوزني شيء،", "في مراع خضر يربضني،", "إلى مياه الراحة يوردني"]); check("psalm in 3 pieces: 2 lines, no repeat", len(e) == 2, e)
        e = await pieces(["بسم الآب والابن والروح القدس،", "الإله الواحد، آمين"]); check("opening prayer in 2 pieces: 1 line", len(e) == 1, e)
        e = await pieces(["يا رب ارحم يا رب ارحم"] * 3, ["Lord have mercy. Lord have mercy."] * 3); check("Lord have mercy said 3 times stays 3", len(e) == 3, e)
        e = await pieces(["حين أيضًا أيها السيد الرب الإله،", "ضابط الكل الذي أرسلته الوحيد إلى العالم، علم الناموس والوصايا،"],
            ["O Master, Lord God, the Pantocrator, who sent Your only Son into the world,", "Pantocrator, who sent Your only Son into the world, the Law and the commandments"])
        check("translator ran ahead: repeat removed", len(e) == 2 and e[1] == "The Law and the commandments", e)
        r = await stream("x", ar=LONG, en="word " * 60, gap=200, tail=7000, m={"delay": 1.5}); L = r["lines"]; d = sorted(l["late"] for l in L if l["late"] is not None)
        check("normal pace: nothing lost", r["lost"] == 0 and all(l["en"] for l in L) and len(L) >= 8, (len(L), r["lost"]))
        check("normal pace: middle line under 4 s", bool(d) and d[len(d) // 2] < 4, d)
        r = await stream("x", ar=LONG, en="word " * 60, gap=200, tail=14000, m={"delay": 1.0, "fail_until": time.time() + 5 + 14}); L = r["lines"]
        check("translator down 14 s: nothing lost", r["lost"] == 0 and all(l["en"] for l in L) and len(L) >= 8, (len(L), r["lost"]))
        check("no page errors", not errs, errs[:3]); await b.close()
    srv.shutdown(); print("\n%d failed" % len(FAILS) if FAILS else "\nall passed"); sys.exit(1 if FAILS else 0)
asyncio.run(main())
