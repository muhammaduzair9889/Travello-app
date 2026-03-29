const path = require('path');

module.exports = function override(config) {
  // Ignore source map warnings for @mediapipe package
  config.ignoreWarnings = [
    {
      module: /node_modules\/@mediapipe\/tasks-vision/,
      message: /Failed to parse source map/,
    },
  ];

  // Alternative: disable source-map-loader for problematic packages
  config.module.rules = config.module.rules.map(rule => {
    if (rule.oneOf) {
      return {
        ...rule,
        oneOf: rule.oneOf.map(oneOfRule => {
          if (oneOfRule.loader && oneOfRule.loader.includes('source-map-loader')) {
            return {
              ...oneOfRule,
              exclude: [
                ...(oneOfRule.exclude || []),
                /node_modules\/@mediapipe/,
              ],
            };
          }
          return oneOfRule;
        }),
      };
    }
    return rule;
  });

  return config;
};
