# Very Important Topic

- Should this data be kept in memory?
- Can we make 100 database queries?
- Should we batch these requests?
- Can one server handle 10,000 requests/sec?
- Do we need a cache?
- Is a synchronous call acceptable here?
- How much storage will we need next year?

# Computer Memory Hierarchy & Latency Notes

## ১. পরিমাপের একক (Time Units & Order of Magnitude)
* **Nanosecond (ns):** 10^-9 সেকেন্ড (সবচেয়ে দ্রুত)
* **Microsecond (μs):** 10^-6 সেকেন্ড
* **Millisecond (ms):** 10^-3 সেকেন্ড (ধীরগতি)

## ২. মেমোরি হায়ারার্কি (সবচেয়ে দ্রুত থেকে ধীর)

### ১. CPU Registers
* CPU-এর সবচেয়ে কাছে এবং দ্রুততম মেমোরি।
* কনকারেন্সি বা প্রসেসিংয়ের কাজ সরাসরি এখানে হয়।
* **গতি:** সাব-ন্যানোসেকেন্ড (< 1 ns)

### ২. CPU Caches (L1, L2, L3)
* প্রসেসরের ভেতরে থাকা অত্যন্ত দ্রুতগতির মেমোরি। সাইজে ছোট (যেমন: 64KB বা 128KB)।
* **গতি:** ন্যানোসেকেন্ড (ns)

### ৩. Main Memory (RAM / DRAM)
* সিস্টেমের মূল মেমোরি। প্রসেসর ক্যাশে ডাটা না পেলে RAM-এ খোঁজে।
* **গতি:** মাইক্রোসেকেন্ড (μs) বা ন্যানোসেকেন্ডের উচ্চসীমা

### ৪. SSD (Solid State Drive)
* NAND ফ্ল্যাশ গেট টেকনোলজি ব্যবহার করে। কোনো মুভিং পার্টস নেই।
* **গতি:** মাইক্রোসেকেন্ড (μs) থেকে মিলিসেকেন্ড (ms)

### ৫. HDD (Hard Disk Drive)
* মেকানিক্যাল ডিস্ক, তাই সবচেয়ে ধীরগতির।
* **গতি:** মিলিসেকেন্ড (ms)

## ৩. ক্লায়েন্ট-সার্ভার ও সিস্টেম পারফরম্যান্স (Network Latency)
* **ডাটা পারফরম্যান্স নির্ভর করে:** Hardware, Workload, OS, Network Path এবং Caching-এর ওপর।
* **ক্যাশ ইন-মেমোরি (Same Server):** CPU ক্যাশ বা RAM থেকে ডাটা রিড করলে ন্যানোসেকেন্ড বা মাইক্রোসেকেন্ডে কাজ শেষ হয়।
* **অন্য সার্ভারে DB (Network Transfer):** ক্লায়েন্ট যখন আলাদা সার্ভারে থাকা ডাটাবেজে হিট করে, তখন নেটওয়ার্ক লেটেন্সি যুক্ত হয়ে সময় মাইক্রোসেকেন্ড থেকে মিলিসেকেন্ডে (ms) পৌঁছে যায়।



১. Sequential Access (সিকোয়েন্সিয়াল অ্যাক্সেস)

কীভাবে কাজ করে: যখন ডাটা ডিস্কের ট্র্যাকে পরপর (একটার পর একটা পরিপাটি করে) সাজানো থাকে, তখন রিড/রাইট হেড এক জায়গায় বসে টানা ডাটা পড়ে যেতে পারে।

গতি: অনেক দ্রুত। কারণ হেডকে বারবার নতুন জায়গা খুঁজতে বা ঘুরতে হয় না।

উদাহরণ: কোনো বড় মুভি বা একটা বড় ভিডিও ফাইল প্লে করা বা বড় ফাইল এক ফোল্ডার থেকে অন্য ফোল্ডারে কপি করা।


২. Random Seek 

কীভাবে কাজ করে: যখন প্রয়োজনীয় ডাটা ডিস্কের ভিন্ন ভিন্ন ট্র্যাকে ছড়ানো-ছিটানো (fragmented) থাকে, তখন রিড/রাইট হেডকে ফিজিক্যালি বারবার জায়গা পরিবর্তন করতে হয় (Seek) এবং সঠিক সেক্টরে না আসা পর্যন্ত ওয়েট করতে হয় (Rotational Latency)।গতি: অত্যন্ত ধীরগতির। 

