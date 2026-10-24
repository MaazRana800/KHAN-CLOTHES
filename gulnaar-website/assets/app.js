
/* KHAN — storefront engine (demo: localStorage cart/orders; production: PostgreSQL API) */
'use strict';
const $=(s,c=document)=>c.querySelector(s), $$=(s,c=document)=>[...c.querySelectorAll(s)];
const rs=n=>'Rs '+Number(n).toLocaleString('en-PK');
const LS={get:(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}},set:(k,v)=>localStorage.setItem(k,JSON.stringify(v))};
const escapeHTML=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

const Wishlist={
  key:'gln_wishlist',
  all(){const value=LS.get(this.key,[]);return Array.isArray(value)?value.filter(id=>typeof id==='string'):[]},
  has(id){return this.all().includes(id)},
  toggle(id){
    const items=this.all();
    const updated=items.includes(id)?items.filter(item=>item!==id):[...items,id];
    LS.set(this.key,updated);
    document.dispatchEvent(new CustomEvent('wishlist:change'));
    return updated.includes(id);
  },
};

const RecentViews={
  key:'gln_recent_views',
  all(){const value=LS.get(this.key,[]);return Array.isArray(value)?value.filter(id=>typeof id==='string'):[]},
  add(id){LS.set(this.key,[id,...this.all().filter(item=>item!==id)].slice(0,6))},
  clear(){LS.set(this.key,[])},
};

const ProductReviews={
  key:'gln_product_reviews',
  all(id){const value=LS.get(this.key,{});return Array.isArray(value[id])?value[id]:[]},
  add(id,review){
    const value=LS.get(this.key,{});
    const reviews=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
    reviews[id]=[review,...(Array.isArray(reviews[id])?reviews[id]:[])].slice(0,50);
    LS.set(this.key,reviews);
  },
};

async function apiRequest(path, options={}) {
  if (!window.KhanAPI) return null;
  try {
    return await window.KhanAPI[path]?.(options.body ?? undefined) ?? null;
  } catch (error) {
    console.error('[api]', error);
    return null;
  }
}

function toast(msg,ok){let t=$('.toast');if(!t){t=document.createElement('div');t.className='toast';document.body.appendChild(t)}
  t.textContent=msg;t.classList.toggle('ok',!!ok);t.classList.add('show');clearTimeout(t._x);t._x=setTimeout(()=>t.classList.remove('show'),2600)}

async function loadProductCatalog(){
  const fallback = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : (typeof PRODUCTS !== 'undefined' ? PRODUCTS : []);
  if (Array.isArray(window.PRODUCTS) && !window.PRODUCTS.length && Array.isArray(PRODUCTS) && PRODUCTS.length) {
    window.PRODUCTS = PRODUCTS;
  }
  if (!window.KhanAPI || typeof window.KhanAPI.products !== 'function') return fallback;
  try {
    const result = await window.KhanAPI.products();
    if (Array.isArray(result) && result.length) {
      PRODUCTS = result;
      window.PRODUCTS = result;
      return result;
    }
  } catch (error) {
    console.warn('[catalog]', error.message || error);
  }
  return fallback;
}

/* ---------- cart ---------- */
const Cart={
  key:'gln_cart',
  items(){return LS.get(this.key,[])},
  save(i){LS.set(this.key,i);document.dispatchEvent(new CustomEvent('cart:change'))},
  add(pid,size,color,qty=1){
    const p=PRODUCTS.find(x=>x.id===pid);if(!p)return;
    const sku=pid+'-'+size+'-'+color;
    const items=this.items();const line=items.find(i=>i.sku===sku);
    const stock=p.sizes.find(s=>s.s===size)?.q??0;
    const cur=line?line.qty:0;
    if(cur+qty>stock){toast('Only '+stock+' left in stock');return false}
    if(line)line.qty+=qty;else items.push({sku,pid,size,color,qty,price:p.sale??p.price,name:p.name,img:p.img});
    this.save(items);return true;
  },
  setQty(sku,qty){let items=this.items();const l=items.find(i=>i.sku===sku);if(!l)return;
    const p=PRODUCTS.find(x=>x.id===l.pid);const stock=p.sizes.find(s=>s.s===l.size)?.q??0;
    if(qty<=0)items=items.filter(i=>i.sku!==sku);else if(qty>stock){toast('Only '+stock+' in stock');l.qty=stock}else l.qty=qty;
    this.save(items)},
  remove(sku){this.save(this.items().filter(i=>i.sku!==sku))},
  count(){return this.items().reduce((a,i)=>a+i.qty,0)},
  subtotal(){return this.items().reduce((a,i)=>a+i.price*i.qty,0)},
  clear(){this.save([])},
};

