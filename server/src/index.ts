import awsLambdaFastify from '@fastify/aws-lambda'
import fastify from 'fastify'

import { lineBotRouter } from './routes/line/bot';
import { lineNotifyRouter } from './routes/line/notify';

const app = fastify();

app.get('/', (request, reply) => {
  reply.send({ hello: 'world' })
});


app.register(lineBotRouter, { prefix: '/line/bot' });
app.register(lineNotifyRouter, { prefix: '/line/notify' });

export const handler = awsLambdaFastify(app);
