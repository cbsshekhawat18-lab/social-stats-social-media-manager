// Accessible names the theme leaves out: the search dialog and each code
// block's toolbar (a <nav>, so each needs a name of its own). Runs after
// every page load, once the theme has mounted its components.
document$.subscribe(function () {
  setTimeout(function () {
    var search = document.querySelector(".md-search[role=dialog]");
    if (search) search.setAttribute("aria-label", "Search");
    document.querySelectorAll(".md-code__nav").forEach(function (nav, i) {
      nav.setAttribute("aria-label", "Code block " + (i + 1));
    });
  }, 0);
});
