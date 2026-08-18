
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


২. Memory Allocation & Process Flow (User Space to Kernel to Hardware)
ডেটা যখন অ্যাপ থেকে বের হয়ে নেটওয়ার্কে যায়, তখন মেমোরি ব্যবহারের ৩টি অঞ্চল পার হতে হয়:

Plaintext
+-------------------------------------------------------------------------+
| [ USER SPACE (RAM) ]   │ L7 (App) -> L6 (Presentation) -> L5 (Session)  |
+-------------------------------------------------------------------------+
| [ KERNEL SPACE (RAM) ] │ L4 (Transport / TCP Chunking) -> L3 (Network)  |
+-------------------------------------------------------------------------+
| [ HARDWARE (NIC) ]     │ L2 (Data Link / MAC) -> L1 (Physical / Bits)   |
+-------------------------------------------------------------------------+
User Space (App RAM):

Application, Presentation & Session (L7, L6, L5): এগুলো অ্যাপ্লিকেশনের নিজ মেমোরিতে (RAM) চলে। ব্রাউজার বা অ্যাপ মূল ডেটা (যেমন: ১ MB-এর একটি JSON বা ছবি) তৈরি করে, Encod/Encrypt করে এবং সেশন শুরু করে।

Kernel Space (OS RAM):

Transport Layer (L4): অপারেটিং সিস্টেমের Kernel বড় ডেটাটিকে ছোট ছোট টুকরো (Chunks/Segments)-এ ভাগ করে। প্রতি টুকরোতে Source Port, Destination Port এবং Sequence Number বসায়।

Network Layer (L3): Kernel প্রতিটি Segment-এর সাথে IP Address যুক্ত করে Packet বানায় এবং Routing পথ ঠিক করে।

Hardware Level (NIC Buffer):

Data Link & Physical (L2, L1): Kernel পুরো Packet-টি Network Interface Card (NIC/Wi-Fi Chip)-এর বাফারে পাঠিয়ে দেয়। NIC তাতে MAC Address সিল মেরে Binary Bits (0101) হিসেবে বাতাসে বা কেবলে ছেড়ে দেয়।

৩. Step-by-Step Chunking & Sequencing Example
ধরো, তুমি ১ megabyte-এর একটি JSON ফাইল পাঠাচ্ছ। ১ MB একবারে পাঠানো সম্ভব নয়, তাই OS Kernel এটিকে ছোট ছোট টুকরোতে ভাগ করে:

Plaintext
Original Data (1 MB)  --->  [Chunk 1] [Chunk 2] [Chunk 3] [Chunk 4] [Chunk 5]
১. Chunking at Transport Layer (L4)
Kernel প্রতিটি Chunks-কে Segment বানায় এবং একই পোর্ট ও পর্যায়ক্রমিক Sequence Number দেয়:

Segment 1: Port: 443 | Seq: 101

Segment 2: Port: 443 | Seq: 102

Segment 3: Port: 443 | Seq: 103

২. Packaging at Network Layer (L3)
প্রতিটি Segment-এর সাথে IP বসে Packet তৈরি হয়:

Packet 1: IP: 142.250.190.46 | Port: 443 | Seq: 101

৩. Frame & Bits (L2 & L1)
NIC চিপের মাধ্যমে MAC যুক্ত হয়ে Frame তৈরি হয় এবং কেবল/Wi-Fi দিয়ে বের হয়ে যায়।

৪. Server Reassembly (গন্তব্যে পৌঁছানো)
ইন্টারনেটের রাউটিংয়ের কারণে টুকরোগুলো যদি সার্ভারে অগোছালো হয়েও পৌঁছায় (যেমন: Seq 102 আগে এলো, Seq 101 পরে এলো), সার্ভারের OS Kernel Port Number দেখে চিনে নেয় এটা কোন অ্যাপের ডাটা এবং Sequence Number (101, 102, 103) দেখে সেগুলোকে আবার আগের মতো ১ MB ফাইলে জোড়া লাগিয়ে অ্যাপকে দেয়।

# 4th part

TCP and UDP

TCP maintain consistency
UDP not maintain consistency

server and client comunication medium must be same

TCP --> UDP not connect each others

TCP chunk

how many chunk which chunk number am i 


total 3 chunk

1 3      2  3      3 3

UDP  not chunk


public ip : which is unique globally

private ip : router inside ip are unique but same ip diffrent router