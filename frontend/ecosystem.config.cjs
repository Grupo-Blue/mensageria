module.exports = {
  apps: [{
    name: 'mensageria-frontend',
    script: 'npm',
    args: 'start',
    cwd: '/root/mensageria/frontend',
    env: {
      NODE_ENV: 'production',
      PORT: '3000',
      DATABASE_URL: 'mysql://root:IU2rLn5sUMp047f3N6@localhost:3306/mensageria_frontend',
      GOOGLE_CLIENT_ID: '556550009781-j77mg98jt90sa6ciaknbe0tldvt6ii2p.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: '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',
      JWT_SECRET: 'mensageria-jwt-secret-production-key-2024',
      BACKEND_API_URL: 'http://localhost:5600',
      BACKEND_API_TOKEN: 'fde0ce0b7751cde985ef240e3c5bec0a26901d94c22e02f8c54c16784de49a04',
      OAUTH_SERVER_URL: 'https://mensageria.grupoblue.com.br'
    }
  }]
}
