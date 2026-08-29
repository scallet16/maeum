const productionCanonicalUrl="https://maeum-one.vercel.app";
export function appBaseUrl(){if(process.env.NODE_ENV==="production")return productionCanonicalUrl;const configured=process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/,"");if(configured)return configured;if(typeof window!=="undefined")return window.location.origin;return ""}
export function studentEntryUrl(token:string){return `${appBaseUrl()}/student/enter/${encodeURIComponent(token)}`}
