import axios, { AxiosResponse } from 'axios';
import {
  RequestTokenSignatureBasic,
  WithingsAccount,
  WithingsUserLatestMeasure,
  WithingsMeasureApiResult,
  WithingsMeasure,
  WithingsHealthMetrics,
} from '../interfaces/withings';
import { stringify } from 'query-string';
import { createHmac } from 'crypto';
import { setupFireStore } from './firestore';
import { withingsUsersCollectionName, withingsUserMeasuresCollectionName } from '../types/withings';

const firestore = setupFireStore();
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
    return this.requestApi<any>('https://wbsapi.withings.net/notify', requestParams);
  }

  async requestRegisteredNotifyList(): Promise<AxiosResponse<any, any>> {
    const requestParams = {
      action: 'list',
    };
    return this.requestApi<any>('https://wbsapi.withings.net/notify', requestParams);
  }

  async requestMesures(): Promise<AxiosResponse<WithingsMeasureApiResult, any>> {
    const requestParams = {
      action: 'getmeas',
    };
    /*
    こんな感じのデータが返ってくる
    {
      "status":0,
      "body":{
        "updatetime":1657392298,
        "timezone":"Asia/Tokyo",
        "measuregrps":[{
          "grpid":3713205203,
          "attrib":0,
          "date":1657391187,
          "created":1657391229,
          "modified":1657391229,
          "category":1,
          "deviceid":"...",
          "hash_deviceid":"...",
          "measures":[
            {"value":103800,"type":1,"unit":-3,"algo":3,"fm":5}, //体重
            {"value":3659,"type":8,"unit":-2,"algo":3,"fm":5}, // 体脂肪量
            {"value":6360,"type":76,"unit":-2,"algo":3,"fm":5}, // 筋肉量
            {"value":5240,"type":77,"unit":-2,"algo":3,"fm":5}, // 体内水分量
            {"value":360,"type":88,"unit":-2,"algo":3,"fm":5}, // 骨量
            {"value":35250,"type":6,"unit":-3}, // 肥満率
            {"value":67210,"type":5,"unit":-3}, // 除脂肪体重
          ],
          "comment":null
        },
        ...
        ],
      }
    }
    */
    return this.requestApi<WithingsMeasureApiResult>('https://wbsapi.withings.net/measure', requestParams);
  }

  async requestAndSaveLatestMesureData(): Promise<WithingsMeasureApiResult> {
    const mesureResponse = await this.requestMesures();
    const measuregrps = mesureResponse.data.body.measuregrps;
    const measureObj: Partial<WithingsUserLatestMeasure> = {
      withing_user_id: this.withingsAccount.withings_user_id,
      created_at: 0,
    };
    for (const measuregrp of measuregrps) {
      if (measureObj.created_at < measuregrp.created) {
        measureObj.created_at = measuregrp.created;
        measureObj.date = measuregrp.date;
        measureObj.updated_at = measuregrp.modified;
        measureObj.metrics = this.convertMetrics(measuregrp.measures);
      }
    }
    const currentDoc = firestore.collection(withingsUserMeasuresCollectionName).doc(this.withingsAccount.withings_user_id);
    await currentDoc.set(measureObj);
    return mesureResponse.data;
  }

  async requestRefreshAccessToken(): Promise<AxiosResponse<any, any>> {
    const basicSignature: RequestTokenSignatureBasic = await constructNonceSignature('requesttoken');
    const requestTokenObj = {
      grant_type: 'refresh_token',
      refresh_token: this.withingsAccount.refresh_token,
      client_secret: process.env.WITHINGS_API_SECRET,
      ...basicSignature,
    };
    return axios.post('https://wbsapi.withings.net/v2/oauth2', stringify(requestTokenObj), {
      headers: {
        Authorization: ['Bearer', this.withingsAccount.access_token].join(' '),
      },
    });
  }

  private convertMetrics(measures: WithingsMeasure[]): WithingsHealthMetrics {
    const metrics: WithingsHealthMetrics = {
      weight_kg: 0,
      fat_mass_weight_kg: 0,
      muscle_mass_kg: 0,
      hydration_kg: 0,
      bone_mass_kg: 0,
      fat_ratio_percent: 0,
      fat_free_mass_kg: 0,
    };
    for (const measure of measures) {
      // 体重
      if (measure.type === 1) {
        metrics.weight_kg = measure.value * Math.pow(10, measure.unit);
        // 体脂肪量
      } else if (measure.type === 8) {
        metrics.fat_mass_weight_kg = measure.value * Math.pow(10, measure.unit);
        // 筋肉量
      } else if (measure.type === 76) {
        metrics.muscle_mass_kg = measure.value * Math.pow(10, measure.unit);
        // 体内水分量
      } else if (measure.type === 77) {
        metrics.hydration_kg = measure.value * Math.pow(10, measure.unit);
        // 骨量
      } else if (measure.type === 88) {
        metrics.bone_mass_kg = measure.value * Math.pow(10, measure.unit);
        // 肥満率
      } else if (measure.type === 6) {
        metrics.fat_ratio_percent = measure.value * Math.pow(10, measure.unit);
        // 除脂肪体重
      } else if (measure.type === 5) {
        metrics.fat_free_mass_kg = measure.value * Math.pow(10, measure.unit);
      }
    }
    return metrics;
  }

  private async requestApi<T>(url: string, requestParams: { [s: string]: any }): Promise<AxiosResponse<T, any>> {
    const expiredAt = new Date(this.withingsAccount.expired_at);
    const now = new Date();
    if (now > expiredAt) {
      const refreshTokenResponse = await this.requestRefreshAccessToken();
      const responseBody = refreshTokenResponse.data.body;
      const nowTime = new Date().getTime();
      await saveWithingsAccountToFirebase({
        ...this.withingsAccount,
        access_token: responseBody.access_token,
        refresh_token: responseBody.refresh_token,
        expired_at: nowTime + responseBody.expires_in * 1000,
      });
    }
    return axios.post(url, stringify(requestParams), {
      headers: {
        Authorization: ['Bearer', this.withingsAccount.access_token].join(' '),
      },
    });
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

export async function saveWithingsAccountToFirebase(withingsAccount: WithingsAccount): Promise<void> {
  const currentDoc = firestore.collection(withingsUsersCollectionName).doc(withingsAccount.withings_user_id);
  await currentDoc.set(withingsAccount);
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
