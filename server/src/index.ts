import awsLambdaFastify from '@fastify/aws-lambda';
import fastify from 'fastify';

import { lineBotRouter } from './routes/line/bot';
import { lineNotifyRouter } from './routes/line/notify';
import { withingsAuthRouter } from './routes/withings/auth';
import { withingsWebhookRouter } from './routes/withings/webhook';

const app = fastify();

app.get('/', (request, reply) => {
  reply.send({ hello: 'world' });
});

app.register(lineBotRouter, { prefix: '/line/bot' });
app.register(lineNotifyRouter, { prefix: '/line/notify' });
app.register(withingsAuthRouter, { prefix: '/withings/auth' });
app.register(withingsWebhookRouter, { prefix: '/withings/webhook' });

export const handler = awsLambdaFastify(app);
