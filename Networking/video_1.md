
# 1. what is host

any devices which sends or recieve trafic

# 2. what is repeater

Repeater হলো এমন একটি network device, যেটা দুর্বল হয়ে যাওয়া network signal-কে আবার শক্তিশালী করে সামনে পাঠায়, যাতে signal আরও দূরে যেতে পারে।

সহজভাবে:

Sender → দুর্বল Signal → Repeater → শক্তিশালী Signal → Receiver

উদাহরণ

ধরো, তোমার Wi-Fi router থেকে ২০ মিটার দূরে গেলে signal খুব দুর্বল হয়ে যায়। সেখানে একটি Wi-Fi repeater/extender রাখলে:

Router 📡 → Repeater 📶 → তোমার Device 💻

Repeater router-এর signal গ্রহণ করে এবং আবার transmit করে, ফলে Wi-Fi coverage বাড়ে।

গুরুত্বপূর্ণ
Repeater সাধারণত OSI Layer 1 (Physical Layer)-এ কাজ করে।
এটি মূলত signal regenerate/repeat করে।
এটি নিজে থেকে routing বা IP address নিয়ে সিদ্ধান্ত নেয় না।
Repeater ≠ Router — Router network-এর মধ্যে traffic route করে, কিন্তু repeater মূলত signal extend করে।

এক লাইনে:
👉 Repeater = Network signal-এর range বাড়ানোর device।

# what is hub 

Hub

Hub হলো একটি networking device, যা একাধিক device-কে connect করে।

Features:

OSI Layer 1
Data সব port-এ পাঠায়
MAC address ব্যবহার করে না
Collision বেশি হয়
Simple ও কম efficient
বর্তমানে Switch বেশি ব্যবহৃত হয়

# what is switch

Switch

Switch হলো এমন একটি networking device, যা একাধিক device connect করে এবং সঠিক device-এর কাছে data পাঠায়।

Features:

OSI Layer 2 (Data Link)
MAC address ব্যবহার করে
নির্দিষ্ট port-এ data পাঠায়
Collision কম
Hub-এর চেয়ে efficient
PC1 ─┐
PC2 ─┤
PC3 ─┼── Switch
PC4 ─┘


PC1 → Switch → PC3 ✅

👉 Switch = Data → Specific Device


Router

Router হলো এমন একটি networking device, যা দুই বা তার বেশি আলাদা network-এর মধ্যে data পাঠায়।

Features:

OSI Layer 3 (Network Layer)
IP address ব্যবহার করে
Different network connect করে
Best path নির্বাচন করে
Internet access দিতে পারে
Local Network
PC ── Switch ── Router ── Internet
                 │
             IP Address

👉 Router = IP address দেখে কোন network-এ data যাবে তা ঠিক করে।

# what is bridge

Bridge

Bridge হলো একটি networking device, যা দুইটি network segment-কে connect করে এবং MAC address দেখে data forward করে।

Features:

OSI Layer 2 (Data Link)
MAC address ব্যবহার করে
দুইটি network segment connect করে
অপ্রয়োজনীয় traffic কমায়
Switch-এর মতো কাজ করে, তবে সাধারণত কম port থাকে
Network A ─── Bridge ─── Network B
   PC1                    PC3
   PC2                    PC4

👉 Bridge = দুইটি network segment connect + MAC দেখে data পাঠায়।