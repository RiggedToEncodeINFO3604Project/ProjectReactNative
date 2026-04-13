module.exports = {
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
