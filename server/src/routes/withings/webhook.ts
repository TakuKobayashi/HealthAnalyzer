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
    const firestore = setupFireStore();
    const withingsUserDoc = firestore.collection(withingsUsersCollectionName).doc(req.query.withing_user_id);
    const withingsUserAccount = await withingsUserDoc.get();
    const withingsAccount = withingsUserAccount.data() as WithingsAccount;
    const withingsApi = new WithingsApi(withingsAccount);
    const registeredNotifyListResponse = await withingsApi.requestRegisteredNotifyList();
    return registeredNotifyListResponse.data;
  });
  app.post('/recieves', async (req, res) => {
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
