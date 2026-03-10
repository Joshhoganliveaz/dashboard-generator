/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["papaparse"],
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.html$/,
      type: "asset/source",
    });
    return config;
  },
};

module.exports = nextConfig;
