import "server-only";

const baseUrl=()=>{
 const value=process.env.NEXT_PUBLIC_SUPABASE_URL;
 if(!value)throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing");
 return value.replace(/\/$/,"");
};

function serviceHeaders(contentType?:string){
 const current=process.env.SUPABASE_SECRET_KEY;
 const legacy=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const key=current||legacy;
 if(!key)throw new Error("SUPABASE_SECRET_KEY is missing");
 const headers:Record<string,string>={apikey:key};
 if(!current)headers.Authorization=`Bearer ${key}`;
 if(contentType)headers["Content-Type"]=contentType;
 return headers;
}

export async function uploadPrivateObject(bucket:string,path:string,body:Uint8Array,mimeType:string){
 const response=await fetch(`${baseUrl()}/storage/v1/object/${bucket}/${path}`,{method:"POST",headers:{...serviceHeaders(mimeType),"x-upsert":"true"},body:body as unknown as BodyInit,cache:"no-store"});
 if(!response.ok)throw new Error(`Private media upload failed (${response.status})`);
}

export async function deletePrivateObject(bucket:string,path:string){
 const response=await fetch(`${baseUrl()}/storage/v1/object/${bucket}`,{method:"DELETE",headers:serviceHeaders("application/json"),body:JSON.stringify({prefixes:[path]}),cache:"no-store"});
 if(!response.ok)throw new Error(`Private media cleanup failed (${response.status})`);
}

export async function signedPrivateObjectUrl(bucket:string,path:string,expiresIn=60){
 const response=await fetch(`${baseUrl()}/storage/v1/object/sign/${bucket}/${path}`,{method:"POST",headers:serviceHeaders("application/json"),body:JSON.stringify({expiresIn}),cache:"no-store"});
 if(!response.ok)throw new Error(`Private media signing failed (${response.status})`);
 const payload=await response.json();
 const signed=String(payload.signedURL||payload.signedUrl||"");
 if(!signed)throw new Error("Supabase did not return a signed media URL");
 return signed.startsWith("http")?signed:`${baseUrl()}/storage/v1${signed}`;
}
