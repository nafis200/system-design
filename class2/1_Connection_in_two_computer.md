
# 1 Connection two computer

Client ↔ Server Connection

1. https://example.com
Step 1 — DNS Lookup

প্রথমে Browser জানতে চায়:

example.com
      ↓
কোন IP?

DNS lookup করে পাওয়া গেল:

example.com
      ↓
93.184.216.34

এখন Client জানে:

Server IP = 93.184.216.34
Port      = 443

কারণ HTTPS সাধারণত port 443 ব্যবহার করে।

Client এখন বলে:

"ঠিক আছে, এখন আমি 93.184.216.34:443-এর সাথে TCP connection বানাব।"

Step 2 — TCP 3-Way Handshake

TCP = Transmission Control Protocol

এখন TCP connection তৈরি হবে।

Client                                  Server
  │                                      │
  │──────────── SYN ───────────────────►│
  │                                      │
  │◄────────── SYN + ACK ───────────────│
  │                                      │
  │──────────── ACK ───────────────────►│
  │                                      │
  │        TCP Connection Established    │
৩টি ধাপের সহজ অর্থ
1. SYN — Synchronize

"আমি কানেক্ট হতে চাই, এই নাও আমার sequence number."

2. SYN-ACK — Synchronize + Acknowledgment

"আমি তোমার request পেয়েছি (ACK), এবং আমিও connection-এর জন্য প্রস্তুত। এই নাও আমার sequence number (SYN)."

3. ACK — Acknowledgment

"আমি তোমার response পেয়েছি। এখন TCP connection established."

SYN
 ↓
SYN + ACK
 ↓
ACK
 ↓
✅ TCP Connection Established
Step 3 — TLS Handshake

TLS = Transport Layer Security

TCP connection তৈরি হয়েছে, কিন্তু এখনো communication secure করার জন্য TLS handshake হবে।

TLS-এর প্রধান কাজ:

🔐 1. Encryption

Data এমনভাবে encrypt করা হয় যাতে মাঝখানের কেউ সহজে পড়তে না পারে।

Original:

Hello Server

Network-এর ওপর conceptually:

8fA9$xP2@kL...

Server সেটা decrypt করে:

Hello Server
🔑 2. Shared Secret তৈরি

TLS handshake-এর সময় Diffie-Hellman/ECDHE key exchange ব্যবহার করে Client এবং Server একই shared secret independently তৈরি করতে পারে।

Client                                  Server
  │                                      │
  │──── Public Key Information ────────►│
  │◄─── Public Key Information ─────────│
  │                                      │
  │                                      │
  │  Calculate Shared Secret             │
  │              🔐                      │
  │                                      │
  │       Same Shared Secret             │
  │◄────────────────────────────────────►│

Shared secret সরাসরি network-এর মাধ্যমে পাঠানো হয় না।

তারপর TLS এই secret থেকে session keys তৈরি করে।

Diffie-Hellman
       ↓
Shared Secret
       ↓
Session Keys 🔐
       ↓
Encryption / Decryption


# API call stateLess whole maintain above 

DNS Look up --> TCP + TLS ---> Request ----> Server --> Response.

Just server we can efficient


# 2nd part

while two services communicate between two server 3part is come

1. Latency

Latency = Request পাঠানো থেকে Response পাওয়া পর্যন্ত সময়।

Client                         Server
  │                              │
  │────── Request ──────────────►│
  │                              │
  │          ⏳ Process           │
  │                              │
  │◄────── Response ─────────────│
  │                              │
  └────────── ⏱️ Time ───────────┘

উদাহরণ:

Request  → Server = 50ms
Response → Client = 50ms


Total ≈ 100ms

👉 Latency বেশি = Application slow

সহজভাবে:

"Request পাঠিয়ে response পেতে কত সময় লাগছে?"

2. Partial Failure

Partial Failure = System-এর কোনো একটা অংশ fail করেছে, কিন্তু পুরো system fail করেনি।

