
# REST and gRpc


REST is application layer protocol.
    
          JSON
client <--------> server


# REST API drawback

1. Complex filter are distrub


QUERY   N + 1 


# Graphql 

frontend can dynamic sent data for different schema


হ্যাঁ, frontend থেকে different schema অনুযায়ী dynamic data পাঠানো যায়। এটা GET, POST—দুই ক্ষেত্রেই সম্ভব, তবে POST body-তে dynamic structure পাঠানো বেশি flexible।

ধরো তোমার backend-এ বিভিন্ন type অনুযায়ী schema আলাদা:

type: "product"
{
  name,
  price,
  category
}

আবার:

type: "service"
{
  title,
  hourlyRate,
  duration
}

graphql has not cahcing


# When we use graphql and when not



# gRpc (using Binary) name proto buffer

Service to service client

API Gateway --> order
|                 | 
|                 |
|                 |
products         payments


Server-sent Events (SSE) Oneway
Websockets  Two-way
webRTC  peer to peer