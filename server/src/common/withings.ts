import axios, { AxiosResponse } from 'axios';
import { RequestTokenSignatureBasic, WithingsAccount } from '../interfaces/withings';
import { stringify } from 'query-string';
import { createHmac } from 'crypto';

export class WithingsApi {
  private withingsAccount: WithingsAccount;

  constructor(account: WithingsAccount) {
    this.withingsAccount = account;
  }

  async requestRegisterWebhook(webhookUrl: string, comment: string): Promise<AxiosResponse<any, any>> {
    const basicSignature: RequestTokenSignatureBasic = await constructNonceSignature('subscribe');
    const requestParams = {
      callbackurl: webhookUrl,
      // appli is see this: https://developer.withings.com/developer-guide/v3/data-api/keep-user-data-up-to-date/
      appli: 1,
      comment: comment,
      ...basicSignature,
    };
    return axios.post('https://wbsapi.withings.net/notify', stringify(requestParams), {
      headers: {
        Authorization: ['Bearer', this.withingsAccount.access_token].join(' '),
      },
    });
  }

  async requestRefreshAccessToken(refresh_token: string): Promise<AxiosResponse<any, any>> {
    const basicSignature: RequestTokenSignatureBasic = await constructNonceSignature('requesttoken');
    const requestTokenObj = {
      grant_type: 'refresh_token',
      refresh_token: refresh_token,
      client_secret: process.env.WITHINGS_API_SECRET,
      ...basicSignature,
    };
    return axios.post('https://wbsapi.withings.net/v2/oauth2', stringify(requestTokenObj));
  }
}

export async function requestGetAccessToken(oauthCallbackCode: string, redirect_uri: string): Promise<AxiosResponse<any, any>> {
  const basicSignature: RequestTokenSignatureBasic = await constructNonceSignature('requesttoken');
  const requestTokenObj = {
    grant_type: 'authorization_code',
    code: oauthCallbackCode,
    redirect_uri: redirect_uri,
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
