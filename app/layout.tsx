import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Alpha Service Desk · Test',description:'Alpha Home Services test foundation',robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body><header><strong>Alpha Home Services</strong><span className="badge">TEST</span></header><aside className="notice">Test environment · Payments, messages and integrations are off.</aside><main>{children}</main></body></html>}
