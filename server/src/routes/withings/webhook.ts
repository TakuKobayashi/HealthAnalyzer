import { setupFireStore } from '../../common/firestore';
import { WithingsAccount, WithingsUserLatestMeasure } from '../../interfaces/withings';
import { WithingsApi } from '../../common/withings';
import { withingsUsersCollectionName, withingsUserMeasuresCollectionName } from '../../types/withings';
import { lineBotClient } from '../../types/line';
import { parse } from 'query-string';
import { TextMessage } from '@line/bot-sdk';

const firestore = setupFireStore();

export async function withingsWebhookRouter(app, opts): Promise<void> {
  app.get('/', async (req, res) => {
    return { message: 'hello' };
  });
  app.get('/registerings', async (req, res) => {
    if (!req.query.withing_user_id) {
      return { message: 'withings_user_idを指定してください' };
    }
    const withingsApi = await constructWithingsApi(req.query.withing_user_id);
    const registeredNotifyListResponse = await withingsApi.requestRegisteredNotifyList();
    return registeredNotifyListResponse.data;
  });
  app.get('/mesures', async (req, res) => {
    if (!req.query.withing_user_id) {
      return { message: 'withings_user_idを指定してください' };
    }
    const withingsApi = await constructWithingsApi(req.query.withing_user_id);
    const mesureBodyData = await withingsApi.requestAndSaveLatestMesureData();
    return mesureBodyData;
  });
  app.post('/recieves', async (request, res) => {
    console.log(request.body);
    /*
    これをparseしてこうする
    {
      userid: '4360293',
      startdate: '1653097272',
      enddate: '1653097273',
      appli: '1'
    }
    */
    if (request.body) {
      const payload = parse(request.body);
      console.log(payload);
      console.log("payload!!");
      console.log(payload.userid);
      const withingsApi = await constructWithingsApi(payload.userid.toString());
      console.log(withingsApi.getWithingsAccount());
      const mesureBodyData = await withingsApi.requestAndSaveLatestMesureData();
      console.log("mesure!!");
      const withingsAccount = withingsApi.getWithingsAccount();
      const withingsLatestMesure = await firestore
        .collection(withingsUserMeasuresCollectionName)
        .doc(withingsAccount.withings_user_id)
        .get();
      const latestData = withingsLatestMesure.data() as WithingsUserLatestMeasure;
      console.log(latestData);
      const message: TextMessage = {
        type: 'text',
        text: buildLinePushMessage(latestData),
      };
      console.log(message);
      console.log("message!!");
      const pushResult = await lineBotClient.pushMessage(withingsAccount.line_user_id, message);
      console.log(pushResult);
      console.log("pushed!!");
      return mesureBodyData;
    } else {
      return { message: 'request body is none' };
    }
  });
}

async function constructWithingsApi(withing_user_id: string): Promise<WithingsApi> {
  const withingsUserDoc = firestore.collection(withingsUsersCollectionName).doc(withing_user_id);
  const withingsUserAccount = await withingsUserDoc.get();
  const withingsAccount = withingsUserAccount.data() as WithingsAccount;
  return new WithingsApi(withingsAccount);
}

function buildLinePushMessage(latestData: WithingsUserLatestMeasure): string {
  const createdAt = new Date(latestData.created_at);
  return [
    [
      `${createdAt.getFullYear()}年${createdAt.getMonth() + 1}月${createdAt.getDate()}日`,
      `${createdAt.getHours()}:${createdAt.getMinutes()}`,
      `の計測結果`,
    ].join(' '),
    `体重:${latestData.metrics.weight_kg}kg`,
    `体脂肪量:${latestData.metrics.fat_mass_weight_kg}kg`,
    `筋肉量:${latestData.metrics.muscle_mass_kg}kg`,
    `体内水分量:${latestData.metrics.hydration_kg}kg`,
    `骨量:${latestData.metrics.bone_mass_kg}kg`,
    `肥満率:${latestData.metrics.fat_ratio_percent}kg`,
    `除脂肪体重:${latestData.metrics.fat_free_mass_kg}kg`,
  ].join('\n');
}
