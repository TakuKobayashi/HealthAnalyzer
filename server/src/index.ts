import serverlessExpress from '@vendia/serverless-express';
import express from 'express';
import bodyParser from 'body-parser';

import { lineBotRouter } from './routes/line/bot';
import { lineNotifyRouter } from './routes/line/notify';
import { sensorsAdminRouter } from './routes/sensors/admin';

const app = express();

app.use(bodyParser.text({ type: '*/*' }));
app.use(bodyParser.urlencoded({ extended: false }));

app.use('/sensor/admin', sensorsAdminRouter);
app.use('/line/bot', lineBotRouter);
app.use('/line/notify', lineNotifyRouter);

app.get('/test', (req, res, next) => {
  res.status(200).json({
    message: 'Hello from root!',
  });
});

export const handler = serverlessExpress({ app });
