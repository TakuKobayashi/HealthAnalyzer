import { setupFireStore } from '../../common/firestore';
import { TextMessage } from '@line/bot-sdk';
import { lineBotRichmenuRouter } from './extends/richmenu';
import { lineBotClient, lineUsersCollectionName } from '../../types/line';

export async function lineBotRouter(app, opts): Promise<void> {
  app.get('/', async (req, res) => {
    res.send('hello line');
  });
  app.get('/push_message', async (req, res) => {
    const message: TextMessage = {
      type: 'text',
      text: 'これはテストです',
    };
    const firestore = setupFireStore();
    const docsQuery = await firestore.collection(lineUsersCollectionName).get();
    const result = await Promise.all(
      docsQuery.docs.map((doc) => {
        return lineBotClient.pushMessage(doc.id, message);
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
  app.register(lineBotRichmenuRouter, { prefix: '/richmenu' });
}

async function handleEvent(event): Promise<void> {
  console.log(event);
  const firestore = setupFireStore();
  if (event.type === 'follow') {
    const profile = await lineBotClient.getProfile(event.source.userId);
    console.log(profile);
    await firestore.collection(lineUsersCollectionName).doc(event.source.userId).set({
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl,
    });
  } else if (event.type === 'unfollow') {
    await firestore.collection(lineUsersCollectionName).doc(event.source.userId).delete();
  } else if (event.type === 'message') {
    if (event.message.type === 'text') {
    }
    // create a echoing text message
    const echo: TextMessage = { type: 'text', text: event.message.text };

    // use reply API
    await lineBotClient.replyMessage(event.replyToken, echo);
  }
}
