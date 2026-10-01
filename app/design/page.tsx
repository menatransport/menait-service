'use client';

import { ArrowRight, Monitor, FolderKanban, Wallet } from 'lucide-react';
import { Mascot } from '@/components/mascot';
import Loading, { MascotLoader } from '@/components/loading';

/** menaIT V.2 — living style guide (tokens, mascot, loader, core surfaces). */

const SWATCHES: { group: string; items: [string, string][] }[] = [
    { group: 'Brand', items: [['brand-50', '#f0faff'], ['brand-100', '#d9f3ff'], ['brand-200', '#b9e9fb'], ['brand-400', '#3da5ff'], ['brand-500', '#2584f7'], ['brand-600', '#1c6ef2'], ['brand-700', '#1556c9'], ['aqua-400', '#3fc8f5']] },
    { group: 'Mint · Sun', items: [['mint-300', '#86f3c6'], ['mint-400', '#5be3a8'], ['mint-500', '#34d399'], ['mint-600', '#16b981'], ['sun-300', '#ffc27a'], ['sun-400', '#ffa94d'], ['sun-500', '#ff8a3d']] },
    { group: 'Ink', items: [['ink-300', '#aebbd0'], ['ink-500', '#6b7f9e'], ['ink-700', '#33476b'], ['ink-900', '#0f2748']] },
];

export default function DesignPage() {
    return (
        <div className="h-screen overflow-y-auto v2-canvas">
            <header className="relative overflow-hidden v2-shell text-white rounded-b-[40px] px-6 sm:px-10 pt-10 pb-20">
                <div aria-hidden="true" className="v2-orb w-96 h-96 -right-40 -top-40" />
                <div className="relative max-w-5xl mx-auto flex items-end justify-between gap-6">
                    <div>
                        <p className="text-white/85 text-sm">Design system</p>
                        <h1 className="font-display text-4xl sm:text-5xl font-bold">menaIT <span className="text-mint-300">V.2</span></h1>
                        <p className="text-white/85 mt-2 max-w-[40ch]">Tokens, mascot น้องมีนา, loader และ surface หลัก — ใช้เป็นแม่แบบของทุกหน้า</p>
                    </div>
                    <Mascot size={120} bubble="ใช้ของจากหน้านี้ได้เลยนะ!" />
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-6 sm:px-10 -mt-10 pb-20 space-y-8">
                <Section title="Color tokens" note="Tailwind: bg-brand-600, text-ink-900, bg-mint-400/20 …">
                    <div className="space-y-5">
                        {SWATCHES.map(s => (
                            <div key={s.group}>
                                <p className="text-xs font-semibold text-ink-500 mb-2">{s.group}</p>
                                <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                                    {s.items.map(([name, hex]) => (
                                        <div key={name}>
                                            <div className="h-14 rounded-2xl ring-1 ring-inset ring-black/5" style={{ background: hex }} />
                                            <p className="text-xs font-medium text-ink-900 mt-1.5">{name}</p>
                                            <p className="text-[11px] text-ink-500 font-mono">{hex}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </Section>

                <Section title="Typography" note="Display: Prompt · Body: Noto Sans Thai">
                    <p className="font-display text-4xl font-bold text-ink-900">หัวข้อหลัก Display 700</p>
                    <p className="font-display text-xl font-semibold text-ink-900 mt-2">หัวข้อรอง Display 600</p>
                    <p className="text-base text-ink-700 mt-2">เนื้อหาทั่วไป Noto Sans Thai — ตรวจสอบและยืนยันสิทธิ์การใช้งานได้ง่าย ๆ ในที่เดียว</p>
                    <p className="text-sm text-ink-500 mt-1">คำอธิบายรอง / caption</p>
                </Section>

                <Section title="Mascot — น้องมีนา" note="<Mascot size motion='bob|hop|none' bubble />">
                    <div className="flex flex-wrap items-end gap-10 pt-8">
                        <Mascot size={52} />
                        <Mascot size={84} motion="none" />
                        <Mascot size={112} className="ml-40" bubble="สวัสดี! น้องมีนามาช่วยแล้ว" />
                    </div>
                </Section>

                <Section title="Loader" note="Route: <Loading/> inside .v2-loader-screen · On light: <MascotLoader/>">
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div className="v2-loader-screen rounded-3xl h-72 grid place-items-center">
                            <Loading />
                        </div>
                        <div className="rounded-3xl h-72 grid place-items-center bg-white border border-border">
                            <MascotLoader text="กำลังบันทึก" size={88} />
                        </div>
                    </div>
                </Section>

                <Section title="Buttons, tiles & cards">
                    <div className="flex flex-wrap items-center gap-3">
                        <button className="v2-btn">ดูรายละเอียด <ArrowRight className="w-4 h-4" /></button>
                        <button className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-full text-brand-700 bg-[#e8f3ff] hover:bg-[#d6eaff] transition">Chip button</button>
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full text-sun-700 bg-[#fff1e0]"><i className="w-1.5 h-1.5 rounded-full bg-current" />รออนุมัติ</span>
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full text-mint-700 bg-[#dcfaf0]"><i className="w-1.5 h-1.5 rounded-full bg-current" />เสร็จสิ้น</span>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-4 mt-6">
                        {[
                            { t: 'Group IT', i: Monitor, c: 'v2-tile-blue' },
                            { t: 'Group OPS', i: FolderKanban, c: 'v2-tile-sun' },
                            { t: 'Group Finance', i: Wallet, c: 'v2-tile-mint' },
                        ].map(({ t, i: Icon, c }) => (
                            <div key={t} className="rounded-[22px] bg-white border border-border p-5 flex items-center gap-4 shadow-[0_4px_14px_-8px_rgba(21,86,201,0.25)] hover:-translate-y-1 hover:shadow-lift transition-all">
                                <span className={`w-12 h-12 rounded-2xl grid place-items-center ${c}`}><Icon className="w-5 h-5" /></span>
                                <span className="font-display font-semibold text-ink-900">{t}</span>
                            </div>
                        ))}
                    </div>
                </Section>
            </main>
        </div>
    );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
    return (
        <section className="v2-glass rounded-[28px] p-6 sm:p-8 v2-card-in">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-5">
                <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
                {note && <code className="text-xs text-ink-500">{note}</code>}
            </div>
            {children}
        </section>
    );
}
