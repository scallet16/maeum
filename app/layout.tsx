import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "마음씨앗 우체국", description: "마음과 자연, 관계를 잇는 우체국" };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ko"><body>{children}</body></html>}