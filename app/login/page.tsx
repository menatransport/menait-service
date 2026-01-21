'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { CircleUserRound, KeyRound } from 'lucide-react';
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        console.log({ username, password, rememberMe });
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });
        if (!res.ok) return alert('Login failed. Try again.');
        const data = await res.json();
        console.log('Login response data:', data);
        const role = (data.user.department === 'IT' || data.user.department === 'Operation Support') ? 'a' : 'u';
        data.user.role = role;
        if (rememberMe) {
            localStorage.setItem('auth-token', data.access_token);
            localStorage.setItem('user', JSON.stringify(data.user)); 
        }
        localStorage.setItem('user', JSON.stringify(data.user));
        router.push('/home');
    };

    const handleAuthengoogle = async () => {
        await signIn('google', { callbackUrl: '/home' });
    }

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
                                    <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
                                    <feOffset dx="0" dy="2" result="offsetblur" />
                                    <feComponentTransfer>
                                        <feFuncA type="linear" slope="0.3" />
                                    </feComponentTransfer>
                                    <feMerge>
                                        <feMergeNode />
                                        <feMergeNode in="SourceGraphic" />
                                    </feMerge>
                                </filter>
                            </defs>
                            <g transform="translate(0 -106.5)">
                                <path d="m101.74 119.25v75l17.321 9.9998 43.301 25 21.65 12.5v-75l-43.301-25-21.65-12.5zm4.3301 7.5 73.612 42.5v65l-73.612-42.5z" fill="#999" />
                                <path d="m101.74 194.25-8.6599 5.0002h-5.2e-4l-38.971 22.5-17.321 9.9999 82.273 47.5 64.952-37.5z" fill="#666" />
                                <path d="m106.07 191.75v-65l73.612 42.5v65z" fill="#d7f9fc" />
                                <path d="m36.787 231.75v5l82.272 47.5 64.952-37.5v-5l-64.952 37.5z" fill="#999" />
                                <path d="m67.098 224.25 30.311-17.5 64.952 37.5-30.311 17.5z" fill="#e6e6e6" />
                                <g transform="translate(2.146 69.75)" fill="#b3b3b3">
                                    <path d="m95.263 142 4.3301 2.5-4.3301 2.5-4.3301-2.5z" />
                                    <path d="m103.92 147 4.3301 2.5-4.3301 2.5-4.3301-2.5z" />
                                    <path d="m112.58 152 4.3301 2.5-4.3301 2.5-4.3301-2.5z" />
                                    <path d="m121.24 157 4.3301 2.5-4.3301 2.5-4.3301-2.5z" />
                                    <path d="m86.603 147 4.3301 2.5-4.3301 2.5-4.3301-2.5z" />
                                    <path d="m95.263 152 4.3301 2.5-4.3301 2.5-4.3301-2.5z" />
                                    <path d="m103.92 157 4.3301 2.5-4.3301 2.5-4.3301-2.5z" />
                                    <path d="m112.58 162 4.3301 2.5-4.3301 2.5-4.3301-2.5z" />
                                    <path d="m77.942 152 4.3301 2.5-4.3301 2.5-4.3301-2.5z" />
                                    <path d="m95.263 162 4.3301 2.5-4.3301 2.5-4.3301-2.5z" />
                                    <path d="m103.92 167 4.3301 2.5-4.3301 2.5-4.3301-2.5z" />
                                    <path d="m99.593 164.5 4.3301 2.5-4.3301 2.5-4.3301-2.5z" />
                                    <path d="m129.9 162 4.3301 2.5-4.3301 2.5-4.3301-2.5z" />
                                    <path d="m138.56 167 4.3301 2.5-4.3301 2.5-4.3301-2.5z" />
                                    <path d="m147.22 172 4.3301 2.5-4.3301 2.5-4.3301-2.5z" />
                                    <path d="m121.24 167 4.3301 2.5-4.3301 2.5-4.3301-2.5z" />
                                    <path d="m129.9 172 4.3301 2.5-4.3301 2.5-4.3301-2.5z" />
                                    <path d="m138.56 177 4.3301 2.5-4.3301 2.5-4.3301-2.5z" />
                                    <path d="m112.58 172 4.3301 2.5-4.3301 2.5-4.3301-2.5z" />
                                    <path d="m121.24 177 4.3301 2.5-4.3301 2.5-4.3301-2.5z" />
                                    <path d="m129.9 182 4.3301 2.5-4.3301 2.5-4.3301-2.5z" />
                                    <path d="m86.603 157 4.3301 2.5-4.3301 2.5-4.3301-2.5z" />
                                </g>
                                <path d="m97.409 246.75-12.99 7.5-17.321-10 12.99-7.5z" fill="#b3b3b3" />
                                {/* เงาที่ฐานโน๊ตบุ๊ค */}
                                <ellipse cx="106" cy="306.5" rx="40" ry="8" fill="#000000" opacity="0.15" filter="url(#shadow)" />
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
                               
                                className="w-full h-11 bg-[#026a75] hover:bg-[#025f68] text-white font-medium transition-all duration-200 shadow-md hover:shadow-lg"
                            >
                                Login
                            </Button>
                            {/* Authen With Google Workspace */}
                            <div className="flex items-center">
                                <div className="grow border-t border-gray-300"></div>
                                <span className="mx-4 text-gray-500">or</span>
                                <div className="grow border-t border-gray-300"></div>
                            </div>
                            <div className="flex items-center justify-center bg-white dark:bg-gray-700">
                                <button type="button" onClick={handleAuthengoogle} className="flex items-center cursor-pointer bg-white dark:bg-gray-900 border border-gray-300 rounded-lg shadow-md px-3 py-2 text-sm font-medium text-gray-800 dark:text-white hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">
                                    <svg className="h-6 w-6 mr-2" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" width="800px" height="800px" viewBox="-0.5 0 48 48" version="1.1"> <title>Google-color</title> <desc>Created with Sketch.</desc> <defs> </defs> <g id="Icons" stroke="none" strokeWidth="1" fill="none" fillRule="evenodd"> <g id="Color-" transform="translate(-401.000000, -860.000000)"> <g id="Google" transform="translate(401.000000, 860.000000)"> <path d="M9.82727273,24 C9.82727273,22.4757333 10.0804318,21.0144 10.5322727,19.6437333 L2.62345455,13.6042667 C1.08206818,16.7338667 0.213636364,20.2602667 0.213636364,24 C0.213636364,27.7365333 1.081,31.2608 2.62025,34.3882667 L10.5247955,28.3370667 C10.0772273,26.9728 9.82727273,25.5168 9.82727273,24" id="Fill-1" fill="#FBBC05"> </path> <path d="M23.7136364,10.1333333 C27.025,10.1333333 30.0159091,11.3066667 32.3659091,13.2266667 L39.2022727,6.4 C35.0363636,2.77333333 29.6954545,0.533333333 23.7136364,0.533333333 C14.4268636,0.533333333 6.44540909,5.84426667 2.62345455,13.6042667 L10.5322727,19.6437333 C12.3545909,14.112 17.5491591,10.1333333 23.7136364,10.1333333" id="Fill-2" fill="#EB4335"> </path> <path d="M23.7136364,37.8666667 C17.5491591,37.8666667 12.3545909,33.888 10.5322727,28.3562667 L2.62345455,34.3946667 C6.44540909,42.1557333 14.4268636,47.4666667 23.7136364,47.4666667 C29.4455,47.4666667 34.9177955,45.4314667 39.0249545,41.6181333 L31.5177727,35.8144 C29.3995682,37.1488 26.7323182,37.8666667 23.7136364,37.8666667" id="Fill-3" fill="#34A853"> </path> <path d="M46.1454545,24 C46.1454545,22.6133333 45.9318182,21.12 45.6113636,19.7333333 L23.7136364,19.7333333 L23.7136364,28.8 L36.3181818,28.8 C35.6879545,31.8912 33.9724545,34.2677333 31.5177727,35.8144 L39.0249545,41.6181333 C43.3393409,37.6138667 46.1454545,31.6490667 46.1454545,24" id="Fill-4" fill="#4285F4"> </path> </g> </g> </g> </svg>
                                    <span>Continue with Google</span>
                                </button>
                            </div>
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