/* ---------- orders ---------- */
const Orders={
  key:'gln_orders',
  all(){return LS.get(this.key,[])},
  save(o){LS.set(this.key,o)},
  async create(data){
    if (!window.KhanAPI || !window.KhanAPI.createOrder) throw new Error('Order service is not configured. Please try again later.');
    return window.KhanAPI.createOrder(data);
  },
  update(code,patch){const all=this.all();const o=all.find(x=>x.code===code);if(o){Object.assign(o,patch);this.save(all)}return o},
  addEvent(code,status,note){const all=this.all();const o=all.find(x=>x.code===code);
    if(o){o.status=status;o.events.push({s:status,at:new Date().toISOString(),note:note||''});this.save(all)}return o},
};

/* ---------- shared chrome ---------- */
const NAV=[['index.html','Home'],['shop.html','Shop'],['wishlist.html','Wishlist'],['info.html#size-guide','Size Guide'],['track.html','Track Order'],['info.html#contact','Contact']];
function renderChrome(active){
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => renderChrome(active), { once: true });
    return;
  }
  if (document.querySelector('#hdr') || document.body.dataset.glnChrome === '1') return;
  document.body.dataset.glnChrome = '1';

  const hdr=document.createElement('div');
  hdr.innerHTML=`
  <div class="topbar">Free delivery on orders above Rs 5,000 &nbsp;•&nbsp; Cash on Delivery nationwide &nbsp;•&nbsp; 7-day easy exchange</div>
  <header class="site-header" id="hdr">
    <div class="container nav">
      <a class="logo" href="index.html">
        <span class="logo-mark">خ</span>
        <span class="logo-text">KHAN<small>PREMIUM CLOTHING</small></span>
      </a>
      <nav class="nav-links" id="navLinks" aria-label="Main navigation">
        <button class="nav-close" id="navClose" type="button" aria-label="Close menu">×</button>
        ${NAV.map(n=>`<a href="${n[0]}" class="${active===n[0].split('#')[0]?'active':''}">${n[1]}</a>`).join('')}
      </nav>
      <div class="nav-icons">
        <a class="icon-btn" href="shop.html" title="Search" aria-label="Search products">⌕</a>
        <a class="icon-btn wishlist-nav" href="wishlist.html" title="Wishlist" aria-label="Wishlist">♡<span class="cart-badge" id="wishlistBadge" style="display:none">0</span></a>
        <button class="icon-btn" id="cartButton" type="button" title="Cart" aria-label="Open shopping bag">🛍<span class="cart-badge" id="cartBadge" style="display:none">0</span></button>
        <button class="icon-btn hamburger" id="burger" type="button" title="Menu" aria-label="Open menu" aria-controls="navLinks" aria-expanded="false">☰</button>
      </div>
    </div>
  </header>
  <div class="scrim" id="scrim"></div>`;
  document.body.prepend(hdr);
  const ftr=document.createElement('footer');
  ftr.className='site-footer';
  ftr.innerHTML=`
  <div class="container">
    <div class="foot-grid">
      <div>
        <a class="logo" href="index.html" style="margin-bottom:14px"><span class="logo-mark">خ</span><span class="logo-text" style="color:#fff">KHAN<small style="color:#c9ab9e">PREMIUM CLOTHING</small></span></a>
        <p style="font-size:.85rem;color:#c9b6ab;max-width:280px">Pakistani craftsmanship, delivered to your door. Kurta shalwar, lawn, and formal wear — stitched with love since 2020.</p>
      </div>
      <div><h4>Shop</h4><a href="shop.html?cat=men">Men</a><a href="shop.html?cat=women">Women</a><a href="shop.html?sale=1">Sale</a><a href="shop.html?new=1">New Arrivals</a></div>
      <div><h4>Help</h4><a href="track.html">Track Order</a><a href="info.html#shipping">Shipping Info</a><a href="info.html#returns">Returns & Exchange</a><a href="info.html#faq">FAQ</a></div>
      <div><h4>Company</h4><a href="info.html#contact">Contact Us</a><a href="info.html#about">About Khan</a><a href="admin.html">Admin Panel</a></div>
    </div>
    <div class="foot-bottom"><span>© 2026 Khan Clothing (Pvt) Ltd — Faisalabad, Pakistan</span><span>COD • JazzCash • Easypaisa • Bank Transfer</span></div>
  </div>`;
  document.body.appendChild(ftr);
  const wa=document.createElement('a');
  wa.className='wa-float';wa.href='https://wa.me/923081961618';wa.target='_blank';wa.title='Chat on WhatsApp';
  wa.innerHTML='<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.3c-.2.6-1.3 1.2-1.8 1.3-.5 0-1 .2-3.4-.7-2.9-1.1-4.7-4-4.9-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.6-.5.5c-.2.2-.3.4-.1.7.2.3.9 1.5 2 2.4 1.4 1.2 2.5 1.6 2.9 1.8.3.2.5.1.7-.1l1-1.1c.2-.3.4-.2.7-.1l2 .9c.3.2.5.3.6.4 0 .1 0 .7-.2 1.1z"/></svg>';
  document.body.appendChild(wa);

  /* mobile drawer */
  const burger=$('#burger'),links=$('#navLinks'),scrim=$('#scrim'),hdrEl=$('#hdr');
  const closeNav=()=>{if(!links||!scrim)return; links.classList.remove('open'); scrim.classList.remove('show'); hdrEl?.classList.remove('menu-open'); document.body.classList.remove('locked'); if(burger){burger.textContent='☰';burger.setAttribute('aria-expanded','false');burger.setAttribute('aria-label','Open menu');}};
  const openNav=()=>{if(!links||!scrim)return; links.classList.add('open'); scrim.classList.add('show'); hdrEl?.classList.add('menu-open'); document.body.classList.add('locked'); if(burger){burger.textContent='×';burger.setAttribute('aria-expanded','true');burger.setAttribute('aria-label','Close menu');}};
  burger?.addEventListener('click',()=>{ if(links?.classList.contains('open')) closeNav(); else openNav(); });
  $('#navClose')?.addEventListener('click',closeNav);
  scrim?.addEventListener('click',closeNav);
  links?.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeNav));

  const searchBtn=document.querySelector('.icon-btn[title="Search"]');
  searchBtn?.addEventListener('click',(e)=>{ e.preventDefault(); location.href='shop.html'; });

  const cartBtn=$('#cartButton');
  cartBtn?.addEventListener('click',(e)=>{ e.preventDefault(); openCartDrawer(); });

  /* header hide-on-scroll-down */
  let lastY=0;
  addEventListener('scroll',()=>{const y=scrollY;if(hdrEl){if(y>140&&y>lastY)hdrEl.classList.add('hide');else hdrEl.classList.remove('hide')}lastY=y},{passive:true});

  updateBadge();
  document.addEventListener('cart:change',updateBadge);
  updateWishlistBadge();
  document.addEventListener('wishlist:change',updateWishlistBadge);
  updateWishlistButtons();
  initReveal();
}
function updateBadge(){const b=$('#cartBadge');if(!b)return;const c=Cart.count();b.textContent=c;b.style.display=c?'grid':'none'}
function updateWishlistBadge(){const b=$('#wishlistBadge');if(!b)return;const c=Wishlist.all().length;b.textContent=c;b.style.display=c?'grid':'none'}
function updateWishlistButtons(){$$('[data-wishlist-id]').forEach(button=>{const saved=Wishlist.has(button.dataset.wishlistId);button.classList.toggle('saved',saved);button.setAttribute('aria-pressed',String(saved));button.setAttribute('aria-label',saved?'Remove from wishlist':'Save to wishlist');button.textContent=button.classList.contains('product-wishlist')?(saved?'♥ Saved to Wishlist':'♡ Save to Wishlist'):(saved?'♥':'♡')})}
function toggleWishlist(id){const saved=Wishlist.toggle(id);toast(saved?'Saved to your wishlist':'Removed from your wishlist',true);updateWishlistButtons();return saved}

