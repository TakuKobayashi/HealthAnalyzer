import { setupFireStore } from '../../common/firestore';
import { Client, Profile, TextMessage, RichMenu } from '@line/bot-sdk';

const config = {
  channelAccessToken: process.env.LINE_BOT_CHANNEL_ACCESSTOKEN,
  channelSecret: process.env.LINE_BOT_CHANNEL_SECRET,
};
const client = new Client(config);

export async function lineBotRouter(app, opts): Promise<void> {
  app.get('/', async (req, res) => {
    res.send('hello line');
  });
  app.get('/push_message', async (req, res) => {
    const message = {
      type: 'text',
      text: 'これはテストです',
    };
    const firestore = setupFireStore();
    const docsQuery = await firestore.collection('line_users').get();
    const result = await Promise.all(
      docsQuery.docs.map((doc) => {
        return client.pushMessage(doc.id, message);
      }),
    );
    console.log(result);
    return 'hello line';
  });
  app.post('/message', async (req, res) => {
    console.log(req.body);
    const messageEvent = req.body;
    const eventReplyPromises: Promise<void>[] = [];
    for (const event of messageEvent.events) {
      eventReplyPromises.push(handleEvent(event));
    }

    const response = await Promise.all(eventReplyPromises).catch((err) => {
      console.error(err);
    });
    return messageEvent;
  });
  app.get('/richmenu/list', async (req, res) => {
    const firestore = setupFireStore();
    const richMenus = await client.getRichMenuList();
    const setFirestores: Promise<FirebaseFirestore.WriteResult>[] = []
    for(const richMenu of richMenus){
      setFirestores.push(firestore.collection('line_richmenus').doc(richMenu.richMenuId).set(richMenu.size));
    }
    await Promise.all(setFirestores)
    /*
    const lichMenuDocs = await firestore.collection('line_richmenus').get();
    for(const doc of lichMenuDocs.docs){
      console.log(doc.id)
      console.log(doc.data())
    }
    */
    return richMenus
  })
  app.get('/richmenu/delete', async (req, res) => {
    return client.deleteRichMenu(req.query.rechmenu_id)
  })
  app.get('/richmenu/create', async (req, res) => {
    const menuSize = {
      // width: 800 ~ 2500 の間　アスペクト比は最低1.45以上にする
      width: 2500,
      // height: 250 以上 アスペクト比は最低1.45以上にする
      height: 1686
    }
    const richmenu: RichMenu = {
      // https://developers.line.biz/en/reference/messaging-api/#size-object
      size: menuSize,
    /**
     * `true` to display the rich menu by default. Otherwise, `false`.
     */
    selected: true,
    /**
     * Name of the rich menu.
     *
     * This value can be used to help manage your rich menus and is not displayed
     * to users.
     *
     * (Max: 300 characters)
     */
    name: "healthAnalyzer",
    /**
     * Text displayed in the chat bar (Max: 14 characters)
     */
    chatBarText: "healthAnalyzer",

      // Other rich menu object properties
      // ...
      areas: [
        {
          bounds: {
            x: 0,
            y: 0,
            width: 2500,
            height: 1686
          },
          action: {
            type: "postback",
            label: "Buy",
            data: "action=buy&itemid=123"
          }
        }
      ]
    }
    const firestore = setupFireStore();
    const richmenuId = await client.createRichMenu(richmenu)
    await firestore.collection('line_richmenus').doc(richmenuId).set(menuSize);
    return richmenuId
  });
}

async function handleEvent(event): Promise<void> {
  console.log(event)
  const firestore = setupFireStore();
  if (event.type === 'follow') {
    const profile = await client.getProfile(event.source.userId);
    console.log(profile)
    await firestore.collection('line_users').doc(event.source.userId).set({
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl,
    });
  } else if (event.type === 'unfollow') {
    await firestore.collection('line_users').doc(event.source.userId).delete();
  } else if (event.type === 'message') {
    if (event.message.type === 'text'){}
    // create a echoing text message
    const echo: TextMessage = { type: 'text', text: event.message.text };

    // use reply API
    await client.replyMessage(event.replyToken, echo);
  }
}