এতে স্পিন্ডেল মোটরের প্লেটার ঘোরানো এবং মেকানিক্যাল হেডের ছোটাছুটিতে মিলিসেকেন্ড (ms) সময় নষ্ট হয়।

উদাহরণ: অপারেটিং সিস্টেমের হাজার হাজার ছোট ছোট ফাইল বা ডাটাবেজের আলাদা আলাদা রো (row) একযোগে রিড/রাইট করা।

Time cahce show at slider


Now go to outside of devices and come network


প্রধান সারসংক্ষেপ:

১. Same Machine (In-Memory/IPC): ডাটা যদি একই সার্ভারের ক্যাশ বা প্রসেসে থাকে, সময় লাগবে Nanoseconds (ns)।

২. Same Availability Zone (AZ): একই ডাটা সেন্টারের নির্দিষ্ট জোনের দুটি মেশিনের মধ্যে কমিউনিকেশন লেটেন্সি কয়েক Microseconds (μs)।

৩. Same Datacenter / Region (Two Machines): একই ডেটাসেন্টারের আলাদা ক্যাবিনেট/জোনের মেশিনের মধ্যে ডাটা ট্রান্সফারে সময় লাগে ∼100 μs থেকে 1−2 ms।

৪. Across Region (Geographic Distance): ক্লাউডে এক মহাদেশ/রিজিয়ন থেকে অন্য রিজিয়নে (যেমন: US-East থেকে EU-West) নেটওয়ার্ক ট্রিপে ফিজিক্যাল লাইটের স্পিডের সীমাবদ্ধতার কারণে লেটেন্সি 10 ms−100 ms+ পর্যন্ত পৌঁছে যায়।

মূল শিক্ষা: ডাটাবেজ বা সার্ভার কলের ক্ষেত্রে নেটওয়ার্ক রাউন্ড-ট্রিপ সময় অপচয়ের প্রধান কারণ। তাই ইন-মেমোরি ক্যাশিং (Redis/Memcached) এবং ব্যাচিং রিকোয়েস্ট (Batching Requests) প্রয়োগ করে сетевое ওভারহেড কমানো দরকার।



Now matter is IOPS

input output per second

Assume IOPS handle 10,00,00 per sec

per one second = 1 / 10,00,00


System Capacity Planning: Requests Per Second (RPS) Calculation

১. প্রদত্ত ডাটা (Given Parameters)
Active Users (DAU): 1M=1,000,000 জন

Requests per User per Day: 10 টি রিকোয়েস্ট/ইউজার/দিন

Seconds in a Day: 86,400 sec (সহজ হিসাবের জন্য রাউন্ড ফিগার: ≈100,000 sec)

২. দৈনিক মোট রিকোয়েস্ট (Total Daily Requests)

Total Requests/Day=Users×Requests per User
Total Requests/Day=1,000,000×10=10,000,000 (10 Million Requests/Day)
৩. এভারেজ RPS গণনা (Average Requests Per Second)

Average RPS= 
Total Seconds in a Day
Total Requests/Day
​
 
ক. নিখুঁত হিসাব (Exact Calculation - 86,400 seconds)
Average RPS= 
86,400
10,000,000
​
 ≈115.74≈116 req/sec
খ. দ্রুত আনুমানিক হিসাব (Round Figure - 100,000 seconds)
Average RPS= 
100,000
10,000,000
​
 =100 req/sec

 Now traffic is increase 10X 

 then 100 * 10 = 1000

 System Capacity Planning: Storage & Network Bandwidth Estimation:

১. স্টোরেজ হিসাব (Storage Estimation)
প্রদত্ত প্যারামিটার:
Total Active Users: 10M=10,000,000 জন

Metadata Size per User: 10 KB (Text data / User profile / Metadata)

গাণিতিক রূপান্তর (Step-by-step Conversion):
Total Storage=Total Users×Data per User
Total Storage=10,000,000×10 KB=100,000,000 KB
Kilobytes (KB) → Megabytes (MB):

1,000
100,000,000 KB
​
 =100,000 MB
Megabytes (MB) → Gigabytes (GB):

1,000
100,000 MB
​
 =100 GB
সারসংক্ষেপ: ১০ মিলিয়ন ইউজারের কেবল টেক্সট বা মেটাডাটা সংরক্ষণের জন্য ন্যূনতম 100 GB পারসিস্টেন্ট ডেটাবেজ স্টোরেজ লাগবে।

