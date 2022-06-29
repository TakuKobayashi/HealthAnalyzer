import { Client } from '@line/bot-sdk';

export const lineUsersCollectionName = 'line_users';
export const lineRichmenusCollectionName = 'line_richmenus';

const config = {
  channelAccessToken: process.env.LINE_BOT_CHANNEL_ACCESSTOKEN,
  channelSecret: process.env.LINE_BOT_CHANNEL_SECRET,
};
export const lineBotClient = new Client(config);
