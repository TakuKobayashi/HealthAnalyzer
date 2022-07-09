import { setupFireStore } from '../../common/firestore';
import { WithingsAccount } from '../../interfaces/withings';
import { WithingsApi } from '../../common/withings';
import { withingsUsersCollectionName } from '../../types/withings';
import { parse } from 'query-string';

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
    const mesureResponse = await withingsApi.requestMesures();
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
      ]
    */
    return mesureResponse.data;
  });
  app.post('/recieves', async (req, res) => {
    console.log("recieved!!!!");
    console.log(req.headers);
    console.log(req.raw);
    console.log(req.body);
    /*
    これをparseしてこうする
    {
      userid: '4360293',
      startdate: '1653097272',
      enddate: '1653097273',
      appli: '1'
    }
    */
    const payload = parse(req.body);
    console.log(payload);
    res.send('OK');
  });
}

async function constructWithingsApi(withing_user_id: string): Promise<WithingsApi> {
  const firestore = setupFireStore();
  const withingsUserDoc = firestore.collection(withingsUsersCollectionName).doc(withing_user_id);
  const withingsUserAccount = await withingsUserDoc.get();
  const withingsAccount = withingsUserAccount.data() as WithingsAccount;
  return new WithingsApi(withingsAccount);
}
