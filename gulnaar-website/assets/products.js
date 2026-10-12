
/* KHAN — seed catalog (demo data; production = PostgreSQL) */
let PRODUCTS = [
  {id:'GLN-MEN-00101',name:'Onyx Black Kurta Shalwar',cat:'men',sub:'Kurta Shalwar',price:4250,sale:3499,img:'assets/img/kurta-black.jpg',badge:'Best Seller',
   fabric:'Premium Wash & Wear',colors:[{n:'Black',c:'#1c1c1c'}],sizes:[{s:'S',q:6},{s:'M',q:9},{s:'L',q:4},{s:'XL',q:2},{s:'XXL',q:0}],
   rating:4.8,rc:214,desc:'A timeless black kurta with a straight band collar and side slits, paired with a classic shalwar. Tailored from breathable wash & wear — your everyday staple, elevated.',isNew:false},
  {id:'GLN-MEN-00102',name:'White Embroidered Kurta Pajama',cat:'men',sub:'Kurta Pajama',price:5850,sale:null,img:'assets/img/kurta-white-emb.jpg',badge:'New',
   fabric:'Cotton Jacquard',colors:[{n:'White',c:'#f4f1ea'}],sizes:[{s:'S',q:3},{s:'M',q:7},{s:'L',q:5},{s:'XL',q:3},{s:'XXL',q:1}],
   rating:4.9,rc:96,desc:'Delicate tone-on-tone embroidery over cotton jacquard with a buttoned placket. Festive without trying too hard — ideal for Eid dinners and mehndis.',isNew:true},
  {id:'GLN-MEN-00103',name:'Off-White Cotton Kurta Pajama',cat:'men',sub:'Kurta Pajama',price:3950,sale:3299,img:'assets/img/kurta-offwhite.jpg',badge:'Sale',
   fabric:'Pure Cotton',colors:[{n:'Off-White',c:'#efe9dc'}],sizes:[{s:'S',q:5},{s:'M',q:8},{s:'L',q:6},{s:'XL',q:4},{s:'XXL',q:2}],
   rating:4.6,rc:178,desc:'Crisp pure-cotton kurta pajama in soft off-white. Cut for comfort with a relaxed shoulder and full sleeves — summer Fridays sorted.',isNew:false},
  {id:'GLN-WMN-00201',name:'Teal Embroidered Lawn 3-Piece',cat:'women',sub:'Lawn 3-Piece',price:6450,sale:null,img:'assets/img/lawn-teal.jpg',badge:'New',
   fabric:'Embroidered Lawn + Organza Dupatta',colors:[{n:'Teal',c:'#1f6f78'}],sizes:[{s:'XS',q:2},{s:'S',q:5},{s:'M',q:7},{s:'L',q:3},{s:'XL',q:1}],
   rating:4.7,rc:143,desc:'Rich teal lawn with intricate embroidery and a contrasting organza dupatta. Three pieces, endless compliments.',isNew:true},
  {id:'GLN-WMN-00202',name:'Maroon Embroidered Formal Suit',cat:'women',sub:'Formal Wear',price:8900,sale:7565,img:'assets/img/formal-maroon.jpg',badge:'Sale',
   fabric:'Embroidered Karandi',colors:[{n:'Maroon',c:'#7B1E2B'}],sizes:[{s:'S',q:4},{s:'M',q:6},{s:'L',q:2},{s:'XL',q:1}],
   rating:4.9,rc:88,desc:'Deep maroon karandi with hand-finished floral embroidery and a printed dupatta. Made for winter weddings.',isNew:false},
  {id:'GLN-WMN-00203',name:'Noir Floral Swiss Lawn 3-Piece',cat:'women',sub:'Lawn 3-Piece',price:7250,sale:null,img:'assets/img/lawn-black-floral.jpg',badge:null,
   fabric:'Swiss Lawn + Chiffon Dupatta',colors:[{n:'Black',c:'#1c1c1c'}],sizes:[{s:'XS',q:1},{s:'S',q:4},{s:'M',q:6},{s:'L',q:4},{s:'XL',q:2}],
   rating:4.5,rc:167,desc:'Black swiss lawn blooming with soft florals, finished with a crinkle chiffon dupatta. Understated, elegant, unforgettable.',isNew:false},
  {id:'GLN-WMN-00204',name:'Emerald Velvet Formal Dress',cat:'women',sub:'Velvet Collection',price:11500,sale:null,img:'assets/img/velvet-emerald.jpg',badge:'Premium',
   fabric:'Micro Velvet with Gold Trim',colors:[{n:'Emerald',c:'#0b5d4e'}],sizes:[{s:'S',q:3},{s:'M',q:4},{s:'L',q:2}],
   rating:5.0,rc:41,desc:'Plush micro velvet in deep emerald with hand-set gold edging. The shadi-season showstopper.',isNew:true},
  {id:'GLN-WMN-00206',name:'Mint Digital Print Lawn Suit',cat:'women',sub:'Lawn 3-Piece',price:6950,sale:5907,img:'assets/img/lawn-mint.jpg',badge:'Sale',
   fabric:'Digital Print Lawn',colors:[{n:'Mint',c:'#bfe3cf'}],sizes:[{s:'XS',q:2},{s:'S',q:6},{s:'M',q:5},{s:'L',q:3},{s:'XL',q:0}],
   rating:4.6,rc:129,desc:'Fresh mint lawn with an all-over digital floral print and a pearl-trim neckline. Summer in an outfit.',isNew:false},
  {id:'GLN-WMN-00207',name:'Olive Farshi Shalwar Kameez',cat:'women',sub:'Formal Wear',price:12800,sale:null,img:'assets/img/formal-olive.jpg',badge:'Premium',
   fabric:'Raw Silk + Organza',colors:[{n:'Olive',c:'#5b6234'}],sizes:[{s:'S',q:2},{s:'M',q:3},{s:'L',q:2}],
   rating:4.8,rc:57,desc:'Regal olive raw-silk kameez with farshi shalwar and an embroidered organza dupatta. Old-money Lahore energy.',isNew:true},
];

