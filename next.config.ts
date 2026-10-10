import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/api/family-data": ["./private-data/**/*.json"],
    "/api/photos/\\[...filename\\]": ["./private-media/**/*"],
  },
};
export default config;
