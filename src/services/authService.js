import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { User } from "../models/userModel.js";
import { AppError } from "../utils/AppError.js";

const buildUserPayload = (user) => ({
  id: user._id.toString(),
  googleId: user.googleId,
  displayName: user.displayName,
  email: user.email,
  avatar: user.avatar
});

export const authService = {
  async findOrCreateGoogleUser(profile) {
    const email = profile.emails?.[0]?.value;

    if (!email) {
      throw new AppError("Google account did not return an email address.", 400);
    }

    const avatar = profile.photos?.[0]?.value || "";
    const displayName = profile.displayName || email;

    const user = await User.findOneAndUpdate(
      { googleId: profile.id },
      {
        $set: {
          displayName,
          email,
          avatar
        }
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );

    return user;
  },

  createToken(user) {
    return jwt.sign({ sub: user._id.toString(), email: user.email }, env.jwtSecret, {
      expiresIn: env.jwtExpiresIn
    });
  },

  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, env.jwtSecret);
      const user = await User.findById(decoded.sub);

      if (!user) {
        throw new AppError("User session is no longer valid.", 401);
      }

      return user;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Authentication failed.", 401);
    }
  },

  buildAuthResponse(user) {
    const safeUser = buildUserPayload(user);
    const token = this.createToken(user);

    return {
      token,
      user: safeUser
    };
  }
};
