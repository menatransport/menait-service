'use client';

import { ArrowRight, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

type MenuItem = {
    title: string;
    description: string;
    icon: React.ElementType;
    href: string;
    color: string;
    shadowColor: string;
}

type ServicesMenuProps = {
    menuItems: MenuItem[];
}

type NewsItem = {
    id: number;
    image: string;
    title: string;
    excerpt: string;
    author: string;
    date: string;
}

type InformationMenuProps = {
    newsItems: NewsItem[];
}

export const ServicesMenu = ({ menuItems }: ServicesMenuProps) => {

    return (
        <div className="shrink-0">
            <div className="flex items-center justify-between mb-4 sm:mb-6 animate-fade-in-up">
                <h2 className="text-base sm:text-lg lg:text-xl font-bold text-gray-800">บริการของเรา</h2>
            </div>

            {/* Service Menu Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8 lg:mb-12">
                {menuItems.map((item, index) => (
                    <Card
                        key={item.title}
                        onClick={() => window.location.href = item.href}
                        className={`group bg-white border-0 shadow-lg ${item.shadowColor} hover:shadow-2xl transition-all duration-500 cursor-pointer hover:-translate-y-2 overflow-hidden animate-fade-in-up stagger-${index + 1}`}
                    >
                        <CardContent className="p-3 sm:p-4 lg:p-6 flex flex-col items-center text-center">
                            <div className={`w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 ${item.color} rounded-2xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-lg`}>
                                <item.icon className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-white" />
                            </div>
                            <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-800 mb-1 sm:mb-2 group-hover:text-[#026a75] transition-colors duration-300 line-clamp-2">
                                {item.title}
                            </h3>
                            <p className="text-[10px] sm:text-xs lg:text-sm text-gray-500 leading-relaxed mb-3 sm:mb-4 line-clamp-2 hidden sm:block">
                                {item.description}
                            </p>
                            <Button className={`w-full ${item.color} text-white font-medium py-2 cursor-pointer sm:py-2.5 px-3 sm:px-4 rounded-lg sm:rounded-xl text-xs sm:text-sm shadow-md hover:shadow-lg transition-all duration-300 group-hover:scale-105`}>
                                <span className=" sm:inline">เข้าใช้งาน</span>
                                <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 sm:ml-1 group-hover:translate-x-1 transition-transform duration-300" />
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}

export const InformationMenu = ({ newsItems }: InformationMenuProps) => {

    return (
        <div className="shrink-0">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="text-base sm:text-lg lg:text-xl font-bold text-gray-800">📢 ข่าวสารและประกาศ</h2>
                <Button variant="ghost" className="text-[#026a75] hover:text-[#037a86] text-xs sm:text-sm font-medium hover:bg-[#026a75]/10 transition-all duration-300">
                    ดูทั้งหมด <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1" />
                </Button>
            </div>

            {/* News Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                {newsItems.map((news, index) => (
                    <Card
                        key={news.id}
                        className={`group bg-white border-0 shadow-md hover:shadow-xl transition-all duration-500 cursor-pointer hover:-translate-y-1 overflow-hidden animate-fade-in-up stagger-${index + 5}`}
                    >
                        {/* Image */}
                        <div className="relative h-28 sm:h-32 lg:h-36 overflow-hidden">
                            <img
                                src={news.image}
                                alt={news.title}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                            />
                            <div className="absolute inset-0 bg-linear-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </div>

                        <CardContent className="p-3 sm:p-4">
                            {/* Title */}
                            <h3 className="text-sm sm:text-base font-semibold text-gray-800 mb-1 sm:mb-2 line-clamp-2 group-hover:text-[#026a75] transition-colors duration-300">
                                {news.title}
                            </h3>

                            {/* Excerpt */}
                            <p className="text-[10px] sm:text-xs text-gray-500 leading-relaxed mb-2 sm:mb-3 line-clamp-2">
                                {news.excerpt}
                            </p>

                            {/* Meta */}
                            <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-gray-400 pt-2 sm:pt-3 border-t border-gray-100">
                                <span className="truncate max-w-[60%]">{news.author}</span>
                                <span>{news.date}</span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>

    );
}