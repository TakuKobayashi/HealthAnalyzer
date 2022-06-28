import { setupFireStore } from '../../common/firestore';
import { Client, Profile } from '@line/bot-sdk';

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
    const docsQuery = await firestore.collection('LineUsers').get();
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
    const messageEvent = JSON.parse(req.body);
    const eventReplyPromises: Promise<void>[] = [];
    for (const event of messageEvent.events) {
      eventReplyPromises.push(handleEvent(event));
    }

    const response = await Promise.all(eventReplyPromises).catch((err) => {
      console.error(err);
    });
    return messageEvent;
  });
}

async function handleEvent(event): Promise<void> {
  console.log(JSON.stringify(event));
  const firestore = setupFireStore();
  if (event.type === 'follow') {
    const profile = await getLineUser(event.source.userId);
    await firestore.collection('LineUsers').doc(event.source.userId).set({
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl,
    });
  } else if (event.type === 'unfollow') {
    await firestore.collection('LineUsers').doc(event.source.userId).delete();
  }

  if (event.type === 'message' || event.message.type === 'text') {
    // create a echoing text message
    const echo = { type: 'text', text: event.message.text };

    // use reply API
    await client.replyMessage(event.replyToken, echo);
  }
}

async function getLineUser(userId: string): Promise<Profile> {
  return client.getProfile(userId);
}
