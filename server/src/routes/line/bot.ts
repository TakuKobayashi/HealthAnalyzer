import { NextFunction, Request, Response } from 'express';

import { setupFireStore } from '../../common/firestore';
import {Profile} from "@line/bot-sdk";

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

async function handleEvent(event): Promise<void> {
  console.log(event);
  console.log(JSON.stringify(event));
  const firestore = setupFireStore();

  if (event.type === 'follow') {
    const profile = await getLineUser(event.source.userId);
    await firestore.collection("LineUsers").doc(event.source.userId).set({
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl,
    });
  } else if(event.type === 'unfollow') {
    await firestore.collection("LineUsers").doc(event.source.userId).delete();
  }

  if (event.type === 'message' || event.message.type === 'text') {
    // create a echoing text message
    const echo = { type: 'text', text: event.message.text };

    // use reply API
    await client.replyMessage(event.replyToken, echo);
  }
}

async function getLineUser(userId: string): Promise<Profile> {
  return client.getProfile(userId);
}

export { lineBotRouter };