২. নেটওয়ার্ক ব্যান্ডউইথ ও ডেটা ট্রান্সফার (Data Transfer & Bandwidth)
সিস্টেম ডিজাইনে ব্যান্ডউইথ পরিমাপের সময় Bit (b) এবং Byte (B)-এর পার্থক্য মনে রাখা অত্যন্ত জরুরি।

মৌলিক নিয়ম:
1 Byte (B)=8 Bits (b)

নেটওয়ার্ক ব্যান্ডউইথ সাধারণত Bits per second (bps)-এ মাপা হয় (যেমন: 1 Gbps)।

স্টোরেজ এবং ফাইল সাইজ সাধারণত Bytes per second (B/s)-এ হিসেব করা হয়।

1 Gbps ব্যান্ডউইথকে MB/s-এ রূপান্তর:
Gigabits → Megabits:

1 Gbps=1,000 Mbps
Megabits (Mb) → Megabytes (MB):

Transfer Speed= 
8
1,000 Mbps
​
 =125 MB/s

৩. প্র্যাকটিক্যাল সিস্টেম ডিজাইন টেকঅ্যাওয়ে (System Design Takeaway)
যদি একটি সিস্টেমের মোট ডেটা 100 GB হয় এবং নেটওয়ার্ক পাইপলাইন 1 Gbps হয়, তবে সম্পূর্ণ ডেটা ট্রান্সফার বা নেটওয়ার্ক দিয়ে রিড/রাইট করতে সর্বনিম্ন সময় লাগবে:

Time= 
125 MB/s
100,000 MB
​
 =800 Seconds≈13.3 Minutes


 Now i have Image Upload Services

 Users is 10 millons
 and 1Image / user / day
 Average Image = 2 MB

 Storage Allocated

 Daily storage = 10 M * 1 * image * 2 MB (image size)

 = 20 TB / day

 1years database = 20 TB * 365

 = 7300 TB

 = 7.3 PB

 Object Storage => S3

 Memorise

 1s = 10^3 ms = 10^6 micro = 10^9 neno second

 RAM = 10-100ns

 NVMe SSD = 10s - 100s micro s

 HDD = milisecond

 1Gbps = 125MB/s

 1GB = 8Gb

 1days = 86400 sec

 99% = 3.65 Days


Rule 1: অনাবশ্যক নেটওয়ার্ক কল কমানো (Minimize Unnecessary Network Calls)মূল কথা: সবচেয়ে দ্রুত নেটওয়ার্ক কল হলো সেই কলটি, যেটি আপনাকে করতেই হয় না।ব্যাখ্যা: প্রতিটি নেটওয়ার্ক কলের পেছনে TCP/TLS হ্যান্ডশেক, DNS লুকআপ এবং প্রসেসিং টাইম যুক্ত থাকে। নেটওয়ার্ক কল যত কমবে, Latency (দেরি) তত কমবে এবং অ্যাপ্লিকেশন তত ফাস্ট হবে।বাস্তব উদাহরণ: প্রতিবার পেজ লোড বা ডেটা চাওয়ার সময় ডাটাবেজ বা রিমোট এপিআই-এ হিট না করে ক্লায়েন্ট সাইড বা ইন-মেমোরি ক্যাশ (যেমন: Redis) ব্যবহার করা।


Rule 2: সিপিইউ-এর কাছাকাছি ডেটা রাখা (Data Locality)মূল কথা: ডেটা প্রসেসরের (CPU) যত কাছে থাকবে, রিড/রাইট স্পিড তত বেশি হবে এবং ল্যাটেন্সি তত কমবে।মেমোরি ট্রাভার্সাল স্পিড (সবচেয়ে দ্রুত থেকে ধীরগতির ক্রম):$$\text{CPU Cache (L1/L2/L3)} \longrightarrow \text{RAM} \longrightarrow \text{SSD / Disk} \longrightarrow \text{Network}$$ব্যাখ্যা:CPU ক্যাশ থেকে ডেটা পড়তে সময় লাগে Nanoseconds (ns)।RAM থেকে পড়তে সময় লাগে Tens of nanoseconds।SSD/Hard Disk থেকে পড়তে সময় লাগে Microseconds (µs) থেকে Milliseconds (ms)।Network পেরিয়ে রিমোট সার্ভার থেকে আনতে সময় লাগে Milliseconds (ms) বা তার বেশি।প্র্যাকটিক্যাল আর্কিটেকচার: বারবার ব্যবহৃত হয় এমন হট ডেটা (Hot Data) ডিস্ক বা নেটওয়ার্ক থেকে না এনে অ্যাপ্লিকেশনের RAM বা Redis / In-memory cache-এ রাখলে ল্যাটেন্সি শতগুণ কমে যায়।


