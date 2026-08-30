"use client";

import jsQR from "jsqr";
import {useEffect,useRef,useState} from "react";

type NativeQrDetector={detect:(source:CanvasImageSource)=>Promise<{rawValue?:string}[]>};

export default function StudentQrScanner({onToken,onCode}:{onToken:(token:string)=>void;onCode:()=>void}){
 const videoRef=useRef<HTMLVideoElement>(null),canvasRef=useRef<HTMLCanvasElement>(null),streamRef=useRef<MediaStream|null>(null),frameRef=useRef<number>(0),detectorRef=useRef<NativeQrDetector|null>(null),decodingRef=useRef(false),foundRef=useRef(false),lastScanRef=useRef(0);
 const [running,setRunning]=useState(false),[message,setMessage]=useState("");
 const stop=(update=true)=>{cancelAnimationFrame(frameRef.current);frameRef.current=0;streamRef.current?.getTracks().forEach(track=>track.stop());streamRef.current=null;decodingRef.current=false;if(update)setRunning(false)};
 useEffect(()=>()=>stop(false),[]);
 const readToken=(raw:string)=>{try{const url=new URL(raw),configured=new URL(process.env.NEXT_PUBLIC_APP_URL||location.origin);if(url.host!==location.host&&url.host!==configured.host)return "";const match=url.pathname.match(/^\/student\/enter\/(qrt_[0-9a-f]{64})\/?$/i);return match?.[1]||""}catch{return ""}};
 const finish=(raw:string)=>{const token=readToken(raw);if(!token){setMessage("마음씨앗 카드를 다시 보여주세요.");return false}foundRef.current=true;setMessage("내 우체국을 열고 있어요…");stop();onToken(token);return true};
 const scan=async(time=0)=>{
  if(foundRef.current)return;
  const video=videoRef.current,canvas=canvasRef.current;
  if(!video||!canvas||video.readyState<2||!video.videoWidth||!video.videoHeight){frameRef.current=requestAnimationFrame(scan);return}
  if(decodingRef.current||time-lastScanRef.current<160){frameRef.current=requestAnimationFrame(scan);return}
  decodingRef.current=true;lastScanRef.current=time;
  const width=video.videoWidth,height=video.videoHeight,scale=Math.min(1,960/Math.max(width,height)),scanWidth=Math.max(1,Math.round(width*scale)),scanHeight=Math.max(1,Math.round(height*scale));
  canvas.width=scanWidth;canvas.height=scanHeight;
  const context=canvas.getContext("2d",{willReadFrequently:true});
  try{
   if(context){
    context.drawImage(video,0,0,scanWidth,scanHeight);
    if(detectorRef.current){try{const results=await detectorRef.current.detect(canvas);if(results[0]?.rawValue&&finish(results[0].rawValue))return}catch{detectorRef.current=null}}
    if(!detectorRef.current){const pixels=context.getImageData(0,0,scanWidth,scanHeight),decoded=jsQR(pixels.data,scanWidth,scanHeight,{inversionAttempts:"attemptBoth"});if(decoded&&finish(decoded.data))return}
   }
  }catch(error){console.warn("student QR decode skipped",error instanceof Error?error.name:"unknown")}
  finally{decodingRef.current=false}
  if(!foundRef.current)frameRef.current=requestAnimationFrame(scan);
 };
 const start=async()=>{setMessage("QR 카드를 찾고 있어요…");foundRef.current=false;lastScanRef.current=performance.now()+450;try{if(!navigator.mediaDevices?.getUserMedia)throw new Error("camera unavailable");const Detector=(window as typeof window&{BarcodeDetector?:new(options:{formats:string[]})=>NativeQrDetector}).BarcodeDetector;try{detectorRef.current=Detector?new Detector({formats:["qr_code"]}):null}catch{detectorRef.current=null}const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}},audio:false});streamRef.current=stream;setRunning(true);const video=videoRef.current;if(video){video.srcObject=stream;await video.play()}frameRef.current=requestAnimationFrame(scan)}catch(error){console.warn("student QR camera unavailable",error instanceof Error?error.name:"unknown");stop();setMessage("카메라를 사용할 수 없어요. 학생 코드로 들어갈 수 있어요.")}};
 return <section className="student-qr-scanner">
  <button type="button" className={`qr-live-view ${running?"running":""}`} onClick={()=>!running&&void start()} aria-label={running?"QR 카드를 카메라에 보여주세요":"QR 카메라 시작"}>
   <video ref={videoRef} playsInline muted hidden={!running} aria-label="QR 촬영 카메라"/>{running?<div className="qr-scan-frame" aria-hidden="true"><span>QR을 이 안에<br/>보여주세요</span></div>:<><span aria-hidden="true">▦</span><p>QR 카드를 여기에 보여줘요</p></>}
  </button>
  <canvas ref={canvasRef} hidden/>
  {!running&&<button type="button" className="qr-start-button" aria-label="QR 카드 찍기" onClick={()=>void start()}>📷 QR 카드 찍기</button>}
  {running&&<button type="button" className="qr-stop-button" onClick={()=>stop()}>카메라 멈추기</button>}
  {message&&<p className="qr-scan-message" role="status" aria-live="polite">{message}</p>}
  <button type="button" className="qr-code-alternative" onClick={()=>{stop();onCode()}}>🔢 코드로 들어가기</button>
 </section>
}