if (typeof window !== 'undefined') window.PRODUCTS = PRODUCTS;
if (typeof module !== 'undefined') module.exports = { PRODUCTS };

const PAY_SETTINGS = {
  cod:{enabled:true,fee:0,limit:50000,label:'Cash on Delivery'},
  jazzcash:{enabled:true,number:'0300-1234567',title:'Khan Clothing (Pvt) Ltd'},
  easypaisa:{enabled:true,number:'0301-7654321',title:'Khan Clothing (Pvt) Ltd'},
  bank:{enabled:true,bank:'Meezan Bank',account:'PK36 MEZN 0002 1701 0567 8901',title:'Khan Clothing (Pvt) Ltd'},
  freeShipAbove:5000,
  cities:[
    {n:'Lahore',fee:200},{n:'Karachi',fee:250},{n:'Islamabad',fee:220},{n:'Rawalpindi',fee:220},
    {n:'Faisalabad',fee:180},{n:'Multan',fee:200},{n:'Gujranwala',fee:180},{n:'Sialkot',fee:180},
    {n:'Peshawar',fee:250},{n:'Quetta',fee:300},{n:'Bahawalpur',fee:220},{n:'Sargodha',fee:200},
  ],
};

const COUPONS = { 'KHAN10':{type:'percent',value:10,min:3000}, 'EID500':{type:'fixed',value:500,min:5000}, 'FREESHIP':{type:'ship',value:0,min:0} };

const SIZES_CHART = [
  ['Size','Chest (in)','Length (in)','Shoulder (in)'],
  ['S','38','40','17'],['M','40','41','17.5'],['L','42','42','18'],['XL','44','43','18.5'],['XXL','46','44','19'],
];
