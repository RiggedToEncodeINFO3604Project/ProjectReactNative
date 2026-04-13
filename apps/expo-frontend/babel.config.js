module.exports = function (api) {
  api.cache(true);

  try {
    require.resolve("babel-preset-expo");
    return {
      presets: ["babel-preset-expo"],
    };
  } catch (error) {
    if (!api.env("test")) {
      throw error;
    }
  }

  return {
    plugins: [
      [
        "@babel/plugin-transform-typescript",
        {
          allowDeclareFields: true,
        },
      ],
      "@babel/plugin-transform-modules-commonjs",
    ],
  };
};
