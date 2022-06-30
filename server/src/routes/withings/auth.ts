import axios, { AxiosResponse } from 'axios';
import { stringify, stringifyUrl } from 'query-string';
import { createHmac } from 'crypto';
import { setupFireStore } from '../../common/firestore';
import { RequestTokenSignatureBasic } from '../../interfaces/withings';
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
    const oauthRes = await requestGetAccessToken(req);
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
    const firestore = setupFireStore();
    const currentDoc = firestore.collection(withingsUsersCollectionName).doc(oauthRes.data.body.userid);
    const currentData = await currentDoc.get();
    await currentDoc.set({
      ...currentData.data(),
      access_token: oauthResultBody.access_token,
      refresh_token: oauthResultBody.refresh_token,
      expired_at: nowTime + oauthResultBody.expires_in * 1000,
      line_user_id: req.cookies[lineUserIdCookieKeyName],
    });
    res.clearCookie(lineUserIdCookieKeyName);
    res.redirect(linebotUrl);
  });
}

async function requestGetAccessToken(req): Promise<AxiosResponse<any, any>> {
  const basicSignature: RequestTokenSignatureBasic = await constructNonceSignature('requesttoken');
  const oauthCallbackCode: string = req.query.code.toString();
  const requestTokenObj = {
    grant_type: 'authorization_code',
    code: oauthCallbackCode,
    redirect_uri: getCallbackUrl(req),
    client_secret: process.env.WITHINGS_API_SECRET,
    ...basicSignature,
  };
  return axios.post('https://wbsapi.withings.net/v2/oauth2', stringify(requestTokenObj));
}

async function constructNonceSignature(action: string): Promise<RequestTokenSignatureBasic> {
  const nonce = await requestNonse();
  // See this: https://developer.withings.com/developer-guide/v3/get-access/sign-your-requests/
  const signature = createHmac('sha256', process.env.WITHINGS_API_SECRET)
    .update([action, process.env.WITHINGS_API_CLIENT_ID, nonce].join(','), 'utf8')
    .digest('hex');
  return {
    action: action,
    client_id: process.env.WITHINGS_API_CLIENT_ID,
    nonce: nonce,
    signature: signature,
  };
}

async function requestNonse(): Promise<string> {
  // see this: https://developer.withings.com/api-reference/#tag/signature
  const signaturetimestamp = Math.floor(new Date().getTime() / 1000);
  const signatureObj = {
    action: 'getnonce',
    client_id: process.env.WITHINGS_API_CLIENT_ID,
    timestamp: signaturetimestamp,
    signature: createHmac('sha256', process.env.WITHINGS_API_SECRET)
      .update(['getnonce', process.env.WITHINGS_API_CLIENT_ID, signaturetimestamp].join(','), 'utf8')
      .digest('hex'),
  };
  const nonceRes = await axios.post('https://wbsapi.withings.net/v2/signature', stringify(signatureObj));
  return nonceRes.data.body.nonce.toString();
}

function getCallbackUrl(req): string {
  const currentBaseUrl = [req.protocol + '://' + req.hostname, req.awsLambda.event.requestContext.stage].join('/');
  return currentBaseUrl + '/withings/auth/callback';
}
