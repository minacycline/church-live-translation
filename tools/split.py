#!/usr/bin/env python3
"""One-time: cut index.html into the parts under src/. Joined in order they give back the same page, character for character."""
import os, sys
CUTS = [  # (file name, text that the first line of the part contains)
 ("00-head.html", "<!doctype html>"),
 ("10-style-base.html", "<style>"),
 ("11-style-light.html", "<style>"),
 ("12-style-screen.html", "<style>"),
 ("13-style-app.html", "<style>"),
 ("20-body-top.html", "</head>"),
 ("21-style-running.html", "<style>"),
 ("22-body-screen-and-settings.html", "<main>"),
 ("30-peerjs.html", "<script>/* PeerJS"),
 ("31-engines-off-and-word-files.html", "<script>"),
 ("40-app-start-and-keys.js", "<script>"),
 ("41-title-and-settings.js", "// ---- title and settings ----"),
 ("42-library-verses-prayers.js", "// ---- library: your pairs"),
 ("43-readings-of-the-day.js", "// ---- today's readings"),
 ("44-caption-screen-and-ready-check.js", "// ---- captions ----"),
 ("45-other-screens-off.js", "// ---- other screens:"),
 ("46-screen-fit-learned-fixes-debug-log.js", "// ---- for whoever runs it"),
 ("47-names-and-old-translators.js", "// ---- free translation (MyMemory) ----"),
 ("48-restricted-devices-screen.js", "// ---- v123:"),
 ("49-translator-claude-and-health-check.js", "function serviceDown(key,msg){"),
 ("50-coptic-calendar-and-quick-translate.js", "// ---- Coptic calendar"),
 ("51-sentence-to-translation.js", "function waitAhead(item){"),
 ("52-viewer-mode.js", "// ---- viewer mode"),
 ("53-review-sheet.js", "// ---- review sheet"),
 ("54-transcripts-and-usage.js", "// ---- transcripts:"),
 ("55-heard-text-cleaning-and-name-repair.js", "// ---- speech: Whisper through Groq"),
 ("56-hearing-setup-word-list.js", "// ---- streaming hearing engine"),
 ("57-hearing-sentence-cutting.js", "// v110: English said fast"),
 ("58-hearing-weak-wifi-hold.js", "// v79 hold and resend"),
 ("59-hearing-connection.js", "function dgOpen(){"),
 ("60-heard-sentence-and-old-engines.js", "function dgFinal(text,sx){"),
 ("61-short-pieces-and-recording.js", "function joinAndFinal(t,alt){"),
 ("62-microphone-sound.js", "// -- audio capture:"),
 ("63-microphone-start-and-tap-to-resume.js", "// v100: when the device needs a touch"),
 ("64-start-stop-closing-screen.js", "async function start(){"),
 ("65-service-report.js", "// v99 service report"),
 ("66-live-test-replay.js", "// ---- live test:"),
 ("67-user-and-admin-views.js", "// ---- v102: two views"),
 ("68-admin-cost.js", "// ---- v120:"),
 ("69-admin-devices.js", "// ---- v122: Devices."),
]
README = """# How this app is changed (since 2026-11-20)

The four pages (index.html, admin/index.html, test/index.html, test/admin/index.html) are BUILT. Never edit them by hand.

1. Change the small files in this folder (src/). parts.txt lists them in order.
2. Every change here starts the "Build and test" action. It joins the parts, runs tests/run.py in a real browser,
   and only if every test passes writes the two TEST pages. A failed test writes nothing.
3. To publish to the church link: put the build number (for example v139) in publish.txt at the top of the repo.
   The action runs the tests again and then writes all four pages.
4. Bump the build number in 00-head.html with every change.
5. A part left out of parts.txt (a line starting with #) is kept here but not in the page.
"""
def main(page="index.html", out="src"):
    lines = open(page, encoding="utf-8", newline="").read().splitlines(keepends=True)
    starts, at = [], 0
    for name, mark in CUTS:
        while at < len(lines) and mark not in lines[at]: at += 1
        if at >= len(lines): sys.exit("cut point not found: " + name + " / " + mark)
        starts.append(at); at += 1
    os.makedirs(out, exist_ok=True)
    for i, (name, _) in enumerate(CUTS):
        end = starts[i + 1] if i + 1 < len(CUTS) else len(lines)
        open(os.path.join(out, name), "w", encoding="utf-8", newline="").write("".join(lines[starts[i]:end]))
    open(os.path.join(out, "parts.txt"), "w", encoding="utf-8").write(
        "# The page is these files joined in this order. A line starting with # is left out.\n" + "\n".join(n for n, _ in CUTS) + "\n")
    t = open("test/index.html", encoding="utf-8", newline="").read().split("\n")
    badge = [l for l in t if 'background:#6d28d9' in l and l.startswith("<div")][0]
    open(os.path.join(out, "test-badge.html"), "w", encoding="utf-8", newline="").write(badge + "\n")
    open(os.path.join(out, "README.md"), "w", encoding="utf-8").write(README)
    print("cut into", len(CUTS), "parts")
if __name__ == "__main__": main(*sys.argv[1:])
