import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

import { env } from "./env.js";
import { authService } from "../services/authService.js";

export const isGoogleAuthConfigured = Boolean(env.googleClientId && env.googleClientSecret);

if (isGoogleAuthConfigured) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.googleClientId,
        clientSecret: env.googleClientSecret,
        callbackURL: env.googleCallbackUrl
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const user = await authService.findOrCreateGoogleUser(profile);
          done(null, user);
        } catch (error) {
          done(error);
        }
      }
    )
  );
}

export { passport };
