const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function weaponFrame(a,mode='battle'){
 if(!/^assets\/opponents\/[a-z0-9-]+\.png$/.test(a?.path||'')||!/^#[a-f0-9]{6}$/i.test(a.accent||'')||!/^[a-z0-9]+$/.test(a.skinId||''))return '';
 const src=escape(a.path),name=escape(a.skinName),id=a.skinId;
 const image=(second=false)=>`<img class="weapon-render${second?' weapon-second':''}" src="/${src}" alt="${second?'':name}" decoding="async" draggable="false">`;
 return `<span class="weapon-frame weapon-${id}${mode==='display'?' weapon-display':''}" style="--weapon-accent:${a.accent}">${mode==='display'?'':'<i class="weapon-aura"></i><i class="weapon-ring"></i>'}${image()}${id==='twin'&&mode!=='display'?image(true):''}<span class="weapon-ground"></span></span>`;
}
