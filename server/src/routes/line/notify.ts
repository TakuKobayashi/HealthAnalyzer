import axios from 'axios';
import { URLSearchParams } from 'url';
import { stringify } from 'querystring'

import { setupFireStore } from '../../common/firestore';

import { v4 as uuidv4 } from 'uuid';

const LINE_NOTIFY_BASE_URL = 'https://notify-api.line.me';
const LINE_NOTIFY_AUTH_BASE_URL = 'https://notify-bot.line.me';

export async function lineNotifyRouter(app, opts): Promise<void> {
  app.get('/', async (req, res) => {
    res.send('hello line');
  });
  app.get('/auth', async (req, res) => {
    const stateString = uuidv4();
    const currentBaseUrl = [req.protocol + '://' + req.hostname, req.awsLambda.event.requestContext.stage].join('/');
    const lineOauthParams = {
      response_type: 'code',
      client_id: process.env.LINE_NOTIFY_CLIENT_ID,
      scope: 'notify',
      state: stateString,
      redirect_uri: currentBaseUrl + "/line/notify/callback",
    };
    res.redirect(LINE_NOTIFY_AUTH_BASE_URL + '/oauth/authorize?' + stringify(lineOauthParams));
  });
  app.get('/message', async (req, res) => {
    const currentBaseUrl = [req.protocol + '://' + req.hostname, req.awsLambda.event.requestContext.stage].join('/');
    const lineOauthParams = {
      grant_type: 'authorization_code',
      client_id: process.env.LINE_NOTIFY_CLIENT_ID,
      client_secret: process.env.LINE_NOTIFY_CLIENT_SECRET,
      code: req.query.code,
      redirect_uri: currentBaseUrl + "/line/notify/callback",
    };
    const result = await axios.post(LINE_NOTIFY_AUTH_BASE_URL + '/oauth/token?' + stringify(lineOauthParams)).catch((err) => {
      console.log(err);
      res.redirect('/');
    });
    const firestore = setupFireStore();
    await firestore.collection('LineNotifyUsers').doc(result.data.access_token).set({
      created_at: new Date(),
    });
    return result.data;
  });
  app.get('/notify', async (req, res) => {
    const messages = new URLSearchParams();
    messages.append('message', 'testtest');
    const firestore = setupFireStore();
    const docsQuery = await firestore.collection('LineNotifyUsers').get();
    const responses = await Promise.all(
      docsQuery.docs.map((doc) => {
        return axios.post(LINE_NOTIFY_BASE_URL + '/api/notify', messages, {
          headers: {
            Authorization: 'Bearer ' + doc.id,
          },
        });
      }),
    );
    return responses.map((response) => response.data);
  });
}