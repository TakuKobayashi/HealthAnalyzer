import { setupFireStore } from '../../../common/firestore';
import { lineBotClient, lineUsersCollectionName, lineRichmenusCollectionName } from '../../../types/line';
import { RichMenu } from '@line/bot-sdk';
import axios from 'axios';

export async function lineBotRichmenuRouter(app, opts): Promise<void> {
  app.get('/users/link', async (req, res) => {
    const userId = req.query.user_id;
    const rechmenuId = req.query.rechmenu_id;
    console.log(req.query);
    console.log(userId);
    console.log(rechmenuId);
    const firestore = setupFireStore();
    const result = await lineBotClient.linkRichMenuToUser(userId, rechmenuId);
    console.log(result);
    const userDoc = firestore.collection(lineUsersCollectionName).doc(userId);
    const userData = await userDoc.get();
    await userDoc.set({
      ...userData.data(),
      linked_richmenu_id: rechmenuId,
    });
    //    const userDoc = await firestore.collection(lineUsersCollectionName).doc(userId).get()
    console.log(userDoc);
    /*
        const lichMenuDocs = await firestore.collection('line_richmenus').get();
        for(const doc of lichMenuDocs.docs){
          console.log(doc.id)
          console.log(doc.data())
        }
        */
    return result;
  });
  app.get('/users/unlink', async (req, res) => {
    const userId = req.query.user_id;
    console.log(req.query);
    console.log(userId);
    const firestore = setupFireStore();
    const result = await lineBotClient.unlinkRichMenuFromUser(userId);
    console.log(result);
    const userDoc = firestore.collection(lineUsersCollectionName).doc(userId);
    const userData = await userDoc.get();
    const userDataObj = userData.data();
    delete userDataObj.linked_richmenu_id;
    await userDoc.set(userDataObj);
    console.log(userDoc);
    return result;
  });
  app.get('/image/set', async (req, res) => {
    const richmenuId = req.query.richmenu_id;
    const imageUrl =
      'https://firebasestorage.googleapis.com/v0/b/healthanalyzer-54f88.appspot.com/o/line_richmenu_images%2Funconnect_richmenu.jpg?alt=media&token=262041f0-e0be-448d-b44e-c2ab6c0bb53d';
    const imageRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const firestore = setupFireStore();
    const currentDoc = firestore.collection(lineRichmenusCollectionName).doc(richmenuId);
    const currentData = await currentDoc.get();
    await currentDoc.set({ ...currentData.data(), image_url: imageUrl });
    const richMenuRes = await lineBotClient.setRichMenuImage(richmenuId, Buffer.from(imageRes.data, 'binary'));
    return richMenuRes;
  });
  app.get('/image/get', async (req, res) => {
    const richmenuId = req.query.richmenu_id;
    const richMenuRes = await lineBotClient.getRichMenuImage(richmenuId);
    return richMenuRes;
  });
  app.get('/list', async (req, res) => {
    const firestore = setupFireStore();
    const richMenus = await lineBotClient.getRichMenuList();
    const setFirestores: Promise<FirebaseFirestore.WriteResult>[] = [];
    for (const richMenu of richMenus) {
      const currentDoc = firestore.collection(lineRichmenusCollectionName).doc(richMenu.richMenuId);
      const currentData = await currentDoc.get();
      setFirestores.push(currentDoc.set({ ...richMenu.size, ...currentData.data() }));
    }
    await Promise.all(setFirestores);
    return richMenus;
  });
  app.get('/delete', async (req, res) => {
    const rechmenuId = req.query.richmenu_id;
    await lineBotClient.deleteRichMenu(rechmenuId);
    const firestore = setupFireStore();
    await firestore.collection(lineRichmenusCollectionName).doc(rechmenuId).delete();
    return '';
  });
  app.get('/create', async (req, res) => {
    const menuSize = {
      // width: 800 ~ 2500 の間　アスペクト比は最低1.45以上にする
      width: 2500,
      // height: 250 以上 アスペクト比は最低1.45以上にする
      height: 825,
    };

    const richmenu: RichMenu = {
      // https://developers.line.biz/en/reference/messaging-api/#size-object
      size: menuSize,
      selected: true,
      name: 'healthAnalyzer',
      chatBarText: '体重計と連携しましょう',
      areas: [
        {
          bounds: {
            x: 0,
            y: 0,
            width: menuSize.width,
            height: menuSize.height,
          },
          action: {
            type: 'uri',
            uri: 'https://y4t3smbhh2.execute-api.ap-northeast-1.amazonaws.com/production//withings/auth/login',
          },
        },
      ],
    };
    const firestore = setupFireStore();
    const richmenuId = await lineBotClient.createRichMenu(richmenu);
    await firestore.collection(lineRichmenusCollectionName).doc(richmenuId).set(menuSize);
    return richmenuId;
  });
}
