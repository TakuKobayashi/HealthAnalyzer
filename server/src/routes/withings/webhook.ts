import { setupFireStore } from '../../common/firestore';
import { WithingsAccount } from '../../interfaces/withings';
import { WithingsApi } from '../../common/withings';
import { withingsUsersCollectionName } from '../../types/withings';
import { parse } from 'query-string';

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
  app.post('/recieves', async (req, res) => {
    console.log('recieved!!!!');
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
    const withingsApi = await constructWithingsApi(payload.userid.toString());
    const mesureBodyData = await withingsApi.requestAndSaveLatestMesureData();
    return mesureBodyData;
  });
}

async function constructWithingsApi(withing_user_id: string): Promise<WithingsApi> {
  const withingsUserDoc = firestore.collection(withingsUsersCollectionName).doc(withing_user_id);
  const withingsUserAccount = await withingsUserDoc.get();
  const withingsAccount = withingsUserAccount.data() as WithingsAccount;
  return new WithingsApi(withingsAccount);
}
