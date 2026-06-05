CHARS='0123456789bcdefghjkmnpqrstuvwxyz'

def encode_hash(lat:float,lng:float,length:int=7)->str:
    even=True
    lat_range=[-90.0,90.0]
    lng_range=[-180.0,180.0]
    out=""
    ch=0
    bit=0

    while len(out)<length:
        if even:
            mid=(lng_range[0]+lng_range[1])/2.0
            if lng>mid:
                ch|=(1<<(4-bit))
                lng_range[0]=mid
            else:
                lng_range[1]=mid
        else:
            mid=(lat_range[0]+lat_range[1])/2.0
            if lat>mid:
                ch|=(1<<(4-bit))
                lat_range[0]=mid
            else:
                lat_range[1]=mid

        even=not even

        if bit<4:
            bit+=1
        else:
            out+=CHARS[ch]
            bit=0
            ch=0

    return out

def decode_hash(geohash:str)->dict:
    even=True
    lat_range=[-90.0,90.0]
    lng_range=[-180.0,180.0]

    for c in geohash:
        val=CHARS.find(c)

        if val==-1:
            continue

        for bit in range(5):
            mask=1<<(4-bit)

            if even:
                mid=(lng_range[0]+lng_range[1])/2.0

                if val&mask:
                    lng_range[0]=mid
                else:
                    lng_range[1]=mid
            else:
                mid=(lat_range[0]+lat_range[1])/2.0

                if val&mask:
                    lat_range[0]=mid
                else:
                    lat_range[1]=mid

            even=not even

    return {
        "lat":(lat_range[0]+lat_range[1])/2.0,
        "lng":(lng_range[0]+lng_range[1])/2.0
    }
