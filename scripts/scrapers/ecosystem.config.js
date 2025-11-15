module.exports = {
  apps: [
    {
      name: 'amz-cron-campanhas',
      script: './cron/executar-campanhas.js',
      cwd: '/opt/amz-ofertas/scrapers',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/opt/amz-ofertas/logs/cron-error.log',
      out_file: '/opt/amz-ofertas/logs/cron-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
