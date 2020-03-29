import { NextFunction, Request, Response } from 'express';

const express = require('express');
const lineBotRouter = express.Router();

const config = {
  channelAccessToken: process.env.LINE_BOT_CHANNEL_ACCESSTOKEN,
  channelSecret: process.env.LINE_BOT_CHANNEL_SECRET,
};

const line = require('@line/bot-sdk');
const client = new line.Client(config);

lineBotRouter.get('/', (req: Request, res: Response, next: NextFunction) => {
  res.send('hello line');
});

lineBotRouter.get('/push_message', async (req: Request, res: Response, next: NextFunction) => {
  const message = {
    type: 'text',
    text: 'これはテストです'
  };
  const result = await client.pushMessage("U624a1ccd6eecd40f4ea4723327776b8f", message)
  console.log(result);
  res.send('hello line');
});

lineBotRouter.post('/message', line.middleware(config), (req: Request, res: Response, next: NextFunction) => {
  console.log(JSON.stringify(req.body));
  Promise
  .all(req.body.events.map(handleEvent))
  .then((result) => res.json(result))
  .catch((err) => {
    console.error(err);
    res.status(200).end();
  });
});

function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    // ignore non-text-message event
    return Promise.resolve(null);
  }

  // create a echoing text message
  const echo = { type: 'text', text: event.message.text };

  // use reply API
  return client.replyMessage(event.replyToken, echo);
}

export { lineBotRouter };
