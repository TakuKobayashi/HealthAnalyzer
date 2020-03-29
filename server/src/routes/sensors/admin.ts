import { NextFunction, Request, Response } from 'express';

import { setupFireStore } from '../../common/firestore';

const express = require('express');
const sensorsAdminRouter = express.Router();

sensorsAdminRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  res.send('hello sensor admin');
});

sensorsAdminRouter.post('/create', async (req: Request, res: Response, next: NextFunction) => {
  console.log(JSON.stringify(req.body));
  res.send('hello sensor admin');
});

sensorsAdminRouter.post('/update', async (req: Request, res: Response, next: NextFunction) => {
  console.log(JSON.stringify(req.body));
  res.send('hello sensor admin');
});

sensorsAdminRouter.post('/delete', async (req: Request, res: Response, next: NextFunction) => {
  console.log(JSON.stringify(req.body));
  res.send('hello sensor admin');
});

export { sensorsAdminRouter };
