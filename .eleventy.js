module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addCollection("insights", (api) =>
    api.getFilteredByTag("insight").sort((a, b) => b.date - a.date)
  );
  eleventyConfig.addCollection("production", (api) =>
    api.getFilteredByTag("production").sort((a, b) => (a.data.order || 0) - (b.data.order || 0))
  );
  return {
    dir: { input: ".", includes: "_includes", data: "_data", output: "_site" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk"
  };
};
