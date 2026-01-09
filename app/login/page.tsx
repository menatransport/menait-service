'use client';
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleUserRound, KeyRound, Leaf, BookOpen } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [rememberMe, setRememberMe] = useState(false);
    const router = useRouter();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Handle login logic here
        console.log({ username, password, rememberMe });
        router.push('/home');
    };

    return (
        <div className="min-h-screen bg-linear-to-br from-[#026a75] via-[#037a86] to-[#025f68] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute top-10 left-10 hidden lg:block">
                {/* <img src="/mena.png" alt="Logo" className="w-48 h-32" /> */}
                {/* <Leaf className="w-32 h-32 text-white animate-pulse" /> */}
            </div>
            <div className="absolute bottom-10 right-10 opacity-20 hidden lg:block">
                {/* <BookOpen className="w-32 h-32 text-white animate-pulse" /> */}
            </div>

            <div className="w-full max-w-md z-10">
                <div className="text-left mx-5 sm:text-center mb-8">
                    <h1 className="text-4xl md:text-5xl font-semibold text-white mb-3">Welcome!</h1>
                    <p className="text-white/90 text-sm md:text-base">MENA it-service system, please login to your account.</p>
                </div>
        
                <Card className="shadow-2xl border-0 relative overflow-visible">
                    {/* Logo/Laptop positioned near Login title */}
                    <div className="absolute -right-8 -top-16 sm:-right-8 sm:-top-10 opacity-90">
                        <svg xmlns="http://www.w3.org/2000/svg" width="140" height="120" version="1.1" viewBox="0 0 285.75 190.5">
                            <defs>
                                <filter id="shadow">
                                    <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
                                    <feOffset dx="0" dy="2" result="offsetblur"/>
                                    <feComponentTransfer>
                                        <feFuncA type="linear" slope="0.3"/>
                                    </feComponentTransfer>
                                    <feMerge>
                                        <feMergeNode/>
                                        <feMergeNode in="SourceGraphic"/>
                                    </feMerge>
                                </filter>
                            </defs>
                            <g transform="translate(0 -106.5)">
                                <path d="m101.74 119.25v75l17.321 9.9998 43.301 25 21.65 12.5v-75l-43.301-25-21.65-12.5zm4.3301 7.5 73.612 42.5v65l-73.612-42.5z" fill="#999"/>
                                <path d="m101.74 194.25-8.6599 5.0002h-5.2e-4l-38.971 22.5-17.321 9.9999 82.273 47.5 64.952-37.5z" fill="#666"/>
                                <path d="m106.07 191.75v-65l73.612 42.5v65z" fill="#d7f9fc"/>
                                <path d="m36.787 231.75v5l82.272 47.5 64.952-37.5v-5l-64.952 37.5z" fill="#999"/>
                                <path d="m67.098 224.25 30.311-17.5 64.952 37.5-30.311 17.5z" fill="#e6e6e6"/>
                                <g transform="translate(2.146 69.75)" fill="#b3b3b3">
                                    <path d="m95.263 142 4.3301 2.5-4.3301 2.5-4.3301-2.5z"/>
                                    <path d="m103.92 147 4.3301 2.5-4.3301 2.5-4.3301-2.5z"/>
                                    <path d="m112.58 152 4.3301 2.5-4.3301 2.5-4.3301-2.5z"/>
                                    <path d="m121.24 157 4.3301 2.5-4.3301 2.5-4.3301-2.5z"/>
                                    <path d="m86.603 147 4.3301 2.5-4.3301 2.5-4.3301-2.5z"/>
                                    <path d="m95.263 152 4.3301 2.5-4.3301 2.5-4.3301-2.5z"/>
                                    <path d="m103.92 157 4.3301 2.5-4.3301 2.5-4.3301-2.5z"/>
                                    <path d="m112.58 162 4.3301 2.5-4.3301 2.5-4.3301-2.5z"/>
                                    <path d="m77.942 152 4.3301 2.5-4.3301 2.5-4.3301-2.5z"/>
                                    <path d="m95.263 162 4.3301 2.5-4.3301 2.5-4.3301-2.5z"/>
                                    <path d="m103.92 167 4.3301 2.5-4.3301 2.5-4.3301-2.5z"/>
                                    <path d="m99.593 164.5 4.3301 2.5-4.3301 2.5-4.3301-2.5z"/>
                                    <path d="m129.9 162 4.3301 2.5-4.3301 2.5-4.3301-2.5z"/>
                                    <path d="m138.56 167 4.3301 2.5-4.3301 2.5-4.3301-2.5z"/>
                                    <path d="m147.22 172 4.3301 2.5-4.3301 2.5-4.3301-2.5z"/>
                                    <path d="m121.24 167 4.3301 2.5-4.3301 2.5-4.3301-2.5z"/>
                                    <path d="m129.9 172 4.3301 2.5-4.3301 2.5-4.3301-2.5z"/>
                                    <path d="m138.56 177 4.3301 2.5-4.3301 2.5-4.3301-2.5z"/>
                                    <path d="m112.58 172 4.3301 2.5-4.3301 2.5-4.3301-2.5z"/>
                                    <path d="m121.24 177 4.3301 2.5-4.3301 2.5-4.3301-2.5z"/>
                                    <path d="m129.9 182 4.3301 2.5-4.3301 2.5-4.3301-2.5z"/>
                                    <path d="m86.603 157 4.3301 2.5-4.3301 2.5-4.3301-2.5z"/>
                                </g>
                                <path d="m97.409 246.75-12.99 7.5-17.321-10 12.99-7.5z" fill="#b3b3b3"/>
                                {/* เงาที่ฐานโน๊ตบุ๊ค */}
                                <ellipse cx="106" cy="306.5" rx="40" ry="8" fill="#000000" opacity="0.15" filter="url(#shadow)"/>
                            </g>
                        </svg>
                    </div>
                    
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-2xl md:text-3xl font-bold text-[#026a75]">Login</CardTitle>
                        <div className="h-1 w-20 bg-[#026a75] rounded-md"></div>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Username Field */}
                            <div className="space-y-2">
                                <Label htmlFor="username" className="text-sm font-medium">
                                    Username :
                                </Label>
                                <div className="relative">
                                    <CircleUserRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#a2ad9f]" />
                                    <Input
                                        type="text"
                                        id="username"
                                        placeholder="Enter your username"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="pl-10 h-11 focus-visible:ring-[#cbeee4]"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Password Field */}
                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-sm font-medium">
                                    Password :
                                </Label>
                                <div className="relative">
                                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#a2ad9f]" />
                                    <Input
                                        type="password"
                                        id="password"
                                        placeholder="Enter your password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pl-10 h-11 focus-visible:ring-[#026a75]"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Remember Me & Forgot Password */}
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="rememberMe"
                                        checked={rememberMe}
                                        onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                                        className="data-[state=checked]:bg-[#026a75] data-[state=checked]:border-[#026a75]"
                                    />
                                    <Label
                                        htmlFor="rememberMe"
                                        className="text-sm font-medium cursor-pointer"
                                    >
                                        Remember Me
                                    </Label>
                                </div>
                                <a
                                    href="#"
                                    className="text-sm text-[#026a75] hover:underline font-medium transition-colors"
                                >
                                    Forgot password?
                                </a>
                            </div>

                            {/* Login Button */}
                            <Button
                                type="submit"
                                className="w-full h-11 bg-[#026a75] hover:bg-[#025f68] text-white font-medium transition-all duration-200 shadow-md hover:shadow-lg"
                            >
                                Login
                            </Button>
                        </form>
                    </CardContent>
                </Card>


                <p className="text-center mt-6 text-white/90 text-sm">
                    Mena IT-Service {" "}
                    <a href="#" className="text-white font-semibold hover:underline">
                        V.0.1.0
                    </a>
                </p>
            </div>
        </div>
    );
}