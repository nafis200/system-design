💻 Distributed Database & Consistency Model (কনসিস্টেন্সি মডেল)
একটি ডিস্ট্রিবিউটেড ডাটাবেস সিস্টেমে একাধিক সার্ভারে ডাটা কপি বা রেপ্লিকা (Replica) হিসেবে সংরক্ষণ করা হয়। ফেসবুক, অ্যামাজনের মতো বড় বড় প্ল্যাটফর্মগুলো পারফরম্যান্স ভালো রাখার জন্য এই পদ্ধতি ব্যবহার করে।

১. মাস্টার ডাটাবেস ও রেপ্লিকা মডেল (Architecture)
যখন সিস্টেমে ডাটা লেখা (Write) হয়, তখন তা Master Database-এ আপডেট হয়। এরপর Master ডাটাবেস থেকে Replica ডাটাবেসগুলোতে ডাটা কপি বা Replication হয়। ব্যবহারকারীরা যখন ডাটা পড়ে (Read), তখন লোড কমানোর জন্য রেপ্লিকাগুলো থেকে পড়া হয়।

Plaintext
               +----------------------+
               |   Master Database    |
               | (Write Operation)    |
               +----------+-----------+
                          |
            +-------------+-------------+
            |      Data Replication     |
            v                           v
   +-----------------+         +-----------------+
   |   Replica 1     |         |   Replica 2     |
   | (Read Only DB)  |         | (Read Only DB)  |
   +-----------------+         +-----------------+
২. কনসিস্টেন্সি সমস্যা ও উদাহরণ (Balance Update Scenario)
ডাটাবেসে ডাটাSync বা Syncronization হতে কিছু সময় লাগে। এই সময়ের কারণে সিস্টেমে Inconsistent Data দেখা যেতে পারে।

উদাহরণ:

আপনার অ্যাকাউন্টে ব্যালেন্স আছে: $100

আপনি $10 কেনাকাটা বা পেমেন্ট করলেন ($100 - $10 = $90)।

Master DB-তে সাথে সাথে ব্যালেন্স $90 হয়ে যায়।

কিন্তু রেপ্লিকা ডাটাবেসগুলোতে ডাটা পৌঁছাতে কয়েক মিলিসেকেন্ড থেকে কয়েক সেকেন্ড সময় (Replication Lag) লাগতে পারে।

Plaintext
                 [ Master DB ] 
             Updated Balance: $90
                      |
        +-------------+-------------+
        | Delay / Replication Time  |
        v                           v
  [ Replica 1 ]               [ Replica 2 ]
  Balance: $100               Balance: $100
 (Inconsistent)              (Inconsistent)
ফলাফল: Master DB আপডেট হলেও যদি কোনো ব্যবহারকারী ওই মুহূর্তেই Replica 1 থেকে ব্যালেন্স চেক করে, তবে সে এখনো $100 দেখতে পাবে। কিছুক্ষণ পর যখনSync শেষ হবে, তখন সব সার্ভারে $90 (Strong Consistency / Real-time Actual Value) দেখাবে।

সবসময় Real-time / Strong Consistency দিতে গেলে: ডাটাবেস ব্লক হয়ে থাকবে, লেটেন্সি বেড়ে যাবে এবং সিস্টেম ডাউন বা Fail হওয়ার ঝুঁকি থাকবে।


৩. Distributed System কেন ব্যবহার করব? (Advantages)


High Availability (উচ্চ প্রাপ্যতা): কোনো একটি সার্ভার বন্ধ থাকলেও অন্য সার্ভার চালু থাকে।

Better Performance (উন্নত পারফরম্যান্স): একসাথে হাজার হাজার ইউজার ডাটা রিড-রাইট করতে পারে।

Fault Tolerance (ত্রুটি সহনশীলতা): মাস্টার বা কোনো রেপ্লিকা ক্র্যাশ করলেও অন্য রেপ্লিকা ডাটা রক্ষা করে এবং কাজ চালিয়ে নেয়।

Lower Latency (কম সময় লাগা): ইউজারের কাছাকাছি লোকেশনের সার্ভার থেকে দ্রুত ডাটা রিড করা যায়।

Scalability (প্রসারণযোগ্যতা): ট্রাফিক বাড়লে নতুন ডাটাবেস সার্ভার সহজেই যোগ করা যায়।

