module.exports = function (api) {
  const isTest = api.env("test");
  api.cache.using(() => isTest);

  try {
    require.resolve("babel-preset-expo");
    return {
      presets: ["babel-preset-expo"],
    };
  } catch (error) {
    if (!isTest) {
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
