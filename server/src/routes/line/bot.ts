import { setupFireStore } from '../../common/firestore';
import { TextMessage, LocationMessage, TemplateMessage } from '@line/bot-sdk';
import { parse, stringify } from 'querystring';
import { lineBotRichmenuRouter } from './extends/richmenu';
import { lineBotClient, lineUsersCollectionName } from '../../types/line';
import { withingsLinkPostbackActionName } from '../../types/postbacks';
import fs from 'fs';

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
    const messageEvent = req.body;
    const eventReplyPromises: Promise<void>[] = [];
    for (const event of messageEvent.events) {
      eventReplyPromises.push(handleEvent(event));
    }

    await Promise.all(eventReplyPromises);
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
  } else if (event.type === 'postback') {
    const postbackDataObj = parse(event.postback.data);
    if (postbackDataObj.action === withingsLinkPostbackActionName) {
      const postbackUrlObj = {
        line_user_id: event.source.userId,
      };
      const echo: TemplateMessage = {
        type: 'template',
        altText: 'Connect to withings',
        template: {
          type: 'buttons',
          text: '以下のボタンを押してWithingsと連携してください',
          actions: [
            {
              type: 'uri',
              label: 'Withingsと連携',
              uri:
                'https://y4t3smbhh2.execute-api.ap-northeast-1.amazonaws.com/production//withings/auth/login?' + stringify(postbackUrlObj),
            },
          ],
        },
      };
      await lineBotClient.replyMessage(event.replyToken, echo);
    }
  } else if (event.type === 'message') {
    if (event.message.type === 'text') {
      const echo: TextMessage = { type: 'text', text: event.message.text };
      await lineBotClient.replyMessage(event.replyToken, echo);
    } else if (event.message.type === 'image') {
      const content = await lineBotClient.getMessageContent(event.message.id);
      content.pipe(fs.createWriteStream(event.message.id + '.jpg'));
      const echo: TextMessage = { type: 'text', text: event.message.id + '.jpg image save complete' };
      await lineBotClient.replyMessage(event.replyToken, echo);
    } else if (event.message.type === 'location') {
      const echo: LocationMessage = {
        type: 'location',
        title: event.message.address,
        address: event.message.address,
        latitude: event.message.latitude,
        longitude: event.message.longitude,
      };
      await lineBotClient.replyMessage(event.replyToken, echo);
    } else if (event.message.type === 'audio') {
      const content = await lineBotClient.getMessageContent(event.message.id);
      content.pipe(fs.createWriteStream(event.message.id + '.wav'));
      const echo: TextMessage = { type: 'text', text: event.message.id + '.wav audio save complete' };
      await lineBotClient.replyMessage(event.replyToken, echo);
    } else if (event.message.type === 'sticker') {
      const echo: TextMessage = { type: 'text', text: 'sticker message received' };
      await lineBotClient.replyMessage(event.replyToken, echo);
    } else if (event.message.type === 'video') {
      const content = await lineBotClient.getMessageContent(event.message.id);
      content.pipe(fs.createWriteStream(event.message.id + '.mp4'));
      const echo: TextMessage = { type: 'text', text: event.message.id + '.mp4 video save complete' };
      await lineBotClient.replyMessage(event.replyToken, echo);
    }
  }
}
