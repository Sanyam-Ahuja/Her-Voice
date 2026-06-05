const chars='0123456789bcdefghjkmnpqrstuvwxyz';

export function encodeHash(lat,lng,len=7){
  let even=true;
  let latRange=[-90,90];
  let lngRange=[-180,180];
  let out='';
  let ch=0;
  let bit=0;

  while(out.length<len){
    if(even){
      const mid=(lngRange[0]+lngRange[1])/2;
      if(lng>mid){
        ch|=(1<<(4-bit));
        lngRange[0]=mid;
      }else{
        lngRange[1]=mid;
      }
    }else{
      const mid=(latRange[0]+latRange[1])/2;
      if(lat>mid){
        ch|=(1<<(4-bit));
        latRange[0]=mid;
      }else{
        latRange[1]=mid;
      }
    }

    even=!even;

    if(bit<4){
      bit++;
    }else{
      out+=chars[ch];
      bit=0;
      ch=0;
    }
  }

  return out;
}

export function decodeHash(hash){
  let even=true;
  let latRange=[-90,90];
  let lngRange=[-180,180];

  for(let i=0;i<hash.length;i++){
    const val=chars.indexOf(hash[i]);

    if(val===-1)continue;

    for(let bit=0;bit<5;bit++){
      const mask=1<<(4-bit);

      if(even){
        const mid=(lngRange[0]+lngRange[1])/2;

        if(val&mask){
          lngRange[0]=mid;
        }else{
          lngRange[1]=mid;
        }
      }else{
        const mid=(latRange[0]+latRange[1])/2;

        if(val&mask){
          latRange[0]=mid;
        }else{
          latRange[1]=mid;
        }
      }

      even=!even;
    }
  }

  return{
    lat: (latRange[0]+latRange[1])/2,
    lng: (lngRange[0]+lngRange[1])/2
  };
}
