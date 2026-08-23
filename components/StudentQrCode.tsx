"use client";
import {useEffect,useState} from "react";
import {QRCodeSVG} from "qrcode.react";
import {studentEntryUrl} from "@/lib/student-entry-url";
export default function StudentQrCode({token,name}:{token:string;name:string}){const [value,setValue]=useState("");useEffect(()=>setValue(studentEntryUrl(token)),[token]);if(!value)return <div className="student-qr-loading" role="status">QR을 만들고 있어요…</div>;return <div className="student-qr" data-qr-value={value}><QRCodeSVG value={value} size={220} level="Q" marginSize={4} bgColor="#FFFFFF" fgColor="#000000" title={`${name} 학생 입장 QR 코드`}/></div>}
