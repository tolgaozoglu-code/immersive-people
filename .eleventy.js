module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("favicon.ico");
  eleventyConfig.addCollection("insights", (api) =>
    api.getFilteredByTag("insight").sort((a, b) => b.date - a.date)
  );
  eleventyConfig.addCollection("media", (api) =>
    api.getFilteredByTag("media").sort((a, b) => (a.data.order || 0) - (b.data.order || 0))
  );
  // YouTube/Vimeo bağlantısını gömme adresine çevirir; tanınmayan adres olduğu gibi kalır.
  eleventyConfig.addFilter("embedUrl", (url) => {
    if (!url) return "";
    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/);
    if (yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1`;
    const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vm) return `https://player.vimeo.com/video/${vm[1]}?autoplay=1`;
    return url;
  });
  eleventyConfig.addCollection("production", (api) =>
    api.getFilteredByTag("production").sort((a, b) => (a.data.order || 0) - (b.data.order || 0))
  );
  return {
    dir: { input: ".", includes: "_includes", data: "_data", output: "_site" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk"
  };
};
