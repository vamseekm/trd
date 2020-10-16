const commonConfig = { name: "unknown" };

function serverRun({ args, ...otherOptions }) {
  return {
    ...commonConfig,
    script: "node",
    cwd: "./server/",
    // args: `run dist:run -- ${cmd}`,
    args: `-r source-map-support/register dist/cli/index.js ${args}`,
    env: {
      NODE_ENV: "dev",
    },
    max_restarts: 5,
    min_uptime: 10000,
    ...otherOptions,
  };
}

function bashRun(opts) {
  return {
    ...commonConfig,
    script: "bash",
    autorestart: true,
    ...opts,
  };
}

module.exports = {
  apps: [
    serverRun({ name: "api-server", args: "--API::startServer" }),
    serverRun({
      name: "tick-processor",
      args:
        "--Event::startTickRawConsumer --Event::startTickStoreConsumer --Event::startTickProcessConsumer",
      // args: "--Event::startTickRawConsumer --Event::startTickProcessConsumer",
    }),

    serverRun({
      name: "tick-listener",
      args: "--Event::startTickListener",
    }),

    bashRun({ name: "redis-server", args: "./bin/redis.sh" }),
    {
      name: "client-server",
      script: "yarn",
      args: "client:dev",
      cwd: "./client",
      autorestart: true,
    },

    bashRun({ name: "gateway", args: "./bin/gateway.sh" }),
    bashRun({ name: "redis-commander", args: "./bin/redis-commander.sh" }),
  ],
};
