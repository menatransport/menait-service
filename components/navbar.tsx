'use client';

import { ArrowLeft, Bell, Search, Shield, User } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

export const NavHome = () => {

    return (
        <div className="shrink-0">

            <header className="px-4 sm:px-6 lg:px-8 pt-2 sm:pt-6 pb-2 animate-fade-in-down">
                <div className="max-w-full sm:mx-10 flex items-center justify-between">

                    {/* Logo */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center animate-pulse-glow">
                            <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                        </div>
                        <span className="text-white font-bold text-base sm:text-xl">
                            Mena IT Service
                        </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 sm:gap-4">

                        {/* Notification */}
                        <button className="relative p-2 sm:p-3 bg-white/10 backdrop-blur-sm rounded-xl hover:bg-white/20 transition-all duration-300 hover:scale-105">
                            <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                            <span className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-rose-500 rounded-full text-[10px] sm:text-xs text-white flex items-center justify-center font-medium animate-pulse">
                                5
                            </span>
                        </button>

                        {/* User */}
                        <div className="flex items-center gap-2 sm:gap-3 p-1.5 sm:px-4 sm:py-2 bg-white/10 backdrop-blur-sm rounded-xl cursor-pointer hover:bg-white/20 transition-all duration-300 hover:scale-105">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#8ce4cb] rounded-full flex items-center justify-center">
                                <User className="w-4 h-4 sm:w-5 sm:h-5 text-[#026a75]" />
                            </div>
                            <div className="hidden sm:block">
                                <p className="text-white font-semibold text-sm">Kittaboon</p>
                                <p className="text-white/70 text-xs">IT Department</p>
                            </div>
                        </div>

                    </div>
                </div>
            </header>

            {/* ================= Welcome Section ================= */}
            <section className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sm:gap-6">

                        {/* Greeting */}
                        <div className="animate-slide-in-left">
                            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-1 sm:mb-2">
                                สวัสดี, Kittaboon 👋
                            </h1>
                            <p className="text-white/80 text-sm sm:text-base lg:text-lg">
                                วันนี้คุณต้องการความช่วยเหลืออะไร?
                            </p>
                        </div>

                        {/* Search */}
                        <div className="relative w-full lg:w-96 animate-fade-in-up">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400 z-10" />
                            <Input
                                // value={searchQuery}
                                // onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="ค้นหาบริการ..."
                                className="w-full h-11 sm:h-12 lg:h-14 bg-white/95 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl rounded-xl sm:rounded-2xl pl-10 sm:pl-12 pr-4 text-sm sm:text-base placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-[#8ce4cb] transition-all duration-300"
                            />
                        </div>

                    </div>
                </div>
            </section>

        </div>

    );
}

export const NavElse = ({ title }: { title: string }) => {

    return (
            <header className="shrink-0 px-4 sm:px-6 lg:px-8 pt-3 sm:pt-6 pb-3">
                <div className="w-full flex items-center justify-between">
                    {/* Left: Back button */}
                    <Button 
                        onClick={() => window.history.back()} 
                        variant="ghost"
                        className="text-white cursor-pointer hover:bg-white/20 rounded-xl h-10 w-auto px-3 sm:h-11 sm:px-4 transition-all duration-300 hover:scale-105 flex items-center gap-2"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span className="text-sm font-medium">ย้อนกลับ</span>
                    </Button>

                    {/* Center: Page Title */}
                    <div className="absolute left-1/2 -translate-x-2/5 sm:-translate-x-1/2 flex items-center gap-2 sm:gap-3">
                        <span className="text-white font-bold text-xs sm:text-lg text-center block">{title}</span>
                    </div>

                    {/* Right: User Profile */}
                    <div className="flex items-center gap-2 sm:gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-1.5 sm:px-4 sm:py-2 hover:bg-white/20 transition-all duration-300 cursor-pointer hover:scale-105">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#8ce4cb] rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 sm:w-5 sm:h-5 text-[#026a75]" />
                        </div>
                        <div className="hidden sm:block">
                            <p className="text-white font-semibold text-sm">Kittaboon</p>
                            <p className="text-white/70 text-xs">IT Department</p>
                        </div>
                    </div>
                </div>
            </header>
    );

}