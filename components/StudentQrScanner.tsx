"use client";

import jsQR from "jsqr";
import {useEffect,useRef,useState} from "react";

export default function StudentQrScanner({onToken,onCode}:{onToken:(token:string)=>void;onCode:()=>void}){
 const videoRef=useRef<HTMLVideoElement>(null),canvasRef=useRef<HTMLCanvasElement>(null),streamRef=useRef<MediaStream|null>(null),frameRef=useRef<number>(0);
 const [running,setRunning]=useState(false),[message,setMessage]=useState("");
 const stop=()=>{cancelAnimationFrame(frameRef.current);streamRef.current?.getTracks().forEach(track=>track.stop());streamRef.current=null;setRunning(false)};
 useEffect(()=>stop,[]);
 const readToken=(raw:string)=>{try{const url=new URL(raw),configured=new URL(process.env.NEXT_PUBLIC_APP_URL||location.origin);if(url.host!==location.host&&url.host!==configured.host)return "";const match=url.pathname.match(/^\/student\/enter\/(qrt_[0-9a-f]{64})\/?$/i);return match?.[1]||""}catch{return ""}};
 const scan=()=>{
  const video=videoRef.current,canvas=canvasRef.current;
  if(!video||!canvas||video.readyState<2){frameRef.current=requestAnimationFrame(scan);return}
  const width=video.videoWidth,height=video.videoHeight;
  if(width&&height){canvas.width=width;canvas.height=height;const context=canvas.getContext("2d",{willReadFrequently:true});context?.drawImage(video,0,0,width,height);const pixels=context?.getImageData(0,0,width,height);const decoded=pixels&&jsQR(pixels.data,width,height,{inversionAttempts:"dontInvert"});if(decoded){const token=readToken(decoded.data);if(token){stop();onToken(token);return}setMessage("마음씨앗 카드를 다시 보여주세요.")}}
  frameRef.current=requestAnimationFrame(scan);
 };
 const start=async()=>{setMessage("");try{if(!navigator.mediaDevices?.getUserMedia)throw new Error("camera unavailable");const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});streamRef.current=stream;setRunning(true);const video=videoRef.current;if(video){video.srcObject=stream;await video.play()}frameRef.current=requestAnimationFrame(scan)}catch(error){console.warn("student QR camera unavailable",error instanceof Error?error.name:"unknown");stop();setMessage("카메라를 사용할 수 없어요. 학생 코드로 들어갈 수 있어요.")}};
 return <section className="student-qr-scanner">
  <button type="button" className={`qr-live-view ${running?"running":""}`} onClick={()=>!running&&void start()} aria-label={running?"QR 카드를 카메라에 보여주세요":"QR 카메라 시작"}>
   <video ref={videoRef} playsInline muted hidden={!running} aria-label="QR 촬영 카메라"/>{!running&&<><span aria-hidden="true">▦</span><p>QR 카드를 여기에 보여줘요</p></>}
  </button>
  <canvas ref={canvasRef} hidden/>
  {!running&&<button type="button" className="qr-start-button" aria-label="QR 카드 찍기" onClick={()=>void start()}>📷 QR 카드 찍기</button>}
  {running&&<button type="button" className="qr-stop-button" onClick={stop}>카메라 멈추기</button>}
  {message&&<p role="alert">{message}</p>}
  <button type="button" className="qr-code-alternative" onClick={()=>{stop();onCode()}}>🔢 코드로 들어가기</button>
 </section>
}
