Simulating Failure Models

- 1. Crash failure
- 2. Omission failure
- 3. Temporal failure (delay)

১. ল্যাবের ৩টি প্রধান ফেলিয়ার মডেল (Failure Models)

ডিস্ট্রিবিউটেড সিস্টেমে মূলত ৩ ধরণের সমস্যা দেখা যায়:

ক্র্যাশ ফেলিয়ার (Crash Failure):

কী ঘটে: কোনো একটি নোড বা সার্ভার পুরোপুরি বন্ধ (Crash/Kill) হয়ে যায়।

ক্লায়েন্ট কী দেখে: ক্লায়েন্ট সাধারণত Connection Refused বা Socket Closed এর মতো দ্রুত কানেকশন এরর দেখতে পায়।

ওমিশন ফেলিয়ার (Omission Failure):

কী ঘটে: সার্ভার চালু থাকে, কিন্তু নেটওয়ার্কের গণ্ডগোলের কারণে কিছু রিকোয়েস্ট বা রেসপন্স মাঝপথে ড্রপ হয়ে যায় (Messages Dropped)।

ক্লায়েন্ট কী দেখে: ক্লায়েন্ট রিকোয়েস্ট পাঠায় কিন্তু কোনো রেসপন্স না পেয়ে ঝুলন্ত অবস্থায় থাকে এবং শেষে Request Timeout এরর দেয়।

টেম্পোরাল / লেটেন্সি ফেলিয়ার (Temporal Failure):

কী ঘটে: সার্ভার বা নেটওয়ার্ক মারাত্মক স্লো হয়ে যায় (Slow Node / High Latency)।

ক্লায়েন্ট কী দেখে: রেসপন্স শেষ পর্যন্ত আসে, তবে তা স্বাভাবিক সময়ের চেয়ে অনেক বেশি সময় নেয়। ক্লায়েন্টের টাইমআউট যদি কম সেট করা থাকে, তবে রেসপন্স আসার আগেই তা ফেইল করে।




১. No Retry (কোনো রিট্রাই না করা)
একবার রিকোয়েস্ট ব্যর্থ হলে ক্লায়েন্ট সাথে সাথেই হাল ছেড়ে দেয় এবং আর কোনো চেষ্টা করে না।

Crash: সবথেকে দ্রুত এরর দেখায় (~50 ms)। কারণ প্রক্সি বা ওএস কার্নেল লেভেল থেকে সরাসরি রিজেক্ট সংকেত পাঠিয়ে দেয়।

Omission: ৫০% ক্ষেত্রে ইউজার এরর দেখে, যদিও বাকি ৫০% ক্ষেত্রে সংযোগ পুরোপুরি ঠিক থাকে।

Temporal: ১.৫ সেকেন্ড পর্যন্ত অপেক্ষা করার পর সরাসরি টাইমআউট এরর দেয়। ইউজার স্পষ্ট বুঝতে পারে যে সার্ভিস সাড়া দেয়নি।

২. Bounded Retry + Timeout (সীমিত চেষ্টা + সময় বেঁধে দেওয়া)
একটি নির্দিষ্ট সংখ্যকবার (যেমন: ৩ বার) চেষ্টা করা এবং প্রতি চেষ্টার জন্য একটি সকেট টাইমআউট (যেমন: ১.৫ সেকেন্ড) বেঁধে দেওয়া।

Crash: এটি একটি নিরাপদ ডিফল্ট কনফিগারেশন (৩ × ১.৫s ≈ ৪.৫s)। এটি মোট অপেক্ষার সময় আটকে রাখে এবং নোড যদি রিস্টার্ট হয়ে দ্রুত ফিরে আসে তবে তা কভার করে।

Omission: শেষ পর্যন্ত রিকোয়েস্ট সফল হয়, তবে ২য় বা ৩য় চেষ্টাটি অহেতুক নষ্ট হয়।

Temporal: ৩ বারই ব্যর্থ হয় এবং মোট ৪.৫ সেকেন্ড সময় অপচয় হয়। কারণ প্রতিটা চেষ্টা একই স্লো সার্ভার ও টাইমআউটের দেয়ালে ধাক্কা খায়।

