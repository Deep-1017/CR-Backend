import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User';
import env from './env';
import logger from '../utils/logger';

if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.API_URL) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${env.API_URL}/api/v1/auth/google/callback`,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error('No email returned from Google'), undefined);
          }

          let user = await User.findOne({ googleId: profile.id });

          if (!user) {
            user = await User.findOne({ email });
            if (user) {
              user.googleId = profile.id;
              user.provider = 'google';
              if (!user.avatar) user.avatar = profile.photos?.[0]?.value || '';
              await user.save();
            } else {
              user = await User.create({
                name: profile.displayName,
                email,
                googleId: profile.id,
                provider: 'google',
                avatar: profile.photos?.[0]?.value || '',
              });
            }
          }

          return done(null, user);
        } catch (err) {
          return done(err as Error, undefined);
        }
      }
    )
  );
} else {
  logger.warn('Google OAuth disabled: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or API_URL is missing.');
}

passport.serializeUser((user: any, done) => done(null, user._id));
passport.deserializeUser(async (id: string, done) => {
  const user = await User.findById(id);
  done(null, user);
});

export default passport;