/* ---------- cart drawer ---------- */
function openCartDrawer(){
  let d=$('#cartDrawer');
  if(!d){
    d=document.createElement('div');d.id='cartDrawer';d.className='drawer';
    d.innerHTML=`<div class="drawer-head"><h3>Your Bag</h3><button id="cdClose" class="icon-btn">✕</button></div>
      <div class="drawer-body" id="cdBody"></div>
      <div class="drawer-foot" id="cdFoot"></div>`;
    document.body.appendChild(d);
    const scrim=document.createElement('div');scrim.className='scrim';scrim.id='cdScrim';document.body.appendChild(scrim);
    d.querySelector('#cdClose').onclick=closeCartDrawer;scrim.onclick=closeCartDrawer;
  }
  renderCartDrawer();
  d.classList.add('open');document.body.classList.add('locked');
  const s=$('#cdScrim');s&&s.classList.add('show');
}
function closeCartDrawer(){$('#cartDrawer')?.classList.remove('open');$('#cdScrim')?.classList.remove('show');document.body.classList.remove('locked')}
function renderCartDrawer(){
  const body=$('#cdBody'),foot=$('#cdFoot'),items=Cart.items();
  if(!items.length){body.innerHTML=`<div class="empty-cart"><div class="big">🛍</div><p>Your bag is empty.</p><a class="btn btn-primary btn-sm" href="shop.html" style="margin-top:14px">Start Shopping</a></div>`;foot.innerHTML='';return}
  body.innerHTML=items.map(i=>`
    <div class="cart-line">
      <img src="${i.img}" alt="${i.name}">
      <div style="flex:1"><div class="n">${i.name}</div><div class="m">Size ${i.size} • ${i.color}</div>
        <div class="qty"><button onclick="Cart.setQty('${i.sku}',${i.qty-1})">−</button><span>${i.qty}</span><button onclick="Cart.setQty('${i.sku}',${i.qty+1})">+</button></div>
      </div>
      <div style="text-align:right"><div class="p">${rs(i.price*i.qty)}</div>
      <button class="icon-btn" style="font-size:.9rem;color:var(--muted)" onclick="Cart.remove('${i.sku}')" title="Remove">🗑</button></div>
    </div>`).join('');
  const sub=Cart.subtotal(),need=Math.max(0,PAY_SETTINGS.freeShipAbove-sub);
  foot.innerHTML=`
    ${need>0?`<div class="free-ship">Add <b>${rs(need)}</b> more for <b>FREE delivery</b></div>`:`<div class="free-ship" style="background:#d6f0e2;border-color:#9ed7b8;color:var(--green)">✓ You've unlocked FREE delivery</div>`}
    <div class="summary-row total"><span>Subtotal</span><span>${rs(sub)}</span></div>
    <a class="btn btn-primary btn-block" href="checkout.html" style="margin-top:10px">Checkout Securely →</a>`;
}
document.addEventListener('cart:change',()=>{if($('#cartDrawer')?.classList.contains('open'))renderCartDrawer()});
addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    closeCartDrawer();
    const links=$('#navLinks');
    if(links?.classList.contains('open')){
      $('#navClose')?.click();
    }
  }
});

/* ---------- product card renderer ---------- */
function stars(r){const f=Math.round(r);return '★'.repeat(f)+'☆'.repeat(5-f)}
function cardHTML(p){
  const price=`<div class="p-price"><span class="now">${rs(p.sale??p.price)}</span>${p.sale?`<span class="was">${rs(p.price)}</span><span class="off">−${Math.round((1-p.sale/p.price)*100)}%</span>`:''}</div>`;
  return `<article class="p-card reveal">
    <a class="p-media" href="product.html?id=${p.id}">
      <img src="${p.img}" alt="${p.name}" loading="lazy">
      ${p.badge?`<span class="p-badge ${p.badge==='Sale'?'sale':''}">${p.badge}</span>`:''}
    </a>
    <div class="p-quick"><button class="wishlist-toggle ${Wishlist.has(p.id)?'saved':''}" type="button" data-wishlist-id="${p.id}" aria-label="${Wishlist.has(p.id)?'Remove from wishlist':'Save to wishlist'}" aria-pressed="${Wishlist.has(p.id)}" onclick="toggleWishlist('${p.id}')">${Wishlist.has(p.id)?'♥':'♡'}</button><button title="Quick add" onclick="quickAdd('${p.id}')">+</button></div>
    <div class="p-info">
      <span class="p-cat">${p.sub}</span>
      <h3 class="p-name"><a href="product.html?id=${p.id}">${p.name}</a></h3>
      <span class="p-code">${p.id}</span>
      <span class="p-rating">${stars(p.rating)} <span style="color:var(--muted)">(${p.rc})</span></span>
      ${price}
      <button class="add-btn" onclick="quickAdd('${p.id}')">Add to Bag</button>
    </div>
  </article>`;
}
function quickAdd(pid){
  const p=PRODUCTS.find(x=>x.id===pid);
  const first=p.sizes.find(s=>s.q>0);
  if(!first){toast('Out of stock');return}
  if(Cart.add(pid,first.s,p.colors[0].n)){openCartDrawer()}
}

function reviewHTML(review){
  const rating=Math.max(1,Math.min(5,Number(review.rating)||1));
  const date=new Date(review.createdAt);
  const dateText=Number.isNaN(date.getTime())?'':date.toLocaleDateString();
  return `<article class="review-card"><div class="review-stars" aria-label="${rating} out of 5 stars">${'★'.repeat(rating)}${'☆'.repeat(5-rating)}</div><strong>${escapeHTML(review.title)}</strong><p>${escapeHTML(review.text)}</p><small>${escapeHTML(review.name)}${dateText?' · '+escapeHTML(dateText):''}</small></article>`;
}

/* ---------- reveal on scroll ---------- */
function initReveal(){
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.12});
  $$('.reveal').forEach(el=>io.observe(el));
}

/* ---------- admin guard ---------- */
function requireAdmin(){
  if(sessionStorage.getItem('gln_admin')!=='1'){location.href='admin.html';return false}
  return true;
}
