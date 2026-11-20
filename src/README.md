# How this app is changed (since 2026-11-20)

The four pages (index.html, admin/index.html, test/index.html, test/admin/index.html) are BUILT. Never edit them by hand.

1. Change the small files in this folder (src/). parts.txt lists them in order.
2. Every change here starts the "Build and test" action. It joins the parts, runs tests/run.py in a real browser,
   and only if every test passes writes the two TEST pages. A failed test writes nothing.
3. To publish to the church link: put the build number (for example v139) in publish.txt at the top of the repo.
   The action runs the tests again and then writes all four pages.
4. Bump the build number in 00-head.html with every change.
5. A part left out of parts.txt (a line starting with #) is kept here but not in the page.