৩. Fast Retry, No Backoff (কোনো বিরতি না দিয়ে দ্রুত রিট্রাই)
প্রথমবার ব্যর্থ হওয়ার সাথে সাথে কোনো সময় নষ্ট না করে (Backoff ছাড়া) মুহূর্তের মধ্যে আবার রিকোয়েস্ট পাঠানো।

Crash: No Retry-এর মতোই সমান সময় নেয়, কারণ মরা নোড কয়েক মিলিসেকেন্ডে জ্যান্ত হয় না।

Omission (সেরা পছন্দ): ওমিশনের জন্য এটি সেরা পলিসি (~50 ms-এ ২য় চেষ্টাতেই সফল)। কারণ নেটওয়ার্কের ক্ষণস্থায়ী ড্রপ বা প্যাকেট লস কয়েক মাইক্রোসেকেন্ডের মধ্যেই ঠিক হয়ে যায়।

Temporal: প্রতিবার ১.৫ সেকেন্ড করে ৩ বারই ব্যর্থ হয় (৪.৫ সেকেন্ড অপচয়)।১.৫ সেকেন্ডের টাইমআউট স্লো সার্ভারের জন্য অত্যন্ত কম।

৪. Retry with Exponential Backoff (সময় বাড়িয়ে বাড়িয়ে রিট্রাই)
প্রতিটি ব্যর্থ চেষ্টার পর রিট্রাই করার ইন্টারভাল সময়ের সাথে দ্বিগুণ/গুণিতক হারে বাড়ানো (যেমন: ১s, ২s, ৪s)।

Crash: প্রায় ১০.৬ সেকেন্ড অযথা সময় অপচয় করে (~50 ms × 3 + 10.5s ব্যাকঅফ)। যে নোড আর ফিরবে না, তার জন্য ব্যাকঅফ দিয়ে অপেক্ষা করা বোকামি।

Omission: কাজ করে ঠিকই, তবে প্রয়োজন ছাড়া বেশি সময় নষ্ট করে।

Temporal: ৩ বারই ব্যর্থ হয়। সার্ভার স্লো থাকলে ক্লায়েন্ট ব্যাকঅফ দিলে সার্ভারের গতি বাড়ানো সম্ভব নয়।

৫. Retry with Longer Timeout (টাইমআউট বাড়িয়ে রিট্রাই)
সকেট টাইমআউট বাড়িয়ে দেওয়া (যেমন: ১.৫ সেকেন্ডের বদলে ৫ সেকেন্ড করা)।

Crash: নোড সত্যি মরে গেলে No Retry-এর মতোই দ্রুত ব্যর্থ হবে।

Omission: কাজ করবে, কিন্তু ওমিশন ফেলিয়ারের ক্ষেত্রে এত দীর্ঘ টাইমআউট রাখার দরকার পড়ে না।

Temporal (সেরা পছন্দ): যদি SLA (Service Level Agreement) অনুমতি দেয়, তবে এটি সেরা পদ্ধতি। এটি ধীরগতির সার্ভারকে প্রসেস সম্পন্ন করার পর্যাপ্ত সময় দেয়, ফলে প্রথম চেষ্টাতেই (যেমন: ২ সেকেন্ডের মাথায়) সফল রেসপন্স পাওয়া যায়।




No retry	Fastest (~50 ms): kernel signal surfaces immediately	50% user errors: link is otherwise healthy	Fast error in 1.5 s: explicit, user knows it failed
Bounded retry + timeout	Principled default (3 × 1.5 s ≈ 4.5 s): caps total wait, also covers transient restarts	Succeeds but wastes attempts	Fails 3×, ~4.5 s wasted: each retry hits the same wall
Fast retry, no backoff	Same as no retry in wall time	Best (succeeds on retry 2, ~50 ms): link healed in microseconds	Fails 3× at 1.5 s each: still too short
Retry with exponential backoff	Wastes ~10.6 s: ~50 ms × 3 plus 10.5 s of backoff on a node that will not return	Works but slower than needed	Fails 3×: backoff cannot speed up a server that is slow on every call
Retry with longer timeout	Same as no retry if the node is truly dead	Works but unnecessary	Best if SLA allows (5 s × 3 ≈ 3.5 s on first success): gives the slow server room to reply