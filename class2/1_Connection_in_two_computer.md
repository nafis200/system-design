
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

OSI Model

7 Application  Http Dns  (important)
6 presentation 
5 Session
4 Transport      (important)
3 Network - IP  (important)
2 Data link
1 physical  (binary data exists)

┌─────────────────────────────────────────────┐
│ 7️⃣ APPLICATION                             │
│    HTTP, DNS                                │
│    → Application-এর communication          │
├─────────────────────────────────────────────┤
│ 6️⃣ PRESENTATION                            │
│    Format, Encoding, Compression            │
│    Encryption*                              │
│    → Data কীভাবে represent হবে             │
├─────────────────────────────────────────────┤
│ 5️⃣ SESSION                                  │
│    Session Management                       │
│    → Communication session manage করা      │
├─────────────────────────────────────────────┤
│ 4️⃣ TRANSPORT ⭐                            │
│    TCP, UDP                                 │
│    → End-to-End data transport              │
├─────────────────────────────────────────────┤
│ 3️⃣ NETWORK ⭐                              │
│    IP                                       │
│    → কোন network/device-এর দিকে যাবে       │
├─────────────────────────────────────────────┤
│ 2️⃣ DATA LINK                               │
│    Ethernet, Wi-Fi, MAC                     │
│    → Local device ↔ device                 │
├─────────────────────────────────────────────┤
│ 1️⃣ PHYSICAL                                │
│    Bits / Signals                           │
│    → Actual signal transmission             │
│      Cable / Fiber / Radio                  │
└─────────────────────────────────────────────┘


7  Application   → কী communicate করছি?
6  Presentation  → Data কীভাবে represent হবে?
5  Session       → Session কীভাবে manage হবে?
4  Transport     → TCP/UDP দিয়ে কীভাবে deliver হবে?
3  Network       → IP দিয়ে কোথায় যাবে?
2  Data Link     → Local-এ কোন device? (MAC)
1  Physical      → আসল signal কীভাবে যাবে?