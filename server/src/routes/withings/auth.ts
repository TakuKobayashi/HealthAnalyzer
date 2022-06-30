import { stringifyUrl } from 'query-string';
import { WithingsAccount } from 'src/interfaces/withings';
import { setupFireStore } from '../../common/firestore';
import { requestGetAccessToken } from '../../common/withings';
import { linebotUrl } from '../../types/line';
import { withingsUsersCollectionName } from '../../types/withings';

const lineUserIdCookieKeyName = 'line_user_id';

export async function withingsAuthRouter(app, opts): Promise<void> {
  app.get('/', async (req, res) => {
    return { message: 'hello' };
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
      access_token: oauthResultBody.access_token,
      refresh_token: oauthResultBody.refresh_token,
      expired_at: nowTime + oauthResultBody.expires_in * 1000,
      line_user_id: req.cookies[lineUserIdCookieKeyName],
    };
    const firestore = setupFireStore();
    const currentDoc = firestore.collection(withingsUsersCollectionName).doc(oauthRes.data.body.userid);
    await currentDoc.update({ ...withingsAccount });
    res.clearCookie(lineUserIdCookieKeyName);
    res.redirect(linebotUrl);
    return;
  });
}

function getCallbackUrl(req): string {
  const currentBaseUrl = ['https://' + req.hostname, req.awsLambda.event.requestContext.stage].join('/');
  return currentBaseUrl + '/withings/auth/callback';
}
