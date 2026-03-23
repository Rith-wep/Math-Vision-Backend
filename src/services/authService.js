import bcrypt from "bcryptjs";
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

    const existingUser = await User.findOne({
      $or: [{ googleId: profile.id }, { email }]
    });

    if (existingUser) {
      existingUser.googleId = profile.id;
      existingUser.displayName = displayName;
      existingUser.email = email;
      existingUser.avatar = avatar;
      await existingUser.save();
      return existingUser;
    }

    return User.create({
      googleId: profile.id,
      displayName,
      email,
      avatar
    });
  },

  async registerWithEmail({ displayName, email, password }) {
    const normalizedEmail = email?.trim().toLowerCase();
    const trimmedName = displayName?.trim();

    if (!trimmedName) {
      throw new AppError("Full name is required.", 400);
    }

    if (!normalizedEmail) {
      throw new AppError("Email is required.", 400);
    }

    if (!password || password.length < 6) {
      throw new AppError("Password must be at least 6 characters long.", 400);
    }

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser?.passwordHash) {
      throw new AppError("An account with this email already exists.", 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    if (existingUser) {
      existingUser.displayName = trimmedName;
      existingUser.passwordHash = passwordHash;
      await existingUser.save();
      return existingUser;
    }

    return User.create({
      displayName: trimmedName,
      email: normalizedEmail,
      passwordHash
    });
  },

  async loginWithEmail({ email, password }) {
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      throw new AppError("Email and password are required.", 400);
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user?.passwordHash) {
      throw new AppError("Invalid email or password.", 401);
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new AppError("Invalid email or password.", 401);
    }

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