Rule 3: ব্যাচিং প্রসেসিং (Batch Processing Over Tiny Requests)মূল কথা: ১০০টি ছোট ছোট রিকোয়েস্ট আলাদাভাবে পাঠানোর চেয়ে ১টি বড় ব্যাচ রিকোয়েস্ট পাঠানো অনেক বেশি দ্রুত ও সাশ্রয়ী।ব্যাখ্যা: প্রতিটি নেটওয়ার্ক রিকোয়েস্টে নির্দিষ্ট পরিমাণ অতিরিক্ত ওভারহেড (Network Overhead, Packet Headers, Connection Setup) থাকে। আপনি ১০০টি আলাদা রিকোয়েস্ট পাঠালে ১০০ বার এই ওভারহেড যোগ হয়। কিন্তু ব্যাচিং করলে ওভারহেড একবারই হয়।বাস্তব উদাহরণ:খারাপ পদ্ধতি (Loop Queries): লুপ চালিয়ে ডাটাবেজে ১০০ বার SELECT * FROM users WHERE id = X কল করা।ব্যাচিং পদ্ধতি (Single Query): একবারে SELECT * FROM users WHERE id IN (1, 2, ..., 100) কল করা।

Rule 4: ব্যান্ডউইথ ও ল্যাটেন্সির সম্পর্ক (Bandwidth vs. Latency)মূল কথা: ব্যান্ডউইথ (Bandwidth) বেশি মানেই ল্যাটেন্সি (Latency) কম—এমনটা ভাবা ভুল। সিস্টেম পারফরম্যান্সের জন্য এই দুটির পার্থক্য বোঝা জরুরি।

সংজ্ঞা:Latency (ল্যাটেন্সি): ১টি ডেটা প্যাকেট উৎস থেকে গন্তব্যে পৌঁছাতে কত সময় লাগে (Time taken)।

Bandwidth (ব্যান্ডউইথ): নির্দিষ্ট সময়ে নেটওয়ার্ক দিয়ে কত পরিমাণ ডেটা পাস হতে পারে (Capacity)।সহজ উদাহরণ: একটি বিশাল পাইপলাইন দিয়ে আপনি একবারে প্রচুর পানি পাঠাতে পারেন (High Bandwidth), কিন্তু পানি পাইপের এক প্রান্ত থেকে অন্য প্রান্তে পৌঁছাতে যদি ১০ সেকেন্ড সময় লাগে, তবে তার ল্যাটেন্সি হলো ১০ সেকেন্ড। ফাইল সাইজ কমানো (Gzip Compression, WebP formats) এবং ডেটা প্যাকেট সাইজ ছোট রাখা ব্যান্ডউইথ ও ল্যাটেন্সি দুটোতেই সাহায্য করে।

Rule 5: এভারেজ ট্রাফিক বনাম পিক ট্রাফিক (Average Traffic vs. Peak Traffic)মূল কথা: আপনার সিস্টেমের আর্কিটেকচার ও রিসোর্স ক্যাপাসিটি Average Traffic দেখে ডিজাইন করবেন না, সবসময় Peak Traffic বিবেচনা করে ডিজাইন করতে হবে।ব্যাখ্যা:Average Traffic: সারাদিনে গড়ে কত রিকোয়েস্ট আসে (যেমন: সারাদিনের গড় ১০,০০০ TPS)।Peak Traffic: বিশেষ কোনো সময়ে বা স্পাইকে (Spike) সর্বোচ্চ কত রিকোয়েস্ট আঘাত করে (যেমন: ফ্ল্যাশ সেল বা ইভেন্টের সময় ৫০,০০০ TPS)।কেন জরুরি: এভারেজ ট্রাফিকের ওপর ভিত্তি করে সার্ভার বা থ্রেড পুল কনফিগার করলে পিক আওয়ারে অতিরিক্ত লোডের কারণে রিকোয়েস্ট কিউ (Queue) হয়ে যাবে, ল্যাটেন্সি মারাত্মক বেড়ে যাবে এবং সার্ভার ডাউন হয়ে যাবে। সিস্টেমকে সবসময় পিক লোডের ৩ গুণ থেকে ৫ গুণ বেশি সহনশীল করে ডিজাইন করতে হয় (Autoscaling, Rate Limiting, Load Balancing এর মাধ্যমে)।


Rule 6: always estimation math