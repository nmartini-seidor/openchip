import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  transpilePackages: ["@openchip/shared", "@openchip/workflow", "@openchip/db", "@openchip/integrations"]
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withWorkflow(withNextIntl(nextConfig));