Client
  │
  │ Request
  ▼
Network
  │
  X ❌
  │
  ▼
Server

অথবা:

Client
  │
  │ Request
  ▼
Server
  │
  X ❌ Server Down

Client জানে না:

Request Server-এ পৌঁছেছিল?    ❓
Server process করেছিল?        ❓
Response পাঠিয়েছিল?           ❓

তাই দরকার:

Timeout
   +
Retry
   +
Error Handling

সহজভাবে:

"System-এর একটা অংশ নষ্ট হলেও অন্য অংশ চলছে—এটাই Partial Failure."

3. Independence

Independence = Client এবং Server আলাদা component হিসেবে কাজ করে।

┌──────────────┐                  ┌──────────────┐
│    Client    │                  │    Server    │
│              │                  │              │
│   Frontend   │                  │   Backend    │
└──────┬───────┘                  └──────┬───────┘
       │                                 │
       │────── API Request ─────────────►│
       │                                 │
       │◄───── JSON Response ────────────│
       │                                 │

Client-এর ভিতরের code:

Client
  ↓
Change

Server-এর ভিতরের code:

Server
  ↓
Change

দুটো আলাদাভাবে develop/deploy করা যায়, যতক্ষণ API contract ঠিক থাকে।



# 3rd part

1. Fundamental Concepts

IP Address: নেটওয়ার্কে ডিভাইস শনাক্ত করে (Device Address)।

MAC Address: ডিভাইসের Network Interface Card (NIC)-এর স্থায়ী ও অনন্য ভৌতিক পরিচয় (Physical Address)।

Port Number: ডিভাইসের ভেতরে নির্দিষ্ট অ্যাপ্লিকেশন শনাক্ত করে (Application Address)।

Plaintext
Example: 192.0.20.120:5000 
         [  Device IP  ]:[Port]

Summary: IP ডেটাকে সঠিক কম্পিউটারে পৌঁছে দেয়, আর Port Number সেই ডেটাকে সঠিক অ্যাপে (যেমন: WhatsApp, Zoom, Chrome) পাঠায়।

network address same : 192.01.12.255

whatsapp port = 100
zoom port = 200
youtube port = 300

while add port then res come he understand which app go response

2. OSI Model: Layer Breakdown
Plaintext
+-----------------------------------------------------------+
| Layer 7: Application  │ HTTP, DNS  │ "কী Service চাই?"     |
| Layer 6: Presentation │ Encryption │ Data formatting & JSON|
| Layer 5: Session      │ Auth/Sync  │ Session Management   |
+-----------------------------------------------------------+
| Layer 4: Transport    │ TCP/UDP    │ Port Numbers & Segments|
| Layer 3: Network      │ IP         │ Source & Destination IP|
| Layer 2: Data Link    │ MAC        │ Frame & Hardware Addressing
| Layer 1: Physical     │ Bits (0/1) │ Cable, Wi-Fi, Signals |
+-----------------------------------------------------------+
3. Data Flow (Sending & Receiving)
Sender Side (Top-to-Bottom / Encapsulation)
Application (L7): Chrome থেকে HTTP Request তৈরি হয়।

Presentation (L6): JSON ডেটা UTF-8 Encoding এবং HTTPS Encryption-এর মাধ্যমে Bytes-এ রূপান্তর হয়।

Session (L5): Server-এর সাথে Connection Session হ্যান্ডেল হয়।

Transport (L4): Source Port ও Destination Port যুক্ত হয়ে Segment তৈরি হয়।

Network (L3): Source IP ও Destination IP যুক্ত হয়ে Packet তৈরি হয়।

Data Link (L2): MAC Address যুক্ত হয়ে Frame তৈরি হয়।

Physical (L1): ডেটা Binary (0101)-এ রূপান্তরিত হয়ে Wi-Fi বা Cable দিয়ে বের হয়।

# 4th part