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
