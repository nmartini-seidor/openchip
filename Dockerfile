FROM node:22-alpine

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm install --frozen-lockfile

EXPOSE 3000

CMD ["pnpm", "--filter", "@openchip/web", "exec", "next", "dev", "--turbopack", "--hostname", "0.0.0.0", "--port", "3000"]
