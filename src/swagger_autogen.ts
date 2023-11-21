import 'dotenv/config';
import swaggerAutogen from 'swagger-autogen';

const outputFile = './swagger.json'
const endpointsFiles = [
  './routes/modules/*.ts',
]

const doc = {
    info: {
        version: "1.0.0",
        title: "API de Mensageria",
        description: "API para envio de mensagens via Whatsapp"
    },
    host: process.env.API_URL,
    basePath: "/",
    schemes: ['http', 'https'],
    consumes: ['application/json'],
    produces: ['application/json'],
    tags: [
        {
            "name": "Whatsapp",
            "description": "Endpoints"
        }
    ],
    securityDefinitions: {
        apiKeyAuth:{
            type: "apiKey",
            in: "header",       // can be "header", "query" or "cookie"
            name: "x-auth-api",  // name of the header, query parameter or cookie
            description: "API Key para ter acesso ao endpoint"
        }
    },
    definitions: {
        SendWhatsappMessage: {
            phone: "71999998888",
            message: "Mensagem que deseja enviar"
        },
        SendedWhatsappMessage: {
            key: {
              remoteJid: "5571999998888@s.whatsapp.net",
              fromMe: true,
              id: "abcdefgh"
            },
            message: {
              extendedTextMessage: {
                text: "Mensagem enviada"
              }
            },
            messageTimestamp: "2342424",
            status: "PENDING"
        },
        IsNotWhatsappNumber: {
          error: "Este número não está cadastrado no Whatsapp"
        }
    }
}

swaggerAutogen(outputFile, endpointsFiles, doc)
