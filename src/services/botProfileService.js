const telegram = require("../telegram");

const MAX_PROFILE_PHOTO_BYTES = 10 * 1024 * 1024;

async function changeBotProfilePhoto(file, reauthorize, api = telegram) {
  if (Number(file.file_size) > MAX_PROFILE_PHOTO_BYTES) return { ok: false, reason: "too_large" };
  const metadata = await api.telegramRequest("getFile", { file_id: file.file_id });
  if (!metadata?.file_path) throw new Error("O Telegram não informou o caminho do arquivo.");
  if (Number(metadata.file_size) > MAX_PROFILE_PHOTO_BYTES) return { ok: false, reason: "too_large" };

  let imageBuffer;
  try {
    imageBuffer = await api.downloadTelegramFile(metadata.file_path, MAX_PROFILE_PHOTO_BYTES);
    if (imageBuffer.length > MAX_PROFILE_PHOTO_BYTES) return { ok: false, reason: "too_large" };
    if (!(await reauthorize())) return { ok: false, reason: "unauthorized" };
    await api.telegramMultipartRequest("setMyProfilePhoto", {
      fields: { photo: { type: "static", photo: "attach://profile_photo" } },
      files: [{ name: "profile_photo", filename: "profile_photo.jpg", contentType: "image/jpeg", data: imageBuffer }],
    });
    return { ok: true };
  } catch (error) {
    if (error?.code === "FILE_TOO_LARGE") return { ok: false, reason: "too_large" };
    throw error;
  } finally {
    imageBuffer = null;
  }
}

module.exports = { MAX_PROFILE_PHOTO_BYTES, changeBotProfilePhoto };
