import { stringifyUrl } from 'query-string';
import { WithingsAccount } from '../../interfaces/withings';
import { setupFireStore } from '../../common/firestore';
import { requestGetAccessToken, WithingsApi, saveWithingsAccountToFirebase } from '../../common/withings';
import { linebotUrl } from '../../types/line';
import { withingsUsersCollectionName } from '../../types/withings';

const lineUserIdCookieKeyName = 'line_user_id';

export async function withingsAuthRouter(app, opts): Promise<void> {
  app.get('/', async (req, res) => {
    const firestore = setupFireStore();
    const currentDoc = firestore.collection(withingsUsersCollectionName);
    const data = await currentDoc.get();
    const arr = [];
    data.forEach((d) => {
      arr.push(d.data());
    });
    return arr;
  });
  app.get('/login', async (req, res) => {
    if (!req.query.line_user_id) {
      res.redirect(linebotUrl);
      return;
    }
    const lineUserId = req.query.line_user_id;
    res.setCookie(lineUserIdCookieKeyName, lineUserId);
    // See this: https://developer.withings.com/api-reference#operation/oauth2-authorize
    const authorizeQueryObj = {
      response_type: 'code',
      client_id: process.env.WITHINGS_API_CLIENT_ID,
      state: lineUserId,
      scope: ['user.activity', 'user.metrics'].join(','),
      redirect_uri: getCallbackUrl(req),
    };
    res.redirect(stringifyUrl({ url: 'https://account.withings.com/oauth2_user/authorize2', query: authorizeQueryObj }));
  });
  app.get('/callback', async (req, res) => {
    if (!req.query.code) {
      res.redirect(linebotUrl);
      return;
    }
    const oauthCallbackCode: string = req.query.code.toString();
    const redirectUrl = getCallbackUrl(req);
    const oauthRes = await requestGetAccessToken(oauthCallbackCode, redirectUrl);
    // このような形で返ってくる
    /* {
      "status":0,
      "body":{
        "userid":"...",
        "access_token":"...",
        "refresh_token":"...",
        "scope":"user.activity,user.metrics",
        "expires_in":10800,
        "token_type":"Bearer"
      }
    } */
    const nowTime = new Date().getTime();
    const oauthResultBody = oauthRes.data.body;
    const withingsAccount: WithingsAccount = {
      withings_user_id: oauthResultBody.userid,
      access_token: oauthResultBody.access_token,
      refresh_token: oauthResultBody.refresh_token,
      expired_at: nowTime + oauthResultBody.expires_in * 1000,
      line_user_id: req.cookies[lineUserIdCookieKeyName],
    };
    const withingsApi = new WithingsApi(withingsAccount);
    const registedWithings = await withingsApi.requestRegisterWebhook(
      getWebhookUrl(req),
      ['LineId', withingsAccount.line_user_id, 'WithingsId', oauthResultBody.userid].join(':'),
    );
    console.log(registedWithings.data);
    // firestore の保存はredirectさせたあとにしておかないとInternal server errorになっちゃう
    res.redirect(linebotUrl);
    await saveWithingsAccountToFirebase(withingsAccount);
  });
  app.get('/refresh_token', async (req, res) => {
    if (!req.query.withing_user_id) {
      return { message: 'withings_user_idを指定してください' };
    }
    const firestore = setupFireStore();
    const withingsUserDoc = firestore.collection(withingsUsersCollectionName).doc(req.query.withing_user_id);
    const withingsUserAccount = await withingsUserDoc.get();
    const withingsAccount = withingsUserAccount.data() as WithingsAccount;
    const withingsApi = new WithingsApi(withingsAccount);
    const registeredNotifyListResponse = await withingsApi.requestRefreshAccessToken();
    return registeredNotifyListResponse.data;
  });
}

function getCallbackUrl(req): string {
  const currentBaseUrl = ['https://' + req.hostname, req.awsLambda.event.requestContext.stage].join('/');
  return currentBaseUrl + '/withings/auth/callback';
}

function getWebhookUrl(req): string {
  const currentBaseUrl = ['https://' + req.hostname, req.awsLambda.event.requestContext.stage].join('/');
  return currentBaseUrl + '/withings/webhook/recieves';
}
