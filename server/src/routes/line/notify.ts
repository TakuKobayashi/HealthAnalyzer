import axios from 'axios';
import { URLSearchParams } from 'url';
import { stringifyUrl } from 'query-string';

import { setupFireStore } from '../../common/firestore';
import { LineNotifyOauthTokenResponse } from '../../interfaces/line';
import { lineNotifyUsersCollectionName } from '../../types/line';

import { v4 as uuidv4 } from 'uuid';

const LINE_NOTIFY_BASE_URL = 'https://notify-api.line.me';
const LINE_NOTIFY_AUTH_BASE_URL = 'https://notify-bot.line.me';

export async function lineNotifyRouter(app, opts): Promise<void> {
  app.get('/', async (req, res) => {
    res.send('hello line');
  });
  app.get('/auth', async (req, res) => {
    const stateString = uuidv4();
    const currentBaseUrl = ['https://' + req.hostname, req.awsLambda.event.requestContext.stage].join('/');
    const lineOauthParams = {
      response_type: 'code',
      client_id: process.env.LINE_NOTIFY_CLIENT_ID,
      scope: 'notify',
      state: stateString,
      redirect_uri: currentBaseUrl + '/line/notify/callback',
    };
    res.redirect(stringifyUrl({ url: LINE_NOTIFY_AUTH_BASE_URL + '/oauth/authorize', query: lineOauthParams }));
  });
  app.get('/callback', async (req, res) => {
    const currentBaseUrl = ['https://' + req.hostname, req.awsLambda.event.requestContext.stage].join('/');
    if (!req.query.code) {
      res.redirect(currentBaseUrl);
      return {};
    }
    const lineOauthParams = {
      grant_type: 'authorization_code',
      client_id: process.env.LINE_NOTIFY_CLIENT_ID,
      client_secret: process.env.LINE_NOTIFY_CLIENT_SECRET,
      code: req.query.code,
      redirect_uri: currentBaseUrl + '/line/notify/callback',
    };
    const result = await axios
      .post<LineNotifyOauthTokenResponse>(stringifyUrl({ url: LINE_NOTIFY_AUTH_BASE_URL + '/oauth/token', query: lineOauthParams }))
      .catch((err) => {
        console.log(err);
      });
    if (!result) {
      res.redirect(currentBaseUrl);
      return {};
    }
    // resultはこんな感じ
    // {"status":200,"message":"access_token is issued","access_token":"..."}
    const firestore = setupFireStore();
    await firestore.collection(lineNotifyUsersCollectionName).doc(result.data.access_token).set({
      created_at: new Date(),
    });
    return result.data;
  });
  app.get('/notify', async (req, res) => {
    const messages = new URLSearchParams();
    messages.append('message', 'testtest');
    const firestore = setupFireStore();
    const docsQuery = await firestore.collection(lineNotifyUsersCollectionName).get();
    const responses = await Promise.all(
      docsQuery.docs.map((doc) => {
        return axios.post(LINE_NOTIFY_BASE_URL + '/api/notify', messages, {
          headers: {
            Authorization: ['Bearer', doc.id].join(' '),
          },
        });
      }),
    );
    return responses.map((response) => response.data);
  });
}
