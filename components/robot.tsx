'use client';
import { useState, useEffect } from 'react';

interface RobotProps {
    greeting?: string;
}

export const Robot = ({ greeting }: RobotProps) => {
    const [showLeft, setShowLeft] = useState(true);

    // useEffect(() => {
    //     const interval = setInterval(() => {
    //         setShowLeft(prev => !prev);
    //     }, 22000);
    //     return () => clearInterval(interval);
    // }, []);

    return (
        <div className="relative flex flex-col items-center">
  
            <div className={`hidden absolute -top-2 -left-32 bg-white/95 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-xl max-w-[180px] transition-all duration-500 ${showLeft ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}>
                <div className="absolute -bottom-2 right-4 w-3 h-3 bg-white/95 rotate-45 rounded-sm" />
                <p className="text-sm font-medium text-[#026a75] relative z-10">
                    {greeting} น้าา
                </p>
            </div>

            <div className={`hidden absolute -top-2 -right-32 bg-white/80 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-xl max-w-[180px] transition-all duration-500 ${!showLeft ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}>
                <div className="absolute -bottom-2 left-4 w-3 h-3 bg-white/95 rotate-45 rounded-sm" />
                <p className="text-sm font-medium text-[#026a75] relative z-10">
                    มีอะไรให้ช่วยไหม? 🤖
                </p>
            </div>

            {/* Robot SVG */}
            <div className="relative group cursor-pointer shrink-0">
                <div className="absolute inset-0 bg-[#8ce4cb]/40 rounded-full blur-xl scale-110 group-hover:scale-125 transition-all duration-500" />
                        
                        <svg
                            width="150"
                            height="150"
                            viewBox="0 0 100 100"
                            className="relative z-10 drop-shadow-lg transform group-hover:scale-110 transition-transform duration-300"
                            aria-label="Robot Assistant"
                        >
                            {/* Definitions for gradients and filters */}
                            <defs>
                                <linearGradient id="robotBodyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor="#8ce4cb" />
                                    <stop offset="100%" stopColor="#026a75" />
                                </linearGradient>
                                <linearGradient id="robotHeadGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor="#a8f0dc" />
                                    <stop offset="100%" stopColor="#8ce4cb" />
                                </linearGradient>
                                <filter id="robotGlow" x="-20%" y="-20%" width="140%" height="140%">
                                    <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                                    <feMerge>
                                        <feMergeNode in="coloredBlur" />
                                        <feMergeNode in="SourceGraphic" />
                                    </feMerge>
                                </filter>
                                <linearGradient id="screenGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#026a75" />
                                    <stop offset="100%" stopColor="#014950" />
                                </linearGradient>
                            </defs>

                            {/* Antenna */}
                            <line x1="50" y1="8" x2="50" y2="18" stroke="#026a75" strokeWidth="3" strokeLinecap="round" />
                            <circle cx="50" cy="6" r="4" fill="#8ce4cb" filter="url(#robotGlow)">
                                <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
                            </circle>

                            {/* Head */}
                            <rect x="25" y="18" width="50" height="40" rx="10" fill="url(#robotHeadGradient)" filter="url(#robotGlow)" />
                            
                            {/* Face screen */}
                            <rect x="30" y="23" width="40" height="30" rx="6" fill="url(#screenGradient)" />
                            
                            {/* Eyes */}
                            <g className="animate-blink">
                                <ellipse cx="40" cy="35" rx="6" ry="7" fill="white" />
                                <ellipse cx="60" cy="35" rx="6" ry="7" fill="white" />
                                <circle cx="41" cy="36" r="3" fill="#026a75">
                                    <animate attributeName="cx" values="41;43;41;39;41" dur="4s" repeatCount="indefinite" />
                                </circle>
                                <circle cx="61" cy="36" r="3" fill="#026a75">
                                    <animate attributeName="cx" values="61;63;61;59;61" dur="4s" repeatCount="indefinite" />
                                </circle>
                            </g>

                            {/* Smile */}
                            <path d="M 40 46 Q 50 52 60 46" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />

                            {/* Body */}
                            <rect x="30" y="60" width="40" height="30" rx="8" fill="url(#robotBodyGradient)" />
                            
                            {/* Body details - chest light */}
                            <circle cx="50" cy="72" r="5" fill="#026a75">
                                <animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite" />
                            </circle>
                            <circle cx="50" cy="72" r="3" fill="#8ce4cb">
                                <animate attributeName="opacity" values="1;0.6;1" dur="1.5s" repeatCount="indefinite" />
                            </circle>

                            {/* Body pattern lines */}
                            <line x1="38" y1="80" x2="46" y2="80" stroke="#026a75" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
                            <line x1="54" y1="80" x2="62" y2="80" stroke="#026a75" strokeWidth="2" strokeLinecap="round" opacity="0.5" />

                            {/* Arms */}
                            <rect x="18" y="62" width="10" height="20" rx="5" fill="#8ce4cb">
                                <animateTransform attributeName="transform" type="rotate" values="0 23 62;5 23 62;0 23 62;-5 23 62;0 23 62" dur="3s" repeatCount="indefinite" />
                            </rect>
                            <rect x="72" y="62" width="10" height="20" rx="5" fill="#8ce4cb">
                                <animateTransform attributeName="transform" type="rotate" values="0 77 62;-5 77 62;0 77 62;5 77 62;0 77 62" dur="3s" repeatCount="indefinite" />
                            </rect>

                            {/* Hands */}
                            <circle cx="23" cy="84" r="5" fill="#026a75" />
                            <circle cx="77" cy="84" r="5" fill="#026a75" />

                            {/* Ears/Side panels */}
                            <rect x="18" y="28" width="6" height="15" rx="3" fill="#026a75" />
                            <rect x="76" y="28" width="6" height="15" rx="3" fill="#026a75" />
                        </svg>

                        {/* Floating particles effect */}
                        <div className="absolute -top-2 -left-2 w-2 h-2 bg-[#8ce4cb] rounded-full animate-float-particle opacity-60" />
                        <div className="absolute top-4 -right-3 w-1.5 h-1.5 bg-[#026a75] rounded-full animate-float-particle-delayed opacity-50" />
                        <div className="absolute -bottom-1 left-2 w-1 h-1 bg-[#8ce4cb] rounded-full animate-float-particle opacity-40" style={{ animationDelay: '1s' }} />
                    </div>
        </div>
    );
}