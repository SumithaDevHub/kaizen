import './globals.css';
import './kanban-theme.css';
export const viewport={themeColor:'#101012'};
export const metadata={title:'KAIZEN 改善 — Forge Your Progress',description:'An atmospheric weekly Kanban planner.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
