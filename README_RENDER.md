# Grihayan 3D Surface Analyzer - Render.com Deployment Package

এই ফোল্ডারটি (`RENDER_DEPLOY`) সম্পূর্ণ আলাদা একটি স্ট্যান্ডঅ্যালোন প্রোডাকশন ডিপ্লয়মেন্ট প্যাকেজ।
এটির মাধ্যমে আপনার সম্পূর্ণ অ্যাপটি (Python FastAPI Backend + React Three.js Frontend) একক একটি Web Service হিসেবে Render.com-এ লাইভ চলবে।

---

## 📁 এই ফোল্ডারের ফাইলসমূহ:
- `app/` - Python FastAPI ব্যাকএন্ড কোড (Scientific GIS, Delaunay TIN, DEM, Contours)
- `static/` - React Three.js ফ্রন্টএন্ডের কম্পাইল করা প্রোডাকশন বিল্ড
- `requirements.txt` - Python লাইব্রেরি তালিকা
- `render.yaml` - Render ব্লুপ্রিন্ট কনফিগারেশন
- `Dockerfile` - ডকার ডিপ্লয়মেন্ট কনফিগারেশন

---

## 🚀 Render.com-এ ডিপ্লয় করার ধাপসমূহ (Step-by-Step Guide):

### পদ্ধতি ১: GitHub রিপোজিটরির মাধ্যমে (সবচেয়ে সহজ ও অটোমেটিক)

1. **নতুন গিট রিপোজিটরি তৈরি করুন:**
   - GitHub-এ যান এবং একটি নতুন রিপোজিটরি তৈরি করুন (যেমন: `grihayan-3d-analyzer`).
   - আপনার কম্পিউটারে টার্মিনাল খুলে এই `RENDER_DEPLOY` ফোল্ডারে যান এবং নিচের কমান্ডগুলো দিন:
     ```bash
     cd "f:\WEB DEVELOPMENT\GRIHAYAN 3D SURFACE ANALYZER\RENDER_DEPLOY"
     git init
     git add .
     git commit -m "Deploy Grihayan 3D Surface Analyzer"
     git branch -M main
     git remote add origin <আপনার_গিটহাব_রিপো_লিংক>
     git push -u origin main
     ```

2. **Render.com-এ কানেক্ট করুন:**
   - [render.com](https://dashboard.render.com/) এ লগইন করুন।
   - **"New +"** বাটনে ক্লিক করে **"Web Service"** সিলেক্ট করুন।
   - আপনার GitHub অ্যাকাউন্ট কানেক্ট করে তৈরি করা রিপোজিটরি (`grihayan-3d-analyzer`) সিলেক্ট করুন।

3. **Render সেটিংস কনফিগার করুন:**
   - **Name**: `grihayan-3d-surface-analyzer` (বা আপনার পছন্দের নাম)
   - **Region**: Singapore (এশিয়া অঞ্চলের জন্য দ্রুত রেসপন্স)
   - **Branch**: `main`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: `Free` (বা প্রয়োজন অনুযায়ী Starter)

4. **"Deploy Web Service"** বাটনে ক্লিক করুন!
   - ৩-৫ মিনিটের মধ্যে আপনার সাইট লাইভ হয়ে যাবে এবং আপনি একটি ফ্রি `.onrender.com` লিঙ্ক পেয়ে যাবেন (যেমন: `https://grihayan-3d-surface-analyzer.onrender.com`).

---

### পদ্ধতি ২: Docker হিসেবে ডিপ্লয় (Render Docker Runtime)

যদি Python প্যাকেজ ইনস্টলেশনের সময় কোনো C/C++ নির্ভর লাইব্রেরিতে সমস্যা এড়াতে চান:
1. Render-এ Web Service তৈরির সময় **Runtime** হিসেবে **"Docker"** নির্বাচন করুন।
2. Render স্বয়ংক্রিয়ভাবে ফোল্ডারে থাকা `Dockerfile` পড়ে পুরো অ্যাপটি কনটেইনার হিসেবে লাইভ করে দেবে।

---

## ⚙️ মূল প্রজেক্টে কোনো প্রভাব নেই:
- আপনার মূল লোকাল প্রজেক্টের কোড (`f:/WEB DEVELOPMENT/GRIHAYAN 3D SURFACE ANALYZER/frontend` এবং `backend`) সম্পূর্ণ অক্ষত রয়েছে।
- আপনার লোকাল সার্ভার (`http://localhost:3000` এবং `http://127.0.0.1:8000`) সবসময় আগের মতই কাজ করবে।
