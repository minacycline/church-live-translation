#!/usr/bin/env python3
"""Tests run before any page is written. A fake hearing stream and a fake translator drive the real page in a browser. Exit 1 = a test failed."""
import asyncio, functools, http.server, json, os, re, shutil, sys, tempfile, threading, time
from playwright.async_api import async_playwright
PAGE = sys.argv[1] if len(sys.argv) > 1 else "test/index.html"
EXPORT = ("window.__h={fix:function(t){return applyFixes(fixNames(cleanHeard(t,true)))},terms:function(){return sxStart().context.terms},"
 "ctxLen:function(){return JSON.stringify(sxStart().context).length},sxMessage:function(m){return sxMessage(m,DG.ws)},onFinal:onFinal,"
 "lines:function(){return lines},DG:DG,setSX:function(x){SX=x},dbg:function(){return DBG.slice()},run:function(v){running=v;DBG0=Date.now()}};")
M = {"delay": 0.3, "fail_until": 0, "replies": [], "n": 0}
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
        t = M["replies"].pop(0) if M["replies"] else "Line %d of the talk, %s." % (M["n"], "with hint" if "rough English" in u else "no hint")
        await asyncio.sleep(M["delay"])
        return await r.fulfill(status=200, content_type="application/json", headers=H,
            body=json.dumps({"content": [{"type": "text", "text": json.dumps({"new": t})}], "usage": {"input_tokens": 1, "output_tokens": 1}}))
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
        v = await pg.evaluate("()=>{const H=window.__h,t=H.terms();return {syn:t.filter(x=>/نكس|نكز/.test(x)).length,ath:t.includes('أثناسيوس'),ctx:H.ctxLen(),fix:H.fix('إلى أهل القديس سينكسار.'),keep:H.fix('قرأنا في السنكسار عن القديس')}}")
        await pg.close()
        check("hearing word list: one spelling of Synaxarium", v["syn"] == 1, v); check("hearing word list: Athanasius on its own", v["ath"], v)
        check("hearing word list under 8,600 characters", v["ctx"] <= 8600, v["ctx"]); check("Saint Synaxarium repaired to Athanasius", "أثناسيوس" in v["fix"], v["fix"])
        check("the word Synaxarium itself is kept", "السنكسار" in v["keep"], v["keep"])
        r = await stream("prayer"); L = r["lines"]
        check("long prayer shown in 3 pieces", len(L) == 3, [l["ar"] for l in L]); check("long prayer: all translated, none lost", all(l["en"] for l in L) and r["lost"] == 0, L)
        check("long prayer: no shifted draft or hint", all("no hint" in l["en"] and not l["draft"] for l in L), L)
        r = await stream("verse"); L = r["lines"]
        check("verse: fixed text shown once", sum(l["fx"] for l in L) == 1 and L[0]["en"].startswith("For God so loved"), L); check("verse then talk: 3 lines", len(L) == 3, [l["ar"] for l in L])
        r = await stream("opening"); L = r["lines"]
        check("slow opening prayer: one fixed line", len(L) == 1 and L[0]["fx"] == 1 and L[0]["en"].startswith("In the name of the Father"), L)
        r = await stream("sermon"); L = r["lines"]
        check("sermon sentence: 4 pieces, all translated", len(L) == 4 and all(l["en"] for l in L), L)
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
