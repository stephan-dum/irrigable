const gulp_html_minify = require('gulp-html-minifier');
const irrigable_html = require("@aboutweb/irrigable-html");
const html_highlight = require("@aboutweb/irrigable-html-highlight");
const html_import = require("@aboutweb/irrigable-html-import");
const html_css = require("@aboutweb/irrigable-html-css");
const html_img = require("@aboutweb/irrigable-html-img");

module.exports = {
  filter : "*.{html,hl}",
  pipeline : [
    irrigable_html({
      elements : [
        html_highlight(),
        html_css(),
        html_img(),
        html_import()
      ]
    }), {
      construct : gulp_html_minify,
      args : {
        collapseWhitespace : true,
        minifyJS : true,
        minifyCSS : true,
        removeComments : true,
        removeCommentsFromCDATA : true,
        collapseBooleanAttributes : true,
        preventAttributesEscaping : true,
        useShortDoctype : true,
        removeScriptTypeAttributes : true,
        removeStyleLinkTypeAttributes : true,
        keepClosingSlash : true,
        ignoreCustomComments : [/^!|#/]
      }
    }
  ]
};
