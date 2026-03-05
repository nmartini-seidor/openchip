import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  transpilePackages: ["@openchip/shared", "@openchip/workflow", "@openchip/db", "@openchip/integrations"]
};

export default withWorkflow(nextConfig);
