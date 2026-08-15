"use client";

import Link from "next/link";
import { Sparkles, BarChart3, FileSpreadsheet, Upload, Brain, FileText } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-dark-blue-900">
      {/* Navbar */}
      <nav className="bg-dark-blue-800 px-6 py-4 flex justify-between items-center border-b border-orange-500/30">
        <div className="flex items-center gap-3">
          <span className="text-3xl font-bold text-orange-500">O</span>
          <span className="text-2xl font-bold text-white">QZARO</span>
          <span className="text-sm text-white opacity-80 hidden sm:inline">DataCleaning</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login">
            <button className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded-md transition">
              Log In
            </button>
          </Link>
          <Link href="/register">
            <button className="border border-orange-500 text-orange-500 hover:bg-orange-500/10 px-5 py-2 rounded-md transition">
              Sign Up
            </button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center text-center px-4 py-20 max-w-4xl mx-auto">
        <div className="w-24 h-24 rounded-full bg-orange-500/20 border-2 border-orange-500 flex items-center justify-center mb-6">
          <span className="text-5xl font-bold text-orange-500">O</span>
        </div>
        <h1 className="text-4xl md:text-6xl font-bold text-white">
          Smart <span className="text-orange-500">Data Cleaning</span> Agent
        </h1>
        <p className="text-white text-lg mt-4 max-w-2xl opacity-90">
          Upload your CSV or Excel file and let AI clean your data in seconds.
        </p>
        <div className="flex flex-wrap gap-4 mt-6">
          <Link href="/dashboard/upload">
            <button className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-lg text-lg font-semibold transition">
              Get Started
            </button>
          </Link>
          <button className="border border-orange-500 text-orange-500 hover:bg-orange-500/10 px-8 py-3 rounded-lg text-lg transition">
            Learn More
          </button>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-16 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center text-white mb-12">Features</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-dark-blue-800 p-6 rounded-lg border border-orange-500/20 text-center">
            <Sparkles className="w-10 h-10 text-orange-500 mx-auto mb-3" />
            <h3 className="text-xl font-semibold text-white">Automatic Cleaning</h3>
            <p className="text-white opacity-80">Remove duplicates, fill missing values, and clean text.</p>
          </div>
          <div className="bg-dark-blue-800 p-6 rounded-lg border border-orange-500/20 text-center">
            <BarChart3 className="w-10 h-10 text-orange-500 mx-auto mb-3" />
            <h3 className="text-xl font-semibold text-white">Advanced Analytics</h3>
            <p className="text-white opacity-80">Get detailed statistics and insights about your data.</p>
          </div>
          <div className="bg-dark-blue-800 p-6 rounded-lg border border-orange-500/20 text-center">
            <FileSpreadsheet className="w-10 h-10 text-orange-500 mx-auto mb-3" />
            <h3 className="text-xl font-semibold text-white">Export Reports</h3>
            <p className="text-white opacity-80">Download cleaned data and reports in multiple formats.</p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-4 py-16 max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-center text-white mb-12">How OQZARO DataCleaning Works</h2>
        <div className="grid md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="bg-dark-blue-800 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto border border-orange-500/30">
              <Upload className="w-8 h-8 text-orange-500" />
            </div>
            <p className="text-white mt-3 font-medium">1. Upload</p>
            <p className="text-white opacity-80 text-sm">Your CSV or Excel file</p>
          </div>
          <div className="text-center">
            <div className="bg-dark-blue-800 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto border border-orange-500/30">
              <Sparkles className="w-8 h-8 text-orange-500" />
            </div>
            <p className="text-white mt-3 font-medium">2. Clean</p>
            <p className="text-white opacity-80 text-sm">AI removes errors</p>
          </div>
          <div className="text-center">
            <div className="bg-dark-blue-800 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto border border-orange-500/30">
              <Brain className="w-8 h-8 text-orange-500" />
            </div>
            <p className="text-white mt-3 font-medium">3. Analyze</p>
            <p className="text-white opacity-80 text-sm">Smart insights</p>
          </div>
          <div className="text-center">
            <div className="bg-dark-blue-800 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto border border-orange-500/30">
              <FileText className="w-8 h-8 text-orange-500" />
            </div>
            <p className="text-white mt-3 font-medium">4. Export</p>
            <p className="text-white opacity-80 text-sm">Reports & cleaned file</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-dark-blue-800 px-6 py-8 border-t border-orange-500/20 text-center">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-orange-500">O</span>
            <span className="text-xl font-bold text-white">QZARO</span>
            <span className="text-sm text-white opacity-80">DataCleaning</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="text-white hover:text-orange-500 transition">About</a>
            <a href="#" className="text-white hover:text-orange-500 transition">Privacy</a>
            <a href="#" className="text-white hover:text-orange-500 transition">Contact</a>
          </div>
          <div className="text-white opacity-80">© 2026 OQZARO. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}