import 'dotenv/config';
import app from './app';
import socket from './libs/socket';
import connect from './services/Baileys';

const port = process.env.PORT || process.env.LOCAL_PORT || 3333;
const server = app.listen(port, () => {
  console.log(`🚀 Server started on port ${port}!`);
});
socket.init(server);
connect();
