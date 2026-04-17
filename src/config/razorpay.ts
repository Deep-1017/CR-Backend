import Razorpay from 'razorpay';
import logger from '../utils/logger';
import env from './env';

const { RAZORPAY_KEY_ID, RAZORPAY_SECRET } = env;

if (!RAZORPAY_KEY_ID || !RAZORPAY_SECRET) {
  logger.error('Razorpay initialization failed: RAZORPAY_KEY_ID and RAZORPAY_SECRET are required. Set Razorpay test account credentials before switching to live credentials.');
  throw new Error('Missing Razorpay credentials');
}

logger.info(`Initializing Razorpay using ${env.isProduction ? 'live' : 'test'} credentials`);

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_SECRET,
});

export default razorpay;
