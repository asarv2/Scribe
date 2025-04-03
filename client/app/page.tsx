/**
 * app/page.tsx
 * The root page component for the app.
 * @AshokSaravanan222
 * 09.01.2024
 */
"use client"
import { HomeLayout } from "@/components/Home/HomeLayout";
import Hero from "@/components/Landing/Hero";
import ForStudents from "@/components/Landing/ForStudents";
import ForTeachers from "@/components/Landing/ForTeachers";
import HowItWorks from "@/components/Landing/HowItWorks";
import CallToAction from "@/components/Landing/CallToAction";
import './landing.css';

export default function Landing() {
  return (
    <div className="landing-page">
      <HomeLayout>
        <Hero />
        <ForStudents />
        <ForTeachers />
        <HowItWorks />
        <CallToAction />
      </HomeLayout>
    </div>
  );
}
