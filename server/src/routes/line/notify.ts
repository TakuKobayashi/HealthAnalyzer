import { NextFunction, Request, Response } from 'express';
import axios from 'axios';
import { URLSearchParams } from 'url';
import { DynamoDBORM } from 'node-dynamodb-orm';

const uuid = require('uuid/v4');
const querystring = require('querystring');
const express = require('express');
const lineNotifyRouter = express.Router();

const LINE_NOTIFY_BASE_URL = 'https://notify-api.line.me';
const LINE_NOTIFY_AUTH_BASE_URL = 'https://notify-bot.line.me';

lineNotifyRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  const accountsTable = new DynamoDBORM('accounts');
  const accounts = await accountsTable.all().catch(err => {
    console.log(err);
    res.send('hello line');
  });
  console.log(accounts);
  res.send('hello line');
});

lineNotifyRouter.get('/auth', (req: Request, res: Response, next: NextFunction) => {
  const stateString = uuid();
  res.cookie('state', stateString);
  const lineOauthParams = {
    response_type: "code",
    client_id: process.env.LINE_NOTIFY_CLIENT_ID,
    scope: "notify",
    state: stateString,
    redirect_uri: req.protocol + '://' + req.hostname + "/line/notify/callback"
  }
  res.redirect(LINE_NOTIFY_AUTH_BASE_URL + "/oauth/authorize?" + querystring.stringify(lineOauthParams));
});

lineNotifyRouter.get('/callback', async (req: Request, res: Response, next: NextFunction) => {
  const lineOauthParams = {
    grant_type: "authorization_code",
    client_id: process.env.LINE_NOTIFY_CLIENT_ID,
    client_secret: process.env.LINE_NOTIFY_CLIENT_SECRET,
    code: req.query.code,
    redirect_uri: req.protocol + '://' + req.hostname + "/line/notify/callback"
  }
  const result = await axios.post(LINE_NOTIFY_AUTH_BASE_URL + "/oauth/token?" + querystring.stringify(lineOauthParams)).catch(err => {
    console.log(err)
    res.redirect("/");
  })
  res.json(result.data);
});

lineNotifyRouter.get('/notify', async (req: Request, res: Response, next: NextFunction) => {
  const messages = new URLSearchParams();
  messages.append('message', 'aaaa');

  const response = await axios.post(LINE_NOTIFY_BASE_URL + "/api/notify", messages, {
    headers: {
      "Authorization": 'Bearer ',
    }
  }).catch(err => {
    console.log(err);
    res.send('error');
  });
  res.send(response.data);
});

export { lineNotifyRouter };
