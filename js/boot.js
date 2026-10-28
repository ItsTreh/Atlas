/* The interface hides what it is about to reveal only while its scripts
   run. An error before the page has started (app.js marks it booted)
   drops the class, so what is written shows instead of a blank screen.
   A file, not inline in index.html, so the page's Content-Security-Policy
   can allow scripts from the page's own files only. */
document.documentElement.classList.add("js");
addEventListener("error", function () {
  if (!document.documentElement.hasAttribute("data-booted")) document.documentElement.classList.remove("js");
});
