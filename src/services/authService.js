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
  avatar: user.avatar,
  role: user.role || "user"
});

const resolveUserRole = (email, currentRole = "user") => {
  const normalizedEmail = email?.trim().toLowerCase();

  if (currentRole === "admin") {
    return "admin";
  }

  if (normalizedEmail && env.adminEmails.includes(normalizedEmail)) {
    return "admin";
  }

  return "user";
};

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
      existingUser.role = resolveUserRole(email, existingUser.role);
      await existingUser.save();
      return existingUser;
    }

    return User.create({
      googleId: profile.id,
      displayName,
      email,
      avatar,
      role: resolveUserRole(email)
    });
  },

  async registerWithEmail({ displayName, email, password, deviceId }) {
    const normalizedEmail = email?.trim().toLowerCase();
    const trimmedName = displayName?.trim();
    const normalizedDeviceId = typeof deviceId === "string" ? deviceId.trim() : "";

    if (!trimmedName) {
      throw new AppError("Full name is required.", 400);
    }

    if (!normalizedEmail) {
      throw new AppError("Email is required.", 400);
    }

    if (!password || password.length < 6) {
      throw new AppError("Password must be at least 6 characters long.", 400);
    }

    if (normalizedDeviceId) {
      const existingDeviceAccounts = await User.countDocuments({ deviceId: normalizedDeviceId });

      if (existingDeviceAccounts >= 3) {
        throw new AppError("Limit reached: This device already has 3 accounts.", 403);
      }
    }

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser?.passwordHash) {
      throw new AppError("An account with this email already exists.", 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    if (existingUser) {
      existingUser.displayName = trimmedName;
      existingUser.passwordHash = passwordHash;
      existingUser.deviceId = normalizedDeviceId;
      existingUser.role = resolveUserRole(normalizedEmail, existingUser.role);
      await existingUser.save();
      return existingUser;
    }

    return User.create({
      displayName: trimmedName,
      email: normalizedEmail,
      deviceId: normalizedDeviceId,
      passwordHash,
      role: resolveUserRole(normalizedEmail)
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

    const nextRole = resolveUserRole(normalizedEmail, user.role);

    if (user.role !== nextRole) {
      user.role = nextRole;
      await user.save();
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

  async updateProfile(userId, { displayName, avatar }) {
    const user = await User.findById(userId);

    if (!user) {
      throw new AppError("User not found.", 404);
    }

    const trimmedName = typeof displayName === "string" ? displayName.trim() : "";
    const normalizedAvatar = typeof avatar === "string" ? avatar.trim() : "";

    if (!trimmedName) {
      throw new AppError("Full name is required.", 400);
    }

    user.displayName = trimmedName;
    user.avatar = normalizedAvatar;
    await user.save();

    return user;
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
