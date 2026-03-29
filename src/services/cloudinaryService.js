import crypto from "node:crypto";

import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

const getCloudinaryConfig = () => {
  if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) {
    throw new AppError(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in backend/.env.",
      500
    );
  }

  return {
    cloudName: env.cloudinaryCloudName,
    apiKey: env.cloudinaryApiKey,
    apiSecret: env.cloudinaryApiSecret,
    folder: env.cloudinaryUploadFolder || "math/admin-documents"
  };
};

const buildSignature = (params, apiSecret) => {
  const serialized = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return crypto.createHash("sha1").update(`${serialized}${apiSecret}`).digest("hex");
};

const parseCloudinaryResponse = async (response) => {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.error?.message || "Cloudinary upload failed.";
    throw new AppError(message, 502);
  }

  return payload;
};

export const cloudinaryService = {
  async uploadDocument(file, options = {}) {
    return this.uploadAsset(file, {
      ...options,
      resourceType: "image",
      fallbackMimeType: "application/pdf"
    });
  },

  async uploadImage(file, options = {}) {
    return this.uploadAsset(file, {
      ...options,
      resourceType: "image",
      fallbackMimeType: "image/jpeg"
    });
  },

  async uploadAsset(file, options = {}) {
    const { cloudName, apiKey, apiSecret, folder } = getCloudinaryConfig();
    const resourceType = options.resourceType || "raw";
    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign = {
      folder,
      public_id_prefix: options.publicIdPrefix || "library",
      timestamp,
      use_filename: "true",
      unique_filename: "true"
    };
    const signature = buildSignature(paramsToSign, apiSecret);
    const formData = new FormData();

    formData.append(
      "file",
      new Blob([file.buffer], { type: file.mimetype || options.fallbackMimeType || "application/octet-stream" }),
      file.originalname
    );
    formData.append("api_key", apiKey);
    formData.append("timestamp", String(timestamp));
    formData.append("folder", folder);
    formData.append("public_id_prefix", paramsToSign.public_id_prefix);
    formData.append("use_filename", paramsToSign.use_filename);
    formData.append("unique_filename", paramsToSign.unique_filename);
    formData.append("signature", signature);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
      method: "POST",
      body: formData
    });
    const payload = await parseCloudinaryResponse(response);

    return {
      secureUrl: payload.secure_url || payload.url || "",
      publicId: payload.public_id || "",
      resourceType: payload.resource_type || resourceType,
      bytes: Number(payload.bytes || 0) || 0,
      pages: Number(payload.pages || 0) || 0,
      originalFilename: payload.original_filename || file.originalname || ""
    };
  },

  async destroyAsset({ publicId, resourceType = "raw" }) {
    if (!publicId) {
      return;
    }

    const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign = {
      invalidate: "true",
      public_id: publicId,
      timestamp
    };
    const signature = buildSignature(paramsToSign, apiSecret);
    const formData = new FormData();

    formData.append("public_id", publicId);
    formData.append("timestamp", String(timestamp));
    formData.append("api_key", apiKey);
    formData.append("invalidate", "true");
    formData.append("signature", signature);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`, {
      method: "POST",
      body: formData
    });
    const payload = await parseCloudinaryResponse(response);

    if (payload.result && payload.result !== "ok" && payload.result !== "not found") {
      throw new AppError(`Cloudinary destroy failed with result: ${payload.result}`, 502);
    }
  }
};
