import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { AVATARS } from './avatar.js';
import { HttpError } from './http-error.mjs';
export function publicProfile(account) {
  return { name: account.name || `玩家${account.accountId.slice(-4)}`, avatar: account.avatarData ? `/api/avatars/${account.accountId}?v=${account.avatarVersion}` : (account.avatar || 'pig-scout'), profileComplete: !!account.name };
}
export function validateName(name) {
  if (typeof name !== 'string') throw new HttpError(400, '请输入昵称');
  name = name.trim().normalize('NFC');
  if ([...name].length < 2 || [...name].length > 16 || /[<>\p{Cc}\p{Cf}]/u.test(name)) throw new HttpError(400, '昵称需为 2–16 个字，不能包含控制字符或尖括号');
  return name;
}
export async function prepareAvatar(avatar) {
  if (AVATARS.some(a => a.id === avatar)) return { avatar, avatarData: null, avatarVersion: null };
  if (typeof avatar !== 'string' || avatar.length > 350000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(avatar)) throw new HttpError(400, '请选择默认头像或上传 PNG、JPEG、WebP 图片');
  const bytes = Buffer.from(avatar.split(',')[1], 'base64');
  if (bytes.length > 256 * 1024) throw new HttpError(400, '头像过大，请重新选择图片');
  try {
    const image = sharp(bytes, { limitInputPixels: 40000000, failOn: 'warning' });
    const meta = await image.metadata();
    if (!['png', 'jpeg', 'webp'].includes(meta.format) || (meta.pages || 1) > 1 || !meta.width || !meta.height || meta.width > 8192 || meta.height > 8192) throw new Error('format');
    const output = await image.rotate().resize(128, 128, { fit: 'cover' }).flatten({ background: '#fff' }).jpeg({ quality: 85 }).toBuffer();
    return { avatar: 'uploaded', avatarData: output.toString('base64'), avatarVersion: createHash('sha256').update(output).digest('hex').slice(0,16) };
  } catch { throw new HttpError(400, '图片无效或尺寸过大，请换一张静态 PNG、JPEG、WebP 图片'); }
}
