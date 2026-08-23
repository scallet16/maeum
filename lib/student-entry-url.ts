export function appBaseUrl(){const configured=process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/,"");if(configured)return configured;if(typeof window!=="undefined")return window.location.origin;return ""}
export function studentEntryUrl(token:string){return `${appBaseUrl()}/student/enter/${encodeURIComponent(token)}`}
