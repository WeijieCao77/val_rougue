import { AVATARS, avatarSrc } from '/pvp/avatar.js';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function profileEditorHtml(account) {
  return `<form id="player-profile-form" class="profile-form">
    <div class="profile-preview"><img id="profile-preview" src="${esc(avatarSrc(account?.avatar))}" alt="头像预览" width="88" height="88"><span>你的对战身份<small>昵称和头像会展示给对手</small></span></div>
    <label class="profile-name">玩家昵称<input id="profile-name" name="name" value="${esc(account?.profileComplete ? account.name : '')}" placeholder="给自己起个昵称" maxlength="32" autocomplete="nickname" required><small>2–16 个字，可以使用中文、字母和数字</small></label>
    <fieldset><legend>选择头像</legend><div class="avatar-options">${AVATARS.map(a => `<button type="button" data-avatar="${a.id}" aria-label="${a.name}" aria-pressed="${account?.avatar === a.id}"><img src="${esc(avatarSrc(a.id))}" alt="" width="52" height="52"><span>${a.name}</span></button>`).join('')}</div></fieldset>
    <label class="avatar-upload">上传自己的头像<input type="file" id="profile-file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.jfif,.webp"></label>
    <p class="muted profile-help">支持静态 PNG、JPEG、WebP，最大 8 MB。图片居中裁成方形，仅上传压缩后的头像。</p>
    <p id="profile-error" role="alert"></p><button class="primary" id="profile-save" type="submit">保存昵称与头像</button>
  </form>`;
}
// Sniff actual bytes rather than trusting a phone/Windows file's MIME label.
async function convertAvatar(file) {
  if (!file.size || file.size > 8 * 1024 * 1024) throw new Error('请选择 8 MB 以内的图片');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const word = (at,n) => String.fromCharCode(...bytes.subarray(at,at+n));
  const png = bytes.length >= 24 && [137,80,78,71,13,10,26,10].every((n,i) => bytes[i] === n);
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = word(0,4) === 'RIFF' && word(8,4) === 'WEBP';
  if (!png && !jpeg && !webp) throw new Error('仅支持静态 PNG、JPEG、WebP；请先转换 GIF、HEIC 或其他格式');
  const view = new DataView(bytes.buffer);
  let dimensions;
  if (png) {
    dimensions = [view.getUint32(16), view.getUint32(20)];
    let at=8;
    while (at+12<=bytes.length) {
      const size=view.getUint32(at), type=word(at+4,4);
      if (at+size+12>bytes.length) throw new Error('图片损坏，请重新选择');
      if (type==='acTL') throw new Error('暂不支持动画头像，请选择静态图片');
      at+=size+12; if(type==='IEND')break;
    }
  } else if (jpeg) {
    let at=2;
    while(at+4<=bytes.length) {
      if(bytes[at++]!==255)break;
      while(bytes[at]===255)at++;
      const marker=bytes[at++];if(marker===218 || marker===217)break;
      if(marker===1)continue;
      if(at+2>bytes.length)break;
      const size=view.getUint16(at);if(size<2 || at+size>bytes.length)break;
      if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker) && size>=7){dimensions=[view.getUint16(at+5),view.getUint16(at+3)];break;}
      at+=size;
    }
  } else {
    let at=12;
    while(at+8<=bytes.length){
      const type=word(at,4),size=view.getUint32(at+4,true), p=at+8;
      if(p+size>bytes.length)throw new Error('图片损坏，请重新选择');
      if(type==='ANIM' || type==='ANMF' || (type==='VP8X' && (bytes[p]&2)))throw new Error('暂不支持动画头像，请选择静态图片');
      if(type==='VP8X' && size>=10)dimensions=[1+bytes[p+4]+(bytes[p+5]<<8)+(bytes[p+6]<<16),1+bytes[p+7]+(bytes[p+8]<<8)+(bytes[p+9]<<16)];
      if(type==='VP8 ' && size>=10)dimensions=[view.getUint16(p+6,true)&16383,view.getUint16(p+8,true)&16383];
      if(type==='VP8L' && size>=5){const n=view.getUint32(p+1,true);dimensions=[1+(n&16383),1+((n>>>14)&16383)];}
      at=p+size+(size%2);
    }
  }
  if (!dimensions || !dimensions[0] || !dimensions[1])throw new Error('图片头无效，请重新选择');
  if(dimensions[0]>8192 || dimensions[1]>8192 || dimensions[0]*dimensions[1]>40000000)throw new Error('图片像素过多，请先缩小后再上传');

  const blob = new Blob([bytes], { type: png ? 'image/png' : jpeg ? 'image/jpeg' : 'image/webp' });
  const url = URL.createObjectURL(blob), image = new Image();
  try {
    await new Promise((resolve,reject) => { image.onload=resolve; image.onerror=()=>reject(new Error('图片无法读取，请换一张图片')); image.src=url; });
    const w=image.naturalWidth,h=image.naturalHeight;
    if (!w || !h || w>8192 || h>8192 || w*h>40000000) throw new Error('图片最长边需小于 8192 像素，总像素不超过 4000 万');
    const canvas=document.createElement('canvas'); canvas.width=canvas.height=128;
    const ctx=canvas.getContext('2d'); if (!ctx) throw new Error('浏览器无法处理图片');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,128,128);
    const side=Math.min(w,h);ctx.drawImage(image,(w-side)/2,(h-side)/2,side,side,0,0,128,128);
    return canvas.toDataURL('image/jpeg',0.85);
  } finally { URL.revokeObjectURL(url); }
}
export function bindProfileEditor(root, account, save) {
  const form=root.querySelector('#player-profile-form'), preview=root.querySelector('#profile-preview'), error=root.querySelector('#profile-error'), submit=root.querySelector('#profile-save');
  let avatar, busy=false, sequence=0;
  const setBusy=value => { busy=value; form.querySelectorAll('button,input').forEach(el=>el.disabled=value); submit.textContent=value?'正在处理…':'保存昵称与头像'; };
  form.querySelectorAll('[data-avatar]').forEach(button=>button.addEventListener('click',()=>{
    avatar=button.dataset.avatar; preview.src=avatarSrc(avatar);error.textContent='';
    form.querySelectorAll('[data-avatar]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  }));
  root.querySelector('#profile-file').addEventListener('change',async event=>{
    const file=event.target.files?.[0];event.target.value='';if (!file) return;
    const operation=++sequence;setBusy(true);error.textContent='';
    try { const next=await convertAvatar(file); if (operation!==sequence || !form.isConnected) return; avatar=next;preview.src=next;form.querySelectorAll('[data-avatar]').forEach(b=>b.setAttribute('aria-pressed','false')); }
    catch(e){if(form.isConnected) error.textContent=e.message;}
    finally{if(form.isConnected && operation===sequence)setBusy(false);}
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;
    const name=root.querySelector('#profile-name').value.trim();
    if ([...name].length<2 || [...name].length>16) { error.textContent='昵称需为 2–16 个字';return; }
    setBusy(true);error.textContent='';
    try { await save({name,...(avatar===undefined ? {} : {avatar})}); }
    catch(e){if(form.isConnected)error.textContent=e.message;}
    finally{if(form.isConnected)setBusy(false);}
  });
}
