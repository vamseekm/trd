/*
const standardOptons = {
    watch: ["."],
    watch_delay: 1000,
    autorestart: false,
    interpreter: "go",
    interpreter_args: "run",
    env: {
      PORT: 3000
    }
}

const appOptionList = [
  {
    script: "main.go",
    name: "api_server",
    args: "--apiserver",
    env: {
      PORT: 3000
    },
    enabled: true,
  },
  {
    name: "migrate",
    script: "migrate.go",
    args: "--migrate",
    enabled: false,
  }
]
const apps = appOptionList.map((appOptions) => {
  const {enabled, ...restOfTheOptions} = appOptions;
  if (enabled) {
    return Object.assign({}, standardOptons, restOfTheOptions);
  }
}).filter((app) => !!app);

console.log(apps);

module.exports = {
  apps
};
*/

module.exports = {
    apps: [
        {
            name: 'api-server',
            interpreter: 'bash',
            script: './server_dev.sh',
            args: '--api-server',
        },
    ],
};