৪. Distributed System-এর চ্যালেঞ্জ ও অসুবিধা (Drawbacks)
Time Lag (সময় লাগা): সব রেপ্লিকাতে ডাটা সিঙ্ক হতে কিছু সময় নেয়।

Higher Latency in Writes: সব কুপিতে ডাটা আপডেট সুনিশ্চিত করতে গেলে রাইট করার গতি কমে যায়।

More Network Communication: সার্ভারগুলোর মধ্যে সার্বক্ষণিক ডেটা আদান-প্রদান করতে হয়।

More Complexity: সিস্টেম ডিজাইন ও আর্কিটেকচার ম্যানেজ করা জটিল।





৫. Failover Mechanism (সার্ভার ক্র্যাশ করলে কী হয়?)
ডিস্ট্রিবিউটেড সিস্টেমে সার্ভার ডাউন হলে সিস্টেম নিজে থেকেই তা রিকভার করে:

Scenario A: রেপ্লিকা ক্র্যাশ করলে
Plaintext
  [ Master DB ] ----(OK)----> [ Replica 1 ] (Crash ❌)
       |
       +--------(OK)--------> [ Replica 2 ] (Working ✅)
সমাধান: রেপ্লিকা ১ ক্র্যাশ করলে ইউজারদের রিড রিকোয়েস্ট রেপ্লিকা ২-তে পাঠানো হয়। সিস্টেম স্বাভাবিক থাকে।

Scenario B: মাস্টার ডাটাবেস ক্র্যাশ করলে (Master Failover)
Plaintext
  [ Master DB ] (Crash ❌) 
       |
       v  (Elections / Automatic Promotion)
  +---------------+
  |  Replica 1    |  --->  Promoted to New [ Master DB ] (Working ✅)
  +---------------+
সমাধান: মেন মাস্টার ডাটাবেস ক্র্যাশ করলে রেপ্লিকাগুলোর মধ্যে থেকে একটি রেপ্লিকাকে স্বয়ংক্রিয়ভাবে নতুন Master Database বানিয়ে দেওয়া হয় এবং সিস্টেম রানিং রাখা হয়।

মূল কথা: ডিস্ট্রিবিউটেড সিস্টেমে সম্পূর্ণ ভুল বা সঠিক বলে কিছু নেই; এটি মূলত Performance/Availability এবং Consistency-এর মধ্যে একটি সঠিক ভারসাম্য (Trade-off) তৈরি করার প্রযুক্তি।



Distributed system one server is node


Consistency Models & CAP Theorem Overview
ডিস্ট্রিবিউটেড ডাটাবেজ সিস্টেমে ডাটা সিঙ্ক্রোনাইজেশন এবং নেটওয়ার্ক বিভ্রাট সামলানোর জন্য এই কনসেপ্টগুলো ব্যবহার করা হয়।

1. Consistency Models (কনসিস্টেন্সি মডেলসমূহ)
Strong Consistency: ডাটা রাইট হওয়ার সাথে সাথেই সব নোডে একসাথে আপডেট হয়ে যায়। যেকোনো ক্লায়েন্ট যেকোনো সময় ডাটা রিড করলে সবসময় একদম লেটেস্ট/নতুন ডাটা পাবে। Latency কিছুটা বেশি হলেও ডাটার নির্ভুলতা ১০০%।

Eventual Consistency: ডাটা রাইট হওয়ার পর সব নোডে তাৎক্ষণিক সিঙ্ক হয় না। সিস্টেমে নতুন আপডেট না আসলে কিছু সময় পর (Eventually) সব নোড কনসিস্টেন্ট হয়। এর Latency কম এবং Availability অনেক বেশি, তবে মাঝে কিছুক্ষণের জন্য পুরানো (Stale) ডাটা দেখা যেতে পারে।

Read-Your-Writes Consistency: এটি Eventual Consistency-র একটি বিশেষ রূপ। যে ইউজার ডাটা আপডেট করেছেন, তিনি রিফ্রেশ করলে সবসময় নিজের লেটেস্ট আপডেট করা ডাটা দেখতে পাবেন (অন্য ইউজাররা সিঙ্ক না হওয়া পর্যন্ত পুরানো ডাটা দেখলেও)।


CAP Theorm:

CAP = consistency, availablity, pertition tolerance


When a network partiotion happens a distribute system must choose betwenn consistency and availability
