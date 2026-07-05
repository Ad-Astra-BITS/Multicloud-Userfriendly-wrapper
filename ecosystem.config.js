module.exports = {
  apps: [
    {
      name: 'ad-astra-backend',
      script: './backend/dist/server.js',
      cwd: '/var/www/ad-astra',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      restart_delay: 3000,
      max_restarts: 10,
    },
    {
      name: 'ad-astra-frontend',
      script: 'npm',
      args: 'start',
      cwd: '/var/www/ad-astra',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
