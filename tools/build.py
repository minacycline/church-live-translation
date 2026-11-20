#!/usr/bin/env python3
"""Joins src/ into the four pages. check = compare with the pages in the repo; test = write the two test pages; live = write all four; guard = stop if a page was edited by hand; version = print the build number."""
import hashlib, json, os, re, sys
BADGE = None
def page():
    names = [l.strip() for l in open("src/parts.txt", encoding="utf-8") if l.strip() and not l.startswith("#")]
    return "".join(open(os.path.join("src", n), encoding="utf-8", newline="").read() for n in names)
def variants(root):
    L = root.split("\n")
    b = next(i for i, l in enumerate(L) if l.startswith('<meta name="build"'))
    body = next(i for i, l in enumerate(L) if l.startswith("<body"))
    badge = open("src/test-badge.html", encoding="utf-8", newline="").read().rstrip("\n")
    def make(base, admin, test):
        o = L[:b + 1] + ([base] if base else []) + (['<meta name="view" content="admin">'] if admin else []) + L[b + 1:body + 1]
        o += (['<div id="admTag">ADMIN</div>'] if admin else []) + ([badge] if test else []) + L[body + 1:]
        return "\n".join(o)
    return {"index.html": root, "admin/index.html": make('<base href="../">', True, False),
            "test/index.html": make('<base href="../">', False, True), "test/admin/index.html": make('<base href="../../">', True, True)}
def sha(s): return hashlib.sha256(s.encode("utf-8")).hexdigest()
def version(root): return re.search(r'name="build" content="([^"]+)"', root).group(1)
if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "check"
    V = variants(page()); bad = []
    if mode == "version": print(version(V["index.html"])); sys.exit(0)
    if mode == "guard":  # a page changed by hand since the last build would be overwritten: stop and say so
        rec = json.load(open("src/built.json")) if os.path.exists("src/built.json") else {}
        for f in V:
            if f in rec and sha(open(f, encoding="utf-8", newline="").read()) != rec[f]: bad.append(f)
        print("pages changed outside src/: " + ", ".join(bad) if bad else "pages are as the last build left them")
        sys.exit(1 if bad else 0)
    if mode == "check":
        for f, s in V.items():
            cur = open(f, encoding="utf-8", newline="").read()
            if cur != s: bad.append(f)
        print("version", version(V["index.html"]), "differs: " + ", ".join(bad) if bad else "all four pages equal the build")
        sys.exit(1 if bad else 0)
    which = list(V) if mode == "live" else ["test/index.html", "test/admin/index.html"]
    for f in which: open(f, "w", encoding="utf-8", newline="").write(V[f])
    rec = json.load(open("src/built.json")) if os.path.exists("src/built.json") else {}
    for f in which: rec[f] = sha(V[f])
    rec["version:" + ("live" if mode == "live" else "test")] = version(V["index.html"])
    json.dump(rec, open("src/built.json", "w"), indent=1, sort_keys=True)
    print("wrote", ", ".join(which), "version", version(V["index.html"]))
