/* The Male_Body sculpture is the anatomy stage's figure
   (js/anatomy-model-male-body.js, 8 MB). index.html?anatomy=procedural
   leaves it out, showing the procedural figure it replaced. Written in
   while the page is still parsing, so it runs before anatomy-regions.js. */
var MALE_BODY_SRC = "js/anatomy-model-male-body.js";
if (new URLSearchParams(location.search).get("anatomy") !== "procedural")
  document.write('<script src="' + MALE_BODY_SRC + '"><\/script>');
